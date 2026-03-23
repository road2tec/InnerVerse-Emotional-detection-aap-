/**
 * HomeScreen - Landing screen showing welcome message, analytics, and quick actions
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    StatusBar, Animated, RefreshControl, SafeAreaView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStoredUser } from '../services/authService';
import { getWeeklySummary } from '../services/historyService';
import { getEmotionInfo, EMOTIONS } from '../utils/emotionUtils';
import AnalyticsChart from '../components/AnalyticsChart';

// Wellness tips array (randomly picked daily or on refresh)
const WELLNESS_TIPS = [
    "Take 5 deep breaths before starting your day.",
    "A 10-minute walk can boost your mood significantly.",
    "Stay hydrated! Drink a glass of water right now.",
    "Write down one thing you are grateful for today.",
    "Stretch your shoulders and neck for quick tension relief.",
    "Listen to your favorite upbeat song.",
    "Disconnect from screens for 15 minutes.",
];

export default function HomeScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [weeklyTrend, setWeeklyTrend] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [tip, setTip] = useState(WELLNESS_TIPS[0]);

    const fadeAnim = new Animated.Value(0);

    const loadDashboard = async () => {
        try {
            const u = await getStoredUser();
            setUser(u);
            if (u?.id) {
                const summary = await getWeeklySummary(u.id);
                setWeeklyTrend(summary.trend || []);
            }
            // Pick a random tip
            setTip(WELLNESS_TIPS[Math.floor(Math.random() * WELLNESS_TIPS.length)]);
        } catch (e) {
            console.error('Dashboard load error:', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [])
    );

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboard();
        setRefreshing(false);
    };

    const emotionEntries = Object.entries(EMOTIONS).slice(0, 6);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

                {/* App Name Header - Professional Design */}
                <View style={styles.appHeader}>
                    <Text style={styles.appTitle}>InnerVerse</Text>
                    <Text style={styles.appTagline}>Your Emotional Wellness Journey</Text>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E94560" />}
                >
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <Text style={styles.greeting}>
                        {user ? `Hello, ${user.username}! 👋` : 'Welcome 👋'}
                    </Text>

                    {/* Phase 10: Wellness Tip Banner */}
                    <View style={styles.tipBanner}>
                        <Text style={styles.tipIcon}>💡</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tipTitle}>Daily Wellness Tip</Text>
                            <Text style={styles.tipText}>{tip}</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Phase 10: Mood Analytics Chart */}
                {user && weeklyTrend.length > 0 && (
                    <View style={{ paddingHorizontal: 20 }}>
                        <AnalyticsChart data={weeklyTrend} />
                    </View>
                )}

                {/* Quick Action Cards */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🎯 Detect Your Emotion</Text>
                    <View style={styles.cards}>
                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: '#1E1E3F' }]}
                            onPress={() => navigation.navigate('TextDetect')}>
                            <Text style={styles.cardEmoji}>✍️</Text>
                            <Text style={styles.cardTitle}>Text</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: '#1E1E3F' }]}
                            onPress={() => navigation.navigate('FaceDetect')}>
                            <Text style={styles.cardEmoji}>📷</Text>
                            <Text style={styles.cardTitle}>Facial</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, { backgroundColor: '#1E1E3F' }]}
                            onPress={() => navigation.navigate('VoiceDetect')}>
                            <Text style={styles.cardEmoji}>🎤</Text>
                            <Text style={styles.cardTitle}>Voice</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Emotion Palette */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🌈 How does it work?</Text>
                    <View style={styles.emotionGrid}>
                        {emotionEntries.map(([key, info]) => (
                            <View key={key} style={[styles.emotionChip, { borderColor: info.color }]}>
                                <Text style={styles.emotionEmoji}>{info.emoji}</Text>
                                <Text style={[styles.emotionLabel, { color: info.color }]}>
                                    {info.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.howText}>
                        We analyze your text, voice, or facial expression to detect your current emotion, then suggest personalized activities to improve your mood.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#1A1A2E',
    },

    container: {
        flex: 1,
        backgroundColor: '#0F0F1F'
    },

    scrollView: {
        flex: 1,
        backgroundColor: '#0F0F1F',
    },

    // App Name Header - Minimal & Professional
    appHeader: {
        backgroundColor: '#0F0F1F',
        paddingTop: Platform.OS === 'android' ? 38 : 14,
        paddingBottom: 10,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#23233A',
        width: '100%',
    },

    appTitle: {
        color: '#F3F4F8',
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: 0.3,
        textAlign: 'center',
        marginBottom: 2,
    },

    appTagline: {
        color: '#9CA3B5',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
        letterSpacing: 0.2,
    },

    header: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: 'transparent',
        marginBottom: 10,
    },
    greeting: {
        color: '#FFFFFF',
        fontSize: 18,
        marginBottom: 10,
        textAlign: 'center',
        fontWeight: '600'
    },
    title: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '900',
        lineHeight: 42,
        marginBottom: 20,
        textAlign: 'center',
        letterSpacing: 1,
        textShadowColor: '#E94560',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    // Tip banner - Professional Design
    tipBanner: {
        flexDirection: 'row',
        backgroundColor: '#1E1E3F',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        gap: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#E94560',
        borderWidth: 1,
        borderColor: '#2A2A4E',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    tipIcon: { fontSize: 24 },
    tipTitle: { color: '#E94560', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    tipText: { color: '#CCCCEE', fontSize: 13, lineHeight: 18 },

    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 14 },
    cards: { flexDirection: 'row', gap: 12 },
    card: {
        flex: 1, borderRadius: 16, padding: 16, paddingTop: 20, paddingBottom: 20, alignItems: 'center',
        borderWidth: 1, borderColor: '#3A3A6E',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    cardEmoji: { fontSize: 32, marginBottom: 8 },
    cardTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    emotionChip: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 6, gap: 6, backgroundColor: '#1E1E3F'
    },
    emotionEmoji: { fontSize: 14 },
    emotionLabel: { fontSize: 12, fontWeight: '600' },
    howText: { color: '#888888', fontSize: 13, lineHeight: 20 },
});
