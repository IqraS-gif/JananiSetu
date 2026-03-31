/**
 * HealthScreen.js
 * Maa App - Health tracking tab (weight, ANC, supplements).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Svg, Circle } from 'react-native-svg';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors, Dimensions, SupplementTypes } from '../../constants';
import WeightGainChart from '../../components/widgets/WeightGainChart';
import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';
import {
    getANCSchedule,
    getSupplementAdherence,
    getUserProfile,
    getWeightHistory,
    logWeight,
    markANCCompleted,
    attachReportToVisit,
    getKickHistory,
    getSymptomHistory,
    getVitalsHistory,
    logKicks,
    logSymptom,
    logVitals,
} from '../../services/database/DatabaseService';

const KICK_SESSION_DURATION = 60 * 60; // 1 hour in seconds

const COMMON_SYMPTOMS = [
    { id: 'swelling', en: 'Swelling', hi: 'सूजन', emoji: '🦵' },
    { id: 'headache', en: 'Headache', hi: 'सिरदर्द', emoji: '🤕' },
    { id: 'nausea', en: 'Nausea', hi: 'जी मिचलाना', emoji: '🤢' },
    { id: 'dizziness', en: 'Dizziness', hi: 'चक्कर आना', emoji: '😵' },
    { id: 'blurred_vision', en: 'Blurred Vision', hi: 'धुंधली दृष्टि', emoji: '👓' },
    { id: 'pain', en: 'Abdominal Pain', hi: 'पेट दर्द', emoji: '😣' },
];

const SEVERITY_LEVELS = [
    { id: 'mild', label: 'हल्का (Mild)', color: '#4FC3F7' },
    { id: 'moderate', label: 'सामान्य (Mod)', color: '#FFB74D' },
    { id: 'severe', label: 'गंभीर (Severe)', color: '#E57373' },
];

export default function HealthScreen() {
    const [profile, setProfile] = useState(null);
    const [weights, setWeights] = useState([]);
    const [anc, setAnc] = useState([]);
    const [suppHistory, setSuppHistory] = useState([]);

    // New States
    const [kickHistory, setKickHistory] = useState([]);
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [symptomHistory, setSymptomHistory] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');

    // Kick Counter Specifics
    const [isCountingKicks, setIsCountingKicks] = useState(false);
    const [kickCount, setKickCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(KICK_SESSION_DURATION);

    // Form States
    const [showWeightInput, setShowWeightInput] = useState(false);
    const [weightInput, setWeightInput] = useState('');

    const [showVitalsInput, setShowVitalsInput] = useState(false);
    const [vitalsInput, setVitalsInput] = useState({ systolic: '', diastolic: '', bloodSugar: '' });

    const [showSymptomInput, setShowSymptomInput] = useState(false);
    const [selectedSymp, setSelectedSymp] = useState(null);
    const [selectedSev, setSelectedSev] = useState('mild');

    const loadData = useCallback(async () => {
        setLoadError('');
        try {
            const userProfile = await getUserProfile();
            setProfile(userProfile);
            setWeights(await getWeightHistory());
            setAnc(await getANCSchedule());
            setSuppHistory(await getSupplementAdherence(7));

            // New health data
            setKickHistory(await getKickHistory(5));
            setVitalsHistory(await getVitalsHistory(5));
            setSymptomHistory(await getSymptomHistory(5));
        } catch (error) {
            console.error('[HealthScreen] load error:', error);
            setLoadError('Unable to load health data. Pull to refresh or retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Timer Logic for Kicks
    useEffect(() => {
        let interval = null;
        if (isCountingKicks && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((t) => t - 1);
            }, 1000);
        } else if (timeLeft === 0 && isCountingKicks) {
            handleCompleteKickSession();
        }
        return () => clearInterval(interval);
    }, [isCountingKicks, timeLeft]);

    const startKickSession = () => {
        setKickCount(0);
        setTimeLeft(KICK_SESSION_DURATION);
        setIsCountingKicks(true);
    };

    const handleCompleteKickSession = async () => {
        setIsCountingKicks(false);
        try {
            const durationUsed = Math.round((KICK_SESSION_DURATION - timeLeft) / 60);
            await logKicks(kickCount, durationUsed || 1);
            loadData();
            if (kickCount < 10) {
                Alert.alert('Alert / सचेत', 'Low kick count recorded (<10). If you still feel reduced movement, contact your doctor or ASHA worker.\n\nकम किक दर्ज की गई। यदि आप अभी भी कम हलचल महसूस करती हैं, तो डॉक्टर या आशा कार्यकर्ता से संपर्क करें।');
            } else {
                Alert.alert('Success', `Session complete. recorded ${kickCount} kicks.`);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to save session.');
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleLogWeight = async () => {
        const value = parseFloat(weightInput);
        if (Number.isNaN(value) || value < 20 || value > 200) {
            Alert.alert('Validation', 'Please enter a valid weight between 20 and 200 kg.');
            return;
        }

        try {
            await logWeight(value, profile?.pregnancy_week || 0);
            setWeightInput('');
            setShowWeightInput(false);
            loadData();
            Alert.alert('Saved', `Weight ${value} kg logged.`);
        } catch (error) {
            console.error('[HealthScreen] logWeight error:', error);
            Alert.alert('Error', 'Unable to save weight.');
        }
    };

    const handleLogVitals = async () => {
        const { systolic, diastolic, bloodSugar } = vitalsInput;
        if (!systolic || !diastolic) {
            Alert.alert('Validation', 'Please enter at least Blood Pressure (Systolic/Diastolic).');
            return;
        }
        try {
            await logVitals({
                systolic: parseInt(systolic),
                diastolic: parseInt(diastolic),
                bloodSugar: bloodSugar ? parseFloat(bloodSugar) : null,
            });
            setVitalsInput({ systolic: '', diastolic: '', bloodSugar: '' });
            setShowVitalsInput(false);
            loadData();
            Alert.alert('Saved', 'Vitals logged successfully.');
        } catch (err) {
            Alert.alert('Error', 'Failed to save vitals.');
        }
    };

    const handleLogSymptom = async () => {
        if (!selectedSymp) {
            Alert.alert('Validation', 'Please select a symptom.');
            return;
        }
        try {
            await logSymptom(selectedSymp.id, selectedSev);
            setSelectedSymp(null);
            setSelectedSev('mild');
            setShowSymptomInput(false);
            loadData();
            Alert.alert('Saved', 'Symptom logged.');
        } catch (err) {
            Alert.alert('Error', 'Failed to save symptom.');
        }
    };

    const handleMarkANC = (visitNumber) => {
        Alert.alert('Mark ANC Visit', 'Mark this ANC visit as completed?', [
            {
                text: 'Yes',
                onPress: async () => {
                    await markANCCompleted(visitNumber);
                    loadData();
                },
            },
            { text: 'No', style: 'cancel' },
        ]);
    };

    const handleUploadReport = async (visitNumber) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const doc = result.assets[0];
            const fileName = `report_anc_${visitNumber}_${Date.now()}.pdf`;

            const destFile = new File(Paths.document, fileName);
            const sourceFile = new File(doc.uri);
            await sourceFile.copy(destFile);

            await attachReportToVisit(visitNumber, destFile.uri);
            loadData();
            Alert.alert('Success', 'Report uploaded successfully.');
        } catch (err) {
            console.error('Report upload error:', err);
            Alert.alert('Error', 'Unable to upload report.');
        }
    };

    const handleRemoveReport = (visitNumber) => {
        Alert.alert('Remove Report', 'Are you sure you want to remove this report?', [
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    await attachReportToVisit(visitNumber, null);
                    loadData();
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const nextVisit = anc.find(v => !v.is_completed);

    const calculateAdherence = () => {
        if (suppHistory.length === 0) return 0;
        const totalTaken = suppHistory.reduce((acc, curr) => acc + curr.count, 0);
        const totalExpected = suppHistory.length * 3; // 3 doses per day
        return Math.round((totalTaken / totalExpected) * 100);
    };

    const adherenceScore = calculateAdherence();

    // Simple streak logic: consecutive days with 3/3 count
    const calculateStreak = () => {
        let streak = 0;
        const reversedHistory = [...suppHistory].reverse();
        for (const day of reversedHistory) {
            if (day.count === 3) streak++;
            else break;
        }
        return streak;
    };

    const streakDays = calculateStreak();

    if (loading) {
        return (
            <View style={styles.centerState}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.stateText}>Loading health data...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        loadData();
                    }}
                    colors={[Colors.primary]}
                />
            }
        >
            {loadError ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{loadError}</Text>
                </View>
            ) : null}

            <Text style={styles.pageTitle}>🩺 स्वास्थ्य <Text style={styles.smallEn}>/ Health</Text></Text>

            {/* Fetal Kick Counter Card */}
            <View style={[styles.section, { marginBottom: 20 }]}>
                <View style={styles.kickCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.sectionTitle}>बच्चे की हलचल <Text style={styles.smallEn}>(Kick Counter)</Text></Text>
                    </View>

                    {!isCountingKicks ? (
                        <View style={styles.kickStart}>
                            <Text style={styles.kickHintHi}>
                                क्या आप बच्चे की हलचल महसूस कर रही हैं? गिनने के लिए नीचे बटन दबाएं।
                            </Text>
                            <Text style={styles.kickHintEn}>
                                Start a session to count baby movements. (Target: 10+ kicks/hr)
                            </Text>
                            <TouchableOpacity style={styles.kickMainBtn} onPress={startKickSession}>
                                <Text style={styles.kickMainBtnText}>गिनना शुरू करें <Text style={styles.btnSubEn}>(Start Counting)</Text></Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.kickActive}>
                            <View style={styles.kickHeader}>
                                <Text style={styles.kickTimer}>
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                                </Text>
                                <TouchableOpacity style={styles.kickStopBtn} onPress={handleCompleteKickSession}>
                                    <Text style={styles.kickStopBtnText}>बंद करें (Stop)</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.kickCircle} onPress={() => setKickCount(c => c + 1)}>
                                <Text style={styles.kickCircleTextHi}>महसूस किया</Text>
                                <Text style={styles.kickCircleTextEn}>(Felt it)</Text>
                                <Text style={styles.kickBigNumber}>{kickCount}</Text>
                            </TouchableOpacity>

                            <Text style={[styles.kickHintHi, { marginTop: 15 }]}>
                                अब तक {kickCount} बार हलचल दर्ज हुई
                            </Text>
                        </View>
                    )}

                    {kickHistory.length > 0 && !isCountingKicks && (
                        <View style={styles.historyList}>
                            <Text style={styles.historyTitle}>पिछली जाँच <Text style={styles.smallEn}>(Recent)</Text></Text>
                            {kickHistory.slice(0, 3).map((s, i) => (
                                <View key={i} style={styles.historyRow}>
                                    <Text style={styles.historyDate}>{s.date}</Text>
                                    <View style={styles.historyInfo}>
                                        <Text style={styles.historyValue}>{s.count} बार हलचल ({Math.round(s.duration_min)} मिनट)</Text>
                                        <Text style={styles.historySub}>{s.count >= 10 ? '✅ स्वस्थ हलचल' : '⚠️ हलचल कम है - डॉक्टर से पूछें'}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>

            {/* Vital Signs Section (Simplified for Rural Users) */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>बीपी और शूगर की जाँच</Text>
                        <Text style={styles.sectionSubtitle}>B.P. & Sugar Check</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowVitalsInput(prev => !prev)}>
                        <Text style={styles.addBtnText}>{showVitalsInput ? 'बंद करें (Close)' : '+ यहाँ लिखें'}</Text>
                    </TouchableOpacity>
                </View>

                {showVitalsInput && (
                    <View style={styles.vitalInputBox}>
                        <Text style={styles.inputHint}>B.P. Example: 120 / 80</Text>
                        <View style={styles.inputRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tinyLabel}>High Number (ऊपर वाला)</Text>
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="120"
                                    placeholderTextColor={Colors.textLight}
                                    keyboardType="numeric"
                                    value={vitalsInput.systolic}
                                    onChangeText={(t) => setVitalsInput({ ...vitalsInput, systolic: t })}
                                    cursorColor={Colors.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.tinyLabel}>Low Number (नीचे वाला)</Text>
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="80"
                                    placeholderTextColor={Colors.textLight}
                                    keyboardType="numeric"
                                    value={vitalsInput.diastolic}
                                    onChangeText={(t) => setVitalsInput({ ...vitalsInput, diastolic: t })}
                                    cursorColor={Colors.primary}
                                />
                            </View>
                        </View>
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.tinyLabel}>Sugar (शूगर) - Optional</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Example: 95"
                                placeholderTextColor={Colors.textLight}
                                keyboardType="numeric"
                                value={vitalsInput.bloodSugar}
                                onChangeText={(t) => setVitalsInput({ ...vitalsInput, bloodSugar: t })}
                                cursorColor={Colors.primary}
                            />
                        </View>
                        <TouchableOpacity style={styles.saveBtnFull} onPress={handleLogVitals}>
                            <Text style={styles.saveBtnText}>सुरक्षित करें <Text style={styles.smallEn}>(Save)</Text></Text>
                        </TouchableOpacity>
                    </View>
                )}

                {vitalsHistory.length > 0 ? (
                    vitalsHistory.map((v, i) => {
                        const isHighBP = v.systolic >= 140 || v.diastolic >= 90;
                        return (
                            <View key={i} style={[styles.vitalRow, isHighBP && styles.vitalHigh]}>
                                <View style={styles.vitalMain}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.vitalLabel}>B.P.</Text>
                                        {isHighBP && <Text style={styles.alertText}> (HIGH/ज़्यादा)</Text>}
                                    </View>
                                    <Text style={styles.vitalVal}>{v.systolic}/{v.diastolic}</Text>
                                </View>
                                {v.blood_sugar ? (
                                    <View style={styles.vitalMain}>
                                        <Text style={styles.vitalLabel}>Sugar</Text>
                                        <Text style={styles.vitalVal}>{v.blood_sugar}</Text>
                                    </View>
                                ) : null}
                                <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                                    <Text style={styles.vitalDate}>{v.date}</Text>
                                    <Text style={styles.vitalTime}>{v.time}</Text>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={styles.emptyText}>No blood pressure or sugar checks yet.</Text>
                )}
            </View>

            {/* Symptoms Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>लक्षणों की जाँच</Text>
                        <Text style={styles.sectionSubtitle}>Symptom Tracker</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowSymptomInput(prev => !prev)}>
                        <Text style={styles.addBtnText}>{showSymptomInput ? 'बंद करें' : '+ लिखें'}</Text>
                    </TouchableOpacity>
                </View>

                {showSymptomInput && (
                    <View style={styles.sympInputBox}>
                        <Text style={styles.label}>Select Symptom:</Text>
                        <View style={styles.sympGrid}>
                            {COMMON_SYMPTOMS.map(s => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.sympItem, selectedSymp?.id === s.id && styles.sympItemSelected]}
                                    onPress={() => setSelectedSymp(s)}
                                >
                                    <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                                    <Text style={styles.sympItemLabel}>{s.hi}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.label}>Severity / तीव्रता:</Text>
                        <View style={styles.sevRow}>
                            {SEVERITY_LEVELS.map(s => (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[
                                        styles.sevBtn,
                                        selectedSev === s.id && { backgroundColor: s.color, borderColor: s.color }
                                    ]}
                                    onPress={() => setSelectedSev(s.id)}
                                >
                                    <Text style={[styles.sevBtnText, selectedSev === s.id && { color: '#fff' }]}>{s.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.saveBtnFull} onPress={handleLogSymptom}>
                            <Text style={styles.saveBtnText}>लक्षण दर्ज करें <Text style={styles.smallEn}>(Save)</Text></Text>
                        </TouchableOpacity>
                    </View>
                )}

                {symptomHistory.length > 0 ? (
                    symptomHistory.map((s, i) => {
                        const symp = COMMON_SYMPTOMS.find(cs => cs.id === s.symptom_id);
                        const sev = SEVERITY_LEVELS.find(sl => sl.id === s.severity);
                        return (
                            <View key={i} style={styles.historyRow}>
                                <Text style={styles.historyDate}>{s.date}</Text>
                                <View style={styles.historyInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.historyValue}>{symp?.emoji} {symp?.hi || s.symptom_id}</Text>
                                        <View style={[styles.sevBadge, { backgroundColor: sev?.color || '#eee', marginLeft: 8 }]}>
                                            <Text style={styles.sevBadgeText}>{sev?.label}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={styles.emptyText}>No symptoms recorded.</Text>
                )}
            </View>

            {/* Weight Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>वज़न की प्रगति</Text>
                        <Text style={styles.sectionSubtitle}>Weight Progress</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowWeightInput((prev) => !prev)}>
                        <Text style={styles.addBtnText}>{showWeightInput ? 'बंद करें' : '+ लिखें'}</Text>
                    </TouchableOpacity>
                </View>

                {showWeightInput ? (
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Weight (kg)"
                            placeholderTextColor={Colors.textLight}
                            keyboardType="numeric"
                            value={weightInput}
                            onChangeText={setWeightInput}
                            cursorColor={Colors.primary}
                        />
                        <TouchableOpacity style={styles.saveBtn} onPress={handleLogWeight}>
                            <Text style={styles.saveBtnText}>सुरक्षित करें</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {weights.length > 0 ? (
                    <View>
                        <WeightGainChart
                            weights={weights}
                            startWeight={profile?.start_weight_kg}
                            heightCm={profile?.height_cm}
                        />
                    </View>
                ) : (
                    <Text style={styles.emptyText}>No weight logs yet.</Text>
                )}
            </View>

            {/* ANC Schedule Section - Upgraded to Vertical Timeline */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>जाँच का सफ़र</Text>
                        <Text style={styles.sectionSubtitle}>The Journey Timeline (ANC)</Text>
                    </View>
                </View>

                {nextVisit && (
                    <View style={styles.nextVisitHighlight}>
                        <View style={styles.nextVisitBadge}>
                            <Text style={styles.nextVisitBadgeText}>अगली जाँच (Next Visit)</Text>
                        </View>
                        <Text style={styles.nextVisitTitle}>जाँच {nextVisit.visit_number}</Text>
                        <Text style={styles.nextVisitWeek}>सप्ताह {nextVisit.recommended_week} पर</Text>
                        <Text style={styles.nextVisitDesc}>{nextVisit.description_hi}</Text>
                    </View>
                )}

                <View style={styles.timelineContainer}>
                    {anc.map((visit, idx) => {
                        const isLast = idx === anc.length - 1;
                        return (
                            <View key={visit.visit_number} style={styles.timelineItem}>
                                <View style={styles.timelineLeft}>
                                    <View style={[
                                        styles.timelineDot,
                                        visit.is_completed ? styles.dotCompleted : styles.dotPending
                                    ]}>
                                        {visit.is_completed && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                                    </View>
                                    {!isLast && <View style={styles.timelineLine} />}
                                </View>
                                <View style={styles.timelineContent}>
                                    <View style={styles.ancCard}>
                                        <View style={styles.ancCardTop}>
                                            <View>
                                                <Text style={styles.ancCardTitle}>जाँच {visit.visit_number} (Visit {visit.visit_number})</Text>
                                                <Text style={styles.ancCardWeek}>सप्ताह {visit.recommended_week} <Text style={styles.smallEn}>(Week {visit.recommended_week})</Text></Text>
                                            </View>
                                            {!visit.is_completed && (
                                                <TouchableOpacity
                                                    style={styles.checkDoneBtn}
                                                    onPress={() => handleMarkANC(visit.visit_number)}
                                                >
                                                    <Text style={styles.checkDoneBtnText}>पूरा हुआ</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <Text style={styles.ancCardDesc}>{visit.description_hi}</Text>

                                        <View style={styles.ancActions}>
                                            <TouchableOpacity
                                                style={[styles.actionBtn, visit.report_uri && styles.actionBtnActive]}
                                                onPress={() => handleUploadReport(visit.visit_number)}
                                            >
                                                <Text style={[styles.actionBtnText, visit.report_uri && styles.actionBtnTextActive]}>
                                                    {visit.report_uri ? '📄 बदलें (Change)' : '📄 रिपोर्ट जोड़ें'}
                                                </Text>
                                            </TouchableOpacity>

                                            {visit.report_uri && (
                                                <TouchableOpacity
                                                    style={styles.removeReportBtn}
                                                    onPress={() => handleRemoveReport(visit.visit_number)}
                                                >
                                                    <Text style={styles.removeReportBtnText}>✖ हटाएं</Text>
                                                </TouchableOpacity>
                                            )}

                                            {visit.report_uri && (
                                                <Text style={styles.reportAttachedBadge}>✅ अटैच है</Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Supplement Section - Upgraded */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>दवाई की रिपोर्ट</Text>
                        <Text style={styles.sectionSubtitle}>Supplement Adherence</Text>
                    </View>
                </View>

                {/* Score Card with Circular Gauge */}
                <View style={styles.scoreCard}>
                    <View style={styles.scoreRow}>
                        <View style={styles.gaugeContainer}>
                            <Svg width="80" height="80" viewBox="0 0 80 80">
                                <Circle
                                    cx="40"
                                    cy="40"
                                    r="35"
                                    stroke="#E0E0E0"
                                    strokeWidth="8"
                                    fill="transparent"
                                />
                                <Circle
                                    cx="40"
                                    cy="40"
                                    r="35"
                                    stroke={adherenceScore >= 80 ? Colors.success : Colors.warning}
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={`${2 * Math.PI * 35}`}
                                    strokeDashoffset={`${2 * Math.PI * 35 * (1 - adherenceScore / 100)}`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 40 40)"
                                />
                                <View style={styles.scoreTextContainer}>
                                    <Text style={styles.scorePercent}>{adherenceScore}%</Text>
                                </View>
                            </Svg>
                        </View>
                        <View style={styles.scoreInfo}>
                            <Text style={styles.scoreTitle}>
                                {adherenceScore >= 80 ? 'शानदार! (Great!)' : 'जरूरी है! (Action Needed)'}
                            </Text>
                            <Text style={styles.scoreDesc}>
                                {adherenceScore >= 80
                                    ? "आप समय पर दवाएं ले रही हैं।"
                                    : "कोशिश करें कि कोई खुरक न छूटे।"
                                }
                            </Text>
                            {streakDays > 0 && (
                                <View style={styles.streakBadge}>
                                    <Text style={styles.streakText}>🔥 {streakDays} दिन का सफुला (Streak)</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Medicine Strip History */}
                <View style={styles.medicineStripContainer}>
                    <Text style={styles.historyTitle}>पिछले 7 दिन (Past 7 Days)</Text>
                    {suppHistory.length > 0 ? (
                        suppHistory.map((day, idx) => (
                            <View key={idx} style={styles.medicineRow}>
                                <View style={styles.medicineDate}>
                                    <Text style={styles.dayText}>{day.date.split('-')[2]}</Text>
                                    <Text style={styles.monthText}>{new Date(day.date).toLocaleString('default', { month: 'short' })}</Text>
                                </View>
                                <View style={styles.pileStrip}>
                                    {(() => {
                                        const takenTypes = day.types ? day.types.split(',') : [];
                                        // We'll show up to 4 slots (1 Iron, 2 Calcium, 1 Folic)
                                        // Simplified for the UI: just show the taken ones first, then empty slots
                                        const slots = [1, 2, 3, 4];
                                        return slots.map(pos => {
                                            const typeId = takenTypes[pos - 1];
                                            const supplement = SupplementTypes.find(s => s.id === typeId);
                                            const taken = !!supplement;

                                            return (
                                                <View key={pos} style={[styles.pillSlot, taken && { backgroundColor: `${supplement.color}15`, borderColor: supplement.color, borderWidth: 1 }]}>
                                                    <Text style={[styles.pillIcon, !taken && { opacity: 0.2 }]}>
                                                        {taken ? supplement.emoji : '💊'}
                                                    </Text>
                                                    {taken && <View style={[styles.pillCheck, { backgroundColor: supplement.color }]}>
                                                        <Text style={styles.pillCheckText}>✓</Text>
                                                    </View>}
                                                </View>
                                            );
                                        });
                                    })()}
                                </View>
                                <Text style={styles.dailyTakenText}>{day.count}/3+</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No records yet.</Text>
                    )}
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
    stateText: { marginTop: 10, fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
    errorTitle: { fontSize: 20, fontWeight: '700', color: Colors.danger, marginBottom: 6 },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: Colors.primary,
    },
    retryButtonText: { color: Colors.white, fontWeight: '700' },
    errorBanner: {
        backgroundColor: `${Colors.danger}15`,
        borderColor: `${Colors.danger}50`,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    errorBannerText: { color: Colors.danger, fontSize: 13, fontWeight: '600' },
    pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },
    smallEn: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary },
    section: { marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
    sectionSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12, marginTop: -4 },
    cardHeader: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10, marginBottom: 15 },

    // Kick Counter Styles
    kickCard: {
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 20,
        elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8,
    },
    kickStart: { alignItems: 'center', paddingVertical: 10 },
    kickHintHi: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginBottom: 8, lineHeight: 22 },
    kickHintEn: { fontSize: 12, color: Colors.textLight, textAlign: 'center', marginBottom: 20 },
    kickMainBtn: { backgroundColor: Colors.primary, paddingVertical: 16, paddingHorizontal: 30, borderRadius: 30, alignItems: 'center' },
    kickMainBtnText: { color: Colors.white, fontSize: 18, fontWeight: '800' },
    btnSubEn: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
    kickActive: { alignItems: 'center' },
    kickHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    kickTimer: { fontSize: 32, fontWeight: '800', color: Colors.warning, fontFamily: 'monospace' },
    kickStopBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: `${Colors.danger}15` },
    kickStopBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
    kickBigNumber: { fontSize: 70, fontWeight: '900', color: Colors.white, marginTop: -5 },
    kickCircle: {
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: Colors.primary,
        alignItems: 'center', justifyContent: 'center',
        elevation: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10,
    },
    kickCircleTextHi: { color: Colors.white, fontSize: 22, fontWeight: '900', marginBottom: 0 },
    kickCircleTextEn: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
    historyList: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
    historyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textLight, textTransform: 'uppercase', marginBottom: 12 },
    historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    historyDate: { fontSize: 13, color: Colors.textLight, width: 80 },
    historyInfo: { flex: 1 },
    historyValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    historySub: { fontSize: 12, color: Colors.textSecondary },

    // Vitals Styles
    vitalInputBox: { backgroundColor: Colors.white, padding: 16, borderRadius: 15, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
    inputHint: { fontSize: 12, color: Colors.textLight, marginBottom: 10, fontStyle: 'italic' },
    tinyLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4, marginLeft: 4 },
    smallInput: {
        flex: 1,
        backgroundColor: '#f9f9f9',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
        marginRight: 8,
        fontSize: 16,
        color: Colors.textPrimary,
        textAlignVertical: 'center',
    },
    vitalRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 14, borderRadius: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: Colors.success },
    vitalHigh: { borderLeftColor: Colors.danger, backgroundColor: `${Colors.danger}05` },
    vitalMain: { marginRight: 24 },
    vitalLabel: { fontSize: 11, color: Colors.textLight, textTransform: 'uppercase', fontWeight: '700' },
    alertText: { fontSize: 10, color: Colors.danger, fontWeight: '900' },
    vitalVal: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
    vitalDate: { fontSize: 12, color: Colors.textLight },
    vitalTime: { fontSize: 10, color: Colors.textLight, textAlign: 'right' },

    // Symptom Styles
    sympInputBox: { backgroundColor: Colors.white, padding: 16, borderRadius: 15, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
    label: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
    sympGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    sympItem: { width: '30%', aspectRatio: 1, backgroundColor: '#f9f9f9', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
    sympItemSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
    sympItemLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
    sevRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    sevBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
    sevBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
    sevBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
    sevBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800', textTransform: 'uppercase' },
    saveBtnFull: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },

    addBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
    inputRow: { flexDirection: 'row', marginBottom: 12 },
    input: {
        flex: 1,
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 14,
        fontSize: 18,
        marginRight: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.textPrimary,
        textAlignVertical: 'center',
    },
    saveBtn: { backgroundColor: Colors.success, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
    saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
    weightTrendCard: {
        backgroundColor: `${Colors.primary}10`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: `${Colors.primary}30`,
    },
    trendLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    trendValue: { fontSize: 22, fontWeight: '900', color: Colors.primary },
    weightRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.white, padding: 12, borderRadius: 10, marginBottom: 8 },
    weightDate: { fontSize: 14, color: Colors.textSecondary },
    weightValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
    weightWeek: { fontSize: 14, color: Colors.info },
    ancCompleted: { borderLeftColor: Colors.success, opacity: 0.7 },
    emptyText: { fontSize: 14, color: Colors.textLight, textAlign: 'center', padding: 20 },

    // Supplement Score Card & Gauge
    scoreCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    scoreRow: { flexDirection: 'row', alignItems: 'center' },
    gaugeContainer: { position: 'relative', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    scoreTextContainer: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    scorePercent: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary },
    scoreInfo: { flex: 1, marginLeft: 20 },
    scoreTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
    scoreDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
    streakBadge: { backgroundColor: `${Colors.warning}15`, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    streakText: { color: Colors.warning, fontSize: 11, fontWeight: '800' },

    // Medicine Strip Styles
    medicineStripContainer: { marginTop: 10 },
    medicineRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 16, marginBottom: 10, elevation: 1 },
    medicineDate: { width: 45, alignItems: 'center' },
    dayText: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
    monthText: { fontSize: 10, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase' },
    pileStrip: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 15 },
    pillSlot: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    pillSlotTaken: { backgroundColor: `${Colors.success}15`, borderWidth: 1, borderColor: Colors.success },
    pillIcon: { fontSize: 20 },
    pillCheck: { position: 'absolute', bottom: -2, right: -2, backgroundColor: Colors.success, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    pillCheckText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    dailyTakenText: { width: 40, textAlign: 'right', fontSize: 14, fontWeight: '800', color: Colors.textPrimary },

    // Next Visit Highlight
    nextVisitHighlight: {
        backgroundColor: Colors.primary,
        borderRadius: 20,
        padding: 20,
        marginBottom: 25,
        elevation: 6,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10
    },
    nextVisitBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 10
    },
    nextVisitBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    nextVisitTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
    nextVisitWeek: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700', marginTop: 2 },
    nextVisitDesc: { color: '#fff', fontSize: 14, marginTop: 8, lineHeight: 20 },

    // Timeline Styles
    timelineContainer: { paddingLeft: 10 },
    timelineItem: { flexDirection: 'row', marginBottom: 20 },
    timelineLeft: { width: 40, alignItems: 'center' },
    timelineDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 2
    },
    dotCompleted: { backgroundColor: Colors.success },
    dotPending: { backgroundColor: '#E0E0E0' },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: -5,
        zIndex: 1
    },
    timelineContent: { flex: 1, paddingLeft: 10 },

    // ANC Card Styles
    ancCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#F0F0F0'
    },
    ancCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    ancCardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
    ancCardWeek: { fontSize: 12, color: Colors.info, fontWeight: '700' },
    ancCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 15 },

    ancActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkDoneBtn: { backgroundColor: Colors.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    checkDoneBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#EEE'
    },
    actionBtnActive: { backgroundColor: `${Colors.primary}10`, borderColor: Colors.primaryLight },
    actionBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
    actionBtnTextActive: { color: Colors.primary },
    reportAttachedBadge: { fontSize: 11, color: Colors.success, fontWeight: '800' },
    removeReportBtn: {
        backgroundColor: `${Colors.danger}10`,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: `${Colors.danger}20`
    },
    removeReportBtnText: { color: Colors.danger, fontSize: 11, fontWeight: '700' },
});
