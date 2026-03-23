/**
 * DetectScreen - Main emotion detection screen
 * Supports: Text, Facial (camera), Voice (microphone)
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { detectEmotionFromText, getRecommendations } from '../services/emotionService';
import { getStoredUser } from '../services/authService';
import { AGE_GROUPS } from '../utils/emotionUtils';

export default function DetectScreen({ navigation, route }) {
    const initialMethod = route?.params?.method || 'text';
    const [method, setMethod] = useState(initialMethod);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedAgeGroup, setSelectedAgeGroup] = useState('adult');

    const methods = [
        { key: 'text', label: '✍️ Text', color: '#4A9EFF' },
        { key: 'facial', label: '📷 Facial', color: '#44BB44' },
        { key: 'voice', label: '🎤 Voice', color: '#FF6B6B' },
    ];

    const handleDetect = async () => {
        try {
            setLoading(true);
            const user = await getStoredUser();
            const userId = user?.id || null;

            let emotionResult;
            if (method === 'text') {
                if (!text.trim()) {
                    Alert.alert('Error', 'Please enter some text to analyze.');
                    return;
                }
                emotionResult = await detectEmotionFromText(text, userId);
            } else if (method === 'facial') {
                navigation.navigate('FaceDetect', { ageGroup: selectedAgeGroup });
                return;
            } else if (method === 'voice') {
                navigation.navigate('VoiceDetect', { ageGroup: selectedAgeGroup });
                return;
            }

            // Get recommendations based on detected emotion
            const recommendations = await getRecommendations(
                emotionResult.emotion,
                selectedAgeGroup,
                userId,
            );

            navigation.navigate('Results', {
                emotionResult,
                recommendations,
                method,
            });
        } catch (error) {
            Alert.alert('Error', error?.response?.data?.detail || 'Failed to detect emotion. Make sure the backend is running.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Title */}
                <View style={styles.header}>
                    <Text style={styles.title}>🎭 Detect Emotion</Text>
                    <Text style={styles.subtitle}>Choose your detection method</Text>
                </View>

                {/* Method Selector */}
                <View style={styles.methodSelector}>
                    {methods.map(m => (
                        <TouchableOpacity
                            key={m.key}
                            style={[
                                styles.methodBtn,
                                method === m.key && { backgroundColor: m.color, borderColor: m.color },
                            ]}
                            onPress={() => setMethod(m.key)}>
                            <Text style={[styles.methodText, method === m.key && { color: '#FFFFFF' }]}>
                                {m.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Age Group Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>👥 Your Age Group</Text>
                    <View style={styles.ageGroupRow}>
                        {AGE_GROUPS.map(ag => (
                            <TouchableOpacity
                                key={ag.value}
                                style={[
                                    styles.ageBtn,
                                    selectedAgeGroup === ag.value && styles.ageBtnActive,
                                ]}
                                onPress={() => setSelectedAgeGroup(ag.value)}>
                                <Text
                                    style={[
                                        styles.ageBtnText,
                                        selectedAgeGroup === ag.value && styles.ageBtnTextActive,
                                    ]}>
                                    {ag.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Input Area based on method */}
                {method === 'text' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>✍️ Describe how you feel</Text>
                        <TextInput
                            style={styles.textInput}
                            value={text}
                            onChangeText={setText}
                            placeholder="I'm feeling really happy today because..."
                            placeholderTextColor="#555555"
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />
                        <Text style={styles.charCount}>{text.length}/2000</Text>
                    </View>
                )}

                {method === 'facial' && (
                    <View style={styles.section}>
                        <View style={styles.cameraPlaceholder}>
                            <Text style={styles.cameraEmoji}>📷</Text>
                            <Text style={styles.cameraText}>Camera Access</Text>
                            <Text style={styles.cameraSubText}>
                                Tap detect to open camera and capture your expression
                            </Text>
                        </View>
                    </View>
                )}

                {method === 'voice' && (
                    <View style={styles.section}>
                        <View style={styles.cameraPlaceholder}>
                            <Text style={styles.cameraEmoji}>🎤</Text>
                            <Text style={styles.cameraText}>Voice Recording</Text>
                            <Text style={styles.cameraSubText}>
                                Tap detect to start recording your voice
                            </Text>
                        </View>
                    </View>
                )}

                {/* Detect Button */}
                <TouchableOpacity
                    style={[styles.detectBtn, loading && { opacity: 0.7 }]}
                    onPress={handleDetect}
                    disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.detectBtnText}>🔍 Analyze Emotion</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F1A' },
    header: {
        padding: 24,
        paddingTop: 60,
    },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 6 },
    subtitle: { color: '#888888', fontSize: 15 },
    methodSelector: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 10,
        marginBottom: 20,
    },
    methodBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333355',
        alignItems: 'center',
    },
    methodText: { color: '#AAAAAA', fontSize: 13, fontWeight: '600' },
    section: { paddingHorizontal: 20, marginBottom: 20 },
    sectionLabel: { color: '#CCCCCC', fontSize: 15, fontWeight: '600', marginBottom: 10 },
    ageGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ageBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333355',
    },
    ageBtnActive: { backgroundColor: '#E94560', borderColor: '#E94560' },
    ageBtnText: { color: '#888888', fontSize: 13 },
    ageBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
    textInput: {
        backgroundColor: '#16213E',
        borderRadius: 16,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 15,
        minHeight: 120,
        borderWidth: 1,
        borderColor: '#2A2A4E',
    },
    charCount: { color: '#555555', fontSize: 12, textAlign: 'right', marginTop: 4 },
    cameraPlaceholder: {
        backgroundColor: '#16213E',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#2A2A4E',
        borderStyle: 'dashed',
    },
    cameraEmoji: { fontSize: 48, marginBottom: 12 },
    cameraText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
    cameraSubText: { color: '#888888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    detectBtn: {
        backgroundColor: '#E94560',
        marginHorizontal: 20,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
    },
    detectBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
