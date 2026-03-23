/**
 * ResultsScreen - Shows detected emotion + recommended activities
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { getEmotionInfo, formatConfidence } from '../utils/emotionUtils';

export default function ResultsScreen({ navigation, route }) {
    const { emotionResult, recommendations, method } = route?.params || {};
    const emotionInfo = getEmotionInfo(emotionResult?.emotion);

    if (!emotionResult) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>No results to show.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>← Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const allEmotionEntries = Object.entries(emotionResult.all_emotions || {}).sort(
        ([, a], [, b]) => b - a,
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Back */}
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>

                {/* Emotion Result Card */}
                <View style={[styles.emotionCard, { borderColor: emotionInfo.color }]}>
                    <Text style={styles.emotionEmoji}>{emotionInfo.emoji}</Text>
                    <Text style={[styles.emotionName, { color: emotionInfo.color }]}>
                        {emotionInfo.label}
                    </Text>
                    <Text style={styles.confidence}>
                        Confidence: {formatConfidence(emotionResult.confidence)}
                    </Text>
                    <View style={styles.methodBadge}>
                        <Text style={styles.methodText}>
                            Detected via {method?.toUpperCase() || 'TEXT'}
                        </Text>
                    </View>
                </View>

                {/* Confidence Bars */}
                {allEmotionEntries.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>📊 Emotion Breakdown</Text>
                        {allEmotionEntries.slice(0, 5).map(([emo, score]) => {
                            const info = getEmotionInfo(emo);
                            return (
                                <View key={emo} style={styles.barRow}>
                                    <Text style={styles.barEmoji}>{info.emoji}</Text>
                                    <Text style={styles.barLabel}>{info.label}</Text>
                                    <View style={styles.barTrack}>
                                        <View
                                            style={[
                                                styles.barFill,
                                                { width: `${Math.round(score * 100)}%`, backgroundColor: info.color },
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.barScore, { color: info.color }]}>
                                        {Math.round(score * 100)}%
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Recommendations */}
                {recommendations && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>✨ Recommended Activities</Text>
                        <Text style={styles.ageGroupText}>For: {recommendations.age_group} • Emotion: {recommendations.emotion}</Text>
                        <Text style={styles.recDescription}>{recommendations.description}</Text>
                        <View style={styles.activitiesList}>
                            {recommendations.activities?.map((activity, idx) => (
                                <View key={idx} style={styles.activityItem}>
                                    <View style={[styles.activityDot, { backgroundColor: emotionInfo.color }]} />
                                    <Text style={styles.activityText}>{activity}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Try Again */}
                <TouchableOpacity
                    style={styles.tryAgainBtn}
                    onPress={() => navigation.navigate('Detect')}>
                    <Text style={styles.tryAgainText}>🔄 Detect Again</Text>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F1A' },
    backBtn: { margin: 20, marginTop: 60 },
    backBtnText: { color: '#E94560', fontSize: 16, fontWeight: '600' },
    errorText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center', marginTop: 100 },
    emotionCard: {
        marginHorizontal: 20,
        backgroundColor: '#16213E',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 2,
        marginBottom: 24,
    },
    emotionEmoji: { fontSize: 60, marginBottom: 12 },
    emotionName: { fontSize: 32, fontWeight: '800', marginBottom: 6 },
    confidence: { color: '#AAAAAA', fontSize: 16, marginBottom: 12 },
    methodBadge: {
        backgroundColor: '#0F0F1A',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    methodText: { color: '#888888', fontSize: 12, fontWeight: '600' },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 14 },
    barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    barEmoji: { fontSize: 18, width: 24 },
    barLabel: { color: '#CCCCCC', fontSize: 13, width: 72 },
    barTrack: {
        flex: 1,
        height: 8,
        backgroundColor: '#2A2A4E',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 4 },
    barScore: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
    ageGroupText: { color: '#888888', fontSize: 13, marginBottom: 6, fontStyle: 'italic' },
    recDescription: { color: '#CCCCCC', fontSize: 14, marginBottom: 16, lineHeight: 22 },
    activitiesList: { gap: 10 },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16213E',
        borderRadius: 12,
        padding: 14,
        gap: 12,
    },
    activityDot: { width: 10, height: 10, borderRadius: 5 },
    activityText: { color: '#FFFFFF', fontSize: 15, flex: 1, lineHeight: 22 },
    tryAgainBtn: {
        backgroundColor: '#16213E',
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E94560',
    },
    tryAgainText: { color: '#E94560', fontSize: 16, fontWeight: '700' },
});
