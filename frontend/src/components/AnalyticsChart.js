import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EMOTION_COLORS = {
    happy: '#FFD700',
    sad: '#4A9EFF',
    angry: '#FF4444',
    frustrated: '#FF8C42',
    neutral: '#AAAAAA',
    excited: '#FF69B4',
    stressed: '#AA55FF',
    fear: '#9955FF',
    surprise: '#FF6B9E',
};

export default function AnalyticsChart({ data }) {
    if (!data || data.length === 0) return null;

    // Find max total for scaling
    const maxTotal = Math.max(...data.map(d => d.total));
    const chartHeight = 120;

    return (
        <View style={S.container}>
            <Text style={S.title}>📈 7-Day Mood Analytics</Text>

            <View style={S.chartArea}>
                {data.map((day, i) => {
                    // Parse "YYYY-MM-DD" to short day name (e.g. "Mon")
                    const dateObj = new Date(day.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                    // Calculate bar height relative to max
                    const hPct = maxTotal > 0 ? (day.total / maxTotal) : 0;
                    const barHeight = Math.max(hPct * chartHeight, 4); // min 4px height

                    // Color based on dominant emotion
                    const color = day.dominant ? (EMOTION_COLORS[day.dominant] || '#666') : '#2A2A4E';

                    return (
                        <View key={i} style={S.barCol}>
                            <View style={[S.barWrap, { height: chartHeight }]}>
                                <View style={[S.bar, { height: barHeight, backgroundColor: color }]} />
                            </View>
                            <Text style={S.dayLabel}>{dayName}</Text>
                            <Text style={S.countLabel}>{day.total > 0 ? day.total : ''}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const S = StyleSheet.create({
    container: {
        backgroundColor: '#12122A',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E1E3E',
        marginBottom: 20,
    },
    title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 16 },
    chartArea: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 150,
    },
    barCol: { alignItems: 'center', width: 34 },
    barWrap: {
        width: 12,
        backgroundColor: '#1A1A3A',
        borderRadius: 6,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        marginBottom: 8,
    },
    bar: { width: '100%', borderRadius: 6 },
    dayLabel: { color: '#888888', fontSize: 10, fontWeight: '600', marginBottom: 2 },
    countLabel: { color: '#666', fontSize: 10, height: 14 },
});
