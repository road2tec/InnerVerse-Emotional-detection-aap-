/**
 * Navigation setup - React Navigation stack + bottom tabs
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import DetectScreen from '../screens/DetectScreen';
import ResultsScreen from '../screens/ResultsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TextDetectScreen from '../screens/TextDetectScreen';
import VoiceDetectScreen from '../screens/VoiceDetectScreen';
import FaceDetectScreen from '../screens/FaceDetectScreen';
import RecommendScreen from '../screens/RecommendScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab icon component - simple text emoji icons (replace with vector icons)
const TabIcon = ({ focused, emoji }) => (
    <React.Fragment>
        <Text style={{ fontSize: focused ? 26 : 22 }}>{emoji}</Text>
    </React.Fragment>
);

import { Text } from 'react-native';

/**
 * Main bottom tab navigator (shown when logged in)
 */
function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#1A1A2E',
                    borderTopColor: '#16213E',
                    paddingBottom: 8,
                    paddingTop: 4,
                    height: 65,
                },
                tabBarActiveTintColor: '#E94560',
                tabBarInactiveTintColor: '#AAAAAA',
                tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
            }}>
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🏠" />, tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="Detect"
                component={DetectScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="🎭" />, tabBarLabel: 'Detect' }}
            />
            {/* Phase 6 — Recommendations tab */}
            <Tab.Screen
                name="Recommend"
                component={RecommendScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="✨" />, tabBarLabel: 'Activities' }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="📊" />, tabBarLabel: 'History' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon focused={focused} emoji="👤" />, tabBarLabel: 'Profile' }}
            />
        </Tab.Navigator>
    );
}

/**
 * Root stack navigator
 */
export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen
                    name="Results"
                    component={ResultsScreen}
                    options={{ animation: 'slide_from_bottom' }}
                />
                {/* Phase 3 — Text emotion detection screen */}
                <Stack.Screen
                    name="TextDetect"
                    component={TextDetectScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                {/* Phase 4 — Voice emotion detection screen */}
                <Stack.Screen
                    name="VoiceDetect"
                    component={VoiceDetectScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                {/* Phase 5 — Face emotion detection screen */}
                <Stack.Screen
                    name="FaceDetect"
                    component={FaceDetectScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                {/* Phase 6 — Recommendations (also accessible as bottom tab) */}
                <Stack.Screen
                    name="Recommendations"
                    component={RecommendScreen}
                    options={{ animation: 'slide_from_bottom' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
