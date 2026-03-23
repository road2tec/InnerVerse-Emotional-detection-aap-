/**
 * Phase 4 Voice Emotion API Service
 * Wraps POST /detect-voice-emotion (multipart upload)
 */

import api from './api';

/** Phase 4 emotion labels */
export const PHASE4_EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fear'];

/**
 * Send recorded audio to backend for emotion detection.
 * @param {string} fileUri - Local file URI from AudioRecorderPlayer
 * @param {string|null} userId
 * @param {string} ageGroup
 */
export const detectVoiceEmotion = async (fileUri, userId = null, ageGroup = 'adult') => {
    const formData = new FormData();

    // React Native FormData accepts { uri, type, name }
    formData.append('audio_file', {
        uri: fileUri,
        type: 'audio/m4a',        // AudioRecorderPlayer default on iOS/Android
        name: 'voice_recording.m4a',
    });

    if (userId) formData.append('user_id', userId);
    formData.append('age_group', ageGroup);

    const res = await api.post('/detect-voice-emotion', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,  // Audio processing can take a few seconds
    });

    return res.data;
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
