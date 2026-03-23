/**
 * VoiceDetectScreen - Phase 4
 * Records user voice → sends to POST /detect-voice-emotion (multipart)
 * Backend extracts MFCC features via Librosa → returns emotion + confidence
 *
 * Recording library: react-native-audio-recorder-player
 * Install: npm install react-native-audio-recorder-player
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StatusBar, Animated, Platform,
} from 'react-native';
import { detectVoiceEmotion } from '../services/voiceEmotionService';
import { BASE_URL } from '../services/api';
import { getStoredUser } from '../services/authService';

// Phase 4 emotion UI config
const PHASE4_EMOTION_CONFIG = {
    neutral: { emoji: '😐', color: '#AAAAAA', label: 'Neutral', bg: '#111111' },
    happy: { emoji: '😊', color: '#FFD700', label: 'Happy', bg: '#1A1600' },
    sad: { emoji: '😢', color: '#4A9EFF', label: 'Sad', bg: '#001233' },
    angry: { emoji: '😠', color: '#FF4444', label: 'Angry', bg: '#1A0000' },
    fear: { emoji: '😨', color: '#AA55FF', label: 'Fear', bg: '#0D0017' },
};

// Recording states
const REC_STATE = { IDLE: 'idle', RECORDING: 'recording', RECORDED: 'recorded', UPLOADING: 'uploading' };

// Tips displayed while recording
const REC_TIPS = [
    '🗣️ Speak naturally for 3–10 seconds',
    '💡 Express how you feel in your voice',
    '🎤 Hold the mic close for best results',
    '😌 Talk about your day or how you feel',
];

export default function VoiceDetectScreen({ navigation }) {
    const [recState, setRecState] = useState(REC_STATE.IDLE);
    const [recordedUri, setRecordedUri] = useState(null);
    const [duration, setDuration] = useState(0);
    const [result, setResult] = useState(null);
    const [ageGroup, setAgeGroup] = useState('adult');
    const [tipIdx, setTipIdx] = useState(0);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim1 = useRef(new Animated.Value(0.3)).current;
    const waveAnim2 = useRef(new Animated.Value(0.5)).current;
    const waveAnim3 = useRef(new Animated.Value(0.7)).current;
    const resultAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);
    const durationRef = useRef(0);

    // AudioRecorderPlayer instance (lazy created)
    const recorderRef = useRef(null);
    const recordingBackendRef = useRef(null); // 'rn-audio-recorder-player' | 'expo-av'
    const expoRecordingRef = useRef(null);

    useEffect(() => {
        let tipInterval = setInterval(() => setTipIdx(i => (i + 1) % REC_TIPS.length), 3000);
        return () => clearInterval(tipInterval);
    }, []);

    useEffect(() => {
        getStoredUser().then(u => u?.age_group && setAgeGroup(u.age_group));
    }, []);

    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            expoRecordingRef.current = null;
        };
    }, []);

    // Animate result in
    useEffect(() => {
        if (result) {
            resultAnim.setValue(0);
            Animated.spring(resultAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 8 }).start();
        }
    }, [result]);

    // Mic pulse when recording
    useEffect(() => {
        let pulse, wave;
        if (recState === REC_STATE.RECORDING) {
            pulse = Animated.loop(Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
            ]));
            pulse.start();

            wave = Animated.loop(Animated.parallel([
                Animated.sequence([
                    Animated.timing(waveAnim1, { toValue: 1.0, duration: 400, useNativeDriver: true }),
                    Animated.timing(waveAnim1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.delay(150),
                    Animated.timing(waveAnim2, { toValue: 0.8, duration: 500, useNativeDriver: true }),
                    Animated.timing(waveAnim2, { toValue: 0.2, duration: 500, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.delay(300),
                    Animated.timing(waveAnim3, { toValue: 1.0, duration: 350, useNativeDriver: true }),
                    Animated.timing(waveAnim3, { toValue: 0.4, duration: 350, useNativeDriver: true }),
                ]),
            ]));
            wave.start();
        } else {
            pulseAnim.setValue(1);
            waveAnim1.setValue(0.3);
            waveAnim2.setValue(0.5);
            waveAnim3.setValue(0.7);
            pulse?.stop();
            wave?.stop();
        }
        return () => { pulse?.stop(); wave?.stop(); };
    }, [recState]);

    // Duration counter
    const startTimer = () => {
        durationRef.current = 0;
        setDuration(0);
        timerRef.current = setInterval(() => {
            durationRef.current += 1;
            setDuration(durationRef.current);
        }, 1000);
    };
    const stopTimer = () => { clearInterval(timerRef.current); };

    const formatDuration = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // ── Recording logic ─────────────────────────────────────────────────────────
    const getRecorder = async () => {
        if (!recorderRef.current) {
            try {
                const { default: AudioRecorderPlayer } = await import('react-native-audio-recorder-player');
                recorderRef.current = new AudioRecorderPlayer();
            } catch (err) {
                return null;
            }
        }
        return recorderRef.current;
    };

    const startRecording = async () => {
        try {
            setResult(null);
            setRecordedUri(null);

            // 1) Prefer Expo Audio first (works reliably in Expo Go/dev builds)
            try {
                const { Audio } = await import('expo-av');
                const permission = await Audio.requestPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert('Microphone Permission Required', 'Please allow microphone access to record your voice.');
                    return;
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });

                const recording = new Audio.Recording();
                await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                await recording.startAsync();

                expoRecordingRef.current = recording;
                recordingBackendRef.current = 'expo-av';
                setRecState(REC_STATE.RECORDING);
                startTimer();
                return;
            } catch (expoErr) {
                // continue to RN native recorder fallback
            }

            // 2) Fallback to react-native-audio-recorder-player (bare RN/dev client)
            const recorder = await getRecorder();
            if (recorder && typeof recorder.startRecorder === 'function') {
                try {
                    const path = Platform.OS === 'android'
                        ? '/sdcard/voice_emotion.m4a'
                        : 'voice_emotion.m4a';
                    await recorder.startRecorder(path);
                    if (typeof recorder.addRecordBackListener === 'function') {
                        recorder.addRecordBackListener(() => { });
                    }
                    recordingBackendRef.current = 'rn-audio-recorder-player';
                    setRecState(REC_STATE.RECORDING);
                    startTimer();
                    return;
                } catch (rnErr) {
                    // native module may be missing in Expo Go; continue to demo mode
                }
            }

            // 3) Final fallback: demo mode
            Alert.alert(
                '🎤 Demo Mode',
                'Recording module is unavailable on this build.\n\nPress "Simulate" to test with demo audio data.',
                [{ text: 'OK' }, { text: 'Simulate', onPress: simulateRecording }],
            );
        } catch (e) {
            Alert.alert('Recording Error', e.message);
        }
    };

    const stopRecording = async () => {
        try {
            if (recordingBackendRef.current === 'rn-audio-recorder-player') {
                const recorder = await getRecorder();
                if (!recorder) return;
                const uri = await recorder.stopRecorder();
                if (typeof recorder.removeRecordBackListener === 'function') {
                    recorder.removeRecordBackListener();
                }
                stopTimer();
                setRecordedUri(uri);
                setRecState(REC_STATE.RECORDED);
                return;
            }

            if (recordingBackendRef.current === 'expo-av' && expoRecordingRef.current) {
                const { Audio } = await import('expo-av');
                await expoRecordingRef.current.stopAndUnloadAsync();
                const uri = expoRecordingRef.current.getURI();
                expoRecordingRef.current = null;
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
                stopTimer();
                setRecordedUri(uri);
                setRecState(REC_STATE.RECORDED);
                return;
            }

            stopTimer();
            setRecState(REC_STATE.IDLE);
        } catch (e) {
            stopTimer();
            setRecState(REC_STATE.IDLE);
            Alert.alert('Stop Error', e.message);
        }
    };

    const simulateRecording = () => {
        setRecState(REC_STATE.RECORDED);
        setRecordedUri('SIMULATED');
        setDuration(5);
    };

    // ── Upload & Detect ─────────────────────────────────────────────────────────
    const handleAnalyse = async () => {
        if (!recordedUri) return;
        try {
            setRecState(REC_STATE.UPLOADING);
            const user = await getStoredUser();
            const userId = user?.id || null;
            const detectedAgeGroup = user?.age_group || ageGroup;

            let data;
            if (recordedUri === 'SIMULATED') {
                // Return a fake result for demo
                data = {
                    emotion: 'neutral',
                    confidence: 0.68,
                    all_emotions: { neutral: 0.68, happy: 0.12, sad: 0.08, angry: 0.07, fear: 0.05 },
                    model_used: 'rule-based',
                    features: { rms_energy: 0.042, zero_crossing_rate: 0.11, spectral_centroid_hz: 2100, tempo_bpm: 105, duration_seconds: 5 },
                    duration_seconds: 5,
                    history_id: null,
                };
            } else {
                data = await detectVoiceEmotion(recordedUri, userId, detectedAgeGroup);
            }
            setResult(data);
            setRecState(REC_STATE.RECORDED);
        } catch (err) {
            setRecState(REC_STATE.RECORDED);
            const msg = err?.response?.data?.detail
                || err?.message
                || `Cannot reach backend (${BASE_URL}).`;
            const friendlyMsg = err?.response
                ? msg
                : `Cannot reach backend at ${BASE_URL}\n\nMake sure:\n1) Backend is running\n2) Phone and laptop are on same Wi-Fi\n3) Mobile data (LTE) is off for this test`;
            Alert.alert('⚠️ Analysis Error', friendlyMsg);
        }
    };

    const handleReset = () => {
        setRecState(REC_STATE.IDLE);
        setRecordedUri(null);
        setDuration(0);
        setResult(null);
        recordingBackendRef.current = null;
        expoRecordingRef.current = null;
    };

    // ── Render helpers ──────────────────────────────────────────────────────────
    const emotionInfo = result ? (PHASE4_EMOTION_CONFIG[result.emotion] || PHASE4_EMOTION_CONFIG.neutral) : null;

    const RecordButton = () => {
        const isRecording = recState === REC_STATE.RECORDING;
        return (
            <View style={S.micArea}>
                {/* Sound wave bars (visible when recording) */}
                {isRecording && (
                    <View style={S.waveRow}>
                        {[waveAnim1, waveAnim2, waveAnim3, waveAnim2, waveAnim1].map((anim, i) => (
                            <Animated.View key={i} style={[S.waveBar, { transform: [{ scaleY: anim }] }]} />
                        ))}
                    </View>
                )}

                {/* Mic button */}
                <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
                    <TouchableOpacity
                        style={[S.micBtn, isRecording && S.micBtnActive]}
                        onPress={isRecording ? stopRecording : startRecording}
                        disabled={recState === REC_STATE.UPLOADING}
                        activeOpacity={0.8}>
                        <Text style={S.micIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
                        <Text style={S.micLabel}>{isRecording ? 'Tap to Stop' : 'Tap to Record'}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Duration counter */}
                <View style={S.durationRow}>
                    {isRecording && <View style={S.recDot} />}
                    <Text style={[S.durationText, isRecording && { color: '#FF4444' }]}>
                        {isRecording ? formatDuration(duration) : recState === REC_STATE.RECORDED ? `${formatDuration(duration)} recorded` : '0:00'}
                    </Text>
                </View>

                {/* Tip */}
                {isRecording && <Text style={S.tip}>{REC_TIPS[tipIdx]}</Text>}
            </View>
        );
    };

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={S.header}>
                    <View style={S.topAccent} />
                    <View style={S.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
                            <Text style={S.backText}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={S.title}>🎤 Voice Analysis</Text>
                        <Text style={S.subtitle}>MFCC + Spectral Feature Extraction</Text>
                        <View style={S.modelBadge}>
                            <Text style={S.modelBadgeText}>📊 RAVDESS-style · Librosa · 5 Emotions</Text>
                        </View>
                    </View>
                </View>

                {/* Feature Pills */}
                <View style={S.featurePills}>
                    {['40 MFCCs', 'Chroma', 'Mel-Spec', 'Spectral Contrast', 'Tempo'].map(f => (
                        <View key={f} style={S.pill}>
                            <Text style={S.pillText}>{f}</Text>
                        </View>
                    ))}
                </View>

                {/* Record Area */}
                <View style={S.card}>
                    <RecordButton />

                    {/* Action Buttons */}
                    <View style={S.actions}>
                        {recState === REC_STATE.RECORDED && (
                            <>
                                <TouchableOpacity style={S.analyseBtn} onPress={handleAnalyse} activeOpacity={0.85}>
                                    {recState === REC_STATE.UPLOADING
                                        ? <><ActivityIndicator color="#fff" size="small" /><Text style={S.analyseBtnText}>  Analysing...</Text></>
                                        : <Text style={S.analyseBtnText}>🔍 Analyse Voice</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity style={S.resetBtn} onPress={handleReset}>
                                    <Text style={S.resetBtnText}>🔄 Record Again</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {recState === REC_STATE.UPLOADING && (
                            <View style={S.uploadingRow}>
                                <ActivityIndicator color="#FF6B35" size="small" />
                                <Text style={S.uploadingText}>Extracting MFCC features...</Text>
                            </View>
                        )}
                    </View>

                    {/* Demo button */}
                    {recState === REC_STATE.IDLE && (
                        <TouchableOpacity style={S.demoBtn} onPress={simulateRecording}>
                            <Text style={S.demoBtnText}>🧪 Try Demo (No Mic Needed)</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Age Group */}
                <View style={S.section}>
                    <Text style={S.sectionLabel}>👥 Age Group</Text>
                    <View style={S.ageRow}>
                        {[{ v: 'child', l: '🧒 Child' }, { v: 'teen', l: '🧑 Teen' }, { v: 'adult', l: '🧑 Adult' }, { v: 'senior', l: '🧓 Senior' }].map(ag => (
                            <TouchableOpacity
                                key={ag.v}
                                style={[S.ageBtn, ageGroup === ag.v && S.ageBtnActive]}
                                onPress={() => setAgeGroup(ag.v)}>
                                <Text style={[S.ageBtnText, ageGroup === ag.v && S.ageBtnTextActive]}>{ag.l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Result Card */}
                {result && emotionInfo && (
                    <Animated.View
                        style={[
                            S.resultCard,
                            { borderColor: emotionInfo.color, backgroundColor: emotionInfo.bg },
                            { opacity: resultAnim, transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] },
                        ]}>

                        <View style={S.emotionRow}>
                            <Text style={S.resultEmoji}>{emotionInfo.emoji}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[S.resultLabel, { color: emotionInfo.color }]}>{emotionInfo.label}</Text>
                                <Text style={S.resultConf}>{Math.round(result.confidence * 100)}% confidence</Text>
                            </View>
                            <View style={[S.modelTag, { borderColor: emotionInfo.color }]}>
                                <Text style={[S.modelTagText, { color: emotionInfo.color }]}>
                                    {result.model_used === 'sklearn' ? '🤖 ML' : '📐 Rules'}
                                </Text>
                            </View>
                        </View>

                        {/* Confidence bar */}
                        <View style={S.confTrack}>
                            <Animated.View style={[S.confFill, {
                                backgroundColor: emotionInfo.color,
                                width: resultAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round(result.confidence * 100)}%`] }),
                            }]} />
                        </View>

                        {/* Emotion breakdown */}
                        {result.all_emotions && Object.keys(result.all_emotions).length > 0 && (
                            <View style={S.breakdown}>
                                <Text style={S.breakdownTitle}>Emotion Breakdown</Text>
                                {Object.entries(result.all_emotions)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([emo, score]) => {
                                        const cfg = PHASE4_EMOTION_CONFIG[emo] || { emoji: '❓', color: '#888', label: emo };
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

                        {/* Audio features */}
                        {result.features && Object.keys(result.features).length > 0 && (
                            <View style={S.featuresCard}>
                                <Text style={S.featuresTitle}>🔬 Extracted Audio Features</Text>
                                <View style={S.featuresGrid}>
                                    {[
                                        { k: 'Duration', v: `${result.duration_seconds}s` },
                                        { k: 'RMS Energy', v: result.features.rms_energy?.toFixed(4) },
                                        { k: 'Zero-Cross Rate', v: result.features.zero_crossing_rate?.toFixed(4) },
                                        { k: 'Spectral Centroid', v: `${result.features.spectral_centroid_hz?.toFixed(0)} Hz` },
                                        { k: 'Tempo', v: `${result.features.tempo_bpm?.toFixed(0)} BPM` },
                                        { k: 'Pitch Variation', v: result.features.pitch_variation?.toFixed(2) },
                                    ].map(({ k, v }) => (
                                        <View key={k} style={S.featItem}>
                                            <Text style={S.featKey}>{k}</Text>
                                            <Text style={[S.featVal, { color: emotionInfo.color }]}>{v ?? '—'}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Saved indicator */}
                        {result.history_id && (
                            <View style={S.savedBadge}>
                                <Text style={S.savedText}>✅ Saved to emotion history</Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    // Header
    header: { backgroundColor: '#12122A', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 14, overflow: 'hidden' },
    topAccent: { height: 4, backgroundColor: '#FF6B35' },
    headerContent: { padding: 20, paddingTop: 50 },
    backBtn: { marginBottom: 12 },
    backText: { color: '#FF6B35', fontSize: 15, fontWeight: '600' },
    title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: '#6B6B9E', fontSize: 13, marginBottom: 10 },
    modelBadge: { backgroundColor: '#0A0A22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#FF6B35', alignSelf: 'flex-start' },
    modelBadgeText: { color: '#FF6B35', fontSize: 12, fontWeight: '700' },
    // Feature pills
    featurePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
    pill: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2A2A4E' },
    pillText: { color: '#6B6B9E', fontSize: 11 },
    // Record card
    card: { backgroundColor: '#12122A', borderRadius: 24, marginHorizontal: 20, marginBottom: 14, padding: 24, borderWidth: 1, borderColor: '#1E1E3E' },
    // Mic area
    micArea: { alignItems: 'center', paddingVertical: 8 },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20, height: 60 },
    waveBar: { width: 6, height: 50, backgroundColor: '#FF4444', borderRadius: 3 },
    micBtn: {
        width: 110, height: 110, borderRadius: 55,
        backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#FF6B35', shadowOpacity: 0.5, shadowRadius: 20, elevation: 8,
        borderWidth: 4, borderColor: '#FF8C5A',
    },
    micBtnActive: { backgroundColor: '#CC2200', borderColor: '#FF4444', shadowColor: '#FF4444' },
    micIcon: { fontSize: 36 },
    micLabel: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2 },
    durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF4444' },
    durationText: { color: '#9999CC', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
    tip: { color: '#6B6B9E', fontSize: 12, marginTop: 10, textAlign: 'center' },
    // Actions
    actions: { marginTop: 16, gap: 10 },
    analyseBtn: { backgroundColor: '#FF6B35', padding: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
    analyseBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    resetBtn: { backgroundColor: '#1A1A3E', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A5E' },
    resetBtnText: { color: '#9999CC', fontSize: 14, fontWeight: '700' },
    uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
    uploadingText: { color: '#FF6B35', fontSize: 13 },
    demoBtn: { marginTop: 14, backgroundColor: '#0A0A22', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4E' },
    demoBtnText: { color: '#6B6B9E', fontSize: 12 },
    // Age group
    section: { paddingHorizontal: 20, marginBottom: 14 },
    sectionLabel: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 10 },
    ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ageBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#1E1E3E' },
    ageBtnActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
    ageBtnText: { color: '#6B6B9E', fontSize: 12 },
    ageBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
    // Result
    resultCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, borderWidth: 2, marginBottom: 14 },
    emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    resultEmoji: { fontSize: 48 },
    resultLabel: { fontSize: 26, fontWeight: '800' },
    resultConf: { color: '#9999CC', fontSize: 14, marginTop: 2 },
    modelTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    modelTagText: { fontSize: 11, fontWeight: '700' },
    confTrack: { height: 8, backgroundColor: '#1A1A3A', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
    confFill: { height: '100%', borderRadius: 4 },
    // Breakdown bars
    breakdown: { marginTop: 4 },
    breakdownTitle: { color: '#9999CC', fontSize: 12, fontWeight: '600', marginBottom: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    barEmoji: { fontSize: 16, width: 22 },
    barLabel: { color: '#CCCCEE', fontSize: 12, width: 70 },
    barTrack: { flex: 1, height: 6, backgroundColor: '#1A1A3A', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    barScore: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
    // Features grid
    featuresCard: { marginTop: 16, backgroundColor: '#0A0A22', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E1E3E' },
    featuresTitle: { color: '#9999CC', fontSize: 12, fontWeight: '600', marginBottom: 10 },
    featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    featItem: { backgroundColor: '#12122A', borderRadius: 10, padding: 10, minWidth: '45%', flex: 1 },
    featKey: { color: '#6B6B9E', fontSize: 10, marginBottom: 3 },
    featVal: { fontSize: 13, fontWeight: '700' },
    // Saved badge
    savedBadge: { marginTop: 14, backgroundColor: '#0D1A0D', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
    savedText: { color: '#4ABB4A', fontSize: 11 },
});
