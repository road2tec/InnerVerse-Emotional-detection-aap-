/**
 * Phase 7 Emotion History API Service
 * GET    /history              — paginated list with filters
 * GET    /history/stats        — aggregated stats
 * GET    /history/{id}         — single record
 * DELETE /history/{id}         — delete one record
 * DELETE /history/clear        — delete all for user
 */

import api from './api';

/**
 * Fetch emotion history (paginated + optional filters)
 * @param {string|null} userId
 * @param {object} options - { limit, skip, inputType, emotion }
 */
export const getEmotionHistory = async (userId = null, options = {}) => {
    const { limit = 20, skip = 0, inputType = null, emotion = null } = options;
    const params = { limit, skip };
    if (userId) params.user_id = userId;
    if (inputType) params.input_type = inputType;
    if (emotion) params.emotion = emotion;

    const res = await api.get('/history', { params });
    return res.data;
};

/**
 * Get aggregated emotion stats for a user
 */
export const getHistoryStats = async (userId = null) => {
    const params = {};
    if (userId) params.user_id = userId;
    const res = await api.get('/history/stats', { params });
    return res.data;
};

/**
 * Get 7-day weekly summary trend for dashboard analytics chart
 */
export const getWeeklySummary = async (userId = null) => {
    const params = {};
    if (userId) params.user_id = userId;
    const res = await api.get('/history/weekly-summary', { params });
    return res.data;
};

/**
 * Get single history record
 */
export const getHistoryRecord = async (recordId) => {
    const res = await api.get(`/history/${recordId}`);
    return res.data;
};

/**
 * Delete single history record by ID
 */
export const deleteHistoryRecord = async (recordId) => {
    const res = await api.delete(`/history/${recordId}`);
    return res.data;
};

/**
 * Delete all history records for a user
 */
export const clearHistory = async (userId = null) => {
    const params = {};
    if (userId) params.user_id = userId;
    const res = await api.delete('/history/clear', { params });
    return res.data;
};

export default {
    getEmotionHistory, getHistoryStats, getWeeklySummary, getHistoryRecord,
    deleteHistoryRecord, clearHistory,
};
