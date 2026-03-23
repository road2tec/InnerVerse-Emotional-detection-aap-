"""
Phase 5 Facial Emotion Detection Service
==========================================
Pipeline:
  1.  Receive image bytes (JPEG / PNG from React Native camera)
  2.  Decode with OpenCV
  3.  Detect face(s) using Haar Cascade frontal-face detector
  4.  Crop & preprocess the largest detected face:
        • Grayscale → resize to 48×48 (FER2013 input size)
        • Normalize to [0, 1]
  5.  Run CNN emotion classifier in priority order:
      a) Custom Keras model (user-trained)
      b) DeepFace (FER2013 pretrained)
      c) Custom PyTorch model
      d) Rule-based pixel-statistics fallback (demo quality)
  6.  Return { emotion, confidence, all_emotions, face_detected, bbox }

Phase 5 Emotion Labels (FER2013 subset + spec):
  happy · sad · angry · surprise · neutral

FER2013 full label set (7 classes):
  0 Angry  1 Disgust  2 Fear  3 Happy  4 Sad  5 Surprise  6 Neutral
We keep: angry, happy, sad, surprise, neutral  (map disgust→angry, fear→neutral)
"""

import io
import logging
import os
from typing import Dict, List, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Phase 5 emotion labels (per spec)
PHASE5_EMOTIONS: List[str] = ["happy", "sad", "angry", "surprise", "neutral"]

# FER2013 full label set → Phase 5 mapping
_FER2013_TO_PHASE5: Dict[str, str] = {
    "angry":    "angry",
    "anger":    "angry",
    "disgust":  "angry",      # map disgust → angry (closest Phase 5 label)
    "fear":     "neutral",    # map fear → neutral (not in Phase 5 spec)
    "fearful":  "neutral",
    "happy":    "happy",
    "happiness": "happy",
    "joy":      "happy",
    "sad":      "sad",
    "sadness":  "sad",
    "surprise": "surprise",
    "surprised": "surprise",
    "neutral":  "neutral",
}

# FER2013 class index → label
_FER2013_IDX_TO_LABEL = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]

# Path to optional pre-saved Keras/PyTorch model
_KERAS_MODEL_CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "dataset", "face emotion.h5"),
    os.path.join(os.path.dirname(__file__), "..", "ml_models", "fer2013_model.h5"),
]
_PYTORCH_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "fer2013_model.pt")

_keras_model = None
_keras_model_loaded_path = None
_pytorch_model = None


# ─── Face Detection ────────────────────────────────────────────────────────────

