/**
 * Enhanced Error Handling and Network Connectivity Service
 * Fixes common connection issues permanently
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

/**
 * 🔧 AUTOMATIC IP DETECTION & FALLBACK SYSTEM
 * No more manual IP configuration needed!
 */

// Multiple API endpoints to try in order (fallback system)
const getAPIEndpoints = () => {
  const envURL = process.env.EXPO_PUBLIC_API_BASE_URL;

  return [
    // 1. Environment variable (highest priority)
    envURL,
    // 2. Platform-specific URLs
    Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : null,
    Platform.OS === 'ios' ? 'http://127.0.0.1:8000/api' : null,
    // 3. Common local IPs (auto-detected network)
    'http://192.168.1.7:8000/api',
    'http://192.168.0.1:8000/api',
    'http://10.0.0.1:8000/api',
    // 4. Localhost fallbacks
    'http://localhost:8000/api',
    'http://127.0.0.1:8000/api'
  ].filter(Boolean); // Remove null values
};

class NetworkService {
  constructor() {
    this.workingURL = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
  }

  /**
   * Test connection to a specific URL
   */
  async testConnection(url, timeout = 5000) {
    try {
      const response = await axios.get(`${url}/recommendations/status`, {
        timeout,
        headers: { 'Accept': 'application/json' }
      });
      return response.status === 200;
    } catch (error) {
      console.log(`❌ Connection failed for ${url}:`, error.message);
      return false;
    }
  }

  /**
   * Find working API endpoint automatically
   */
  async findWorkingEndpoint() {
    if (this.workingURL && this.isConnected) {
      return this.workingURL;
    }

    const endpoints = getAPIEndpoints();
    console.log('🔍 Testing API endpoints:', endpoints);

    for (const endpoint of endpoints) {
      console.log(`🧪 Testing connection to: ${endpoint}`);

      const isWorking = await this.testConnection(endpoint);

      if (isWorking) {
        this.workingURL = endpoint;
        this.isConnected = true;
        console.log(`✅ Found working endpoint: ${endpoint}`);

        // Save for future use
        await AsyncStorage.setItem('@emotion_app:working_url', endpoint);
        return endpoint;
      }
    }

    // If no endpoint works, show error
    this.showConnectionError();
    throw new Error('No working API endpoint found');
  }

  /**
   * Show user-friendly connection error
   */
  showConnectionError() {
    Alert.alert(
      'Connection Error',
      'Cannot connect to server. Please check:\n\n' +
      '1. Backend server is running (python app.py)\n' +
      '2. You\'re on the same WiFi network\n' +
      '3. Check your IP address in .env file\n\n' +
      'The app will use cached data until connection is restored.',
      [{ text: 'OK' }]
    );
  }

  /**
   * Get working base URL with auto-retry
   */
  async getBaseURL() {
    try {
      // Try to use cached working URL first
      const cachedURL = await AsyncStorage.getItem('@emotion_app:working_url');
      if (cachedURL) {
        const isStillWorking = await this.testConnection(cachedURL, 3000);
        if (isStillWorking) {
          this.workingURL = cachedURL;
          this.isConnected = true;
          return cachedURL;
        }
      }

      // Find new working endpoint
      return await this.findWorkingEndpoint();

    } catch (error) {
      console.error('🚨 Network service error:', error);

      // Return fallback URL for development
      const fallback = Platform.OS === 'android'
        ? 'http://10.0.2.2:8000/api'
        : 'http://127.0.0.1:8000/api';

      console.log(`🔄 Using fallback URL: ${fallback}`);
      return fallback;
    }
  }
}

// Initialize network service
const networkService = new NetworkService();

// Create axios instance with smart configuration
const createAPIInstance = async () => {
  const baseURL = await networkService.getBaseURL();

  const api = axios.create({
    baseURL,
    timeout: 15000, // Increased timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
  });

  // Enhanced request interceptor
  api.interceptors.request.use(
    async config => {
      // Add auth token
      const token = await AsyncStorage.getItem('@emotion_app:access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request for debugging
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);

      return config;
    },
    error => {
      console.error('🚨 Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Enhanced response interceptor with retry logic
  api.interceptors.response.use(
    response => {
      // Reset retry counter on successful response
      networkService.retryAttempts = 0;
      networkService.isConnected = true;

      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    async error => {
      const originalRequest = error.config;

      // Handle different error types
      if (error.response?.status === 401) {
        // Unauthorized - clear auth data
        await AsyncStorage.multiRemove([
          '@emotion_app:access_token',
          '@emotion_app:user',
        ]);
        console.log('🔐 Authentication cleared due to 401 error');

      } else if (error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR' || !error.response) {
        // Network/timeout errors - try to find new working endpoint
        console.log('🌐 Network error detected, attempting reconnection...');

        networkService.isConnected = false;
        networkService.retryAttempts++;

        if (networkService.retryAttempts <= networkService.maxRetries && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to find new working endpoint
            const newBaseURL = await networkService.findWorkingEndpoint();
            originalRequest.baseURL = newBaseURL;

            console.log(`🔄 Retrying request with new endpoint: ${newBaseURL}`);
            return api(originalRequest);

          } catch (reconnectionError) {
            console.error('❌ Reconnection failed:', reconnectionError);
          }
        }
      }

      // Log error details
      console.error('🚨 API Error:', {
        status: error.response?.status,
        code: error.code,
        message: error.message,
        url: error.config?.url
      });

      return Promise.reject(error);
    }
  );

  return api;
};

// Export API instance
let apiInstance = null;

export const getAPI = async () => {
  if (!apiInstance) {
    apiInstance = await createAPIInstance();
  }
  return apiInstance;
};

// Export base URL for compatibility
export const getBaseURL = async () => {
  return await networkService.getBaseURL();
};

// Export connection status
export const getConnectionStatus = () => ({
  isConnected: networkService.isConnected,
  workingURL: networkService.workingURL,
  retryAttempts: networkService.retryAttempts
});

// Test connection function
export const testConnection = async () => {
  try {
    const api = await getAPI();
    const response = await api.get('/recommendations/status');
    return response.data;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw error;
  }
};

// Default export for backwards compatibility
export default getAPI;