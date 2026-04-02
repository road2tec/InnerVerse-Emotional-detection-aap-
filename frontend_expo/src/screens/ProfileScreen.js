/**
 * ProfileScreen - Phase 2
 * Shows user info fetched from GET /api/users/profile (JWT protected)
 * Plus emotion detection stats: total detections, last detected emotion
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StatusBar, RefreshControl,
} from 'react-native';
import { logoutUser, fetchProfile, getStoredUser } from '../services/authService';
import { getEmotionInfo } from '../utils/emotionUtils';

export default function ProfileScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadProfile = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);

            // Try to fetch from API (requires JWT in AsyncStorage)
            const data = await fetchProfile();
            setProfile(data);
        } catch (err) {
            // Fall back to stored user if API call fails (offline or not logged in)
            const stored = await getStoredUser();
            if (stored) {
                setProfile(stored);
            } else {
                setError('not_logged_in');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await logoutUser();
                        navigation.replace('Login');
                    },
                },
            ],
            { cancelable: true },
        );
    };

    // ── State: Loading ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[S.container, S.center]}>
                <ActivityIndicator color="#E94560" size="large" />
                <Text style={S.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    // ── State: Not logged in ────────────────────────────────────────────────────
    if (error === 'not_logged_in') {
        return (
            <View style={[S.container, S.center]}>
                <Text style={S.guestEmoji}>👤</Text>
                <Text style={S.guestTitle}>You're browsing as Guest</Text>
                <Text style={S.guestSub}>Create an account to save your emotion history and personalise your recommendations.</Text>
                <TouchableOpacity style={S.primaryBtn} onPress={() => navigation.navigate('Register')}>
                    <Text style={S.primaryBtnText}>Create Account</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.outlineBtn} onPress={() => navigation.navigate('Login')}>
                    <Text style={S.outlineBtnText}>Sign In</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Profile data ────────────────────────────────────────────────────────────
    const name = profile?.name || 'User';
    const ageGroupLabel = {
        child: '🧒 Child (0–12)',
        teen: '🧑‍🎓 Teen (13–19)',
        adult: '🧑 Adult (20–59)',
        senior: '🧓 Senior (60+)',
    }[profile?.age_group] || '—';

    const lastEmotionInfo = profile?.last_emotion
        ? getEmotionInfo(profile.last_emotion)
        : null;

    const createdDate = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'long', year: 'numeric',
        })
        : '—';

    const infoRows = [
        { icon: '📧', label: 'Email', value: profile?.email || '—' },
        { icon: '🎂', label: 'Age', value: profile?.age ? `${profile.age} years` : '—' },
        { icon: '👥', label: 'Age Group', value: ageGroupLabel },
        { icon: '📅', label: 'Member Since', value: createdDate },
    ];

    const statCards = [
        {
            icon: '🎭',
            label: 'Total Detections',
            value: profile?.total_detections ?? 0,
            color: '#E94560',
        },
        {
            icon: lastEmotionInfo?.emoji || '❓',
            label: 'Last Emotion',
            value: lastEmotionInfo?.label || 'None yet',
            color: lastEmotionInfo?.color || '#888888',
        },
    ];

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadProfile(true)}
                        tintColor="#E94560"
                    />
                }>

                {/* ── Hero Header ─────────────────────────────────────────────────── */}
                <View style={S.heroSection}>
                    <View style={S.topBar} />
                    <View style={S.avatarWrap}>
                        <View style={S.avatar}>
                            <Text style={S.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
                        </View>
                        <View style={S.onlineDot} />
                    </View>
                    <Text style={S.userName}>{name}</Text>
                    <Text style={S.userEmail}>{profile?.email}</Text>
                    <View style={S.agePill}>
                        <Text style={S.agePillText}>{ageGroupLabel}</Text>
                    </View>
                </View>

                {/* ── Stats Row ──────────────────────────────────────────────────── */}
                <View style={S.statsRow}>
                    {statCards.map((card, i) => (
                        <View key={i} style={[S.statCard, { borderTopColor: card.color }]}>
                            <Text style={S.statEmoji}>{card.icon}</Text>
                            <Text style={[S.statValue, { color: card.color }]}>{card.value}</Text>
                            <Text style={S.statLabel}>{card.label}</Text>
                        </View>
                    ))}
                </View>

                {/* ── JWT Auth Badge ─────────────────────────────────────────────── */}
                <View style={S.authBadge}>
                    <Text style={S.authBadgeText}>🔐  Authenticated via JWT  ·  Password secured with bcrypt</Text>
                </View>

                {/* ── Info Card ──────────────────────────────────────────────────── */}
                <View style={S.infoCard}>
                    <Text style={S.cardTitle}>Account Details</Text>
                    {infoRows.map((row, i) => (
                        <View key={i} style={[S.infoRow, i < infoRows.length - 1 && S.infoRowBorder]}>
                            <Text style={S.infoIcon}>{row.icon}</Text>
                            <Text style={S.infoLabel}>{row.label}</Text>
                            <Text style={S.infoValue} numberOfLines={1}>{row.value}</Text>
                        </View>
                    ))}
                </View>

                {/* ── Actions ────────────────────────────────────────────────────── */}
                <View style={S.actionsSection}>
                    <TouchableOpacity
                        style={S.historyBtn}
                        onPress={() => navigation.navigate('History')}>
                        <Text style={S.historyBtnText}>📊  View Emotion History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                        <Text style={S.logoutText}>🚪  Sign Out</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    center: { justifyContent: 'center', alignItems: 'center', padding: 30 },
    loadingText: { color: '#6B6B9E', marginTop: 12, fontSize: 14 },

    // Hero
    heroSection: {
        backgroundColor: '#12122A',
        paddingBottom: 28,
        alignItems: 'center',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        marginBottom: 16,
    },
    topBar: { height: 4, backgroundColor: '#E94560', borderRadius: 2, width: '100%', marginBottom: 32 },
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: '#E94560',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: '#0A0A1A',
        shadowColor: '#E94560', shadowOpacity: 0.5, shadowRadius: 16, elevation: 8,
    },
    avatarText: { color: '#fff', fontSize: 38, fontWeight: '800' },
    onlineDot: {
        position: 'absolute', bottom: 4, right: 0,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: '#00CC66',
        borderWidth: 2, borderColor: '#12122A',
    },
    userName: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.3, marginBottom: 4 },
    userEmail: { color: '#6B6B9E', fontSize: 14, marginBottom: 12 },
    agePill: {
        backgroundColor: '#0A0A22',
        borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
        borderWidth: 1, borderColor: '#E94560',
    },
    agePillText: { color: '#E94560', fontSize: 12, fontWeight: '700' },

    // Stats
    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 12 },
    statCard: {
        flex: 1, backgroundColor: '#12122A', borderRadius: 16,
        padding: 16, alignItems: 'center',
        borderWidth: 1, borderColor: '#1E1E3E',
        borderTopWidth: 3,
    },
    statEmoji: { fontSize: 24, marginBottom: 6 },
    statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    statLabel: { color: '#6B6B9E', fontSize: 11, textAlign: 'center' },

    // Auth badge
    authBadge: {
        marginHorizontal: 20, marginBottom: 12,
        backgroundColor: '#0D1A0D',
        borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
        borderWidth: 1, borderColor: '#1E3E1E',
    },
    authBadgeText: { color: '#4ABB4A', fontSize: 11, textAlign: 'center' },

    // Info card
    infoCard: {
        backgroundColor: '#12122A', borderRadius: 20,
        marginHorizontal: 20, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: '#1E1E3E',
    },
    cardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 16 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#1A1A30' },
    infoIcon: { fontSize: 20, width: 28 },
    infoLabel: { color: '#6B6B9E', fontSize: 13, flex: 1 },
    infoValue: { color: '#CCCCEE', fontSize: 13, fontWeight: '600', maxWidth: 180 },

    // Actions
    actionsSection: { paddingHorizontal: 20, gap: 12 },
    historyBtn: {
        backgroundColor: '#12122A', padding: 16, borderRadius: 16,
        alignItems: 'center', borderWidth: 1.5, borderColor: '#E94560',
    },
    historyBtnText: { color: '#E94560', fontSize: 15, fontWeight: '700' },
    logoutBtn: {
        backgroundColor: '#1A0A0F', padding: 16, borderRadius: 16,
        alignItems: 'center', borderWidth: 1.5, borderColor: '#CC2244',
    },
    logoutText: { color: '#CC2244', fontSize: 15, fontWeight: '700' },

    // Guest state
    guestEmoji: { fontSize: 60, marginBottom: 16 },
    guestTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
    guestSub: { color: '#6B6B9E', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    primaryBtn: {
        backgroundColor: '#E94560', paddingHorizontal: 40, paddingVertical: 15,
        borderRadius: 16, width: '100%', alignItems: 'center', marginBottom: 12,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    outlineBtn: {
        borderWidth: 1.5, borderColor: '#E94560', paddingHorizontal: 40, paddingVertical: 14,
        borderRadius: 16, width: '100%', alignItems: 'center',
    },
    outlineBtnText: { color: '#E94560', fontSize: 15, fontWeight: '700' },
});