def _detect_faces(gray: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detect faces using Haar Cascade.
    Returns list of (x, y, w, h) bounding boxes sorted by area (largest first).
    """
    import cv2
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=7,
        minSize=(60, 60),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )

    if len(faces) == 0:
        # Retry with slightly more lenient params but still filter noise
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=5,
            minSize=(48, 48),
        )

    if len(faces) == 0:
        return []

    # Sort by area descending (largest face = primary subject)
    faces_list = [(x, y, w, h) for (x, y, w, h) in faces]
    return sorted(faces_list, key=lambda f: f[2] * f[3], reverse=True)


def _preprocess_face(gray: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
    """Crop face ROI and preprocess to FER2013 input format (48×48, normalized)."""
    import cv2
    x, y, w, h = bbox
    # Add 10% padding around detected region
    pad = int(min(w, h) * 0.1)
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(gray.shape[1], x + w + pad)
    y2 = min(gray.shape[0], y + h + pad)
    roi = gray[y1:y2, x1:x2]
    face_48 = cv2.resize(roi, (48, 48), interpolation=cv2.INTER_AREA)
    return face_48.astype(np.float32) / 255.0  # normalize to [0,1]


# ─── Classifier Loaders ────────────────────────────────────────────────────────

def _load_keras_model():
    global _keras_model, _keras_model_loaded_path
    if _keras_model is not None:
        return _keras_model

    for candidate in _KERAS_MODEL_CANDIDATE_PATHS:
        path = os.path.abspath(candidate)
        if not os.path.exists(path):
            continue
        try:
            import tensorflow as tf     # noqa: F401
            from tensorflow import keras
            _keras_model = keras.models.load_model(path)
            _keras_model_loaded_path = path
            logger.info(f"✅ Keras face-emotion model loaded from {path}")
            return _keras_model
        except Exception as exc:
            logger.warning(f"Keras model load failed for {path}: {exc}")
    return None


def _load_pytorch_model():
    global _pytorch_model
    if _pytorch_model is not None:
        return _pytorch_model
    path = os.path.abspath(_PYTORCH_MODEL_PATH)
    if os.path.exists(path):
        try:
            import torch
            _pytorch_model = torch.load(path, map_location="cpu")
            _pytorch_model.eval()
            logger.info(f"✅ FER2013 PyTorch model loaded from {path}")
            return _pytorch_model
        except Exception as exc:
            logger.warning(f"PyTorch model load failed: {exc}")
    return None


# ─── Inference Methods ─────────────────────────────────────────────────────────

def _infer_deepface(img_bgr: np.ndarray) -> Optional[Dict]:
    """Try DeepFace — uses FER2013-pretrained model internally."""
    try:
        from deepface import DeepFace
        result = DeepFace.analyze(
            img_bgr,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        if isinstance(result, list):
            result = result[0]

        dominant = result.get("dominant_emotion", "neutral").lower()
        raw_emotions: Dict[str, float] = {
            k.lower(): round(v / 100.0, 4)
            for k, v in result.get("emotion", {}).items()
        }

        # Remap to Phase 5 labels
        mapped = _remap_to_phase5(raw_emotions)
        dominant_phase5 = _FER2013_TO_PHASE5.get(dominant, "neutral")
        return {
            "emotion": dominant_phase5,
            "confidence": mapped.get(dominant_phase5, 0.6),
            "all_emotions": mapped,
            "model_used": "deepface",
        }
    except ImportError:
        return None
    except Exception as exc:
        logger.warning(f"DeepFace inference failed: {exc}")
        return None


def _infer_keras(face_48: np.ndarray) -> Optional[Dict]:
    """Run FER2013 Keras CNN on preprocessed 48×48 face."""
    model = _load_keras_model()
    if model is None:
        return None
    try:
        x = face_48.reshape(1, 48, 48, 1)       # grayscale channel
        proba = model.predict(x, verbose=0)[0]
        probs_raw = {_FER2013_IDX_TO_LABEL[i]: round(float(p), 4) for i, p in enumerate(proba)}
        mapped = _remap_to_phase5(probs_raw)
        primary = max(mapped, key=mapped.get)
        model_name = f"keras-custom:{os.path.basename(_keras_model_loaded_path)}" if _keras_model_loaded_path else "keras-custom"
        return {"emotion": primary, "confidence": mapped[primary], "all_emotions": mapped, "model_used": model_name}
    except Exception as exc:
        logger.warning(f"Keras inference failed: {exc}")
        return None


def _infer_pytorch(face_48: np.ndarray) -> Optional[Dict]:
    """Run FER2013 PyTorch CNN on preprocessed 48×48 face."""
    model = _load_pytorch_model()
    if model is None:
        return None
    try:
        import torch
        import torch.nn.functional as F
        x = torch.tensor(face_48).unsqueeze(0).unsqueeze(0)   # (1,1,48,48)
        with torch.no_grad():
            logits = model(x)
            proba = F.softmax(logits, dim=1)[0].numpy()
        probs_raw = {_FER2013_IDX_TO_LABEL[i]: round(float(p), 4) for i, p in enumerate(proba)}
        mapped = _remap_to_phase5(probs_raw)
        primary = max(mapped, key=mapped.get)
        return {"emotion": primary, "confidence": mapped[primary], "all_emotions": mapped, "model_used": "pytorch-fer2013"}
    except Exception as exc:
        logger.warning(f"PyTorch inference failed: {exc}")
        return None


def _infer_pixel_rules(face_48: np.ndarray, full_gray: np.ndarray, bbox: Tuple) -> Dict:
    """
    Rule-based fallback using pixel intensity statistics.

    Observations from FER2013:
      - Happy faces: higher mean brightness, moderate std (relaxed muscles)
      - Angry faces: lower mean, higher std (furrowed brows create contrast)
      - Sad faces: low mean brightness, low std (drooping features)
      - Surprised: high std, wide open features create more variation
      - Neutral: moderate everything
    """
    mean_px = float(np.mean(face_48))
    std_px = float(np.std(face_48))

    # Mouth region (lower 30% of face) — key for happy/sad discrimination
    mouth_region = face_48[int(48 * 0.65):]
    mouth_mean = float(np.mean(mouth_region))

    # Brow region (upper 25% of face) — key for angry/surprised
    brow_region = face_48[:int(48 * 0.25)]
    brow_std = float(np.std(brow_region))

    scores: Dict[str, float] = {e: 0.0 for e in PHASE5_EMOTIONS}

    # Happy: bright face, bright mouth (smiling)
    if mean_px > 0.55:   scores["happy"] += 2.5
    if mouth_mean > 0.5: scores["happy"] += 2.0
    if std_px < 0.25:    scores["happy"] += 1.0

    # Sad: dark face, low variation
    if mean_px < 0.40:   scores["sad"] += 2.5
    if std_px < 0.20:    scores["sad"] += 1.5
    if mouth_mean < 0.35: scores["sad"] += 1.5

    # Angry: dark face, high brow contrast
    if mean_px < 0.45:   scores["angry"] += 1.5
    if brow_std > 0.22:  scores["angry"] += 2.5
    if std_px > 0.25:    scores["angry"] += 1.0

    # Surprised: high overall std (wide features)
    if std_px > 0.28:    scores["surprise"] += 2.0
    if mean_px > 0.45:   scores["surprise"] += 1.5
    if brow_std > 0.25:  scores["surprise"] += 1.0

    # Neutral is baseline
    scores["neutral"] = max(0.5, 4.0 - max(scores.values()))

    total = sum(scores.values()) or 1.0
    probs = {k: round(v / total, 4) for k, v in scores.items()}
    primary = max(probs, key=probs.get)
    return {"emotion": primary, "confidence": probs[primary], "all_emotions": probs, "model_used": "pixel-rules"}


# ─── Main Detection Function ───────────────────────────────────────────────────

def detect_face_emotion(image_bytes: bytes) -> Dict:
    """
    Detect facial emotion from image bytes.

    Args:
        image_bytes: Raw image data (JPEG/PNG from camera or gallery)

    Returns:
        {
            emotion, confidence, all_emotions, model_used,
            face_detected, bbox, face_count, image_shape
        }
    """
    try:
        import cv2
    except ImportError:
        return _error_response("opencv-python-headless is not installed")

    try:
        # ── Decode image ──────────────────────────────────────────────────────
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img_bgr is None:
            return _error_response("Could not decode image. Send JPEG or PNG.")

        h, w = img_bgr.shape[:2]
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # ── Face detection ────────────────────────────────────────────────────
        faces = _detect_faces(gray)
        face_detected = len(faces) > 0

        if not face_detected:
            logger.info("No face detected — running full-image analysis")
            # Still attempt emotion detection on the whole image
            bbox = (0, 0, w, h)
        else:
            bbox = faces[0]   # largest face

        # ── Preprocessing for ML models ───────────────────────────────────────
        face_48 = _preprocess_face(gray, bbox)

        # ── Inference: Priority order ─────────────────────────────────────────
        result = None

        # 1. Try user-provided/custom Keras model first
        result = _infer_keras(face_48)

        # 2. Try DeepFace fallback (FER pretrained)
        if result is None:
            result = _infer_deepface(img_bgr)

        # 3. Try PyTorch model
        if result is None:
            result = _infer_pytorch(face_48)

        # 4. Pixel-statistics fallback
        if result is None:
            result = _infer_pixel_rules(face_48, gray, bbox)

        bx, by, bw, bh = bbox
        return {
            **result,
            "face_detected": face_detected,
            "face_count": len(faces),
            "bbox": {"x": int(bx), "y": int(by), "w": int(bw), "h": int(bh)},
            "image_shape": {"width": int(w), "height": int(h)},
        }

    except Exception as exc:
        logger.error(f"Face emotion detection error: {exc}", exc_info=True)
        return _error_response(str(exc))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _remap_to_phase5(raw: Dict[str, float]) -> Dict[str, float]:
    """Merge FER2013 7-class probabilities into Phase 5 5-class set."""
    out: Dict[str, float] = {e: 0.0 for e in PHASE5_EMOTIONS}
    for label, score in raw.items():
        mapped = _FER2013_TO_PHASE5.get(label.lower(), "neutral")
        out[mapped] = round(out[mapped] + score, 6)
    total = sum(out.values()) or 1.0
    return {k: round(v / total, 4) for k, v in out.items()}


def _error_response(reason: str) -> Dict:
    return {
        "emotion": "neutral",
        "confidence": 0.0,
        "all_emotions": {e: (1.0 if e == "neutral" else 0.0) for e in PHASE5_EMOTIONS},
        "model_used": "error",
        "face_detected": False,
        "face_count": 0,
        "bbox": {},
        "image_shape": {},
        "error": reason,
    }


def get_face_model_info() -> Dict:
    """Return model availability status."""
    keras_available_paths = [os.path.abspath(p) for p in _KERAS_MODEL_CANDIDATE_PATHS if os.path.exists(os.path.abspath(p))]
    has_keras = len(keras_available_paths) > 0
    has_pytorch = os.path.exists(os.path.abspath(_PYTORCH_MODEL_PATH))
    try:
        import deepface   # noqa: F401
        has_deepface = True
    except ImportError:
        has_deepface = False

    active_model = (
        "keras-custom" if has_keras else
        "deepface (FER2013 pretrained)" if has_deepface else
        "pytorch-fer2013" if has_pytorch else
        "pixel-statistics fallback"
    )

    return {
        "active_model": active_model,
        "deepface_available": has_deepface,
        "keras_model_available": has_keras,
        "keras_model_paths": keras_available_paths,
        "pytorch_model_available": has_pytorch,
        "emotion_labels": PHASE5_EMOTIONS,
        "input_format": "48×48 grayscale (FER2013 standard)",
        "face_detector": "OpenCV Haar Cascade frontalface",
        "note": "Primary Keras path: backend/dataset/face emotion.h5. Fallback: backend/ml_models/fer2013_model.h5.",
    }
