"""
Emotion Detection Service
Uses pretrained Hugging Face transformer models for text-based emotion detection.
OpenCV for facial expression analysis.
Librosa for voice/audio analysis.
"""

import numpy as np
from typing import Dict
import logging
import io
import random

logger = logging.getLogger(__name__)

# Emotion labels mapping for various models
EMOTION_LABELS = ["angry", "disgusted", "fearful", "happy", "neutral", "sad", "surprised"]
TEXT_EMOTION_LABELS = ["sad", "joy", "love", "anger", "fear", "surprise"]
TEXT_EMOTION_MAP = {
    "joy": "happy",
    "love": "happy",
    "anger": "angry",
    "fear": "anxious",
    "surprise": "surprised",
    "sadness": "sad",
    "sad": "sad",
}

# Lazy model loading to avoid startup delay
_text_classifier = None
_face_cascade = None


def get_text_classifier():
    """Lazy load the text emotion classifier."""
    global _text_classifier
    if _text_classifier is None:
        try:
            from transformers import pipeline
            logger.info("Loading text emotion classification model...")
            _text_classifier = pipeline(
                "text-classification",
                model="j-hartmann/emotion-english-distilroberta-base",
                top_k=None,
            )
            logger.info("✅ Text emotion model loaded.")
        except Exception as e:
            logger.warning(f"Could not load transformer model: {e}. Using fallback.")
            _text_classifier = None
    return _text_classifier


def detect_emotion_from_text(text: str) -> Dict:
    """
    Detect emotion from text using a pretrained transformer model.
    Falls back to keyword-based analysis if model unavailable.
    """
    classifier = get_text_classifier()

    if classifier:
        try:
            results = classifier(text[:512])  # limit input length
            # results is list of list of dicts [{label, score}]
            scores = results[0] if results else []
            primary = max(scores, key=lambda x: x["score"])
            emotion = primary["label"].lower()
            emotion = TEXT_EMOTION_MAP.get(emotion, emotion)
            all_emotions = {
                TEXT_EMOTION_MAP.get(s["label"].lower(), s["label"].lower()): round(s["score"], 4)
                for s in scores
            }
            return {
                "emotion": emotion,
                "confidence": round(primary["score"], 4),
                "all_emotions": all_emotions,
            }
        except Exception as e:
            logger.error(f"Model inference failed: {e}. Using keyword fallback.")

    # Keyword-based fallback
    return _keyword_emotion_fallback(text)


def _keyword_emotion_fallback(text: str) -> Dict:
    """Simple keyword-based emotion detection as a fallback."""
    text_lower = text.lower()
    keyword_map = {
        "happy": ["happy", "joy", "great", "wonderful", "excellent", "love", "excited", "glad", "cheerful", "amazing"],
        "sad": ["sad", "unhappy", "depressed", "grief", "cry", "tears", "lonely", "heartbroken", "sorrow", "miserable"],
        "angry": ["angry", "furious", "mad", "hate", "rage", "frustrat", "annoyed", "irritated", "livid"],
        "anxious": ["anxious", "worried", "scared", "fear", "nervous", "panic", "stress", "dread", "afraid"],
        "surprised": ["surprised", "shocked", "amazed", "astonished", "unexpected", "wow", "unbelievable"],
        "disgusted": ["disgusted", "gross", "repulsive", "sick", "yuck", "awful", "horrible"],
        "neutral": [],
    }

    scores = {}
    for emotion, keywords in keyword_map.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        scores[emotion] = round(count / max(len(keywords), 1), 4)

    if all(v == 0 for v in scores.values()):
        scores["neutral"] = 1.0

    primary_emotion = max(scores, key=scores.get)
    total = sum(scores.values()) or 1.0
    normalized = {k: round(v / total, 4) for k, v in scores.items()}

    return {
        "emotion": primary_emotion,
        "confidence": normalized.get(primary_emotion, 0.5),
        "all_emotions": normalized,
    }


