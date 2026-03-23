/**
 * RecommendScreen - Phase 6
 * Activity Recommendation Engine
 *
 * User inputs:  emotion (picker or from previous detection) + age
 * Calls:        POST /recommend-activity
 * Shows:        Curated activity list with priority ordering + age personalisation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    ActivityIndicator, Alert, StatusBar, Animated,
} from 'react-native';
import { getActivityRecommendations } from '../services/recommendationService';
import { getStoredUser } from '../services/authService';

// Emotion config for ALL Phase 3/4/5 labels
const EMOTION_CONFIG = {
    happy: { emoji: '😊', color: '#FFD700', label: 'Happy' },
    sad: { emoji: '😢', color: '#4A9EFF', label: 'Sad' },
    angry: { emoji: '😠', color: '#FF4444', label: 'Angry' },
    frustrated: { emoji: '😤', color: '#FF8C42', label: 'Frustrated' },
    neutral: { emoji: '😐', color: '#AAAAAA', label: 'Neutral' },
    excited: { emoji: '🤩', color: '#FF69B4', label: 'Excited' },
    stressed: { emoji: '😰', color: '#AA55FF', label: 'Stressed' },
    fear: { emoji: '😨', color: '#9955FF', label: 'Fear' },
    surprise: { emoji: '😲', color: '#FF6B9E', label: 'Surprise' },
};

const AGE_GROUPS = [
    { v: 'child', l: '🧒 Child', range: '≤ 12' },
    { v: 'teen', l: '🧑 Teen', range: '13–19' },
    { v: 'adult', l: '🧑 Adult', range: '20–59' },
    { v: 'senior', l: '🧓 Senior', range: '60+' },
];

// Activity category icons (matched by keyword)
const ACTIVITY_ICONS = {
    meditation: '🧘', walk: '🚶', exercise: '🏋️', yoga: '🧘', run: '🏃',
    music: '🎵', listen: '🎧', playlist: '🎶', dance: '💃',
    movie: '🎬', watch: '📺', show: '📺',
    friend: '👥', talk: '💬', call: '📞', celebrate: '🎉', family: '👨‍👩‍👧',
    read: '📚', book: '📖', journal: '✍️', write: '📝',
    breathe: '💨', breathing: '💨', stretch: '🤸', relaxation: '😌',
    garden: '🌻', garden: '🌱', cook: '🍳', bake: '🥐',
    game: '🎮', sport: '⚽', workout: '💪', gym: '🏋️',
    project: '🎯', productive: '📋', task: '✅', skill: '🎓',
    trip: '✈️', adventure: '🌄', outing: '🏕️', walk: '🏃',
    nap: '😴', rest: '💤', tea: '🍵', bath: '🛁', shower: '🚿',
    drawing: '🎨', draw: '🎨', paint: '🖌️', art: '🖼️',
    puzzle: '🧩', sudoku: '🔢', crossword: '📰',
};

function getActivityIcon(activityText) {
    const lower = activityText.toLowerCase();
    for (const [kw, icon] of Object.entries(ACTIVITY_ICONS)) {
        if (lower.includes(kw)) return icon;
    }
    return '✨';
}

export default function RecommendScreen({ navigation, route }) {
    // Pre-filled from previous detection screen if navigated that way
    const prefillEmotion = route?.params?.emotion || '';
    const prefillAge = route?.params?.age ? String(route.params.age) : '';

    const [selectedEmotion, setSelectedEmotion] = useState(prefillEmotion);
    const [age, setAge] = useState(prefillAge);
    const [ageGroup, setAgeGroup] = useState('adult');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const resultAnim = useRef(new Animated.Value(0)).current;
    const staggerAnims = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;

    useEffect(() => {
        getStoredUser().then(u => {
            if (u?.age_group) setAgeGroup(u.age_group);
            if (u?.age && !prefillAge) setAge(String(u.age));
        });
        // Auto-fetch if navigated with emotion pre-filled
        if (prefillEmotion) handleRecommend(prefillEmotion);
    }, []);

    // Stagger-animate activity cards
    useEffect(() => {
        if (result?.activities) {
            staggerAnims.forEach(a => a.setValue(0));
            resultAnim.setValue(0);
            Animated.parallel([
                Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
                Animated.stagger(80, staggerAnims.map((a, i) =>
                    i < result.activities.length
                        ? Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 })
                        : Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true })
                )),
            ]).start();
        }
    }, [result]);

    const handleRecommend = async (overrideEmotion) => {
        const emotion = overrideEmotion || selectedEmotion;
        if (!emotion) {
            Alert.alert('Select Emotion', 'Please select your current emotion first.');
            return;
        }
        try {
            setLoading(true);
            setResult(null);
            const user = await getStoredUser();
            const userId = user?.id || null;
            const numericAge = parseInt(age, 10) || null;
            const data = await getActivityRecommendations(emotion, numericAge, !numericAge ? ageGroup : null, userId);
            setResult(data);
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Failed to load recommendations. Is the backend running?';
            Alert.alert('⚠️ Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const emotionInfo = result ? (EMOTION_CONFIG[result.emotion] || EMOTION_CONFIG.neutral) : null;
    const selectedInfo = EMOTION_CONFIG[selectedEmotion];

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* ── Header ──────────────────────────────────────────────────── */}
                <View style={S.header}>
                    <View style={S.topAccent} />
                    <View style={S.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
                            <Text style={S.backText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={S.title}>✨ Activity Recommendations</Text>
                        <Text style={S.subtitle}>Personalised by emotion + age group</Text>
                    </View>
                </View>

                {/* ── Emotion Picker ───────────────────────────────────────────── */}
                <View style={S.section}>
                    <Text style={S.sectionLabel}>🎭 How are you feeling?</Text>
                    <View style={S.emotionGrid}>
                        {Object.entries(EMOTION_CONFIG).map(([key, cfg]) => (
                            <TouchableOpacity
                                key={key}
                                style={[
                                    S.emotionPill,
                                    selectedEmotion === key && { backgroundColor: cfg.color + '22', borderColor: cfg.color },
                                ]}
                                onPress={() => setSelectedEmotion(key)}>
                                <Text style={S.emotionPillEmoji}>{cfg.emoji}</Text>
                                <Text style={[S.emotionPillLabel, selectedEmotion === key && { color: cfg.color }]}>
                                    {cfg.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Age Input ────────────────────────────────────────────────── */}
                <View style={S.section}>
                    <Text style={S.sectionLabel}>🎂 Your Age (optional — auto-selects group)</Text>
                    <View style={S.ageInputRow}>
                        <TextInput
                            style={S.ageInput}
                            value={age}
                            onChangeText={setAge}
                            placeholder="e.g. 24"
                            placeholderTextColor="#3A3A5E"
                            keyboardType="numeric"
                            maxLength={3}
                        />
                        <Text style={S.ageGroupDerived}>
                            {age && parseInt(age) > 0 ? (
                                <>→ <Text style={{ color: '#AA55FF', fontWeight: '700' }}>
                                    {parseInt(age) <= 12 ? 'Child' : parseInt(age) <= 19 ? 'Teen' : parseInt(age) <= 59 ? 'Adult' : 'Senior'}
                                </Text></>
                            ) : 'Enter your age'}
                        </Text>
                    </View>

                    {/* Manual group override when no age */}
                    {!age && (
                        <>
                            <Text style={[S.sectionLabel, { marginTop: 12 }]}>Or pick age group:</Text>
                            <View style={S.ageGroupRow}>
                                {AGE_GROUPS.map(ag => (
                                    <TouchableOpacity
                                        key={ag.v}
                                        style={[S.ageGroupBtn, ageGroup === ag.v && S.ageGroupBtnActive]}
                                        onPress={() => setAgeGroup(ag.v)}>
                                        <Text style={[S.ageGroupBtnLabel, ageGroup === ag.v && { color: '#fff' }]}>{ag.l}</Text>
                                        <Text style={S.ageGroupBtnRange}>{ag.range}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* ── Recommend Button ─────────────────────────────────────────── */}
                <View style={S.actionRow}>
                    <TouchableOpacity
                        style={[
                            S.recommendBtn,
                            { backgroundColor: selectedInfo?.color || '#6B6B9E' },
                            (!selectedEmotion || loading) && S.recommendBtnDisabled,
                        ]}
                        onPress={() => handleRecommend()}
                        disabled={!selectedEmotion || loading}
                        activeOpacity={0.85}>
                        {loading
                            ? <><ActivityIndicator color="#fff" size="small" /><Text style={S.recommendBtnText}> Loading...</Text></>
                            : <Text style={S.recommendBtnText}>
                                {selectedInfo ? `${selectedInfo.emoji} Get Activities` : '✨ Get Recommendations'}
                            </Text>}
                    </TouchableOpacity>
                </View>

                {/* ── Results ──────────────────────────────────────────────────── */}
                {result && emotionInfo && (
                    <Animated.View style={[
                        S.resultSection,
                        { opacity: resultAnim, transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] },
                    ]}>
                        {/* Header */}
                        <View style={[S.resultHeader, { backgroundColor: emotionInfo.color + '18', borderColor: emotionInfo.color }]}>
                            <Text style={S.resultHeaderEmoji}>{emotionInfo.emoji}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[S.resultHeaderEmotion, { color: emotionInfo.color }]}>
                                    {emotionInfo.label} — {result.age_group.charAt(0).toUpperCase() + result.age_group.slice(1)}
                                </Text>
                                <Text style={S.resultHeaderDesc}>{result.description}</Text>
                            </View>
                        </View>

                        {/* Activity Cards */}
                        <Text style={S.activitiesLabel}>
                            Recommended Activities ({result.activities.length} of {result.total_available})
                        </Text>
                        {result.activities.map((activity, i) => (
                            <Animated.View
                                key={i}
                                style={[
                                    S.activityCard,
                                    { borderLeftColor: emotionInfo.color },
                                    {
                                        opacity: staggerAnims[i],
                                        transform: [{
                                            translateX: staggerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                                        }],
                                    },
                                ]}>
                                <View style={[S.activityIconWrap, { backgroundColor: emotionInfo.color + '22' }]}>
                                    <Text style={S.activityCardIcon}>{getActivityIcon(activity)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.activityCardText}>{activity}</Text>
                                </View>
                                <View style={[S.activityNumber, { borderColor: emotionInfo.color + '44' }]}>
                                    <Text style={[S.activityNumberText, { color: emotionInfo.color }]}>{i + 1}</Text>
                                </View>
                            </Animated.View>
                        ))}

                        {/* Quick try another emotion */}
                        <View style={S.tryAnotherRow}>
                            <Text style={S.tryAnotherLabel}>Try another emotion:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {Object.entries(EMOTION_CONFIG)
                                        .filter(([k]) => k !== result.emotion)
                                        .slice(0, 5)
                                        .map(([key, cfg]) => (
                                            <TouchableOpacity
                                                key={key}
                                                style={[S.quickEmotionChip, { borderColor: cfg.color + '55' }]}
                                                onPress={() => { setSelectedEmotion(key); handleRecommend(key); }}>
                                                <Text>{cfg.emoji} {cfg.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                </View>
                            </ScrollView>
                        </View>
                    </Animated.View>
                )}

                {/* ── How It Works ─────────────────────────────────────────────── */}
                {!result && !loading && (
                    <View style={S.howCard}>
                        <Text style={S.howTitle}>How it works</Text>
                        {[
                            { i: '🎭', t: 'Pick your emotion', d: 'Select how you feel right now' },
                            { i: '🎂', t: 'Enter your age', d: 'We personalise activities for your life stage' },
                            { i: '✨', t: 'Get recommendations', d: 'Curated activities to improve your mood' },
                        ].map(step => (
                            <View key={step.t} style={S.howStep}>
                                <Text style={S.howStepIcon}>{step.i}</Text>
                                <View>
                                    <Text style={S.howStepTitle}>{step.t}</Text>
                                    <Text style={S.howStepDesc}>{step.d}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    header: { backgroundColor: '#12122A', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 14, overflow: 'hidden' },
    topAccent: { height: 4, backgroundColor: '#E8AA14' },
    headerContent: { padding: 20, paddingTop: 50 },
    backBtn: { marginBottom: 12 },
    backText: { color: '#E8AA14', fontSize: 15, fontWeight: '600' },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: '#6B6B9E', fontSize: 13 },
    section: { paddingHorizontal: 20, marginBottom: 16 },
    sectionLabel: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 10 },
    // Emotion grid
    emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emotionPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1.5, borderColor: '#1E1E3E', backgroundColor: '#12122A',
    },
    emotionPillEmoji: { fontSize: 18 },
    emotionPillLabel: { color: '#9999CC', fontSize: 12, fontWeight: '600' },
    // Age
    ageInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    ageInput: {
        backgroundColor: '#12122A', borderRadius: 14, padding: 14,
        color: '#FFFFFF', fontSize: 18, fontWeight: '700', width: 90,
        borderWidth: 1.5, borderColor: '#2A2A5E', textAlign: 'center',
    },
    ageGroupDerived: { color: '#6B6B9E', fontSize: 14, flex: 1 },
    ageGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ageGroupBtn: {
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1.5, borderColor: '#1E1E3E', backgroundColor: '#12122A',
        alignItems: 'center',
    },
    ageGroupBtnActive: { backgroundColor: '#3A2A6E', borderColor: '#AA55FF' },
    ageGroupBtnLabel: { color: '#9999CC', fontSize: 12, fontWeight: '700' },
    ageGroupBtnRange: { color: '#4A4A6A', fontSize: 10, marginTop: 2 },
    // Recommend button
    actionRow: { paddingHorizontal: 20, marginBottom: 16 },
    recommendBtn: {
        padding: 18, borderRadius: 16, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center', gap: 8,
        shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    recommendBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
    recommendBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    // Results
    resultSection: { paddingHorizontal: 20, marginBottom: 16 },
    resultHeader: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16,
        borderRadius: 16, borderWidth: 1.5, marginBottom: 16,
    },
    resultHeaderEmoji: { fontSize: 40 },
    resultHeaderEmotion: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    resultHeaderDesc: { color: '#9999CC', fontSize: 13, lineHeight: 20 },
    activitiesLabel: { color: '#6B6B9E', fontSize: 12, fontWeight: '600', marginBottom: 10 },
    // Activity cards
    activityCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#12122A', borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: '#1E1E3E', borderLeftWidth: 3,
    },
    activityIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    activityCardIcon: { fontSize: 22 },
    activityCardText: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '500' },
    activityNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    activityNumberText: { fontSize: 12, fontWeight: '800' },
    // Try another
    tryAnotherRow: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1E1E3E' },
    tryAnotherLabel: { color: '#6B6B9E', fontSize: 12, fontWeight: '600' },
    quickEmotionChip: {
        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
        borderWidth: 1.5, backgroundColor: '#12122A',
    },
    // How it works
    howCard: {
        backgroundColor: '#12122A', borderRadius: 20, marginHorizontal: 20, padding: 18,
        borderWidth: 1, borderColor: '#1E1E3E',
    },
    howTitle: { color: '#9999CC', fontSize: 13, fontWeight: '700', marginBottom: 14 },
    howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
    howStepIcon: { fontSize: 26 },
    howStepTitle: { color: '#CCCCEE', fontSize: 14, fontWeight: '600', marginBottom: 2 },
    howStepDesc: { color: '#6B6B9E', fontSize: 12 },
});
