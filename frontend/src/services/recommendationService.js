/**
 * Phase 6 Activity Recommendation API Service
 * Wraps POST /recommend-activity
 */

import api from './api';

/**
 * Get activity recommendations based on emotion and age.
 * @param {string} emotion - Detected emotion label
 * @param {number|null} age - User's numeric age (auto-converts to age group)
 * @param {string|null} ageGroup - Explicit age group override
 * @param {string|null} userId - Optional user ID for history tracking
 */
export const getActivityRecommendations = async (emotion, age = null, ageGroup = null, userId = null) => {
    const payload = { emotion };
    if (age !== null) payload.age = age;
    if (ageGroup) payload.age_group = ageGroup;
    if (userId) payload.user_id = userId;

    const res = await api.post('/recommend-activity', payload);
    return res.data;
};

/**
 * GET convenience alias — same as POST but via query params
 */
export const getRecommendationsGet = async (emotion, age = null, ageGroup = null) => {
    const params = { emotion };
    if (age !== null) params.age = age;
    if (ageGroup) params.age_group = ageGroup;
    const res = await api.get('/recommendations', { params });
    return res.data;
};

/**
 * Get full recommendation matrix (all emotions × age groups)
 */
export const getRecommendationMatrix = async () => {
    const res = await api.get('/recommendations/all');
    return res.data;
};

/**
 * Get supported emotions and age groups
 */
export const getSupportedEmotions = async () => {
    const res = await api.get('/recommendations/emotions');
    return res.data;
};

export default { getActivityRecommendations, getRecommendationsGet, getRecommendationMatrix, getSupportedEmotions };
