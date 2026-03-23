/**
 * API Service - Phase 2 updated
 * Auto-attaches JWT from AsyncStorage for every request
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

/**
 * API base URL resolution strategy:
 * 1) EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_API_URL (if set)
 * 2) Probe likely local hosts (Expo host / Metro host / emulator loopback)
 * 3) Pick the first host whose /health returns success
 */
const getHostFromUrl = (rawUrl) => {
  const value = (rawUrl || '').trim();
  if (!value) return null;
  try {
    const match = value.match(/^[a-zA-Z]+:\/\/([^/:]+)(?::\d+)?\//);
    if (match?.[1]) return match[1];
    const noSchemeMatch = value.match(/^([^/:]+)(?::\d+)?$/);
    if (noSchemeMatch?.[1]) return noSchemeMatch[1];
    return null;
  } catch {
    return null;
  }
};

const getDevHostFromMetro = () => {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
    return getHostFromUrl(scriptURL);
  } catch {
    return null;
  }
};

const getExpoHost = () => {
  try {
    const Constants = require('expo-constants').default;
    const possible = [
      Constants?.expoConfig?.hostUri,
      Constants?.expoGoConfig?.debuggerHost,
      Constants?.manifest?.debuggerHost,
    ].filter(Boolean);

    for (const entry of possible) {
      const host = getHostFromUrl(String(entry).includes('://') ? entry : `http://${entry}`);
      if (host) return host;
    }
    return null;
  } catch {
    return null;
  }
};

const normalizeApiBase = (rawUrl) => {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const buildCandidateApiBases = () => {
  const envBase = normalizeApiBase(
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    ''
  );

  const packagerHost = getHostFromUrl(process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '');

  const hostCandidates = [
    getExpoHost(),
    getDevHostFromMetro(),
    packagerHost,
    Platform.OS === 'android' ? '10.0.2.2' : null,
    '127.0.0.1',
    'localhost',
  ].filter(Boolean);

  const dedupedHosts = [...new Set(hostCandidates)];
  const hostBases = dedupedHosts.map(host => `http://${host}:8000/api`);

  return [...new Set([...hostBases, envBase].filter(Boolean))];
};

const toHealthUrl = (apiBase) => `${apiBase.replace(/\/api$/, '')}/health`;

let resolvedApiBase = null;
let resolvingPromise = null;

const resolveWorkingApiBase = async () => {
  if (resolvedApiBase) return resolvedApiBase;
  if (resolvingPromise) return resolvingPromise;

  resolvingPromise = (async () => {
    const candidates = buildCandidateApiBases();
    const probe = axios.create({ timeout: 2500 });

    for (const candidate of candidates) {
      try {
        const res = await probe.get(toHealthUrl(candidate));
        if (res.status >= 200 && res.status < 500) {
          resolvedApiBase = candidate;
          return resolvedApiBase;
        }
      } catch {
      }
    }

    resolvedApiBase = candidates[0] || 'http://127.0.0.1:8000/api';
    return resolvedApiBase;
  })();

  try {
    return await resolvingPromise;
  } finally {
    resolvingPromise = null;
  }
};

const DEFAULT_LOCAL_BASE_URL = buildCandidateApiBases()[0] || (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api');

export let BASE_URL = DEFAULT_LOCAL_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT and resolve working backend host before every request
api.interceptors.request.use(
  async config => {
    const workingBase = await resolveWorkingApiBase();
    BASE_URL = workingBase;
    config.baseURL = workingBase;

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
