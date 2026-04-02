/**
 * 🔧 Network Connection Testing & Troubleshooting Utility
 * Use this to diagnose and fix API connection issues
 */

import { Alert, Platform } from 'react-native';
import { BASE_URL, ALTERNATIVE_URLS } from './api';

/**
 * Test all possible API URLs and find working one
 */
export const testAllConnections = async () => {
  const urlsToTest = [BASE_URL, ...ALTERNATIVE_URLS];
  const results = [];

  console.log('🔍 Testing connections to detect network issues...');

  for (const url of urlsToTest) {
    try {
      const testUrl = url.replace('/api', '/health');
      const response = await fetch(testUrl, { timeout: 5000 });

      results.push({
        url,
        status: response.ok ? 'SUCCESS' : `HTTP ${response.status}`,
        working: response.ok
      });

      if (response.ok) {
        console.log('✅ Working URL found:', url);
      }
    } catch (err) {
      results.push({
        url,
        status: `ERROR: ${err.message}`,
        working: false
      });
    }
  }

  return results;
};

/**
 * Auto-fix connection by trying alternative URLs
 */
export const autoFixConnection = async () => {
  const results = await testAllConnections();
  const workingUrl = results.find(r => r.working);

  if (workingUrl) {
    Alert.alert(
      '✅ Connection Fixed!',
      `Found working URL: ${workingUrl.url}\n\nTo make this permanent:\n1. Edit .env file\n2. Set: EXPO_PUBLIC_API_BASE_URL=${workingUrl.url}\n3. Restart app`,
      [
        { text: 'Got it!', style: 'default' }
      ]
    );
    return workingUrl.url;
  } else {
    Alert.alert(
      '❌ Connection Failed',
      'No working backend connection found.\n\nTroubleshooting:\n1. Is backend running? (python app.py)\n2. Check your WiFi network\n3. Verify IP address',
      [
        { text: 'Help', onPress: () => showNetworkHelp() },
        { text: 'OK', style: 'cancel' }
      ]
    );
    return null;
  }
};

/**
 * Show network troubleshooting help
 */
export const showNetworkHelp = () => {
  const platform = Platform.OS;

  Alert.alert(
    '🆘 Network Troubleshooting',
    `Device: ${platform}\n\n` +
    '1. Backend Running?\n' +
    '   • cd backend && python app.py\n' +
    '   • Should see: "Uvicorn running on http://0.0.0.0:8000"\n\n' +
    '2. Find Your IP:\n' +
    '   • Terminal: ifconfig | grep inet\n' +
    '   • Settings > Network > WiFi\n\n' +
    '3. Update Config:\n' +
    '   • Edit .env file\n' +
    '   • Set: EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api\n\n' +
    '4. Restart: npx expo start --clear',
    [{ text: 'OK' }]
  );
};

/**
 * Quick connection test (use in screens)
 */
export const quickConnectionTest = async () => {
  try {
    const testUrl = BASE_URL.replace('/api', '/health');
    const response = await fetch(testUrl, { timeout: 3000 });
    return response.ok;
  } catch {
    return false;
  }
};

export default {
  testAllConnections,
  autoFixConnection,
  showNetworkHelp,
  quickConnectionTest
};