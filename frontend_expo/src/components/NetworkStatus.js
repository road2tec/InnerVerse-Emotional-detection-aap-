/**
 * 🌐 Network Status Widget
 * Shows connection status and provides quick troubleshooting
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { quickConnectionTest, autoFixConnection } from '../utils/networkTester';

export default function NetworkStatus() {
  const [isConnected, setIsConnected] = useState(null); // null = testing, true/false = result
  const [lastTest, setLastTest] = useState(null);

  const testConnection = async () => {
    setIsConnected(null); // Show testing state
    try {
      const result = await quickConnectionTest();
      setIsConnected(result);
      setLastTest(new Date().toLocaleTimeString());
    } catch (err) {
      setIsConnected(false);
      setLastTest(new Date().toLocaleTimeString());
    }
  };

  // Test connection on component mount
  useEffect(() => {
    testConnection();

    // Re-test every 30 seconds
    const interval = setInterval(testConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTroubleshoot = async () => {
    Alert.alert(
      '🔧 Connection Troubleshooting',
      'Testing all possible connections...',
      [{ text: 'OK' }]
    );

    await autoFixConnection();
    testConnection(); // Re-test after troubleshooting
  };

  const getStatusColor = () => {
    if (isConnected === null) return '#FFB800'; // Testing (yellow)
    return isConnected ? '#00C853' : '#F44336'; // Success (green) / Error (red)
  };

  const getStatusText = () => {
    if (isConnected === null) return 'Testing...';
    return isConnected ? 'Connected' : 'Connection Error';
  };

  const getStatusIcon = () => {
    if (isConnected === null) return '🔍';
    return isConnected ? '✅' : '❌';
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
      <Text style={styles.statusText}>
        {getStatusIcon()} {getStatusText()}
      </Text>

      {lastTest && (
        <Text style={styles.lastTest}>Last: {lastTest}</Text>
      )}

      <TouchableOpacity
        style={[styles.button, { opacity: isConnected === false ? 1 : 0.7 }]}
        onPress={isConnected === false ? handleTroubleshoot : testConnection}
      >
        <Text style={styles.buttonText}>
          {isConnected === false ? '🔧 Fix' : '🔄 Test'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  lastTest: {
    color: '#AAAAAA',
    fontSize: 10,
    marginRight: 8,
  },
  button: {
    backgroundColor: '#E94560',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});