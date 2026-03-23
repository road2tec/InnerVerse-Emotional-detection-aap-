/**
 * Connection Test Screen - Debug and Fix Connectivity Issues
 * This screen helps users diagnose and resolve connection problems
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAPI, getConnectionStatus, testConnection, getBaseURL } from '../services/api_enhanced';

const ConnectionTestScreen = ({ navigation }) => {
  const [testResults, setTestResults] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState({});
  const [currentURL, setCurrentURL] = useState('');

  useEffect(() => {
    loadConnectionInfo();
  }, []);

  const loadConnectionInfo = async () => {
    try {
      const baseURL = await getBaseURL();
      const status = getConnectionStatus();
      const cachedURL = await AsyncStorage.getItem('@emotion_app:working_url');

      setCurrentURL(baseURL);
      setConnectionInfo({
        ...status,
        cachedURL,
        envURL: process.env.EXPO_PUBLIC_API_BASE_URL
      });
    } catch (error) {
      console.error('Failed to load connection info:', error);
    }
  };

  const runConnectionTests = async () => {
    setIsTesting(true);
    setTestResults([]);
    const results = [];

    // Test endpoints in order
    const endpoints = [
      process.env.EXPO_PUBLIC_API_BASE_URL,
      'http://10.0.2.2:8000/api', // Android emulator
      'http://127.0.0.1:8000/api', // iOS simulator
      'http://192.168.1.7:8000/api', // Current IP
      'http://localhost:8000/api' // Localhost
    ].filter(Boolean);

    for (const endpoint of endpoints) {
      results.push({
        url: endpoint,
        status: 'testing',
        message: 'Testing connection...'
      });
      setTestResults([...results]);

      try {
        const api = await getAPI();
        const response = await fetch(`${endpoint}/recommendations/status`, {
          method: 'GET',
          timeout: 5000
        });

        if (response.ok) {
          const data = await response.json();
          results[results.length - 1] = {
            url: endpoint,
            status: 'success',
            message: `✅ Connected! Server status: ${data.service_status}`
          };
        } else {
          results[results.length - 1] = {
            url: endpoint,
            status: 'error',
            message: `❌ HTTP ${response.status}: ${response.statusText}`
          };
        }
      } catch (error) {
        results[results.length - 1] = {
          url: endpoint,
          status: 'error',
          message: `❌ ${error.message || 'Connection failed'}`
        };
      }

      setTestResults([...results]);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
    }

    setIsTesting(false);
  };

  const clearCachedData = async () => {
    try {
      await AsyncStorage.multiRemove([
        '@emotion_app:working_url',
        '@emotion_app:access_token',
        '@emotion_app:user'
      ]);

      Alert.alert('Success', 'Cached data cleared. The app will search for servers again.');
      await loadConnectionInfo();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear cached data');
    }
  };

  const showFixInstructions = () => {
    Alert.alert(
      'Connection Fix Instructions',
      'To fix connection issues:\n\n' +
      '1. Make sure backend server is running:\n' +
      '   cd backend && python app.py\n\n' +
      '2. Check your WiFi - device and computer must be on same network\n\n' +
      '3. Find your computer\'s IP address:\n' +
      '   • macOS: ifconfig | grep "inet "\n' +
      '   • Windows: ipconfig\n\n' +
      '4. Update .env file with your IP:\n' +
      '   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api\n\n' +
      '5. Restart Expo: npx expo start --clear',
      [{ text: 'OK' }]
    );
  };

  const testCurrentConnection = async () => {
    try {
      setIsTesting(true);
      const result = await testConnection();
      Alert.alert(
        'Connection Test',
        `✅ Successfully connected!\n\nServer Status: ${result.service_status}\nAI Available: ${result.ai_recommendations ? 'Yes' : 'No'}`
      );
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        `❌ Cannot connect to server:\n\n${error.message}\n\nTap "Fix Instructions" for help.`
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔧 Connection Diagnostics</Text>

      {/* Current Connection Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Configuration</Text>
        <Text style={styles.infoText}>Active URL: {currentURL}</Text>
        <Text style={styles.infoText}>
          Status: {connectionInfo.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </Text>
        {connectionInfo.cachedURL && (
          <Text style={styles.infoText}>Cached URL: {connectionInfo.cachedURL}</Text>
        )}
        {connectionInfo.envURL && (
          <Text style={styles.infoText}>Environment URL: {connectionInfo.envURL}</Text>
        )}
      </View>

      {/* Quick Test Buttons */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={testCurrentConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>🧪 Test Current Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={runConnectionTests}
          disabled={isTesting}
        >
          <Text style={styles.buttonText}>🔍 Test All Endpoints</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {testResults.map((result, index) => (
            <View key={index} style={styles.testResult}>
              <Text style={styles.urlText}>{result.url}</Text>
              <Text
                style={[
                  styles.resultText,
                  result.status === 'success' ? styles.successText : styles.errorText
                ]}
              >
                {result.message}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={clearCachedData}
        >
          <Text style={styles.buttonText}>🗑️ Clear Cached Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.infoButton]}
          onPress={showFixInstructions}
        >
          <Text style={styles.buttonText}>📖 Fix Instructions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>← Back to App</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333'
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333'
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
    fontFamily: 'monospace'
  },
  button: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: '#007AFF'
  },
  secondaryButton: {
    backgroundColor: '#34C759'
  },
  warningButton: {
    backgroundColor: '#FF9500'
  },
  errorButton: {
    backgroundColor: '#FF3B30'
  },
  infoButton: {
    backgroundColor: '#5856D6'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  testResult: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 4
  },
  urlText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4
  },
  resultText: {
    fontSize: 14,
    fontWeight: '500'
  },
  successText: {
    color: '#34C759'
  },
  errorText: {
    color: '#FF3B30'
  }
});

export default ConnectionTestScreen;