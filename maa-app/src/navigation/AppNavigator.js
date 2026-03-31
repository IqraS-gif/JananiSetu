/**
 * AppNavigator.js
 * Maa App - Bottom tab navigation.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Colors, Labels } from '../constants';
import { useLanguage } from '../context/LanguageContext';
import MealLoggingFlow from '../screens/food/MealLoggingFlow';
import HealthScreen from '../screens/health/HealthScreen';
import HomeScreen from '../screens/home/HomeScreen';
import LearnStack from '../screens/learn/LearnStack';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EyeHealthScreen from '../screens/eye/EyeHealthScreen';
import AcuityTestScreen from '../screens/eye/tests/AcuityTestScreen';
import ContrastTestScreen from '../screens/eye/tests/ContrastTestScreen';
import AmslerTestScreen from '../screens/eye/tests/AmslerTestScreen';
import PeripheralTestScreen from '../screens/eye/tests/PeripheralTestScreen';

const Tab = createBottomTabNavigator();
const EyeStack = createNativeStackNavigator();

function EyeStackNavigator() {
    return (
        <EyeStack.Navigator screenOptions={{ headerShown: false }}>
            <EyeStack.Screen name="EyeHealth" component={EyeHealthScreen} />
            <EyeStack.Screen name="AcuityTest" component={AcuityTestScreen} />
            <EyeStack.Screen name="ContrastTest" component={ContrastTestScreen} />
            <EyeStack.Screen name="AmslerTest" component={AmslerTestScreen} />
            <EyeStack.Screen name="PeripheralTest" component={PeripheralTestScreen} />
        </EyeStack.Navigator>
    );
}

const TAB_ICONS = {
    Home: '🏠',
    Food: '🍽️',
    Health: '💊',
    Learn: '📚',
    Profile: '👤',
    Eye: '👁️',
};

const TAB_LABEL_KEYS = {
    Home: 'home',
    Food: 'food',
    Health: 'health',
    Learn: 'learn',
    Profile: 'profile',
    Eye: 'eye',
};

function getTabLabel(routeName, language) {
    const key = TAB_LABEL_KEYS[routeName];
    if (!key || !Labels[key]) return routeName;
    return Labels[key][language] || Labels[key].en || routeName;
}

export default function AppNavigator() {
    const { language } = useLanguage();

    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                            <Text style={styles.icon}>{TAB_ICONS[route.name]}</Text>
                        </View>
                    ),
                    tabBarLabel: ({ focused }) => (
                        <Text style={[styles.label, focused && styles.labelActive]}>
                            {getTabLabel(route.name, language)}
                        </Text>
                    ),
                    tabBarStyle: styles.tabBar,
                    tabBarItemStyle: styles.tabBarItem,
                })}
            >
                <Tab.Screen name="Home" component={HomeScreen} />
                <Tab.Screen name="Food" component={MealLoggingFlow} />
                <Tab.Screen name="Health" component={HealthScreen} />
                <Tab.Screen name="Learn" component={LearnStack} />
                <Tab.Screen name="Eye" component={EyeStackNavigator} />
                <Tab.Screen name="Profile" component={ProfileScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        height: 80,
        paddingBottom: 10,
        paddingTop: 8,
        backgroundColor: Colors.white,
        borderTopWidth: 0,
        elevation: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    tabBarItem: {
        paddingVertical: 4,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconWrapActive: {
        backgroundColor: Colors.surfaceLight,
    },
    icon: {
        fontSize: 24,
    },
    label: {
        fontSize: 12,
        color: Colors.textLight,
        fontWeight: '500',
    },
    labelActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
});
