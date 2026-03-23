/**
 * Emotion utility helpers
 */

export const EMOTIONS = {
    happy: { emoji: '😊', color: '#FFD700', bg: '#1A1A00', label: 'Happy' },
    sad: { emoji: '😢', color: '#4A9EFF', bg: '#001233', label: 'Sad' },
    angry: { emoji: '😠', color: '#FF4444', bg: '#1A0000', label: 'Angry' },
    anxious: { emoji: '😰', color: '#FF8C00', bg: '#1A0A00', label: 'Anxious' },
    neutral: { emoji: '😐', color: '#AAAAAA', bg: '#1A1A1A', label: 'Neutral' },
    surprised: { emoji: '😲', color: '#FF69B4', bg: '#1A0015', label: 'Surprised' },
    disgusted: { emoji: '🤢', color: '#44BB44', bg: '#001A00', label: 'Disgusted' },
    fearful: { emoji: '😨', color: '#9B59B6', bg: '#0D0017', label: 'Fearful' },
};

export const AGE_GROUPS = [
    { label: 'Child (0-12)', value: 'child' },
    { label: 'Teen (13-19)', value: 'teen' },
    { label: 'Adult (20-59)', value: 'adult' },
    { label: 'Senior (60+)', value: 'senior' },
];

export const getEmotionInfo = (emotion) => {
    const key = emotion?.toLowerCase();
    return EMOTIONS[key] || EMOTIONS.neutral;
};

export const getAgeGroup = (age) => {
    if (age <= 12) return 'child';
    if (age <= 19) return 'teen';
    if (age <= 59) return 'adult';
    return 'senior';
};

export const formatConfidence = (confidence) => {
    return `${Math.round(confidence * 100)}%`;
};

export const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
