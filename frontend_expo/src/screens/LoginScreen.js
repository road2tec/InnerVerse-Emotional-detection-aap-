/**
 * LoginScreen - Phase 2
 * Email + password JSON login with JWT storage in AsyncStorage
 */

import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
    Platform, Animated, StatusBar,
} from 'react-native';
import { loginUser } from '../services/authService';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const validate = () => {
        const errs = {};
        if (!email.trim()) errs.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
        if (!password) errs.password = 'Password is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) { shake(); return; }
        try {
            setLoading(true);
            await loginUser(email.trim().toLowerCase(), password);
            navigation.replace('MainTabs');
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Login failed. Check your credentials.';
            Alert.alert('Login Failed', msg);
            shake();
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={S.container}
            enabled={Platform.OS === 'ios'}
        >
            <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
            <ScrollView
                contentContainerStyle={S.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >

                {/* Decorative top bar */}
                <View style={S.topBar} />

                {/* Header */}
                <View style={S.header}>
                    <View style={S.logoWrap}>
                        <Text style={S.logo}>🎭</Text>
                    </View>
                    <Text style={S.title}>Welcome Back!</Text>
                    <Text style={S.subtitle}>Sign in to detect your emotions</Text>
                </View>

                {/* Form card */}
                <Animated.View style={[S.card, { transform: [{ translateX: shakeAnim }] }]}>

                    {/* Email */}
                    <View style={S.fieldWrap}>
                        <Text style={S.label}>📧  Email Address</Text>
                        <TextInput
                            style={[S.input, errors.email && S.inputError]}
                            value={email}
                            onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                            placeholder="you@example.com"
                            placeholderTextColor="#4A4A6A"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {errors.email ? <Text style={S.errorMsg}>⚠ {errors.email}</Text> : null}
                    </View>

                    {/* Password */}
                    <View style={S.fieldWrap}>
                        <Text style={S.label}>🔒  Password</Text>
                        <View style={S.passwordRow}>
                            <TextInput
                                style={[S.input, S.passwordInput, errors.password && S.inputError]}
                                value={password}
                                onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                                placeholder="Enter your password"
                                placeholderTextColor="#4A4A6A"
                                secureTextEntry={!showPass}
                            />
                            <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPass(p => !p)}>
                                <Text style={S.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </View>
                        {errors.password ? <Text style={S.errorMsg}>⚠ {errors.password}</Text> : null}
                    </View>

                    {/* Forgot password placeholder */}
                    <TouchableOpacity style={S.forgotWrap}>
                        <Text style={S.forgotText}>Forgot password? (coming soon)</Text>
                    </TouchableOpacity>

                    {/* Login button */}
                    <TouchableOpacity
                        style={[S.loginBtn, loading && S.btnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={S.loginBtnText}>Sign In →</Text>}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={S.divider}>
                        <View style={S.dividerLine} />
                        <Text style={S.dividerText}>OR</Text>
                        <View style={S.dividerLine} />
                    </View>

                    {/* Guest mode */}
                    <TouchableOpacity
                        style={S.guestBtn}
                        onPress={() => navigation.replace('MainTabs')}
                        activeOpacity={0.8}>
                        <Text style={S.guestBtnText}>Continue as Guest</Text>
                    </TouchableOpacity>

                    {/* Register link */}
                    <View style={S.footer}>
                        <Text style={S.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={S.footerLink}>Create one</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* JWT info badge */}
                <View style={S.securityBadge}>
                    <Text style={S.securityText}>🔐 Secured with JWT · Passwords hashed with bcrypt</Text>
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    topBar: { height: 4, backgroundColor: '#E94560', borderRadius: 2 },
    scroll: { flexGrow: 1, padding: 20 },
    header: { alignItems: 'center', paddingTop: 40, paddingBottom: 28 },
    logoWrap: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#12122A',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#E94560',
        marginBottom: 16,
        shadowColor: '#E94560', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    logo: { fontSize: 36 },
    title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
    subtitle: { color: '#6B6B9E', fontSize: 14, marginTop: 6 },
    card: {
        backgroundColor: '#12122A',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1E1E3E',
    },
    fieldWrap: { marginBottom: 16 },
    label: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 8 },
    input: {
        backgroundColor: '#0A0A22',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 15,
        borderWidth: 1.5,
        borderColor: '#1E1E3E',
    },
    inputError: { borderColor: '#FF4466' },
    passwordRow: { flexDirection: 'row', alignItems: 'center' },
    passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
    eyeBtn: {
        backgroundColor: '#0A0A22',
        borderWidth: 1.5, borderLeftWidth: 0, borderColor: '#1E1E3E',
        borderTopRightRadius: 14, borderBottomRightRadius: 14,
        padding: 14,
    },
    eyeIcon: { fontSize: 18 },
    errorMsg: { color: '#FF4466', fontSize: 12, marginTop: 5 },
    forgotWrap: { alignSelf: 'flex-end', marginBottom: 18 },
    forgotText: { color: '#6B6B9E', fontSize: 12 },
    loginBtn: {
        backgroundColor: '#E94560',
        padding: 17,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#E94560', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    btnDisabled: { opacity: 0.65 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#1E1E3E' },
    dividerText: { color: '#4A4A6A', fontSize: 12 },
    guestBtn: {
        backgroundColor: '#0A0A22',
        padding: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#1E1E3E',
        marginBottom: 20,
    },
    guestBtnText: { color: '#9999CC', fontSize: 14, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center' },
    footerText: { color: '#6B6B9E', fontSize: 14 },
    footerLink: { color: '#E94560', fontSize: 14, fontWeight: '700' },
    securityBadge: { marginTop: 20, alignItems: 'center' },
    securityText: { color: '#3A3A5E', fontSize: 11 },
});
