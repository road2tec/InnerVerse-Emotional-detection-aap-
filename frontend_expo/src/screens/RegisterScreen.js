/**
 * SignupScreen - Phase 2
 * Full user registration with name, email, password, age
 * Stores JWT securely in AsyncStorage after signup
 */

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Animated,
    StatusBar,
} from 'react-native';
import { signupUser } from '../services/authService';

const InputField = ({ label, field, icon, form, update, errors, shakeAnim, ...props }) => (
    <View style={S.fieldWrap}>
        <Text style={S.label}>{icon}  {label}</Text>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <TextInput
                style={[S.input, errors[field] && S.inputError]}
                value={form[field]}
                onChangeText={v => update(field, v)}
                placeholderTextColor="#4A4A6A"
                {...props}
            />
        </Animated.View>
        {errors[field] ? <Text style={S.errorMsg}>⚠ {errors[field]}</Text> : null}
    </View>
);

export default function SignupScreen({ navigation }) {
    const [form, setForm] = useState({ name: '', email: '', password: '', age: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const update = (key, val) => {
        setForm(f => ({ ...f, [key]: val }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
    };

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const validate = () => {
        const newErrors = {};
        if (!form.name.trim()) newErrors.name = 'Full name is required';
        if (!form.email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Enter a valid email';
        if (!form.password) newErrors.password = 'Password is required';
        else if (form.password.length < 6) newErrors.password = 'Minimum 6 characters';
        if (!form.age) newErrors.age = 'Age is required';
        else if (isNaN(parseInt(form.age)) || parseInt(form.age) < 1 || parseInt(form.age) > 120)
            newErrors.age = 'Enter a valid age (1–120)';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignup = async () => {
        if (!validate()) { shake(); return; }
        try {
            setLoading(true);
            await signupUser({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                age: parseInt(form.age),
            });
            navigation.replace('MainTabs');
        } catch (err) {
            const msg = err?.response?.data?.detail || 'Signup failed. Please try again.';
            Alert.alert('Signup Failed', msg);
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
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
            >

                {/* Header */}
                <View style={S.header}>
                    <Text style={S.logo}>🎭</Text>
                    <Text style={S.title}>Create Account</Text>
                    <Text style={S.subtitle}>Join and start your emotion journey</Text>
                </View>

                {/* Card */}
                <View style={S.card}>
                    <InputField label="Full Name" field="name" icon="👤" form={form} update={update} errors={errors} shakeAnim={shakeAnim} placeholder="e.g. Arjun Sharma" autoCapitalize="words" />
                    <InputField label="Email Address" field="email" icon="📧" form={form} update={update} errors={errors} shakeAnim={shakeAnim} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

                    {/* Password with eye toggle */}
                    <View style={S.fieldWrap}>
                        <Text style={S.label}>🔒  Password</Text>
                        <Animated.View style={[S.passwordRow, { transform: [{ translateX: shakeAnim }] }]}>
                            <TextInput
                                style={[S.input, S.passwordInput, errors.password && S.inputError]}
                                value={form.password}
                                onChangeText={v => update('password', v)}
                                placeholder="Min. 6 characters"
                                placeholderTextColor="#4A4A6A"
                                secureTextEntry={!showPass}
                            />
                            <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPass(p => !p)}>
                                <Text style={S.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                        {errors.password ? <Text style={S.errorMsg}>⚠ {errors.password}</Text> : null}
                        <Text style={S.hint}>Use letters, numbers, and symbols for a strong password</Text>
                    </View>

                    <InputField label="Age" field="age" icon="🎂" form={form} update={update} errors={errors} shakeAnim={shakeAnim} placeholder="e.g. 22" keyboardType="numeric" />

                    {/* Age group preview */}
                    {form.age && !isNaN(parseInt(form.age)) && (
                        <View style={S.ageGroupBadge}>
                            <Text style={S.ageGroupText}>
                                {parseInt(form.age) <= 12 ? '🧒 Child (0–12)'
                                    : parseInt(form.age) <= 19 ? '🧑‍🎓 Teen (13–19)'
                                        : parseInt(form.age) <= 59 ? '🧑 Adult (20–59)'
                                            : '🧓 Senior (60+)'}
                            </Text>
                        </View>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                        style={[S.signupBtn, loading && S.btnDisabled]}
                        onPress={handleSignup}
                        disabled={loading}
                        activeOpacity={0.85}>
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={S.signupBtnText}>Create Account →</Text>}
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={S.footer}>
                        <Text style={S.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={S.footerLink}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const S = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A1A' },
    scroll: { flexGrow: 1, padding: 20, paddingTop: 0 },
    header: { alignItems: 'center', paddingTop: 60, paddingBottom: 28 },
    logo: { fontSize: 56, marginBottom: 14 },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 0.3 },
    subtitle: { color: '#6B6B9E', fontSize: 14, marginTop: 6 },
    card: {
        backgroundColor: '#12122A',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1E1E3E',
        shadowColor: '#E94560',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    fieldWrap: { marginBottom: 18 },
    label: { color: '#9999CC', fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
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
        borderWidth: 1.5,
        borderLeftWidth: 0,
        borderColor: '#1E1E3E',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
        padding: 14,
    },
    eyeIcon: { fontSize: 18 },
    hint: { color: '#4A4A6A', fontSize: 11, marginTop: 6 },
    errorMsg: { color: '#FF4466', fontSize: 12, marginTop: 5 },
    ageGroupBadge: {
        backgroundColor: '#0A0A22',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E94560',
        alignSelf: 'flex-start',
    },
    ageGroupText: { color: '#E94560', fontSize: 13, fontWeight: '700' },
    signupBtn: {
        backgroundColor: '#E94560',
        padding: 17,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#E94560',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
    },
    btnDisabled: { opacity: 0.65 },
    signupBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    footerText: { color: '#6B6B9E', fontSize: 14 },
    footerLink: { color: '#E94560', fontSize: 14, fontWeight: '700' },
});
