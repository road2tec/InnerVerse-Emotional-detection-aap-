/**
 * Phase 6 Activity Recommendation API Service
 * Wraps POST /recommendations for AI-powered activity suggestions
 */

import api from './api';

/**
 * Get activity recommendations based on emotion and age.
 * @param {string} emotion - Detected emotion label
 * @param {string} ageGroup - Age group (child/teen/adult/senior)
 * @param {string|null} userId - Optional user ID for history tracking
 */
export const getActivityRecommendations = async (emotion, ageGroup, userId = null) => {
    console.log('🎯 API Call: getActivityRecommendations', { emotion, ageGroup, userId });

    const payload = {
        emotion: emotion.toLowerCase(),
        age_group: ageGroup.toLowerCase(),
    };
    if (userId) payload.user_id = userId;

    console.log('📤 Request payload:', payload);

    const res = await api.post('/recommendations/', payload);
    console.log('📥 API response:', res.data);
    return res.data;
};

/**
 * Get sample recommendation for testing
 */
export const getSampleRecommendation = async (emotion, ageGroup) => {
    const res = await api.get(`/recommendations/sample?emotion=${emotion}&age_group=${ageGroup}`);
    return res.data;
};

/**
 * Get all supported emotions and age groups
 */
export const getSupportedEmotions = async () => {
    const res = await api.get('/recommendations/emotions');
    return res.data;
};

/**
 * Get recommendation service status
 */
export const getRecommendationStatus = async () => {
    const res = await api.get('/recommendations/status');
    return res.data;
};

export default {
    getActivityRecommendations,
    getSampleRecommendation,
    getSupportedEmotions,
    getRecommendationStatus
};