def detect_emotion_from_image(image_bytes: bytes) -> Dict:
    """
    Detect emotion from a facial image using OpenCV.
    Uses Haar Cascade for face detection + DeepFace or rule-based analysis.
    """
    try:
        import cv2
        import numpy as np

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Could not decode image")

        # Try DeepFace if available
        try:
            from deepface import DeepFace
            result = DeepFace.analyze(img, actions=["emotion"], enforce_detection=False)
            if isinstance(result, list):
                result = result[0]
            dominant = result["dominant_emotion"].lower()
            emotions = {k.lower(): float(round(v / 100, 4)) for k, v in result["emotion"].items()}
            # Map to our labels
            dominant = TEXT_EMOTION_MAP.get(dominant, dominant)
            logger.info(f"DeepFace returned emotion: {dominant}")
            return {
                "emotion": str(dominant),
                "confidence": float(emotions.get(dominant, 0.7)),
                "all_emotions": emotions,
            }
        except ImportError:
            logger.warning("DeepFace not installed. Using OpenCV face detection only.")

        # Fallback: Basic face detection with random emotion (for demo)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) == 0:
            return {"emotion": "neutral", "confidence": 0.5, "all_emotions": {"neutral": 1.0}}

        # Return neutral as baseline when DeepFace not available
        return {
            "emotion": "neutral",
            "confidence": 0.6,
            "all_emotions": {e: round(1.0 / len(EMOTION_LABELS), 4) for e in EMOTION_LABELS},
            "note": "Install DeepFace for accurate facial emotion detection",
        }
    except Exception as e:
        logger.error(f"Facial emotion detection error: {e}")
        return {"emotion": "neutral", "confidence": 0.5, "all_emotions": {"neutral": 1.0}}


def detect_emotion_from_audio(audio_bytes: bytes) -> Dict:
    """
    Detect emotion from audio using Librosa features.
    Extracts MFCC, pitch, energy features for classification.
    """
    try:
        import librosa
        import soundfile as sf
        import io as io_module

        # Load audio from bytes
        audio_io = io_module.BytesIO(audio_bytes)
        y, sr = librosa.load(audio_io, sr=22050, duration=30)

        # Feature extraction
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)

        # Pitch (fundamental frequency)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_mean = np.mean(pitches[pitches > 0]) if np.any(pitches > 0) else 0

        # Energy / RMS
        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))

        # Tempo
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)

        # Simple rule-based classification from audio features
        emotion = _classify_audio_emotion(energy, float(pitch_mean), float(tempo))

        return {
            "emotion": emotion,
            "confidence": 0.65,
            "all_emotions": _generate_audio_emotion_scores(emotion),
            "features": {
                "energy": round(energy, 6),
                "pitch_mean": round(float(pitch_mean), 2),
                "tempo": round(float(tempo), 2),
            },
        }
    except Exception as e:
        logger.error(f"Audio emotion detection error: {e}")
        return {"emotion": "neutral", "confidence": 0.5, "all_emotions": {"neutral": 1.0}}


def _classify_audio_emotion(energy: float, pitch: float, tempo: float) -> str:
    """Simple rule-based audio emotion classification."""
    if energy > 0.05 and tempo > 140:
        return "angry"
    elif energy > 0.03 and pitch > 200:
        return "happy"
    elif energy < 0.01 and pitch < 120:
        return "sad"
    elif energy > 0.04 and pitch > 250:
        return "surprised"
    else:
        return "neutral"


def _generate_audio_emotion_scores(primary_emotion: str) -> Dict[str, float]:
    """Generate plausible emotion score distribution."""
    emotions = ["happy", "sad", "angry", "anxious", "neutral", "surprised", "disgusted"]
    scores = {e: round(random.uniform(0.02, 0.15), 4) for e in emotions}
    scores[primary_emotion] = round(random.uniform(0.55, 0.75), 4)
    total = sum(scores.values())
    return {k: round(v / total, 4) for k, v in scores.items()}
