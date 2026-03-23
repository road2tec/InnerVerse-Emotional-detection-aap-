/**
 * Phase 5 Face Emotion API Service
 * Wraps POST /detect-face-emotion (multipart image upload)
 */

import api from './api';

/** Phase 5 emotion labels */
export const PHASE5_EMOTIONS = ['happy', 'sad', 'angry', 'surprise', 'neutral'];

/**
 * Send captured image to backend for face emotion detection.
 * @param {string} imageUri - Local image URI from react-native-image-picker
 * @param {string|null} userId
 * @param {string} ageGroup
 */
export const detectFaceEmotion = async (imageUri, userId = null, ageGroup = 'adult') => {
    const formData = new FormData();

    formData.append('image_file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'face_photo.jpg',
    });

    if (userId) formData.append('user_id', userId);
    formData.append('age_group', ageGroup);

    const res = await api.post('/detect-face-emotion', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
    });
    return res.data;
};

/**
 * Get face emotion model status (DeepFace / Keras / pixel-rules)
 */
export const getFaceModelInfo = async () => {
    const res = await api.get('/detect-face-emotion/model-info');
    return res.data;
};

/**
 * Get facial emotion history
 */
export const getFaceEmotionHistory = async (userId = null, limit = 20) => {
    const params = { limit };
    if (userId) params.user_id = userId;
    const res = await api.get('/detect-face-emotion/history', { params });
    return res.data;
};

export default { detectFaceEmotion, getFaceModelInfo, getFaceEmotionHistory };
