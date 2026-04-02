"""
Phase 6: Activity Recommendation Engine
=========================================
Rule-based recommendation system that maps:
  (emotion, age_group) → curated list of activities + description

Emotions covered (all phases):
  Phase 3 text:  happy · sad · angry · frustrated · neutral · excited · stressed
  Phase 4 voice: happy · sad · angry · fear · neutral
  Phase 5 face:  happy · sad · angry · surprise · neutral

Age groups:
  child (≤12)  · teen (13–19)  · adult (20–59)  · senior (60+)

The spec example:
  sad   → meditation, watching movies, talking with friends
  angry → breathing exercises, short walk
  happy → listening to music, celebrating with friends

We extend with full age-group customisation and an "age" → "age_group" helper.
"""

from typing import Dict, List, Tuple, Optional

# ─── Age Group Helper ──────────────────────────────────────────────────────────

def age_to_group(age: int) -> str:
    """Convert numeric age to age group label."""
    if age <= 0:
        return "adult"
    if age <= 12:
        return "child"
    if age <= 19:
        return "teen"
    if age <= 59:
        return "adult"
    return "senior"


# ─── Recommendation Data Matrix ────────────────────────────────────────────────
# Structure: { emotion: { age_group: (description, [activities]) } }

_RECOMMENDATIONS: Dict[str, Dict[str, Tuple[str, List[str]]]] = {

    # ── Happy ─────────────────────────────────────────────────────────────────
    "happy": {
        "child":  ("Great time to play and explore!",
                   ["Outdoor playtime", "Draw or paint something fun", "Play board games with family",
                    "Dance to your favourite songs", "Build something creative"]),
        "teen":   ("Ride the wave — channel it into something awesome!",
                   ["Listening to music", "Celebrating with friends", "Play sports or video games",
                    "Post your creative work online", "Try a new hobby or skill"]),
        "adult":  ("Celebrate wins and stay in this flow state.",
                   ["Listening to music", "Celebrating with friends", "Exercise or yoga session",
                    "Work on a passion project", "Plan a trip or outing"]),
        "senior": ("Savour the joy and share it with loved ones.",
                   ["Gardening", "Call or visit family and friends", "Light dancing",
                    "Read an uplifting book", "Bake or cook something special"]),
    },

    # ── Sad ───────────────────────────────────────────────────────────────────
    "sad": {
        "child":  ("It's okay to feel sad. Here are some comforting activities.",
                   ["Hug a favourite toy or pet", "Draw your feelings", "Watch a feel-good cartoon",
                    "Talk to a parent or trusted friend", "Listen to soothing music"]),
        "teen":   ("Allow yourself to feel it — but don't stay stuck.",
                   ["Meditation", "Watch a comfort movie", "Talk with a close friend",
                    "Write in a journal", "Listen to uplifting playlists"]),
        "adult":  ("Take care of yourself — one step at a time.",
                   ["Meditation", "Watch a favourite movie", "Talk with friends or family",
                    "Go for a gentle walk", "Practice deep breathing exercises"]),
        "senior": ("You are not alone. Gentle self-care helps.",
                   ["Meditation", "Watch a comfort show", "Phone or video-call a loved one",
                    "Light stretching", "Read uplifting stories or memoirs"]),
    },

    # ── Angry ─────────────────────────────────────────────────────────────────
    "angry": {
        "child":  ("Let's cool down together with these calming activities.",
                   ["Take 5 deep breaths", "Squeeze a stress ball", "Go run around outside",
                    "Draw or colour how you feel", "Count slowly to 10"]),
        "teen":   ("Channel that energy into something positive.",
                   ["Breathing exercises", "Short walk or run", "Hit the gym or do push-ups",
                    "Write in a journal", "Listen to loud energising music"]),
        "adult":  ("Calm the storm — then address the root cause.",
                   ["Breathing exercises", "Short brisk walk", "Progressive muscle relaxation",
                    "Cold water splash or shower", "Vent to a trusted friend"]),
        "senior": ("Gentle techniques to restore calm and peace.",
                   ["Slow deep breathing", "Short outdoor stroll", "Gentle stretching",
                    "Listen to calming nature sounds", "Sip herbal tea quietly"]),
    },

    # ── Frustrated ────────────────────────────────────────────────────────────
    "frustrated": {
        "child":  ("Take a break — things will be easier soon.",
                   ["Take a short break from the activity", "Have a healthy snack",
                    "Play something easy and fun", "Talk to an adult about what is hard",
                    "Do some jumping jacks to release energy"]),
        "teen":   ("Step back, reset, come back stronger.",
                   ["Step away from what's frustrating you", "Short walk or stretch",
                    "Listen to music", "Talk to a friend", "Try the task from a fresh angle"]),
        "adult":  ("Reframe, reset, and refocus.",
                   ["5-minute mindfulness break", "Walk away and come back fresh",
                    "Write down what's frustrating and why", "Exercise to reset energy",
                    "Break the task into smaller steps"]),
        "senior": ("Be patient with yourself — you've overcome challenges before.",
                   ["Quiet rest", "Gentle walk outside", "Call a trusted friend",
                    "Listen to relaxing music", "Hot tea and slow breathing"]),
    },

    # ── Neutral ───────────────────────────────────────────────────────────────
    "neutral": {
        "child":  ("A calm moment — great for learning something new!",
                   ["Read a story book", "Solve a puzzle", "Learn something new",
                    "Help with a small chore", "Practice drawing"]),
        "teen":   ("A balanced state — perfect for productivity or self-growth.",
                   ["Study or work on a project", "Read or watch educational content",
                    "Organise your space", "Try a new recipe", "Exercise or walk"]),
        "adult":  ("Stable mood — ideal for focused work and self-improvement.",
                   ["Exercise", "Reading", "Work on productivity tasks",
                    "Meal planning", "Learn a new skill online"]),
        "senior": ("A peaceful moment — great for reflection and light activity.",
                   ["Light exercise or stretching", "Reading", "Sudoku or crossword puzzle",
                    "Gardening", "Meditation"]),
    },

    # ── Excited ───────────────────────────────────────────────────────────────
    "excited": {
        "child":  ("Amazing energy! Let's use it well!",
                   ["Outdoor adventure play", "Dance party", "Create an art project",
                    "Invite friends to play", "Explore a new game"]),
        "teen":   ("High energy — make the most of it!",
                   ["Sports or intense workout", "Start that creative project you've been putting off",
                    "Hang out with friends", "Try something new and bold",
                    "Share your excitement on social media"]),
        "adult":  ("Positive momentum — capture it!",
                   ["Work on a passion project", "Go for a run or intense workout",
                    "Plan next steps for your goals", "Celebrate with friends",
                    "Try an adventure activity"]),
        "senior": ("Wonderful energy! Channel it gently.",
                   ["Light dancing", "Share your excitement with family",
                    "Start a new creative hobby", "Plan a social gathering",
                    "Take a scenic walk or drive"]),
    },

    # ── Stressed ──────────────────────────────────────────────────────────────
    "stressed": {
        "child":  ("Life can feel big sometimes. Here's how to feel smaller worries.",
                   ["Talk to a parent or teacher", "Hug a pet or stuffed animal",
                    "Take slow deep breaths", "Play with clay or playdough",
                    "Watch a calming show"]),
        "teen":   ("You've got this — but take care of yourself first.",
                   ["Meditation / mindfulness", "Exercise or yoga", "Take a short break from screens",
                    "Write in a stress journal", "Talk to someone you trust"]),
        "adult":  ("Manage the load — your wellbeing comes first.",
                   ["Meditation or deep breathing", "Exercise / yoga session",
                    "Prioritise tasks with a to-do list", "Limit screen time for 30 min",
                    "Take a power nap"]),
        "senior": ("Be gentle with yourself. Rest is productive.",
                   ["Slow breathing exercises", "Gentle yoga or stretching",
                    "Meditation", "Call a loved one", "Warm bath or shower"]),
    },

    # ── Fear ──────────────────────────────────────────────────────────────────
    "fear": {
        "child":  ("Feeling scared is normal. You are safe.",
                   ["Talk to a trusted adult", "Hold a comfort object", "Take slow breaths",
                    "Watch a comforting show", "Listen to calming music"]),
        "teen":   ("Face the fear slowly — you don't have to tackle it all at once.",
                   ["Deep breathing exercises", "Write down what you're afraid of",
                    "Talk to a friend or counsellor", "Grounding exercise (5-4-3-2-1 senses)",
                    "Listen to calming music"]),
        "adult":  ("Acknowledge the fear — then take one small step.",
                   ["Box breathing (4-4-4-4)", "Grounding mindfulness technique",
                    "Talk to a trusted person", "Exercise to reduce cortisol",
                    "Journaling to identify triggers"]),
        "senior": ("Fear is natural and manageable. Gentle steps help.",
                   ["Slow deep breathing", "Call a family member or friend",
                    "Meditation or prayer", "Light stretching",
                    "Listen to gentle soothing music"]),
    },

    # ── Surprise ──────────────────────────────────────────────────────────────
    "surprise": {
        "child":  ("Something unexpected happened! Here's how to process it.",
                   ["Talk about what surprised you", "Draw how it made you feel",
                    "Take a few deep breaths", "Play something familiar and comforting",
                    "Read a favourite book"]),
        "teen":   ("Take a moment to absorb it — then plan your reaction.",
                   ["Pause and reflect before reacting", "Write thoughts in a journal",
                    "Talk to a trusted friend", "Listen to music",
                    "Go for a short walk to process"]),
        "adult":  ("Unexpected events — process them with intention.",
                   ["Take a mindful pause", "Journal about what happened",
                    "Talk it through with someone", "Light exercise to reset",
                    "Plan your next steps calmly"]),
        "senior": ("Take your time to process the unexpected.",
                   ["Sit quietly with a cup of tea", "Call a family member",
                    "Light breathing exercise", "Write in a diary",
                    "Take a gentle walk"]),
    },
}

