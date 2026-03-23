"""
Phase 3 Text Emotion Detection Service
=======================================
Primary model path:
    backend/dataset/emotion_classifier_pipe_lr.pkl

Model priority:
    1) User-trained sklearn pipeline (.pkl)  ✅ primary
    2) Keyword rules fallback

Note:
    DistilRoBERTa transformer path is intentionally disabled.

Phase 3 Emotion Labels:
    happy · sad · angry · frustrated · neutral · excited · stressed
"""

import logging
import os
import pickle
import re
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# ─── Phase 3 Emotion Taxonomy ──────────────────────────────────────────────────

PHASE3_EMOTIONS = ["happy", "sad", "angry", "frustrated", "neutral", "excited", "stressed"]

# Maps the model's raw label output → Phase 3 taxonomy
# Model outputs: joy, sadness, anger, fear, disgust, surprise, neutral
_MODEL_TO_PHASE3: Dict[str, str] = {
    # Direct mapping
    "joy":      "happy",
    "sadness":  "sad",
    "anger":    "angry",
    "neutral":  "neutral",
    # Contextual mappings
    "fear":     "stressed",     # fear → stress (high overlap in text context)
    "disgust":  "frustrated",   # disgust → frustration
    "surprise": "excited",      # surprise → excited  (positive surprise)
    # Already in Phase 3 taxonomy (from other models)
    "happy":    "happy",
    "sad":      "sad",
    "excited":  "excited",
    "frustrated": "frustrated",
    "stressed": "stressed",
}

_SKLEARN_MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "dataset", "emotion_classifier_pipe_lr.pkl")
)

_sklearn_pipeline = None
_sklearn_checked = False
_sklearn_load_error: Optional[str] = None


# ─── Predefined Context Rules (Hybrid with ML) ───────────────────────────────
# Each rule uses grouped terms under "all_of"; at least one term in each group
# must be present in text for the rule to trigger.
_PREDEFINED_CONTEXT_RULES: List[Dict] = [
    {
        "name": "monday_traffic_frustration",
        "emotion": "frustrated",
        "strength": 0.86,
        "all_of": [
            ["monday"],
            ["traffic", "traffic jam", "jam", "congestion", "commute", "delay", "delayed", "late"],
        ],
    },
    {
        "name": "deadline_pressure_stress",
        "emotion": "stressed",
        "strength": 0.84,
        "all_of": [
            ["deadline", "submission", "exam", "presentation", "interview", "meeting"],
            ["pressure", "too much", "overload", "no time", "can't handle", "cannot handle", "overwhelmed"],
        ],
    },
    {
        "name": "weekend_plan_excitement",
        "emotion": "excited",
        "strength": 0.78,
        "all_of": [
            ["friday", "weekend"],
            ["trip", "travel", "plan", "party", "outing", "vacation", "holiday"],
        ],
    },
]


def _contains_term(text_lower: str, term: str) -> bool:
    """Term match with word boundaries for single words, substring for phrases."""
    cleaned = term.lower().strip()
    if not cleaned:
        return False
    if " " in cleaned:
        return cleaned in text_lower
    return re.search(rf"\b{re.escape(cleaned)}\b", text_lower) is not None


def _pick_predefined_rule(text: str) -> Optional[Dict]:
    """Return first matching predefined context rule for input text."""
    text_lower = text.lower()
    for rule in _PREDEFINED_CONTEXT_RULES:
        groups = rule.get("all_of", [])
        if groups and all(any(_contains_term(text_lower, term) for term in group) for group in groups):
            return rule
    return None


def _normalise_scores(scores: Dict[str, float]) -> Dict[str, float]:
    """Normalise scores to sum to 1 and keep Phase 3 labels only."""
    cleaned = {emotion: float(scores.get(emotion, 0.0)) for emotion in PHASE3_EMOTIONS}
    total = sum(cleaned.values()) or 1.0
    return {emotion: round(value / total, 4) for emotion, value in cleaned.items()}


