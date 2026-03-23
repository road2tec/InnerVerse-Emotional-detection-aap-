/**
 * Auth Service - Phase 2 Enhanced
 * Handles signup, login, logout, profile, and secure token storage
 */

import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@emotion_app:access_token';
const USER_KEY = '@emotion_app:user';

// ─── Token Storage ─────────────────────────────────────────────────────────────

export const saveToken = async (token) => AsyncStorage.setItem(TOKEN_KEY, token);
export const getToken = async () => AsyncStorage.getItem(TOKEN_KEY);
export const clearToken = async () => AsyncStorage.removeItem(TOKEN_KEY);

export const saveUser = async (user) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
export const getStoredUser = async () => {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
};
export const clearUser = async () => AsyncStorage.removeItem(USER_KEY);

// ─── Auth API calls ────────────────────────────────────────────────────────────

/**
 * Sign up a new user
 * @param {{name: string, email: string, password: string, age: number}} data
 */
export const signupUser = async ({ name, email, password, age }) => {
    const res = await api.post('/users/signup', { name, email, password, age });
    const { access_token, user } = res.data;
    await saveToken(access_token);
    await saveUser(user);
    return res.data;
};

/**
 * Login with email + password
 * @param {string} email
 * @param {string} password
 */
export const loginUser = async (email, password) => {
    const res = await api.post('/users/login', { email, password });
    const { access_token, user } = res.data;
    await saveToken(access_token);
    await saveUser(user);
    return res.data;
};

/**
 * Logout - clear all stored auth data
 */
export const logoutUser = async () => {
    await clearToken();
    await clearUser();
};

/**
 * Fetch full profile from API (authenticated)
 */
export const fetchProfile = async () => {
    const res = await api.get('/users/profile');
    await saveUser(res.data);
    return res.data;
};

/**
 * Update profile fields (name / age)
 */
export const updateProfile = async (fields) => {
    const res = await api.patch('/users/profile', fields);
    await saveUser(res.data);
    return res.data;
};

/**
 * Check if a token is stored (user is "logged in")
 */
export const isAuthenticated = async () => {
    const token = await getToken();
    return !!token;
};

export default {
    signupUser,
    loginUser,
    logoutUser,
    fetchProfile,
    updateProfile,
    isAuthenticated,
    getStoredUser,
    getToken,
};
