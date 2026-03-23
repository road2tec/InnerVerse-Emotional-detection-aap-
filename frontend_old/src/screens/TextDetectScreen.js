/**
 * TextDetectScreen - Phase 3
 * Emotion detection from text input using BERT-based NLP model.
 * POST /detect-text-emotion → { emotion, confidence, all_emotions }
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, StatusBar,
    Animated, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import { detectTextEmotion } from '../services/textEmotionService';
import { getStoredUser } from '../services/authService';
import { getRecommendations } from '../services/emotionService';
import { AGE_GROUPS } from '../utils/emotionUtils';

// Phase 3 emotion config
const PHASE3_EMOTION_CONFIG = {
    happy: { emoji: '😊', color: '#FFD700', label: 'Happy', bg: '#1A1600' },
    sad: { emoji: '😢', color: '#4A9EFF', label: 'Sad', bg: '#001233' },
    angry: { emoji: '😠', color: '#FF4444', label: 'Angry', bg: '#1A0000' },
    frustrated: { emoji: '😤', color: '#FF8C42', label: 'Frustrated', bg: '#1A0800' },
    neutral: { emoji: '😐', color: '#AAAAAA', label: 'Neutral', bg: '#1A1A1A' },
    excited: { emoji: '🤩', color: '#FF69B4', label: 'Excited', bg: '#1A0015' },
    stressed: { emoji: '😰', color: '#AA55FF', label: 'Stressed', bg: '#0D0017' },
};

// Prompts to help users express themselves
const INPUT_PROMPTS = [
    '"I am feeling very stressed about my exams..."',
    '"Today was amazing, I got promoted!"',
    '"I can\'t stop worrying about everything..."',
    '"I\'m so excited for the weekend trip!"',
    '"Nothing seems to be going right for me..."',
    '"I\'m frustrated that nobody listens to me."',
];

export default function TextDetectScreen({ navigation }) {
    const [text, setText] = useState('');
    const [ageGroup, setAgeGroup] = useState('adult');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [promptIdx, setPromptIdx] = useState(0);
    const [recommendations, setRecommendations] = useState(null);
    const [loadingRec, setLoadingRec] = useState(false);

    const resultAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Rotate example prompts every 3s
    useEffect(() => {
        const interval = setInterval(() => {
            setPromptIdx(i => (i + 1) % INPUT_PROMPTS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Animate result card on new result
    useEffect(() => {
        if (result) {
            resultAnim.setValue(0);
            Animated.spring(resultAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 60,
                friction: 8,
            }).start();
        }
    }, [result]);

    // Pulse animation for the detect button
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const handleDetect = async () => {
        if (!text.trim()) {
            Alert.alert('Empty input', 'Please type how you are feeling before analysing.');
            return;
        }
        Keyboard.dismiss();
        try {
            setLoading(true);
            setResult(null);
            setRecommendations(null);
            const user = await getStoredUser();
            const userId = user?.id || null;
            const detectedAgeGroup = user?.age_group || ageGroup;

            const data = await detectTextEmotion(text.trim(), userId, detectedAgeGroup);
            setResult(data);

            // Auto-fetch recommendations
            try {
                setLoadingRec(true);
                const rec = await getRecommendations(data.emotion, detectedAgeGroup, userId);
                setRecommendations(rec);
            } catch (_) {/* recommendations optional */ }
            finally { setLoadingRec(false); }

        } catch (err) {
            const msg = err?.response?.data?.detail || 'Detection failed. Is the backend running?';
            Alert.alert('⚠️ Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setText('');
        setResult(null);
        setRecommendations(null);
    };

    const emotionInfo = result ? (PHASE3_EMOTION_CONFIG[result.emotion] || PHASE3_EMOTION_CONFIG.neutral) : null;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* ── Header ───────────────────────────────────────────────────── */}
                <View style={S.header}>
                    <View style={S.topAccent} />
                    <View style={S.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
                            <Text style={S.backText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={S.title}>✍️ Text Analysis</Text>
                        <Text style={S.subtitle}>BERT-based NLP Emotion Detection</Text>
                        <View style={S.modelBadge}>
                            <Text style={S.modelBadgeText}>🤖 DistilRoBERTa · 7 Emotions</Text>
                        </View>
                    </View>
                </View>

                {/* ── Prompt hint ──────────────────────────────────────────────── */}
                <View style={S.promptWrap}>
                    <Text style={S.promptLabel}>💡 Try something like:</Text>
                    <Text style={S.promptText}>{INPUT_PROMPTS[promptIdx]}</Text>
                </View>

                {/* ── Text Input ───────────────────────────────────────────────── */}
                <View style={S.inputSection}>
                    <View style={S.inputHeader}>
                        <Text style={S.inputLabel}>How are you feeling today?</Text>
                        <Text style={S.charCount}>{text.length}/2000</Text>
                    </View>
                    <TextInput
                        style={S.textInput}
                        value={text}
                        onChangeText={setText}
                        placeholder="Type your thoughts and feelings here..."
                        placeholderTextColor="#3A3A5E"
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        maxLength={2000}
                    />

                    {/* Emotion keyword chips */}
                    <View style={S.chipRow}>
                        {['I feel...', 'I am...', 'Today was...', 'I\'m worried', 'So excited!'].map(chip => (
                            <TouchableOpacity
                                key={chip}
                                style={S.chip}
                                onPress={() => setText(t => t ? `${t} ${chip}` : chip)}>
                                <Text style={S.chipText}>{chip}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Age Group ────────────────────────────────────────────────── */}
                <View style={S.section}>
                    <Text style={S.sectionLabel}>👥 Age Group (for personalised tips)</Text>
                    <View style={S.ageRow}>
                        {AGE_GROUPS.map(ag => (
                            <TouchableOpacity
                                key={ag.value}
                                style={[S.ageBtn, ageGroup === ag.value && S.ageBtnActive]}
                                onPress={() => setAgeGroup(ag.value)}>
                                <Text style={[S.ageBtnText, ageGroup === ag.value && S.ageBtnTextActive]}>
                                    {ag.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Action Buttons ───────────────────────────────────────────── */}
                <View style={S.actions}>
                    <Animated.View style={{ flex: 1, transform: [{ scale: text ? pulseAnim : 1 }] }}>
                        <TouchableOpacity
                            style={[S.detectBtn, (!text.trim() || loading) && S.detectBtnDisabled]}
                            onPress={handleDetect}
                            disabled={!text.trim() || loading}
                            activeOpacity={0.85}>
                            {loading
                                ? <><ActivityIndicator color="#fff" size="small" /><Text style={S.detectBtnText}>  Analysing...</Text></>
                                : <Text style={S.detectBtnText}>🔍 Analyse Emotion</Text>}
                        </TouchableOpacity>
                    </Animated.View>

                    {text.length > 0 && (
                        <TouchableOpacity style={S.clearBtn} onPress={handleClear}>
                            <Text style={S.clearBtnText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Result Card ──────────────────────────────────────────────── */}
                {result && emotionInfo && (
                    <Animated.View
                        style={[
                            S.resultCard,
                            { borderColor: emotionInfo.color, backgroundColor: emotionInfo.bg },
                            {
                                opacity: resultAnim,
                                transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                            },
                        ]}>

                        {/* Primary emotion */}
                        <View style={S.emotionRow}>
                            <Text style={S.resultEmoji}>{emotionInfo.emoji}</Text>
                            <View>
                                <Text style={[S.resultLabel, { color: emotionInfo.color }]}>{emotionInfo.label}</Text>
                                <Text style={S.resultConfidence}>
                                    {Math.round(result.confidence * 100)}% confidence
                                </Text>
                            </View>
                            <View style={[S.modelTag, { borderColor: emotionInfo.color }]}>
                                <Text style={[S.modelTagText, { color: emotionInfo.color }]}>
                                    {result.model_used === 'bert' ? '🤖 BERT' : '📝 Keyword'}
                                </Text>
                            </View>
                        </View>

                        {/* Confidence bar */}
                        <View style={S.confBarTrack}>
                            <Animated.View
                                style={[
                                    S.confBarFill,
                                    {
                                        backgroundColor: emotionInfo.color,
                                        width: resultAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0%', `${Math.round(result.confidence * 100)}%`],
                                        }),
                                    },
                                ]}
                            />
                        </View>

                        {/* All emotions breakdown */}
                        {result.all_emotions && Object.keys(result.all_emotions).length > 1 && (
                            <View style={S.breakdown}>
                                <Text style={S.breakdownTitle}>Emotion Breakdown</Text>
                                {Object.entries(result.all_emotions)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 5)
                                    .map(([emo, score]) => {
                                        const cfg = PHASE3_EMOTION_CONFIG[emo] || { emoji: '❓', color: '#888', label: emo };
                                        const pct = Math.round(score * 100);
                                        return (
                                            <View key={emo} style={S.barRow}>
                                                <Text style={S.barEmoji}>{cfg.emoji}</Text>
                                                <Text style={S.barLabel}>{cfg.label}</Text>
                                                <View style={S.barTrack}>
                                                    <View style={[S.barFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
                                                </View>
                                                <Text style={[S.barScore, { color: cfg.color }]}>{pct}%</Text>
                                            </View>
                                        );
                                    })}
                            </View>
                        )}

                        {/* History saved indicator */}
                        {result.history_id && (
                            <View style={S.savedBadge}>
                                <Text style={S.savedText}>✅ Saved to emotion history</Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* ── Recommendations ────────────────────────────────────────── */}
                {loadingRec && (
                    <View style={S.recLoading}>
                        <ActivityIndicator color="#E94560" size="small" />
                        <Text style={S.recLoadingText}>Loading activity suggestions...</Text>
                    </View>
                )}

                {recommendations && emotionInfo && (
                    <View style={S.recCard}>
                        <Text style={S.recTitle}>✨ Recommended Activities</Text>
                        <Text style={S.recSubtitle}>
                            For <Text style={{ color: emotionInfo.color, fontWeight: '700' }}>{emotionInfo.label}</Text> mood · {recommendations.age_group}
                        </Text>
                        <Text style={S.recDesc}>{recommendations.description}</Text>
                        {recommendations.activities?.map((activity, i) => (
                            <View key={i} style={S.activityItem}>
                                <View style={[S.activityDot, { backgroundColor: emotionInfo.color }]} />
                                <Text style={S.activityText}>{activity}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },

    // Header
    header: { backgroundColor: '#12122A', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 16, overflow: 'hidden' },
    topAccent: { height: 4, backgroundColor: '#AA55FF' },
    headerContent: { padding: 20, paddingTop: 50 },
    backBtn: { marginBottom: 12 },
    backText: { color: '#AA55FF', fontSize: 15, fontWeight: '600' },
    title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: '#6B6B9E', fontSize: 13, marginBottom: 10 },
    modelBadge: {
        backgroundColor: '#0A0A22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
        borderWidth: 1, borderColor: '#AA55FF', alignSelf: 'flex-start',
    },
    modelBadgeText: { color: '#AA55FF', fontSize: 12, fontWeight: '700' },

    // Prompt
    promptWrap: {
        marginHorizontal: 20, marginBottom: 16,
        backgroundColor: '#12122A', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: '#1E1E3E',
    },
    promptLabel: { color: '#6B6B9E', fontSize: 11, marginBottom: 4 },
    promptText: { color: '#9999CC', fontSize: 13, fontStyle: 'italic' },

    // Input
    inputSection: { paddingHorizontal: 20, marginBottom: 16 },
    inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    inputLabel: { color: '#CCCCEE', fontSize: 14, fontWeight: '600' },
    charCount: { color: '#3A3A5E', fontSize: 12 },
    textInput: {
        backgroundColor: '#12122A',
        borderRadius: 18, padding: 16,
        color: '#FFFFFF', fontSize: 15, lineHeight: 24,
        minHeight: 140,
        borderWidth: 1.5, borderColor: '#1E1E3E',
        textAlignVertical: 'top',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip: {
        backgroundColor: '#1A1A3E', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 6,
        borderWidth: 1, borderColor: '#2A2A5E',
    },
    chipText: { color: '#9999CC', fontSize: 12 },

    // Age group
    section: { paddingHorizontal: 20, marginBottom: 16 },
    sectionLabel: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 10 },
    ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ageBtn: {
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
        borderWidth: 1, borderColor: '#1E1E3E',
    },
    ageBtnActive: { backgroundColor: '#AA55FF', borderColor: '#AA55FF' },
    ageBtnText: { color: '#6B6B9E', fontSize: 12 },
    ageBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },

    // Actions
    actions: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 20, gap: 10,
    },
    detectBtn: {
        backgroundColor: '#AA55FF', padding: 18, borderRadius: 16,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
        shadowColor: '#AA55FF', shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
    },
    detectBtnDisabled: { backgroundColor: '#2A1A4E', shadowOpacity: 0 },
    detectBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    clearBtn: {
        backgroundColor: '#12122A', width: 52, height: 52, borderRadius: 26,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: '#2A2A5E',
    },
    clearBtnText: { color: '#6B6B9E', fontSize: 18, fontWeight: '700' },

    // Result card
    resultCard: {
        marginHorizontal: 20, borderRadius: 20, padding: 20,
        borderWidth: 2, marginBottom: 16,
    },
    emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    resultEmoji: { fontSize: 48 },
    resultLabel: { fontSize: 26, fontWeight: '800' },
    resultConfidence: { color: '#9999CC', fontSize: 14, marginTop: 2 },
    modelTag: {
        marginLeft: 'auto', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1,
    },
    modelTagText: { fontSize: 11, fontWeight: '700' },
    confBarTrack: {
        height: 8, backgroundColor: '#1A1A3A', borderRadius: 4,
        overflow: 'hidden', marginBottom: 20,
    },
    confBarFill: { height: '100%', borderRadius: 4 },

    // Breakdown bars
    breakdown: { marginTop: 4 },
    breakdownTitle: { color: '#9999CC', fontSize: 12, fontWeight: '600', marginBottom: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    barEmoji: { fontSize: 16, width: 22 },
    barLabel: { color: '#CCCCEE', fontSize: 12, width: 82 },
    barTrack: { flex: 1, height: 6, backgroundColor: '#1A1A3A', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    barScore: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },

    // Saved badge
    savedBadge: {
        marginTop: 14, backgroundColor: '#0D1A0D', borderRadius: 10,
        paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start',
    },
    savedText: { color: '#4ABB4A', fontSize: 11 },

    // Recs loading
    recLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
    recLoadingText: { color: '#6B6B9E', fontSize: 13 },

    // Recommendations card
    recCard: {
        backgroundColor: '#12122A', borderRadius: 20, padding: 20,
        marginHorizontal: 20, marginBottom: 16,
        borderWidth: 1, borderColor: '#1E1E3E',
    },
    recTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    recSubtitle: { color: '#6B6B9E', fontSize: 13, marginBottom: 8 },
    recDesc: { color: '#9999CC', fontSize: 13, lineHeight: 20, marginBottom: 14 },
    activityItem: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: '#0A0A22', borderRadius: 12, padding: 12,
        marginBottom: 8, gap: 10,
    },
    activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
    activityText: { color: '#CCCCEE', fontSize: 14, flex: 1, lineHeight: 22 },
});
