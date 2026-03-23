/**
 * FaceDetectScreen - Phase 5
 * Captures user selfie via camera or gallery → sends to POST /detect-face-emotion
 * Backend: OpenCV face detection + FER2013 CNN → returns emotion + confidence
 *
 * Camera library: react-native-image-picker (gallery + camera)
 * Install: npm install react-native-image-picker
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    ActivityIndicator, Alert, StatusBar, Animated,
} from 'react-native';
import { detectFaceEmotion, getFaceModelInfo } from '../services/faceEmotionService';
import { getStoredUser } from '../services/authService';
import { getActivityRecommendations } from '../services/recommendationService';

// Phase 5 emotion UI config
const PHASE5_EMOTION_CONFIG = {
    happy: { emoji: '😊', color: '#FFD700', label: 'Happy', bg: '#1A1600' },
    sad: { emoji: '😢', color: '#4A9EFF', label: 'Sad', bg: '#001233' },
    angry: { emoji: '😠', color: '#FF4444', label: 'Angry', bg: '#1A0000' },
    surprise: { emoji: '😲', color: '#FF69B4', label: 'Surprise', bg: '#1A0015' },
    neutral: { emoji: '😐', color: '#AAAAAA', label: 'Neutral', bg: '#111111' },
};

// Tips carousel
const TIPS = [
    '📸 Make sure your face is well-lit',
    '😊 Look directly at the camera',
    '🔦 Avoid harsh backlight or shadows',
    '📐 Keep face centred in the frame',
    '👁️ OpenCV works best with frontal face',
];

export default function FaceDetectScreen({ navigation }) {
    const [imageUri, setImageUri] = useState(null);
    const [detecting, setDetecting] = useState(false);
    const [result, setResult] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [ageGroup, setAgeGroup] = useState('adult');
    const [tipIdx, setTipIdx] = useState(0);
    const [modelInfo, setModelInfo] = useState({
        active_model: 'pixel-rules',
        model_name: 'Loading...'
    });

    const resultAnim = useRef(new Animated.Value(0)).current;
    const scanAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const ti = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3000);
        return () => clearInterval(ti);
    }, []);

    useEffect(() => {
        getStoredUser().then(u => u?.age_group && setAgeGroup(u.age_group));
    }, []);

    // Load face model information
    useEffect(() => {
        const loadModelInfo = async () => {
            try {
                const info = await getFaceModelInfo();
                setModelInfo(info);
            } catch (err) {
                console.warn('Could not load face model info:', err);
                setModelInfo({
                    active_model: 'pixel-rules',
                    model_name: 'Rule-based Detection'
                });
            }
        };
        loadModelInfo();
    }, []);

    // Animate result card in
    useEffect(() => {
        if (result) {
            resultAnim.setValue(0);
            Animated.spring(resultAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 8 }).start();
        }
    }, [result]);

    // Scan line animation while detecting
    useEffect(() => {
        if (detecting) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(scanAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                    Animated.timing(scanAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
                ])
            );
            loop.start();
            return () => loop.stop();
        }
    }, [detecting]);

    // Button pulse
    useEffect(() => {
        if (!imageUri) {
            const loop = Animated.loop(Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
            ]));
            loop.start();
            return () => loop.stop();
        }
    }, [imageUri]);

    // ── Camera / Gallery picker ─────────────────────────────────────────────────
    const pickImage = async (source) => {
        try {
            const ImagePicker = await import('expo-image-picker');

            // Request permissions first
            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Camera permission is required.');
                    return;
                }
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Gallery permission is required.');
                    return;
                }
            }

            const options = {
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 4],
                quality: 0.85,
            };

            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
                setResult(null);
            }
        } catch (err) {
            console.error('Image picker error:', err);
            Alert.alert('Error', 'Failed to launch camera/gallery.');
        }
    };

    const useDemoImage = () => {
        // Simulate a captured image URI for demo purposes
        setImageUri('DEMO');
        setResult(null);
    };

    // ── Detect emotion ──────────────────────────────────────────────────────────
    const handleDetect = async () => {
        if (!imageUri) return;
        try {
            setDetecting(true);
            setResult(null);
            setRecommendations(null);
            const user = await getStoredUser();
            const userId = user?.id || null;
            const detectedAgeGroup = user?.age_group || ageGroup;

            let data;
            if (imageUri === 'DEMO') {
                // Return demo result
                await new Promise(r => setTimeout(r, 1800));
                data = {
                    emotion: 'happy',
                    confidence: 0.84,
                    all_emotions: { happy: 0.84, neutral: 0.09, sad: 0.04, angry: 0.02, surprise: 0.01 },
                    model_used: 'pixel-rules',
                    face_detected: true,
                    face_count: 1,
                    bbox: { x: 120, y: 60, w: 240, h: 240 },
                    image_shape: { width: 480, height: 640 },
                    history_id: null,
                };
            } else {
                data = await detectFaceEmotion(imageUri, userId, detectedAgeGroup);
            }
            setResult(data);

            // Fetch activity recommendations based on detected emotion
            try {
                setLoadingRecommendations(true);
                const recs = await getActivityRecommendations(data.emotion, detectedAgeGroup, userId);
                setRecommendations(recs);
            } catch (recErr) {
                console.warn('Failed to load recommendations:', recErr);
                setRecommendations(null);
            } finally {
                setLoadingRecommendations(false);
            }
        } catch (err) {
            const backendDetail = err?.response?.data?.detail;
            const fallback = err?.message ? err.message : JSON.stringify(err);
            const fullMsg = backendDetail || fallback;
            Alert.alert('⚠️ Error', `Detection failed. Detail: ${fullMsg}`);
        } finally {
            setDetecting(false);
        }
    };

    const handleReset = () => {
        setImageUri(null);
        setResult(null);
        setRecommendations(null);
    };

    const emotionInfo = result ? (PHASE5_EMOTION_CONFIG[result.emotion] || PHASE5_EMOTION_CONFIG.neutral) : null;

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
                        <Text style={S.title}>📷 Facial Analysis</Text>
                        <Text style={S.subtitle}>
                            {modelInfo.active_model === 'keras-custom'
                                ? 'OpenCV Face Detection + Custom CNN'
                                : 'OpenCV Face Detection + Rule-based Analysis'
                            }
                        </Text>
                        <View style={S.modelBadge}>
                            <Text style={S.modelBadgeText}>
                                {modelInfo.active_model === 'keras-custom'
                                    ? '🧠 Custom Face Model · 5 Emotions'
                                    : modelInfo.active_model === 'deepface'
                                        ? '🤖 DeepFace Model · 5 Emotions'
                                        : '🔍 Rule-based Detection · 5 Emotions'
                                }
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Tip ─────────────────────────────────────────────────────── */}
                <View style={S.tipWrap}>
                    <Text style={S.tipText}>{TIPS[tipIdx]}</Text>
                </View>

                {/* ── Image Preview Area ───────────────────────────────────────── */}
                <View style={S.previewSection}>
                    <View style={S.previewFrame}>
                        {imageUri && imageUri !== 'DEMO' ? (
                            <View style={StyleSheet.absoluteFillObject}>
                                <Image source={{ uri: imageUri }} style={[S.previewImage, { width: '100%', height: '100%' }]} resizeMode="cover" />
                                {/* Scan overlay while detecting */}
                                {detecting && (
                                    <View style={StyleSheet.absoluteFill}>
                                        <View style={S.scanOverlay}>
                                            <Animated.View style={[S.scanLine, {
                                                transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }) }],
                                            }]} />
                                        </View>
                                        {/* Face bounding box corners overlay */}
                                        <View style={S.cornerTL} /><View style={S.cornerTR} />
                                        <View style={S.cornerBL} /><View style={S.cornerBR} />
                                    </View>
                                )}
                            </View>
                        ) : imageUri === 'DEMO' ? (
                            <View style={[S.previewPlaceholder, { backgroundColor: '#1A0A1A' }]}>
                                <Text style={{ fontSize: 64 }}>🤳</Text>
                                <Text style={S.placeholderText}>Demo Mode</Text>
                                <Text style={S.placeholderSub}>Simulating face capture...</Text>
                            </View>
                        ) : (
                            <View style={S.previewPlaceholder}>
                                <Text style={{ fontSize: 56, marginBottom: 10 }}>📷</Text>
                                <Text style={S.placeholderText}>No Image Captured</Text>
                                <Text style={S.placeholderSub}>Take a selfie or pick from gallery</Text>
                            </View>
                        )}

                        {/* Face detection badges removed as per user request */}
                        {/*
                        {result?.face_detected && imageUri && (
                            <View style={S.faceDetectedBadge}>
                                <Text style={S.faceDetectedText}>
                                    ✅ {result.face_count} face{result.face_count !== 1 ? 's' : ''} detected
                                </Text>
                            </View>
                        )}
                        {result && !result.face_detected && (
                            <View style={[S.faceDetectedBadge, { backgroundColor: '#331A00' }]}>
                                <Text style={[S.faceDetectedText, { color: '#FF8C42' }]}>
                                    ⚠️ No face detected — full-image analysis used
                                </Text>
                            </View>
                        )}
                        */}
                    </View>

                    {/* Capture buttons */}
                    {!imageUri ? (
                        <View style={S.captureRow}>
                            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: pulseAnim }] }]}>
                                <TouchableOpacity style={S.cameraBtn} onPress={() => pickImage('camera')} activeOpacity={0.85}>
                                    <Text style={S.captureBtnIcon}>📸</Text>
                                    <Text style={S.captureBtnText}>Take Selfie</Text>
                                </TouchableOpacity>
                            </Animated.View>
                            <TouchableOpacity style={S.galleryBtn} onPress={() => pickImage('gallery')} activeOpacity={0.85}>
                                <Text style={S.captureBtnIcon}>🖼️</Text>
                                <Text style={[S.captureBtnText, { color: '#FF6B9E' }]}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={S.captureRow}>
                            <TouchableOpacity
                                style={[S.detectBtn, detecting && S.detectBtnDisabled]}
                                onPress={handleDetect}
                                disabled={detecting}
                                activeOpacity={0.85}>
                                {detecting
                                    ? <><ActivityIndicator color="#fff" size="small" /><Text style={S.detectBtnText}>  Analysing Face...</Text></>
                                    : <Text style={S.detectBtnText}>🔍 Detect Emotion</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={S.retakeBtn} onPress={handleReset}>
                                <Text style={S.retakeBtnText}>🔄</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Demo button */}
                    {!imageUri && (
                        <TouchableOpacity style={S.demoBtn} onPress={useDemoImage}>
                            <Text style={S.demoBtnText}>🧪 Try Demo (No Camera Needed)</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Age Group ────────────────────────────────────────────────── */}
                <View style={S.section}>
                    <Text style={S.sectionLabel}>👥 Age Group</Text>
                    <View style={S.ageRow}>
                        {[{ v: 'child', l: '🧒 Child' }, { v: 'teen', l: '🧑 Teen' }, { v: 'adult', l: '🧑 Adult' }, { v: 'senior', l: '🧓 Senior' }].map(ag => (
                            <TouchableOpacity key={ag.v} style={[S.ageBtn, ageGroup === ag.v && S.ageBtnActive]} onPress={() => setAgeGroup(ag.v)}>
                                <Text style={[S.ageBtnText, ageGroup === ag.v && S.ageBtnTextActive]}>{ag.l}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Technical Info ────────────────────────────────────────────── */}
                <View style={S.pipelineCard}>
                    <Text style={S.pipelineTitle}>🔬 Detection Pipeline</Text>
                    <View style={S.pipelineSteps}>
                        {[
                            { n: '1', t: 'OpenCV Haar Cascade', d: 'Detects face region' },
                            { n: '2', t: '48×48 Grayscale Crop', d: 'FER2013 input format' },
                            { n: '3', t: 'FER2013 CNN', d: 'DeepFace → Keras → PyTorch → Rules' },
                            { n: '4', t: 'Phase 5 Mapping', d: '7 classes → 5 labels' },
                        ].map(step => (
                            <View key={step.n} style={S.pipelineStep}>
                                <View style={S.stepNum}><Text style={S.stepNumText}>{step.n}</Text></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.stepTitle}>{step.t}</Text>
                                    <Text style={S.stepDesc}>{step.d}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Result Card ──────────────────────────────────────────────── */}
                {result && emotionInfo && (
                    <Animated.View style={[
                        S.resultCard, { borderColor: emotionInfo.color, backgroundColor: emotionInfo.bg },
                        { opacity: resultAnim, transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
                    ]}>
                        {/* Primary emotion */}
                        <View style={S.emotionRow}>
                            <Text style={S.resultEmoji}>{emotionInfo.emoji}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[S.resultLabel, { color: emotionInfo.color }]}>{emotionInfo.label}</Text>
                                <Text style={S.resultConf}>{Math.round(result.confidence * 100)}% confidence</Text>
                            </View>
                            <View style={[S.modelTag, { borderColor: emotionInfo.color }]}>
                                <Text style={[S.modelTagText, { color: emotionInfo.color }]}>
                                    {result.model_used === 'deepface' ? '🧠 DeepFace'
                                        : result.model_used === 'keras-fer2013' ? '🤖 Keras'
                                            : result.model_used === 'pytorch-fer2013' ? '🔥 PyTorch'
                                                : '📐 Rules'}
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
                                <Text style={S.breakdownTitle}>Emotion Breakdown (FER2013)</Text>
                                {Object.entries(result.all_emotions)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([emo, score]) => {
                                        const cfg = PHASE5_EMOTION_CONFIG[emo] || { emoji: '❓', color: '#888', label: emo };
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

                        {/* Image metadata */}
                        {result.image_shape?.width && (
                            <View style={S.metaRow}>
                                <Text style={S.metaText}>
                                    🖼️ {result.image_shape.width}×{result.image_shape.height}px
                                    {result.bbox?.w ? `  ·  Face: ${result.bbox.w}×${result.bbox.h}px` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Saved */}
                        {result.history_id && (
                            <View style={S.savedBadge}>
                                <Text style={S.savedText}>✅ Saved to emotion history</Text>
                            </View>
                        )}

                        {/* Activity Recommendations */}
                        {loadingRecommendations && (
                            <View style={S.recommendationsCard}>
                                <ActivityIndicator color={emotionInfo.color} size="small" />
                                <Text style={S.loadingRecText}>Loading activity recommendations...</Text>
                            </View>
                        )}

                        {recommendations && !loadingRecommendations && (
                            <View style={S.recommendationsCard}>
                                <View style={S.recHeader}>
                                    <Text style={S.recTitle}>🎯 Activity Recommendations</Text>
                                    {recommendations.ai_generated && (
                                        <View style={[S.aiBadge, { borderColor: emotionInfo.color }]}>
                                            <Text style={[S.aiBadgeText, { color: emotionInfo.color }]}>
                                                ✨ AI {recommendations.model_used}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                {recommendations.description && (
                                    <Text style={S.recDescription}>{recommendations.description}</Text>
                                )}
                                <View style={S.activitiesList}>
                                    {recommendations.activities.map((activity, idx) => (
                                        <View key={idx} style={[S.activityItem, { borderLeftColor: emotionInfo.color }]}>
                                            <Text style={S.activityNumber}>{idx + 1}</Text>
                                            <Text style={S.activityText}>{activity}</Text>
                                        </View>
                                    ))}
                                </View>
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
    topAccent: { height: 4, backgroundColor: '#FF6B9E' },
    headerContent: { padding: 20, paddingTop: 50 },
    backBtn: { marginBottom: 12 },
    backText: { color: '#FF6B9E', fontSize: 15, fontWeight: '600' },
    title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: '#6B6B9E', fontSize: 13, marginBottom: 10 },
    modelBadge: { backgroundColor: '#0A0A22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#FF6B9E', alignSelf: 'flex-start' },
    modelBadgeText: { color: '#FF6B9E', fontSize: 11, fontWeight: '700' },
    // Tip
    tipWrap: { marginHorizontal: 20, marginBottom: 14, backgroundColor: '#12122A', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E1E3E' },
    tipText: { color: '#9999CC', fontSize: 13, textAlign: 'center' },
    // Preview
    previewSection: { paddingHorizontal: 20, marginBottom: 14 },
    previewFrame: {
        backgroundColor: '#12122A', borderRadius: 20, overflow: 'hidden',
        height: 300, width: '100%', borderWidth: 1.5, borderColor: '#1E1E3E', marginBottom: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    previewImage: { width: '100%', height: '100%' },
    previewPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A22' },
    placeholderText: { color: '#9999CC', fontSize: 16, fontWeight: '700', marginTop: 6 },
    placeholderSub: { color: '#4A4A6A', fontSize: 12, marginTop: 4 },
    // Scan overlay
    scanOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
    scanLine: { height: 3, backgroundColor: 'rgba(255,107,158,0.7)', marginHorizontal: 8, borderRadius: 2, shadowColor: '#FF6B9E', shadowOpacity: 0.8, shadowRadius: 6 },
    cornerTL: { position: 'absolute', top: 16, left: 16, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FF6B9E', borderRadius: 4 },
    cornerTR: { position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FF6B9E', borderRadius: 4 },
    cornerBL: { position: 'absolute', bottom: 16, left: 16, width: 28, height: 28, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FF6B9E', borderRadius: 4 },
    cornerBR: { position: 'absolute', bottom: 16, right: 16, width: 28, height: 28, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FF6B9E', borderRadius: 4 },
    // Face detected badge styles removed (no longer used)
    // faceDetectedBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,20,0,0.85)', paddingVertical: 8, alignItems: 'center' },
    // faceDetectedText: { color: '#4ABB4A', fontSize: 12, fontWeight: '700' },
    // Capture buttons
    captureRow: { flexDirection: 'row', gap: 10 },
    cameraBtn: { flex: 1, backgroundColor: '#FF6B9E', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#FF6B9E', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    galleryBtn: { flex: 1, backgroundColor: '#12122A', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FF6B9E' },
    captureBtnIcon: { fontSize: 22, marginBottom: 3 },
    captureBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    detectBtn: { flex: 1, backgroundColor: '#FF6B9E', padding: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: '#FF6B9E', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
    detectBtnDisabled: { backgroundColor: '#4A1A2E', shadowOpacity: 0 },
    detectBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    retakeBtn: { width: 52, height: 52, backgroundColor: '#12122A', borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#2A2A5E' },
    retakeBtnText: { fontSize: 22 },
    demoBtn: { marginTop: 12, backgroundColor: '#0A0A22', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4E' },
    demoBtnText: { color: '#6B6B9E', fontSize: 12 },
    // Age group
    section: { paddingHorizontal: 20, marginBottom: 14 },
    sectionLabel: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 10 },
    ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    ageBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#1E1E3E' },
    ageBtnActive: { backgroundColor: '#FF6B9E', borderColor: '#FF6B9E' },
    ageBtnText: { color: '#6B6B9E', fontSize: 12 },
    ageBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
    // Pipeline card
    pipelineCard: { backgroundColor: '#12122A', borderRadius: 16, marginHorizontal: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1E1E3E' },
    pipelineTitle: { color: '#9999CC', fontSize: 12, fontWeight: '700', marginBottom: 12 },
    pipelineSteps: { gap: 10 },
    pipelineStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FF6B9E', alignItems: 'center', justifyContent: 'center' },
    stepNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    stepTitle: { color: '#CCCCEE', fontSize: 13, fontWeight: '600' },
    stepDesc: { color: '#6B6B9E', fontSize: 11, marginTop: 1 },
    // Result card
    resultCard: { marginHorizontal: 20, borderRadius: 20, padding: 20, borderWidth: 2, marginBottom: 14 },
    emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    resultEmoji: { fontSize: 48 },
    resultLabel: { fontSize: 26, fontWeight: '800' },
    resultConf: { color: '#9999CC', fontSize: 14, marginTop: 2 },
    modelTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    modelTagText: { fontSize: 11, fontWeight: '700' },
    confTrack: { height: 8, backgroundColor: '#1A1A3A', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
    confFill: { height: '100%', borderRadius: 4 },
    breakdown: {},
    breakdownTitle: { color: '#9999CC', fontSize: 12, fontWeight: '600', marginBottom: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    barEmoji: { fontSize: 16, width: 22 },
    barLabel: { color: '#CCCCEE', fontSize: 12, width: 72 },
    barTrack: { flex: 1, height: 6, backgroundColor: '#1A1A3A', borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    barScore: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
    metaRow: { marginTop: 12, backgroundColor: '#0A0A22', borderRadius: 10, padding: 8 },
    metaText: { color: '#4A4A6A', fontSize: 11, textAlign: 'center' },
    savedBadge: { marginTop: 12, backgroundColor: '#0D1A0D', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
    savedText: { color: '#4ABB4A', fontSize: 11 },
    // Recommendations
    recommendationsCard: { marginTop: 16, backgroundColor: '#0A0A22', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E1E3E' },
    recHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    recTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    aiBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, backgroundColor: '#0D0D1A' },
    aiBadgeText: { fontSize: 9, fontWeight: '700' },
    recDescription: { color: '#9999CC', fontSize: 12, marginBottom: 12, lineHeight: 18 },
    loadingRecText: { color: '#9999CC', fontSize: 12, marginTop: 8, textAlign: 'center' },
    activitiesList: { gap: 10 },
    activityItem: { backgroundColor: '#12122A', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3 },
    activityNumber: { color: '#FF6B9E', fontSize: 16, fontWeight: '800', minWidth: 24 },
    activityText: { color: '#CCCCEE', fontSize: 13, flex: 1, lineHeight: 19 },
});