def _apply_predefined_rule(text: str, base_result: Dict) -> Dict:
    """
    Blend rule-based one-hot distribution with model distribution.
    Keeps ML prediction in the loop while enforcing strong contextual cues.
    """
    rule = _pick_predefined_rule(text)
    if not rule:
        return base_result

    target_emotion = rule["emotion"]
    alpha = min(max(float(rule.get("strength", 0.8)), 0.0), 0.95)

    base_scores = {emotion: float(base_result.get("all_emotions", {}).get(emotion, 0.0)) for emotion in PHASE3_EMOTIONS}
    if sum(base_scores.values()) <= 0:
        base_scores = {emotion: (1.0 if emotion == "neutral" else 0.0) for emotion in PHASE3_EMOTIONS}

    rule_scores = {emotion: (1.0 if emotion == target_emotion else 0.0) for emotion in PHASE3_EMOTIONS}
    blended_scores = {
        emotion: (1 - alpha) * base_scores[emotion] + alpha * rule_scores[emotion]
        for emotion in PHASE3_EMOTIONS
    }
    normalised = _normalise_scores(blended_scores)

    primary = max(normalised, key=normalised.get)
    model_name = f"hybrid-rule+{base_result.get('model', 'unknown')}"
    processed_at = base_result.get("processed_at", datetime.utcnow().isoformat() + "Z")

    return _make_result(primary, normalised[primary], normalised, model_name, processed_at)


def _extract_predictor(obj):
    """Try to extract a predict-capable estimator from common artifact wrappers."""
    if obj is None:
        return None

    if hasattr(obj, "predict"):
        return obj

    # Dict wrappers: {"model": pipeline}, {"pipeline": ...}, etc.
    if isinstance(obj, dict):
        for key in ("model", "pipeline", "clf", "classifier", "estimator"):
            candidate = obj.get(key)
            if hasattr(candidate, "predict"):
                return candidate
        for candidate in obj.values():
            if hasattr(candidate, "predict"):
                return candidate

    # Tuple/list wrappers
    if isinstance(obj, (tuple, list)):
        for candidate in obj:
            if hasattr(candidate, "predict"):
                return candidate

    # Numpy object arrays may wrap model or metadata
    try:
        import numpy as np
        if isinstance(obj, np.ndarray):
            if obj.dtype == object:
                for candidate in obj.ravel().tolist():
                    if hasattr(candidate, "predict"):
                        return candidate
    except Exception:
        pass

    return None


def _get_sklearn_pipeline():
    """Lazy-load user-trained sklearn text classifier pipeline from dataset path."""
    global _sklearn_pipeline, _sklearn_checked, _sklearn_load_error

    if _sklearn_checked:
        return _sklearn_pipeline

    _sklearn_checked = True
    if not os.path.exists(_SKLEARN_MODEL_PATH):
        _sklearn_load_error = f"model file not found at {_SKLEARN_MODEL_PATH}"
        logger.warning(f"Text sklearn model not found at {_SKLEARN_MODEL_PATH}")
        return None

    try:
        with open(_SKLEARN_MODEL_PATH, "rb") as f:
            loaded_obj = pickle.load(f)

        model = _extract_predictor(loaded_obj)
        if model is None:
            # Try to explain common bad artifact case
            try:
                import numpy as np
                if isinstance(loaded_obj, np.ndarray) and loaded_obj.dtype == object and loaded_obj.size > 0 and all(isinstance(x, str) for x in loaded_obj.ravel().tolist()):
                    _sklearn_load_error = (
                        "invalid artifact: file contains only label names, not a trained estimator. "
                        "Re-export full sklearn pipeline (vectorizer + classifier)."
                    )
                else:
                    _sklearn_load_error = (
                        f"invalid artifact type: {type(loaded_obj).__name__} (no predict-capable model found)"
                    )
            except Exception:
                _sklearn_load_error = f"invalid artifact type: {type(loaded_obj).__name__}"
            logger.error(f"Loaded sklearn artifact is invalid: {_sklearn_load_error}")
            return None

        _sklearn_pipeline = model
        _sklearn_load_error = None
        logger.info(f"✅ Loaded text sklearn model from {_SKLEARN_MODEL_PATH}")
        return _sklearn_pipeline
    except Exception as exc:
        _sklearn_load_error = str(exc)
        logger.error(f"Failed to load text sklearn model: {exc}")
        _sklearn_pipeline = None
        return None


