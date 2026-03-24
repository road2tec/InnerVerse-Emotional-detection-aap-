"""
Phase 4 Voice Emotion Detection Service
=========================================
Pipeline:
  1.  Receive audio bytes (WAV / M4A / MP3 / OGG from React Native)
  2.  Decode with librosa / soundfile
  3.  Extract MFCC + spectral + prosodic features (RAVDESS-style feature set)
  4.  Run classifier in priority order:
      a) Custom Keras .h5 voice model (user-trained)
      b) sklearn MLPClassifier trained on RAVDESS-compatible features
      c) physics-based rule classifier fallback
  5.  Return {emotion, confidence, all_emotions, features}

Emotions (Phase 4 spec):
  happy · sad · angry · fear · neutral

RAVDESS Dataset Emotion Codes (for reference):
  01 neutral  02 calm  03 happy  04 sad
  05 angry    06 fear  07 disgust 08 surprised
We map to our 5-label set.
"""

import io
import logging
import os
import pickle
from typing import Dict, List, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Phase 4 emotion taxonomy
PHASE4_EMOTIONS: List[str] = ["neutral", "happy", "sad", "angry", "fear"]

# Paths to optional pre-saved models
_KERAS_MODEL_CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "dataset", "Emotion_Voice_Detection_Model.h5"),
    os.path.join(os.path.dirname(__file__), "..", "ml_models", "Emotion_Voice_Detection_Model.h5"),
]
_SKLEARN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "voice_emotion_model.pkl")

# Singleton models (lazy load)
_keras_voice_model = None
_keras_voice_model_loaded_path = None
_voice_model = None


# ─── Feature Extraction ───────────────────────────────────────────────────────

def _extract_features(y: np.ndarray, sr: int) -> np.ndarray:
    """
    Extract a 162-dimensional RAVDESS-style feature vector from audio signal.

    Features:
      - 40 MFCCs (mean) + 40 MFCCs (std)          → 80 dims
      - 12 Chroma (mean)                            → 12 dims
      - Mel-Spectrogram (mean, 40 bands)            → 40 dims
      - Spectral contrast (mean, 7 bands)           → 7 dims
      - Spectral centroid (mean)                    →  1 dim
      - ZCR mean                                    →  1 dim
      - RMS energy mean                             →  1 dim
      - Tempo                                       →  1 dim
      Total                                         = 143 dims (padded to 162 for compat.)
    """
    import librosa

    features = []

    # ── 1. MFCCs (mean + std) ─────────────────────────────────────────────────
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
    features.extend(np.mean(mfccs, axis=1).tolist())   # 40
    features.extend(np.std(mfccs, axis=1).tolist())    # 40

    # ── 2. Chroma ─────────────────────────────────────────────────────────────
    stft = np.abs(librosa.stft(y))
    chroma = librosa.feature.chroma_stft(S=stft, sr=sr)
    features.extend(np.mean(chroma, axis=1).tolist())  # 12

    # ── 3. Mel Spectrogram ────────────────────────────────────────────────────
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=40)
    features.extend(np.mean(mel, axis=1).tolist())     # 40

    # ── 4. Spectral Contrast ──────────────────────────────────────────────────
    contrast = librosa.feature.spectral_contrast(S=stft, sr=sr)
    features.extend(np.mean(contrast, axis=1).tolist())  # 7

    # ── 5. Scalar features ────────────────────────────────────────────────────
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    features.append(float(np.mean(centroid)))          # 1

    zcr = librosa.feature.zero_crossing_rate(y)
    features.append(float(np.mean(zcr)))               # 1

    rms = librosa.feature.rms(y=y)
    features.append(float(np.mean(rms)))               # 1

    tempo_arr = librosa.feature.tempo(y=y, sr=sr)
    features.append(float(tempo_arr[0]) if len(tempo_arr) > 0 else 0.0)  # 1

    # Pad/trim to exactly 162 dims for sklearn model compatibility
    arr = np.array(features, dtype=np.float32)
    if len(arr) < 162:
        arr = np.pad(arr, (0, 162 - len(arr)))
    else:
        arr = arr[:162]

    return arr


