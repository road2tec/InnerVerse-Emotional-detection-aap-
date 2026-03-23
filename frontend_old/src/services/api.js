/**
 * API Service - Phase 2 updated
 * Auto-attaches JWT from AsyncStorage for every request
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ⚠️  Change this to your machine's LAN IP when running on a physical device
 *   Android emulator → 10.0.2.2
 *   iOS simulator   → 127.0.0.1
 *   Physical device → your local IP e.g. 192.168.x.x
 */
export const BASE_URL = 'http://10.0.2.2:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('@emotion_app:access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// Clear auth data on 401 responses
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([
        '@emotion_app:access_token',
        '@emotion_app:user',
      ]);
    }
    return Promise.reject(error);
  },
);

export default api;