# Emotion aliases (from Phase 3/4/5 raw outputs → our keys)
_EMOTION_ALIASES: Dict[str, str] = {
    "joy":        "happy",
    "happiness":  "happy",
    "sadness":    "sad",
    "anger":      "angry",
    "fearful":    "fear",
    "scared":     "fear",
    "anxious":    "fear",
    "anxiety":    "stressed",
    "surprised":  "surprise",
    "disgust":    "frustrated",
    "disgusted":  "frustrated",
    "calm":       "neutral",
    "bored":      "neutral",
}

# Default age group as fallback
_FALLBACK_AGE_GROUP = "adult"


# ─── Main Recommendation Function ─────────────────────────────────────────────

def get_activity_recommendations(
    emotion: str,
    age_group: Optional[str] = None,
    age: Optional[int] = None,
    top_n: int = 5,
) -> Dict:
    """
    Get activity recommendations for a given emotion and age context.

    Args:
        emotion:    Detected emotion string (any casing, handles aliases)
        age_group:  'child' | 'teen' | 'adult' | 'senior'
        age:        Numeric age — used to derive age_group if not given
        top_n:      Maximum number of activities to return (default 5)

    Returns:
        {
            "emotion": str,
            "age_group": str,
            "activities": List[str],
            "description": str,
            "total_available": int,
        }
    """
    # ── Resolve emotion ─────────────────────────────────────────────────────
    clean_emotion = emotion.lower().strip()
    clean_emotion = _EMOTION_ALIASES.get(clean_emotion, clean_emotion)

    # ── Resolve age group ───────────────────────────────────────────────────
    if not age_group and age is not None:
        age_group = age_to_group(age)
    if not age_group:
        age_group = _FALLBACK_AGE_GROUP
    age_group = age_group.lower().strip()

    # ── Look up recommendation ──────────────────────────────────────────────
    emotion_recs = _RECOMMENDATIONS.get(clean_emotion)

    if not emotion_recs:
        # Emotion not in matrix — fall back to neutral
        emotion_recs = _RECOMMENDATIONS["neutral"]
        clean_emotion = "neutral"

    age_group_rec = emotion_recs.get(age_group) or emotion_recs.get(_FALLBACK_AGE_GROUP)

    if not age_group_rec:
        # Very unlikely, but use neutral adult as last resort
        age_group_rec = _RECOMMENDATIONS["neutral"][_FALLBACK_AGE_GROUP]

    description, activities = age_group_rec
    selected = activities[:top_n]

    return {
        "emotion": clean_emotion,
        "age_group": age_group,
        "activities": selected,
        "description": description,
        "total_available": len(activities),
    }


def get_all_emotions() -> List[str]:
    """Return all supported emotion keys."""
    return sorted(_RECOMMENDATIONS.keys())


def get_all_age_groups() -> List[str]:
    return ["child", "teen", "adult", "senior"]


def get_recommendations_matrix() -> Dict:
    """Return full matrix for admin/debug purposes."""
    matrix = {}
    for emotion, age_groups in _RECOMMENDATIONS.items():
        matrix[emotion] = {}
        for ag, (desc, acts) in age_groups.items():
            matrix[emotion][ag] = {"description": desc, "activity_count": len(acts)}
    return matrix