def _get_scalar_summary(y: np.ndarray, sr: int) -> Dict:
    """Return human-readable audio feature summary for the API response."""
    import librosa
    rms = float(np.mean(librosa.feature.rms(y=y)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    tempo_arr = librosa.feature.tempo(y=y, sr=sr)
    tempo = float(tempo_arr[0]) if len(tempo_arr) > 0 else 0.0
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    pitch_proxy = float(np.mean(np.abs(mfcc[1])))  # 1st delta MFCC ~ pitch variation

    return {
        "rms_energy": round(rms, 6),
        "zero_crossing_rate": round(zcr, 6),
        "spectral_centroid_hz": round(centroid, 2),
        "tempo_bpm": round(tempo, 2),
        "pitch_variation": round(pitch_proxy, 4),
        "duration_seconds": round(len(y) / sr, 2),
    }


# ─── Model Loading ────────────────────────────────────────────────────────────

def _load_keras_voice_model():
    """Try to load user-trained Keras .h5 model from dataset/ml_models."""
    global _keras_voice_model, _keras_voice_model_loaded_path

    if _keras_voice_model is not None:
        return _keras_voice_model

    for candidate in _KERAS_MODEL_CANDIDATE_PATHS:
        model_path = os.path.abspath(candidate)
        if not os.path.exists(model_path):
            continue
        try:
            import tensorflow as tf     # noqa: F401
            from tensorflow import keras
            _keras_voice_model = keras.models.load_model(model_path)
            _keras_voice_model_loaded_path = model_path
            logger.info(f"✅ Voice Keras model loaded from {model_path}")
            return _keras_voice_model
        except Exception as exc:
            logger.warning(f"Failed to load Keras voice model from {model_path}: {exc}")

    return None


def _infer_keras_voice_model(feat_vector: np.ndarray) -> Optional[Tuple[str, Dict[str, float]]]:
    """
    Run inference on custom Keras .h5 model.
    Supports common input shapes: (1,162), (1,162,1), (1,1,162).
    Expected output order is Phase 4 labels: [neutral, happy, sad, angry, fear].
    """
    model = _load_keras_voice_model()
    if model is None:
        return None

    candidates = [
        feat_vector.reshape(1, -1),
        feat_vector.reshape(1, -1, 1),
        feat_vector.reshape(1, 1, -1),
    ]

    for x in candidates:
        try:
            pred = model.predict(x, verbose=0)
            pred = np.array(pred).reshape(-1)

            if pred.size != len(PHASE4_EMOTIONS):
                continue

            pred = np.maximum(pred, 0)
            total = float(np.sum(pred))
            if total <= 0:
                continue

            probs = {label: round(float(score / total), 4) for label, score in zip(PHASE4_EMOTIONS, pred)}
            primary = max(probs, key=probs.get)
            return primary, probs
        except Exception:
            continue

    logger.warning("Keras voice model inference failed for all supported input shapes.")
    return None

def _load_voice_model():
    """Try to load a pre-trained sklearn model from ml_models/."""
    global _voice_model
    if _voice_model is not None:
        return _voice_model

    model_path = os.path.abspath(_SKLEARN_MODEL_PATH)
    if os.path.exists(model_path):
        try:
            with open(model_path, "rb") as f:
                _voice_model = pickle.load(f)
            logger.info(f"✅ Voice emotion model loaded from {model_path}")
            return _voice_model
        except Exception as exc:
            logger.warning(f"Failed to load voice model: {exc}")

    logger.info("ℹ️ No trained voice model found — using rule-based classifier.")
    return None


# ─── Rule-Based Classifier (physics fallback) ─────────────────────────────────

def _rule_classifier(
    rms: float,
    zcr: float,
    centroid: float,
    tempo: float,
    pitch_variation: float,
) -> Tuple[str, Dict[str, float]]:
    """
    Physics-based fallback classifier using 5 acoustic heuristics.
    Based on empirical observations from RAVDESS dataset findings:

    Angry  : high energy, high ZCR, very high centroid, fast tempo
    Happy  : moderate-high energy, high centroid, fast tempo, high pitch var
    Sad    : low energy, low ZCR, low centroid, slow tempo
    Fear   : moderate energy but high ZCR, high pitch variation, irregular
    Neutral: balanced, moderate everything
    """
    # Raw scores per emotion (higher = more likely)
    scores: Dict[str, float] = {e: 0.0 for e in PHASE4_EMOTIONS}

    # ── Angry ─────────────────────────────────────────────────────────────────
    if rms > 0.1:           scores["angry"] += 2.0
    if zcr > 0.18:          scores["angry"] += 1.5
    if centroid > 3500:     scores["angry"] += 1.5
    if tempo > 150:         scores["angry"] += 1.0

    # ── Happy ─────────────────────────────────────────────────────────────────
    if 0.06 < rms <= 0.1:   scores["happy"] += 2.0
    if centroid > 3000:     scores["happy"] += 1.5
    if tempo > 130:         scores["happy"] += 1.5
    if pitch_variation > 18: scores["happy"] += 1.0

    # ── Sad ───────────────────────────────────────────────────────────────────
    # Relaxed thresholds for mobile (background noise increases RMS and ZCR)
    if rms < 0.05:          scores["sad"] += 3.0
    if zcr < 0.1:           scores["sad"] += 1.5
    if centroid < 2500:     scores["sad"] += 1.5
    if tempo < 110:         scores["sad"] += 1.0

    # ── Fear ──────────────────────────────────────────────────────────────────
    if 0.04 < rms < 0.08:   scores["fear"] += 1.0
    if zcr > 0.12:          scores["fear"] += 1.5
    if pitch_variation > 22: scores["fear"] += 2.0
    if tempo > 130:         scores["fear"] += 1.0

    # ── Neutral (baseline) ────────────────────────────────────────────────────
    scores["neutral"] = max(0.5, 4.0 - max(scores.values()))

    # Normalise to probabilities
    total = sum(scores.values()) or 1.0
    probs = {k: round(v / total, 4) for k, v in scores.items()}
    primary = max(probs, key=probs.get)
    return primary, probs


# ─── Main Detection Function ──────────────────────────────────────────────────

def detect_voice_emotion(audio_bytes: bytes, filename: str = "recording.wav") -> Dict:
    """
    Detect emotion from audio bytes.

    Args:
        audio_bytes: Raw audio file content (WAV / M4A / MP3 / OGG)
        filename:    Original filename (used only for logging)

    Returns:
        {
            emotion, confidence, all_emotions,
            model_used, features, duration_seconds
        }
    """
    try:
        import librosa
    except ImportError:
        logger.error("librosa is not installed.")
        return _error_response("librosa not available")

    try:
        # ── Decode audio ──────────────────────────────────────────────────────
        # Use pydub to handle .m4a and other formats safely before librosa
        try:
            from pydub import AudioSegment
            audio_io = io.BytesIO(audio_bytes)
            audio = AudioSegment.from_file(audio_io)
            wav_io = io.BytesIO()
            audio.export(wav_io, format="wav")
            wav_io.seek(0)
            y, sr = librosa.load(wav_io, sr=22050, mono=True, duration=30)
        except Exception as e:
            logger.warning(f"Pydub processing failed {e}, falling back to direct librosa load.")
            audio_io = io.BytesIO(audio_bytes)
            y, sr = librosa.load(audio_io, sr=22050, mono=True, duration=30)

        if len(y) == 0:
            return _error_response("Empty audio signal")

        # ── Extract features ──────────────────────────────────────────────────
        feat_vector = _extract_features(y, sr)
        scalars = _get_scalar_summary(y, sr)

        # ── Try custom Keras model first ─────────────────────────────────────
        keras_result = _infer_keras_voice_model(feat_vector)
        if keras_result is not None:
            emotion, probs = keras_result
            model_name = f"keras-custom:{os.path.basename(_keras_voice_model_loaded_path)}" if _keras_voice_model_loaded_path else "keras-custom"
            return _make_result(emotion, probs[emotion], probs, model_name, scalars)

        # ── Try sklearn model next ────────────────────────────────────────────
        model = _load_voice_model()
        if model is not None:
            try:
                feat_2d = feat_vector.reshape(1, -1)
                proba = model.predict_proba(feat_2d)[0]
                classes = model.classes_
                probs = {str(c): round(float(p), 4) for c, p in zip(classes, proba)}
                # Remap to Phase 4 labels
                probs = _remap_to_phase4(probs)
                primary = max(probs, key=probs.get)
                return _make_result(primary, probs[primary], probs, "sklearn", scalars)
            except Exception as exc:
                logger.warning(f"sklearn model inference failed: {exc} — using rule fallback")

        # ── Rule-based fallback ───────────────────────────────────────────────
        emotion, probs = _rule_classifier(
            rms=scalars["rms_energy"],
            zcr=scalars["zero_crossing_rate"],
            centroid=scalars["spectral_centroid_hz"],
            tempo=scalars["tempo_bpm"],
            pitch_variation=scalars["pitch_variation"],
        )
        return _make_result(emotion, probs[emotion], probs, "rule-based", scalars)

    except Exception as exc:
        logger.error(f"Voice emotion detection error: {exc}", exc_info=True)
        return _error_response(str(exc))


# ─── Helpers ──────────────────────────────────────────────────────────────────

_RAVDESS_TO_PHASE4: Dict[str, str] = {
    "neutral": "neutral",
    "calm":    "neutral",
    "happy":   "happy",
    "sad":     "sad",
    "angry":   "angry",
    "fear":    "fear",
    "fearful": "fear",
    "disgust": "angry",
    "surprised": "happy",
}


def _remap_to_phase4(probs: Dict[str, float]) -> Dict[str, float]:
    """Remap RAVDESS emotion labels to Phase 4 5-label set."""
    out: Dict[str, float] = {e: 0.0 for e in PHASE4_EMOTIONS}
    for label, score in probs.items():
        mapped = _RAVDESS_TO_PHASE4.get(label.lower(), "neutral")
        out[mapped] = round(out[mapped] + score, 6)
    total = sum(out.values()) or 1.0
    return {k: round(v / total, 4) for k, v in out.items()}


def _make_result(emotion: str, confidence: float, all_emotions: Dict, model: str, features: Dict) -> Dict:
    return {
        "emotion": emotion,
        "confidence": round(float(confidence), 4),
        "all_emotions": all_emotions,
        "model_used": model,
        "features": features,
        "duration_seconds": features.get("duration_seconds", 0.0),
    }


def _error_response(reason: str) -> Dict:
    return {
        "emotion": "neutral",
        "confidence": 0.0,
        "all_emotions": {e: (1.0 if e == "neutral" else 0.0) for e in PHASE4_EMOTIONS},
        "model_used": "error",
        "features": {},
        "error": reason,
        "duration_seconds": 0.0,
    }


def get_voice_model_info() -> Dict:
    keras_available_paths = [os.path.abspath(p) for p in _KERAS_MODEL_CANDIDATE_PATHS if os.path.exists(os.path.abspath(p))]
    has_keras = len(keras_available_paths) > 0
    model = _load_voice_model()
    return {
        "model_name": "RAVDESS-compatible voice emotion classifier",
        "model_type": "Keras custom (.h5)" if has_keras else (type(model).__name__ if model else "Rule-based acoustic classifier"),
        "status": "keras model available (priority-1)" if has_keras else ("sklearn model loaded" if model else "rule-based fallback active"),
        "keras_model_available": has_keras,
        "keras_model_paths": keras_available_paths,
        "emotion_labels": PHASE4_EMOTIONS,
        "feature_dimensions": 162,
        "feature_set": "MFCC-40 × 2 + Chroma-12 + Mel-40 + SpectralContrast-7 + Scalars-3",
    }