def _map_label(raw_label: str) -> str:
    """Map a raw model label to Phase 3 taxonomy."""
    key = raw_label.lower().strip()
    return _MODEL_TO_PHASE3.get(key, "neutral")


def _merge_scores(raw_scores: List[Dict]) -> Dict[str, float]:
    """
    Convert raw [{label, score}] list → Phase 3 emotion score dict.
    When two raw labels map to the same Phase 3 emotion, sum their scores.
    Normalise so all values sum to 1.
    """
    merged: Dict[str, float] = {e: 0.0 for e in PHASE3_EMOTIONS}
    for item in raw_scores:
        phase3_label = _map_label(item["label"])
        merged[phase3_label] = round(merged.get(phase3_label, 0.0) + item["score"], 6)

    total = sum(merged.values()) or 1.0
    return {k: round(v / total, 4) for k, v in merged.items()}


def _merge_label_score_dict(raw_scores: Dict[str, float]) -> Dict[str, float]:
    """Convert {label: score} dict into Phase 3 normalized distribution."""
    merged: Dict[str, float] = {e: 0.0 for e in PHASE3_EMOTIONS}
    for raw_label, score in raw_scores.items():
        phase3_label = _map_label(str(raw_label))
        merged[phase3_label] = round(merged.get(phase3_label, 0.0) + float(score), 6)

    total = sum(merged.values()) or 1.0
    return {k: round(v / total, 4) for k, v in merged.items()}


def _infer_with_sklearn(text: str, processed_at: str) -> Optional[Dict]:
    """Run inference using user-trained sklearn pipeline model."""
    model = _get_sklearn_pipeline()
    if model is None:
        return None

    try:
        pred = model.predict([text])
        raw_pred_label = str(pred[0])

        raw_probs: Dict[str, float] = {}
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba([text])[0]
            classes = getattr(model, "classes_", None)
            if classes is not None and len(classes) == len(probs):
                raw_probs = {str(label): float(score) for label, score in zip(classes, probs)}

        # Fallback if predict_proba is unavailable
        if not raw_probs:
            raw_probs = {raw_pred_label: 1.0}

        merged = _merge_label_score_dict(raw_probs)
        primary = max(merged, key=merged.get)
        return _make_result(primary, merged[primary], merged, "sklearn-lr-pipeline", processed_at)
    except Exception as exc:
        logger.error(f"sklearn text model inference failed: {exc}")
        return None


# ─── Main Detection Function ───────────────────────────────────────────────────

def detect_text_emotion(text: str) -> Dict:
    """
    Detect emotion from text input.

    Args:
        text: Free-form text (e.g. "I feel very stressed today")

    Returns:
        {
            "emotion": "stressed",
            "confidence": 0.87,
            "all_emotions": {"happy": 0.02, "stressed": 0.87, ...},
            "model": "sklearn-lr-pipeline" | "keyword",
            "processed_at": ISO datetime string
        }
    """
    text = text.strip()
    if not text:
        return _make_result("neutral", 1.0, {e: (1.0 if e == "neutral" else 0.0) for e in PHASE3_EMOTIONS}, "keyword")

    processed_at = datetime.utcnow().isoformat() + "Z"

    # ── User-trained sklearn pipeline (primary path) ───────────────────────
    sklearn_result = _infer_with_sklearn(text, processed_at)
    base_result = sklearn_result if sklearn_result else _keyword_fallback(text, processed_at)

    # ── Hybrid: predefined context rule + model distribution ───────────────
    return _apply_predefined_rule(text, base_result)


def _make_result(emotion: str, confidence: float, all_emotions: Dict, model: str, processed_at: Optional[str] = None) -> Dict:
    return {
        "emotion": emotion,
        "confidence": round(float(confidence), 4),
        "all_emotions": all_emotions,
        "model": model,
        "processed_at": processed_at or (datetime.utcnow().isoformat() + "Z"),
    }


# ─── Enhanced Keyword Fallback ────────────────────────────────────────────────

