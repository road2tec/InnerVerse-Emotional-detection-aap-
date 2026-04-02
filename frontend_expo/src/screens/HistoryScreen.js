/**
 * HistoryScreen - Phase 7 (Full Rewrite)
 * Shows emotion detection history: stats dashboard, filter tabs, delete, inline recommendations.
 *
 * Backend endpoints:
 *   GET    /history           — paginated + filtered list
 *   GET    /history/stats     — aggregated stats
 *   DELETE /history/{id}      — remove single record
 *   DELETE /history/clear     — remove all records for user
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
    Alert, StatusBar, Animated, RefreshControl,
} from 'react-native';
import { getStoredUser } from '../services/authService';
import { getEmotionHistory, getHistoryStats, deleteHistoryRecord, clearHistory } from '../services/historyService';

// ── Emotion config ────────────────────────────────────────────────────────────
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

function getEmotionInfo(emotion) {
    return EMOTION_CONFIG[emotion?.toLowerCase()] || { emoji: '🎭', color: '#666699', label: emotion || 'Unknown' };
}

// ── Method config ─────────────────────────────────────────────────────────────
const METHOD_CONFIG = {
    text: { emoji: '✍️', label: 'Text', color: '#4CAF50' },
    voice: { emoji: '🎤', label: 'Voice', color: '#FF9800' },
    facial: { emoji: '📷', label: 'Face', color: '#FF6B9E' },
    face: { emoji: '📷', label: 'Face', color: '#FF6B9E' },
};

// Filter tabs
const FILTER_TABS = [
    { key: null, label: 'All' },
    { key: 'text', label: '✍️ Text' },
    { key: 'voice', label: '🎤 Voice' },
    { key: 'facial', label: '📷 Face' },
];

function formatDate(raw) {
    if (!raw) return '';
    try {
        const d = new Date(raw);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            + '  ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return raw; }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function HistoryScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const skipRef = useRef(0);
    const LIMIT = 15;

    const statsAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        init();
    }, []);

    useEffect(() => {
        if (user) {
            skipRef.current = 0;
            loadHistory(false);
        }
    }, [activeFilter]);

    const init = async () => {
        const u = await getStoredUser();
        setUser(u);
        if (u?.id) {
            await Promise.all([loadHistory(false, u.id), loadStats(u.id)]);
        } else {
            setLoading(false);
        }
    };

    const loadStats = async (uid) => {
        try {
            const s = await getHistoryStats(uid);
            setStats(s);
            Animated.spring(statsAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }).start();
        } catch { }
    };

    const loadHistory = async (append = false, uid = user?.id) => {
        if (!uid) return;
        try {
            if (!append) setLoading(true);
            else setLoadingMore(true);

            const data = await getEmotionHistory(uid, {
                limit: LIMIT,
                skip: append ? skipRef.current : 0,
                inputType: activeFilter,
            });

            const records = data.history || [];
            if (append) {
                setHistory(prev => [...prev, ...records]);
            } else {
                setHistory(records);
                skipRef.current = 0;
            }
            skipRef.current += records.length;
            setTotal(data.total || 0);
            setHasMore(data.has_more || false);
        } catch (e) {
            console.error('History load error:', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        skipRef.current = 0;
        loadHistory(false);
        loadStats(user?.id);
    }, [user, activeFilter]);

    const handleDelete = (item) => {
        Alert.alert(
            '🗑️ Delete Record',
            `Remove this ${getEmotionInfo(item.emotion).label} detection from your history?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingId(item.id);
                            await deleteHistoryRecord(item.id);
                            setHistory(prev => prev.filter(r => r.id !== item.id));
                            setTotal(t => t - 1);
                            loadStats(user?.id);
                        } catch {
                            Alert.alert('Error', 'Could not delete record.');
                        } finally {
                            setDeletingId(null);
                        }
                    },
                },
            ]
        );
    };

    const handleClearAll = () => {
        Alert.alert(
            '⚠️ Clear All History',
            'This will permanently delete all your emotion detection history. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearHistory(user?.id);
                            setHistory([]);
                            setTotal(0);
                            setStats(null);
                        } catch {
                            Alert.alert('Error', 'Could not clear history.');
                        }
                    },
                },
            ]
        );
    };

    // ── Render stats dashboard ─────────────────────────────────────────────────
    const renderStats = () => {
        if (!stats || stats.total_detections === 0) return null;
        const dominantInfo = getEmotionInfo(stats.dominant_emotion);

        return (
            <Animated.View style={[S.statsCard, {
                opacity: statsAnim,
                transform: [{ scale: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }],
            }]}>
                <View style={S.statsRow}>
                    <View style={S.statBox}>
                        <Text style={S.statNum}>{stats.total_detections}</Text>
                        <Text style={S.statLabel}>Total Sessions</Text>
                    </View>
                    <View style={[S.statBox, S.statBoxMid]}>
                        <Text style={[S.statNum, { color: dominantInfo.color }]}>{dominantInfo.emoji}</Text>
                        <Text style={S.statLabel}>Top Emotion</Text>
                        <Text style={[S.statSub, { color: dominantInfo.color }]}>{dominantInfo.label}</Text>
                    </View>
                    <View style={S.statBox}>
                        <Text style={S.statNum}>{stats.last_emotion ? getEmotionInfo(stats.last_emotion).emoji : '—'}</Text>
                        <Text style={S.statLabel}>Last Detected</Text>
                    </View>
                </View>

                {/* Method breakdown */}
                {Object.keys(stats.by_method || {}).length > 0 && (
                    <View style={S.methodBreakdown}>
                        {Object.entries(stats.by_method).map(([method, count]) => {
                            const cfg = METHOD_CONFIG[method] || { emoji: '🔍', label: method, color: '#666' };
                            const pct = Math.round((count / stats.total_detections) * 100);
                            return (
                                <View key={method} style={S.methodRow}>
                                    <Text style={S.methodEmoji}>{cfg.emoji}</Text>
                                    <Text style={S.methodLabel}>{cfg.label}</Text>
                                    <View style={S.methodTrack}>
                                        <View style={[S.methodFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
                                    </View>
                                    <Text style={[S.methodCount, { color: cfg.color }]}>{count}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </Animated.View>
        );
    };

    // ── Render single history card ─────────────────────────────────────────────
    const renderItem = ({ item, index }) => {
        const info = getEmotionInfo(item.emotion);
        const methodKey = item.detection_method || item.input_type || 'text';
        const methodCfg = METHOD_CONFIG[methodKey] || { emoji: '🔍', label: methodKey, color: '#666' };
        const isDeleting = deletingId === item.id;
        const recs = (item.recommendations || []).slice(0, 3);

        return (
            <View style={[S.card, { borderLeftColor: info.color }]}>
                {/* Top row */}
                <View style={S.cardTopRow}>
                    <Text style={S.cardEmoji}>{info.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[S.cardEmotion, { color: info.color }]}>{info.label}</Text>
                        <View style={S.cardMetaRow}>
                            <View style={[S.methodBadge, { backgroundColor: methodCfg.color + '22' }]}>
                                <Text style={[S.methodBadgeText, { color: methodCfg.color }]}>
                                    {methodCfg.emoji} {methodCfg.label}
                                </Text>
                            </View>
                            {item.confidence > 0 && (
                                <Text style={S.confidenceBadge}>{Math.round(item.confidence * 100)}%</Text>
                            )}
                        </View>
                    </View>
                    {/* Delete button */}
                    <TouchableOpacity
                        style={S.deleteBtn}
                        onPress={() => handleDelete(item)}
                        disabled={isDeleting}>
                        {isDeleting
                            ? <ActivityIndicator size="small" color="#FF4444" />
                            : <Text style={S.deleteBtnText}>🗑️</Text>}
                    </TouchableOpacity>
                </View>

                {/* Confidence bar */}
                {item.confidence > 0 && (
                    <View style={S.confTrack}>
                        <View style={[S.confFill, { width: `${Math.round(item.confidence * 100)}%`, backgroundColor: info.color }]} />
                    </View>
                )}

                {/* Input text preview */}
                {item.input_text && (
                    <Text style={S.inputTextPreview} numberOfLines={1}>
                        💬 "{item.input_text}"
                    </Text>
                )}

                {/* Inline recommendations */}
                {recs.length > 0 && (
                    <View style={S.recsWrap}>
                        <Text style={S.recsLabel}>Recommended:</Text>
                        <View style={S.recsList}>
                            {recs.map((r, i) => (
                                <View key={i} style={[S.recChip, { borderColor: info.color + '44' }]}>
                                    <Text style={S.recChipText}>✨ {r}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Date */}
                <Text style={S.cardDate}>{formatDate(item.created_at)}</Text>
            </View>
        );
    };

    // ── Not logged in ─────────────────────────────────────────────────────────
    if (!loading && !user) {
        return (
            <View style={[S.container, S.center]}>
                <StatusBar barStyle="light-content" />
                <Text style={{ fontSize: 52, marginBottom: 16 }}>📊</Text>
                <Text style={S.infoTitle}>Login to see your history</Text>
                <Text style={S.infoSub}>Your emotion sessions are saved when you sign in.</Text>
                <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate('Login')}>
                    <Text style={S.actionBtnText}>Sign In</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.topAccent} />
                <View style={S.headerContent}>
                    <View style={S.headerRow}>
                        <View>
                            <Text style={S.title}>📊 Emotion History</Text>
                            <Text style={S.subtitle}>{total} sessions recorded</Text>
                        </View>
                        {history.length > 0 && (
                            <TouchableOpacity style={S.clearBtn} onPress={handleClearAll}>
                                <Text style={S.clearBtnText}>🗑️ Clear All</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* ── Stats ─────────────────────────────────────────────────────────── */}
            {renderStats()}

            {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
            <View style={S.filterRow}>
                {FILTER_TABS.map(tab => (
                    <TouchableOpacity
                        key={String(tab.key)}
                        style={[S.filterTab, activeFilter === tab.key && S.filterTabActive]}
                        onPress={() => setActiveFilter(tab.key)}>
                        <Text style={[S.filterTabText, activeFilter === tab.key && S.filterTabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── List ──────────────────────────────────────────────────────────── */}
            {loading ? (
                <View style={S.center}>
                    <ActivityIndicator color="#E94560" size="large" />
                    <Text style={S.loadingText}>Loading history...</Text>
                </View>
            ) : history.length === 0 ? (
                <View style={S.center}>
                    <Text style={{ fontSize: 52, marginBottom: 16 }}>🎭</Text>
                    <Text style={S.infoTitle}>No history yet</Text>
                    <Text style={S.infoSub}>
                        {activeFilter
                            ? `No ${activeFilter} detections found. Try another filter.`
                            : 'Detect your first emotion to see it here.'}
                    </Text>
                    <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate('Home')}>
                        <Text style={S.actionBtnText}>Start Detecting</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item, i) => item.id || String(i)}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E94560" />}
                    onEndReached={() => hasMore && !loadingMore && loadHistory(true)}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={() =>
                        loadingMore ? <ActivityIndicator color="#E94560" style={{ marginTop: 12 }} /> : null
                    }
                />
            )}
        </View>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    header: { backgroundColor: '#12122A', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 0, overflow: 'hidden' },
    topAccent: { height: 4, backgroundColor: '#E94560' },
    headerContent: { padding: 20, paddingTop: 50 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 3 },
    subtitle: { color: '#6B6B9E', fontSize: 13 },
    clearBtn: { backgroundColor: '#1A0A0A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#FF4444' },
    clearBtnText: { color: '#FF4444', fontSize: 12, fontWeight: '700' },
    // Stats
    statsCard: { backgroundColor: '#12122A', borderRadius: 20, margin: 16, marginTop: 14, padding: 16, borderWidth: 1, borderColor: '#1E1E3E' },
    statsRow: { flexDirection: 'row', marginBottom: 14 },
    statBox: { flex: 1, alignItems: 'center' },
    statBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1E1E3E' },
    statNum: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 3 },
    statLabel: { color: '#6B6B9E', fontSize: 11, textAlign: 'center' },
    statSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    methodBreakdown: { borderTopWidth: 1, borderTopColor: '#1E1E3E', paddingTop: 12, gap: 8 },
    methodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    methodEmoji: { fontSize: 14, width: 18 },
    methodLabel: { color: '#9999CC', fontSize: 12, width: 44 },
    methodTrack: { flex: 1, height: 5, backgroundColor: '#1A1A3A', borderRadius: 3, overflow: 'hidden' },
    methodFill: { height: '100%', borderRadius: 3 },
    methodCount: { fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' },
    // Filter tabs
    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterTab: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: '#1E1E3E', backgroundColor: '#12122A' },
    filterTabActive: { backgroundColor: '#E94560', borderColor: '#E94560' },
    filterTabText: { color: '#6B6B9E', fontSize: 12, fontWeight: '600' },
    filterTabTextActive: { color: '#FFFFFF' },
    // History cards
    card: {
        backgroundColor: '#12122A', borderRadius: 16, padding: 14, marginBottom: 12,
        borderLeftWidth: 3, borderWidth: 1, borderColor: '#1E1E3E',
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
    cardEmoji: { fontSize: 30, paddingTop: 2 },
    cardEmotion: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    methodBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    methodBadgeText: { fontSize: 11, fontWeight: '700' },
    confidenceBadge: { color: '#888888', fontSize: 11 },
    deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    deleteBtnText: { fontSize: 18 },
    confTrack: { height: 4, backgroundColor: '#1A1A3A', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
    confFill: { height: '100%', borderRadius: 2 },
    inputTextPreview: { color: '#6B6B9E', fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
    recsWrap: { marginBottom: 8 },
    recsLabel: { color: '#6B6B9E', fontSize: 11, fontWeight: '600', marginBottom: 6 },
    recsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    recChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, backgroundColor: '#0A0A22' },
    recChipText: { color: '#CCCCEE', fontSize: 11 },
    cardDate: { color: '#404060', fontSize: 11 },
    // Empty / loading
    infoTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    infoSub: { color: '#6B6B9E', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    loadingText: { color: '#6B6B9E', marginTop: 12 },
    actionBtn: { backgroundColor: '#E94560', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
    actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
