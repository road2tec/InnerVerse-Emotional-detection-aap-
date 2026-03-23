/**
 * Network Configuration Helper
 * Helps users detect and configure the correct API URL
 */

import { Platform } from 'react-native';

/**
 * Get setup instructions based on platform
 */
export const getSetupInstructions = () => {
  const platform = Platform.OS;

  return {
    platform,
    instructions: {
      'Find Your IP Address': platform === 'ios'
        ? 'Settings > Wi-Fi > (i) icon > IP Address'
        : 'Settings > Network > WiFi > Advanced',
      'Terminal Command': platform === 'ios'
        ? 'ifconfig | grep "inet " | grep -v 127.0.0.1'
        : 'ipconfig | findstr "IPv4"',
      'Update Config': 'Edit .env file: EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api',
      'Restart App': 'Run: npx expo start --clear'
    },
    commonIPs: [
      '192.168.1.x (Most common home WiFi)',
      '192.168.0.x (Router default)',
      '10.0.0.x (Corporate networks)',
      '172.16.x.x (Private networks)'
    ]
  };
};

/**
 * Validate if a URL looks correct
 */
export const validateAPIURL = (url) => {
  try {
    const parsed = new URL(url);
    return {
      valid: parsed.protocol === 'http:' || parsed.protocol === 'https:',
      protocol: parsed.protocol,
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
      message: parsed.protocol === 'http:' && parsed.hostname !== 'localhost'
        ? 'URL looks good!'
        : 'Note: Make sure backend is running on this address'
    };
  } catch (e) {
    return {
      valid: false,
      message: 'Invalid URL format'
    };
  }
};

/**
 * Generate common URL options based on detected network
 */
export const generateURLOptions = () => {
  return [
    'http://127.0.0.1:8000/api (Localhost)',
    'http://10.0.2.2:8000/api (Android Emulator)',
    'http://192.168.1.x:8000/api (Common WiFi)',
    'http://192.168.0.x:8000/api (Router Default)',
  ];
};

export default {
  getSetupInstructions,
  validateAPIURL,
  generateURLOptions
};