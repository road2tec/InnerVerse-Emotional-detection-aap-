/**
 * Phase 3 Text Emotion API service
 * Wraps POST /detect-text-emotion backend endpoint
 */

import api from './api';

const PHASE3_EMOTIONS = ['happy', 'sad', 'angry', 'frustrated', 'neutral', 'excited', 'stressed'];

/**
 * Detect emotion from text via BERT-based NLP model
 * @param {string} text - User input text
 * @param {string|null} userId - Optional user ID for history
 * @param {string} ageGroup - User age group
 */
export const detectTextEmotion = async (text, userId = null, ageGroup = 'adult') => {
    const res = await api.post('/detect-text-emotion', {
        text,
        user_id: userId,
        age_group: ageGroup,
    });
    return res.data;
};

/**
 * Get text emotion model info (loaded model vs keyword fallback)
 */
export const getTextEmotionModelInfo = async () => {
    const res = await api.get('/detect-text-emotion/model-info');
    return res.data;
};

/**
 * Get text emotion detection history
 * @param {string|null} userId
 * @param {number} limit
 */
export const getTextEmotionHistory = async (userId = null, limit = 20) => {
    const params = { limit };
    if (userId) params.user_id = userId;
    const res = await api.get('/detect-text-emotion/history', { params });
    return res.data;
};

export { PHASE3_EMOTIONS };
export default { detectTextEmotion, getTextEmotionModelInfo, getTextEmotionHistory };
