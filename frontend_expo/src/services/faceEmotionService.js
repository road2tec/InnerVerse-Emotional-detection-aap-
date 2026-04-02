/**
 * Phase 5 Face Emotion API Service
 * Wraps POST /detect-face-emotion (multipart image upload)
 */

import api from './api';

/** Phase 5 emotion labels */
export const PHASE5_EMOTIONS = ['happy', 'sad', 'angry', 'surprise', 'neutral'];

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Send captured image to backend for face emotion detection using expo-file-system.
 * @param {string} imageUri - Local image URI from react-native-image-picker
 * @param {string|null} userId
 * @param {string} ageGroup
 */
export const detectFaceEmotion = async (imageUri, userId = null, ageGroup = 'adult') => {
    const token = await AsyncStorage.getItem('@emotion_app:access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = {
        age_group: ageGroup,
    };
    if (userId) params.user_id = userId;

    try {
        const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/detect-face-emotion`, imageUri, {
            httpMethod: 'POST',
            uploadType: 1, // FileSystemUploadType.MULTIPART is 1
            fieldName: 'image_file',
            mimeType: 'image/jpeg',
            parameters: params,
            headers,
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
            let errData = {};
            try { errData = JSON.parse(uploadResult.body); } catch (e) { }
            throw { response: { data: errData, status: uploadResult.status } };
        }

        return JSON.parse(uploadResult.body);
    } catch (e) {
        throw e;
    }
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
