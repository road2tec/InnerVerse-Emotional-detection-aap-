/**
 * Emotion API Service - handles all emotion detection API calls
 */

import api from './api';
import { BASE_URL } from './api';

/**
 * Detect emotion from text
 * @param {string} text - Input text
 * @param {string|null} userId - Optional user ID
 */
export const detectEmotionFromText = async (text, userId = null) => {
    const response = await api.post('/emotion/text', {
        text,
        user_id: userId,
    });
    return response.data;
};

/**
 * Detect emotion from facial image
 * @param {string} imageUri - Local file URI of the image
 * @param {string|null} userId
 * @param {string} ageGroup - child, teen, adult, senior
 */
export const detectEmotionFromFacial = async (imageUri, userId = null, ageGroup = 'adult') => {
    const formData = new FormData();
    formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'face.jpg',
    });
    if (userId) formData.append('user_id', userId);
    formData.append('age_group', ageGroup);

    const response = await api.post('/emotion/facial', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

/**
 * Detect emotion from voice audio
 * @param {string} audioUri - Local file URI of the audio
 * @param {string|null} userId
 * @param {string} ageGroup
 */
export const detectEmotionFromVoice = async (audioUri, userId = null, ageGroup = 'adult') => {
    const formData = new FormData();
    formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'voice.wav',
    });
    if (userId) formData.append('user_id', userId);
    formData.append('age_group', ageGroup);

    const response = await api.post('/emotion/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

/**
 * Get activity recommendations for a detected emotion
 * @param {string} emotion - Detected emotion
 * @param {string} ageGroup - Target age group
 * @param {string|null} userId
 */
export const getRecommendations = async (emotion, ageGroup, userId = null) => {
    const response = await api.post('/recommendations/', {
        emotion,
        age_group: ageGroup,
        user_id: userId,
    });
    return response.data;
};

/**
 * Get user's emotion detection history
 * @param {string} userId
 */
export const getUserHistory = async userId => {
    const response = await api.get(`/users/history/${userId}`);
    return response.data;
};

export default {
    detectEmotionFromText,
    detectEmotionFromFacial,
    detectEmotionFromVoice,
    getRecommendations,
    getUserHistory,
};
