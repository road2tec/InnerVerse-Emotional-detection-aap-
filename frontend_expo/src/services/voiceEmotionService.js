/**
 * Phase 4 Voice Emotion API Service
 * Wraps POST /detect-voice-emotion (multipart upload)
 */

import api from './api';

/** Phase 4 emotion labels */
export const PHASE4_EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fear'];

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Send recorded audio to backend for emotion detection using expo-file-system.
 * @param {string} fileUri - Local file URI from AudioRecorderPlayer
 * @param {string|null} userId
 * @param {string} ageGroup
 */
export const detectVoiceEmotion = async (fileUri, userId = null, ageGroup = 'adult') => {
    const token = await AsyncStorage.getItem('@emotion_app:access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = {
        age_group: ageGroup,
    };
    if (userId) params.user_id = userId;

    try {
        const uploadResult = await FileSystem.uploadAsync(`${BASE_URL}/detect-voice-emotion`, fileUri, {
            httpMethod: 'POST',
            uploadType: 1, // FileSystemUploadType.MULTIPART is 1
            fieldName: 'audio_file',
            mimeType: 'audio/m4a',
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
 * Get voice emotion model info (sklearn loaded vs rule-based fallback).
 */
export const getVoiceModelInfo = async () => {
    const res = await api.get('/detect-voice-emotion/model-info');
    return res.data;
};

/**
 * Get voice emotion detection history.
 */
export const getVoiceEmotionHistory = async (userId = null, limit = 20) => {
    const params = { limit };
    if (userId) params.user_id = userId;
    const res = await api.get('/detect-voice-emotion/history', { params });
    return res.data;
};

export default { detectVoiceEmotion, getVoiceModelInfo, getVoiceEmotionHistory };