# Covers ALL Phase 3 labels including stressed / excited / frustrated
_KEYWORD_MAP: Dict[str, List[str]] = {
    "happy": [
        "happy", "happiness", "joy", "joyful", "great", "wonderful", "excellent",
        "love", "glad", "cheerful", "amazing", "fantastic", "delighted", "pleased",
        "content", "blissful", "grateful", "thrilled", "positive", "elated",
    ],
    "sad": [
        "sad", "sadness", "unhappy", "depressed", "depression", "grief",
        "cry", "crying", "tears", "lonely", "heartbroken", "sorrow", "miserable",
        "hopeless", "devastated", "gloomy", "melancholy", "disappointed", "upset",
    ],
    "angry": [
        "angry", "anger", "furious", "fury", "mad", "hate", "hatred",
        "rage", "livid", "enraged", "outraged", "irate", "infuriated",
        "bitter", "hostile", "aggressive",
    ],
    "frustrated": [
        "frustrated", "frustration", "annoyed", "annoying", "irritated", "irritating",
        "fed up", "fed-up", "aggravated", "exasperated", "sick of", "tired of",
        "exhausted", "overwhelmed", "helpless", "stuck", "useless", "pointless",
        "nothing works", "can't do", "whatever",
    ],
    "neutral": [
        "okay", "ok", "fine", "alright", "normal", "usual", "average",
        "neither", "just", "nothing special", "so-so",
    ],
    "excited": [
        "excited", "excitement", "thrilled", "ecstatic", "enthusiastic",
        "can't wait", "eager", "anticipating", "pumped", "stoked", "hyped",
        "energetic", "motivated", "inspired", "passionate", "fired up",
        "looking forward", "amazing news", "great news",
    ],
    "stressed": [
        "stressed", "stress", "stressful", "pressure", "overwhelmed",
        "burnout", "burnt out", "burned out", "tense", "tension",
        "worried", "worry", "anxious", "anxiety", "nervous",
        "panic", "panicking", "dread", "dreading", "deadline",
        "too much", "can't handle", "breaking down", "struggling",
        "exhausted", "worn out", "restless", "sleepless", "sleep deprived",
        "no time", "not enough time",
    ],
}


def _keyword_fallback(text: str, processed_at: str) -> Dict:
    """Enhanced keyword-based emotion detection covering all Phase 3 labels."""
    text_lower = text.lower()
    # Tokenise roughly — split on non-word chars
    tokens = set(re.split(r"[\s\W]+", text_lower))

    raw_scores: Dict[str, float] = {}
    for emotion, keywords in _KEYWORD_MAP.items():
        hit_count = 0
        for kw in keywords:
            if " " in kw:            # phrase keyword — check substring
                if kw in text_lower:
                    hit_count += 2   # multi-word matches worth more
            elif kw in tokens:
                hit_count += 1
        raw_scores[emotion] = float(hit_count)

    # If no keywords match → neutral
    if all(v == 0.0 for v in raw_scores.values()):
        raw_scores["neutral"] = 1.0

    total = sum(raw_scores.values()) or 1.0
    normalised = {k: round(v / total, 4) for k, v in raw_scores.items()}

    primary = max(normalised, key=normalised.get)
    confidence = normalised[primary]

    # Ensure minimum confidence of 0.5 when only one category matched
    if confidence < 0.5 and sum(1 for v in normalised.values() if v > 0) == 1:
        confidence = 0.5
        normalised[primary] = 0.5

    return _make_result(primary, confidence, normalised, "keyword", processed_at)


# ─── Model Info ───────────────────────────────────────────────────────────────

def get_model_info() -> Dict:
    """Return information about the loaded model."""
    sklearn_model = _get_sklearn_pipeline()

    if sklearn_model is not None:
        return {
            "model_name": "emotion_classifier_pipe_lr.pkl",
            "status": f"loaded from {_SKLEARN_MODEL_PATH}",
            "emotion_labels": PHASE3_EMOTIONS,
            "type": "Scikit-learn pipeline (Logistic Regression)",
        }

    return {
        "model_name": "emotion_classifier_pipe_lr.pkl",
        "status": f"sklearn artifact invalid ({_sklearn_load_error}); keyword fallback active" if _sklearn_load_error else "unavailable (keyword fallback active)",
        "emotion_labels": PHASE3_EMOTIONS,
        "type": "keyword-based",
    }
