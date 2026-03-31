/**
 * HomeScreen.js
 * Maa App - Focused "Today" Dashboard.
 * Prioritizes daily tasks: Meal Logging, Supplements, and ANC Checkups.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import learnContent from '../../../learn_content.json';
import StatusCard from '../../components/common/StatusCard';
import EmptyState from '../../components/common/EmptyState';
import { Colors, Dimensions, SupplementTypes } from '../../constants';
import {
    getDailySummary,
    getNextANC,
    getNutritionRequirements,
    getTodayMeals,
    getUserProfile,
    logSupplement,
    logWater,
} from '../../services/database/DatabaseService';
import { showEmergencyOptions } from '../../services/emergency/EmergencyService';
import {
    calculateDailyNutrition,
    calculateNutritionGaps,
    generateRecommendations,
    getOverallNutritionStatus,
} from '../../services/nutrition/NutritionCalculator';

function parseCheckups(rawValue) {
    if (!rawValue) return '';
    try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed.join(' | ') : '';
    } catch (error) {
        console.error('[HomeScreen] Invalid checkups_list:', error);
        return '';
    }
}

export default function HomeScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [dailySummary, setDailySummary] = useState(null);
    const [nutritionGaps, setNutritionGaps] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [nextANC, setNextANC] = useState(null);
    const [dailyTip, setDailyTip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    const loadData = useCallback(async () => {
        setLoadError('');
        try {
            const userProfile = await getUserProfile();
            setProfile(userProfile);

            const summary = await getDailySummary();
            setDailySummary(summary);

            const meals = await getTodayMeals();
            const consumed = calculateDailyNutrition(meals);
            const week = userProfile?.pregnancy_week || 1;
            const requirements = await getNutritionRequirements(week);
            const gaps = calculateNutritionGaps(consumed, requirements);
            setNutritionGaps(gaps);
            setRecommendations(generateRecommendations(gaps));
            setNextANC(await getNextANC(week));
        } catch (error) {
            console.error('[HomeScreen] Load error:', error);
            setLoadError('Unable to load dashboard data. Pull to refresh or try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const tips = learnContent?.daily_tips || [];
        if (!tips.length) return;

        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        setDailyTip(tips[dayOfYear % tips.length]);
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation, loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogWater = async () => {
        try {
            const glasses = await logWater();
            Alert.alert('Water Logged / पानी पिया', `Water: ${glasses} glasses / ${glasses} गिलास पानी`);
            loadData();
        } catch (error) {
            console.error('[HomeScreen] logWater error:', error);
        }
    };

    const handleLogSupplement = () => {
        Alert.alert(
            'Supplement / दवाई',
            'Which supplement did you take? \nआपने कौन सी दवाई ली?',
            SupplementTypes.map((item) => ({
                text: `${item.emoji} ${item.name_hi || item.name_en}`,
                onPress: async () => {
                    try {
                        await logSupplement(item.id);
                        Alert.alert('Saved / सुरक्षित', `${item.name_hi || item.name_en} recorded.`);
                        loadData();
                    } catch (error) {
                        console.error('[HomeScreen] logSupplement error:', error);
                    }
                },
            })).concat([{ text: 'Cancel / रद्द करें', style: 'cancel' }])
        );
    };

    const handleEmergency = () => {
        showEmergencyOptions(profile);
    };

    const week = profile?.pregnancy_week || 0;
    const name = profile?.name || 'Maa';
    const overallNutrition = nutritionGaps ? getOverallNutritionStatus(nutritionGaps) : 'low';
    const waterGlasses = dailySummary?.water_glasses || 0;
    const waterTarget = 10;
    const supplementCount = dailySummary?.supplements_taken || 0;
    const supplementTarget = 3;

    const checkupsText = useMemo(() => parseCheckups(nextANC?.checkups_list), [nextANC?.checkups_list]);

    if (loading) {
        return (
            <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.stateText}>नमस्ते {name}, डैशबोर्ड लोड हो रहा है... / Loading dashboard...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        >
            {/* Error Banner */}
            {loadError ? (
                <View style={styles.errorBanner} accessible accessibilityRole="alert" accessibilityLabel={loadError}>
                    <Text style={styles.errorBannerEmoji}>⚠️</Text>
                    <Text style={styles.errorBannerText}>{loadError}</Text>
                </View>
            ) : null}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.greeting}>नमस्ते, {name}</Text>
                    <Text style={styles.subGreeting}>आज के लिए आपका प्लान / Your plan for today</Text>
                </View>
                <TouchableOpacity
                    style={styles.emergencyBtn}
                    onPress={handleEmergency}
                    accessibilityRole="button"
                    accessibilityLabel="Emergency SOS"
                    accessibilityHint="Double tap to call emergency services"
                >
                    <Text style={styles.emergencyText}>🚨</Text>
                    <Text style={styles.emergencyLabel}>SOS</Text>
                </TouchableOpacity>
            </View>

            {/* Pregnancy Progress */}
            <View style={styles.progressCard}>
                <View style={styles.weekInfo}>
                    <Text style={styles.weekLabel}>गर्भावस्था का हफ्ता / Pregnancy Week</Text>
                    <Text style={styles.weekValue}>{week || '--'}</Text>
                </View>
                <View style={styles.progressSeparator} />
                <View style={[styles.statusBadge, { backgroundColor: Colors.primary + '15' }]}>
                    <Text style={[styles.statusBadgeText, { color: Colors.primary }]}>
                        {week > 28 ? 'तीसरी तिमाही / 3rd Trimester' : week > 13 ? 'दूसरी तिमाही / 2nd Trimester' : 'पहली तिमाही / 1st Trimester'}
                    </Text>
                </View>
            </View>

            {/* Primary Tasks - Large Cards */}
            <Text style={styles.sectionTitle}>आज के मुख्य काम / Major Tasks Today</Text>

            <TouchableOpacity
                style={[styles.taskCard, { backgroundColor: Colors.primary }]}
                onPress={() => navigation.navigate('Food')}
                accessibilityRole="button"
                accessibilityLabel="Log Your Meals. खाना लिखें."
                accessibilityHint="Opens meal logging screen"
            >
                <View style={styles.taskIconContainer}>
                    <Text style={styles.taskEmoji}>🍚</Text>
                </View>
                <View style={styles.taskTextContent}>
                    <Text style={styles.taskTitleHi}>खाना लिखें</Text>
                    <Text style={styles.taskTitleEn}>Log Your Meals</Text>
                    <Text style={styles.taskStatus}>
                        {nutritionGaps?.calories?.percentage >= 100 ? 'लक्ष्य पूरा! / Target met!' : 'पोषण ट्रैक करें / Track nutrition'}
                    </Text>
                </View>
                <Text style={styles.taskArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.taskCard, { backgroundColor: Colors.success }]}
                onPress={handleLogSupplement}
                accessibilityRole="button"
                accessibilityLabel={`Take Supplements. दवाई लें. ${supplementCount} of ${supplementTarget} taken today.`}
            >
                <View style={styles.taskIconContainer}>
                    <Text style={styles.taskEmoji}>💊</Text>
                </View>
                <View style={styles.taskTextContent}>
                    <Text style={styles.taskTitleHi}>दवाई लें</Text>
                    <Text style={styles.taskTitleEn}>Take Supplements</Text>
                    <Text style={styles.taskStatus}>
                        {supplementCount}/{supplementTarget} आज ली गई / taken today
                    </Text>
                </View>
                <Text style={styles.taskArrow}>→</Text>
            </TouchableOpacity>

            {nextANC && (
                <TouchableOpacity
                    style={[styles.taskCard, { backgroundColor: Colors.info }]}
                    onPress={() => navigation.navigate('Health')}
                >
                    <View style={styles.taskIconContainer}>
                        <Text style={styles.taskEmoji}>🏥</Text>
                    </View>
                    <View style={styles.taskTextContent}>
                        <Text style={styles.taskTitleHi}>अगली जांच (ANC)</Text>
                        <Text style={styles.taskTitleEn}>Next Doctor Visit</Text>
                        <Text style={styles.taskStatus}>
                            हफ्ता / Week {nextANC.recommended_week} • जांचें देखें / View tests
                        </Text>
                    </View>
                    <Text style={styles.taskArrow}>→</Text>
                </TouchableOpacity>
            )}

            {/* Status Tracking Grid */}
            <Text style={styles.sectionTitle}>आपकी प्रगति / Status Tracking</Text>
            <View style={styles.statusGrid}>
                <StatusCard
                    emoji="🥗"
                    labelHi="पोषण"
                    labelEn="Nutrition"
                    value={nutritionGaps?.calories ? `${Math.round(nutritionGaps.calories.percentage)}%` : '0%'}
                    percentage={nutritionGaps?.calories?.percentage || 0}
                    status={overallNutrition}
                    onPress={() => navigation.navigate('Food')}
                />
                <StatusCard
                    emoji="💧"
                    labelHi="पानी"
                    labelEn="Water"
                    value={`${waterGlasses}/${waterTarget}`}
                    percentage={(waterGlasses / waterTarget) * 100}
                    status={waterGlasses >= 8 ? 'good' : waterGlasses >= 5 ? 'medium' : 'low'}
                    onPress={handleLogWater}
                />
            </View>

            {/* Daily Wisdom Section */}
            {dailyTip && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>आज की सीख / Daily Wisdom</Text>
                    <TouchableOpacity
                        style={styles.wisdomCard}
                        onPress={() => navigation.navigate('Learn')}
                    >
                        <View style={styles.wisdomEmojiContainer}>
                            <Text style={styles.wisdomEmoji}>{dailyTip.emoji}</Text>
                        </View>
                        <View style={styles.wisdomContent}>
                            <Text style={styles.wisdomTitle}>{dailyTip.titleHi}</Text>
                            <Text style={styles.wisdomText}>{dailyTip.bodyHi}</Text>
                            <Text style={styles.readMoreText}>और जानें / Read more →</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>आपके लिए सुझाव / Recommended</Text>
                    <View style={styles.recContainer}>
                        {recommendations.slice(0, 2).map((item, index) => (
                            <View key={index} style={[styles.recItem, item.priority === 'high' && styles.recItemHigh]}>
                                <Text style={styles.recBullet}>{item.priority === 'high' ? '⚠️' : '💡'}</Text>
                                <Text style={styles.recText}>{item.hi}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Help / Contact Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>मदद चाहिए? / Need Help?</Text>
                <View style={styles.helpRow}>
                    <TouchableOpacity
                        style={styles.helpCard}
                        onPress={() => {
                            if (profile?.asha_contact) {
                                Linking.openURL(`tel:${profile.asha_contact}`);
                            } else {
                                Alert.alert('Contact Missing', 'Add ASHA contact in your profile.');
                            }
                        }}
                    >
                        <Text style={styles.helpEmoji}>👩‍⚕️</Text>
                        <Text style={styles.helpLabel}>आशा वर्कर / ASHA</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.helpCard, { borderLeftColor: Colors.danger }]}
                        onPress={handleEmergency}
                    >
                        <Text style={styles.helpEmoji}>🚑</Text>
                        <Text style={styles.helpLabel}>इमरजेंसी / Help</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingHorizontal: Dimensions.screenPadding, paddingTop: 50 },
    centerState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
        paddingHorizontal: 24,
    },
    stateText: {
        marginTop: 15,
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    headerLeft: { flex: 1 },
    greeting: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
    subGreeting: { fontSize: 13, color: Colors.textLight, marginTop: 2 },
    emergencyBtn: {
        backgroundColor: Colors.danger,
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    emergencyText: { fontSize: 22 },
    emergencyLabel: { fontSize: 9, color: Colors.white, fontWeight: '900', marginTop: -2 },

    progressCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        elevation: 2,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    weekInfo: { flex: 1 },
    weekLabel: { fontSize: 11, color: Colors.textLight, fontWeight: '600' },
    weekValue: { fontSize: 28, fontWeight: '800', color: Colors.primary },
    progressSeparator: { width: 1, height: 30, backgroundColor: Colors.border, marginHorizontal: 16 },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    statusBadgeText: { fontSize: 12, fontWeight: '800' },

    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.textPrimary,
        marginBottom: 12,
        marginTop: 8
    },

    taskCard: {
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 3,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    taskIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    taskEmoji: { fontSize: 28 },
    taskTextContent: { flex: 1 },
    taskTitleHi: { fontSize: 18, fontWeight: '800', color: Colors.white },
    taskTitleEn: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    taskStatus: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '700' },
    taskArrow: { fontSize: 20, color: Colors.white, fontWeight: '800' },

    statusGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        marginHorizontal: -4
    },

    section: { marginBottom: 24 },

    wisdomCard: {
        backgroundColor: Colors.cardBackground,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    wisdomEmojiContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        elevation: 2,
    },
    wisdomEmoji: { fontSize: 32 },
    wisdomContent: { flex: 1 },
    wisdomTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
    wisdomText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
    readMoreText: { fontSize: 12, color: Colors.primary, fontWeight: '800' },

    recContainer: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 12,
    },
    recItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    recItemHigh: {
        backgroundColor: Colors.danger + '05',
    },
    recBullet: { fontSize: 16, marginRight: 10, marginTop: 2 },
    recText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20, fontWeight: '600' },

    helpRow: { flexDirection: 'row', justifyContent: 'space-between' },
    helpCard: {
        width: '48%',
        backgroundColor: Colors.white,
        borderRadius: 15,
        padding: 16,
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: Colors.success,
        elevation: 2,
    },
    helpEmoji: { fontSize: 32, marginBottom: 8 },
    helpLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },

    // Error Banner
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.danger + '12',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: Colors.danger,
    },
    errorBannerEmoji: { fontSize: 20, marginRight: 10 },
    errorBannerText: { flex: 1, fontSize: 14, color: Colors.danger, fontWeight: '600', lineHeight: 20 },
});
