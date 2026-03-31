/**
 * PeripheralTestScreen.js
 * Peripheral Vision Test — Flash detection using voice input
 *
 * INPUT METHOD: Voice — say "हाँ" / "हा" / "देखा" (or "yes" / "saw") when you see the flash.
 * Fall back: large tap button.
 *
 * Protocol:
 *   - Concentric rings of test points (5°, 10°, 15°, 20° eccentricity)
 *   - 3 flash intensities: bright / medium / dim
 *   - Fixation dot in centre; user must not move eyes
 */
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    SafeAreaView, ScrollView, Dimensions, Animated,
} from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const { width: SW } = Dimensions.get('window');
const CANVAS = Math.min(SW - 40, 360);
const CX = CANVAS / 2;
const CY = CANVAS / 2;

// Positive (seen) voice keywords
const SEEN_KEYWORDS = [
    'हाँ', 'हा', 'ha', 'haan', 'han', 'देखा', 'dekha', 'yes', 'saw', 'seen',
];

function isSeenWord(transcript) {
    const t = transcript.toLowerCase().trim();
    return SEEN_KEYWORDS.some(k => t.includes(k));
}

// Generate test points arranged in rings
function buildTestPoints() {
    const eccentricities = [
        { deg: 5, r: CANVAS * 0.12 },
        { deg: 10, r: CANVAS * 0.22 },
        { deg: 15, r: CANVAS * 0.33 },
        { deg: 20, r: CANVAS * 0.44 },
    ];
    const anglesPerRing = [8, 10, 12, 14];
    const points = [];
    let id = 0;
    eccentricities.forEach(({ deg, r }, ri) => {
        const n = anglesPerRing[ri];
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI / n) * i - Math.PI / 2;
            points.push({
                id: id++,
                x: CX + r * Math.cos(angle),
                y: CY + r * Math.sin(angle),
                eccentricity: deg,
            });
        }
    });
    return points;
}

const TEST_POINTS = buildTestPoints();
const INTENSITIES = ['bright', 'medium', 'dim'];
const FLASH_DUR = 200; // ms
const RESPONSE_WIN = 1800; // ms user has to respond

export default function PeripheralTestScreen({ navigation }) {
    const [phase, setPhase] = useState('instructions');
    const [trialQueue, setTrialQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(0);
    const [results, setResults] = useState([]);
    const [flashVisible, setFlashVisible] = useState(false);
    const [activePoint, setActivePoint] = useState(null);
    const [listening, setListening] = useState(false);
    const [waitingResponse, setWaitingResponse] = useState(false);
    const [progress, setProgress] = useState(0);
    const micPulse = useRef(new Animated.Value(1)).current;
    const responseTimerRef = useRef(null);
    const respondedRef = useRef(false);

    const totalPoints = TEST_POINTS.length * INTENSITIES.length;

    // Voice recognition events
    useSpeechRecognitionEvent('result', (event) => {
        const raw = event.results?.[0]?.transcript ?? '';
        if (isSeenWord(raw) && waitingResponse && !respondedRef.current) {
            respondedRef.current = true;
            recordResponse(true);
        }
    });
    useSpeechRecognitionEvent('end', () => setListening(false));

    // Mic pulse animation
    useEffect(() => {
        if (listening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(micPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
                    Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            micPulse.stopAnimation();
            micPulse.setValue(1);
        }
    }, [listening]);

    const flashColor = useCallback((intensityLevel) => {
        if (intensityLevel === 'bright') return 'rgba(255,255,200,0.95)';
        if (intensityLevel === 'medium') return 'rgba(255,255,200,0.55)';
        return 'rgba(255,255,200,0.2)';
    }, []);

    const recordResponse = useCallback((seen) => {
        if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
        setWaitingResponse(false);
        setListening(false);
        ExpoSpeechRecognitionModule.stop();

        const currentTrial = trialQueue[queueIndex];
        if (!currentTrial) return;

        const newResult = {
            pointId: TEST_POINTS[currentTrial.pointIndex]?.id,
            eccentricity: TEST_POINTS[currentTrial.pointIndex]?.eccentricity,
            intensity: currentTrial.intensity,
            seen,
        };

        const updatedResults = [...results, newResult];
        setResults(updatedResults);
        setProgress(updatedResults.length / totalPoints);

        // Advance queue
        const nextIdx = queueIndex + 1;
        if (nextIdx < trialQueue.length) {
            setQueueIndex(nextIdx);
            setTimeout(() => {
                showNextFlashFromQueue(nextIdx);
            }, 800);
        } else {
            // Done
            setTimeout(() => finishTest(updatedResults), 600);
        }
    }, [trialQueue, queueIndex, totalPoints, results, showNextFlashFromQueue, finishTest]);

    const startVoiceListening = useCallback(async () => {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!perm.granted) return;
        setListening(true);
        respondedRef.current = false;
        ExpoSpeechRecognitionModule.start({ lang: 'hi-IN', interimResults: false, continuous: false });
    }, []);

    const showNextFlashFromQueue = useCallback((idx) => {
        const trial = trialQueue[idx];
        if (!trial) return;
        const point = TEST_POINTS[trial.pointIndex];
        if (!point) return;
        setActivePoint(point);

        // Pre-flash pause 800–1400ms
        const preDelay = 800 + Math.random() * 600;
        setTimeout(() => {
            setFlashVisible(true);
            setTimeout(() => {
                setFlashVisible(false);
                // Open response window
                setWaitingResponse(true);
                respondedRef.current = false;
                startVoiceListening();

                // Auto-miss after response window
                responseTimerRef.current = setTimeout(() => {
                    if (!respondedRef.current) {
                        respondedRef.current = true;
                        recordResponse(false);
                    }
                }, RESPONSE_WIN);
            }, FLASH_DUR);
        }, preDelay);
    }, [startVoiceListening, recordResponse, trialQueue]);

    const startTest = useCallback(() => {
        // Build and Shuffle Trial Queue
        const fullQueue = [];
        TEST_POINTS.forEach((_, ptIdx) => {
            INTENSITIES.forEach(intensityLevel => {
                fullQueue.push({ pointIndex: ptIdx, intensity: intensityLevel });
            });
        });

        // Fisher-Yates Shuffle
        for (let i = fullQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fullQueue[i], fullQueue[j]] = [fullQueue[j], fullQueue[i]];
        }

        setTrialQueue(fullQueue);
        setQueueIndex(0);
        setResults([]);
        setProgress(0);
        setPhase('test');

        // Use the newly generated queue for the first flash
        // We can't wait for state update here, so we pass it directly
        const startTrial = (idx, queue) => {
            const trial = queue[idx];
            const pt = TEST_POINTS[trial.pointIndex];
            setActivePoint(pt);
            setTimeout(() => {
                setFlashVisible(true);
                setTimeout(() => {
                    setFlashVisible(false);
                    setWaitingResponse(true);
                    respondedRef.current = false;
                    startVoiceListening();
                    responseTimerRef.current = setTimeout(() => {
                        if (!respondedRef.current) {
                            respondedRef.current = true;
                            recordResponse(false);
                        }
                    }, RESPONSE_WIN);
                }, FLASH_DUR);
            }, 1000);
        };

        // BUT, recordResponse and showNextFlashFromQueue depend on trialQueue state.
        // It's safer to use effect or a local reference.
        // Let's simplify and just use showNextFlash after state update.
    }, [startVoiceListening, recordResponse]);

    // Auto-trigger first flash when queue is ready
    useEffect(() => {
        if (phase === 'test' && trialQueue.length > 0 && queueIndex === 0 && results.length === 0) {
            showNextFlashFromQueue(0);
        }
    }, [phase, trialQueue]);

    const finishTest = useCallback((finalResults) => {
        // Calculate Visual Field Index
        const seen = finalResults.filter(r => r.seen).length;
        const vfi = Math.round((seen / finalResults.length) * 100);
        // Group by eccentricity
        const byEcc = {};
        finalResults.forEach(r => {
            if (!byEcc[r.eccentricity]) byEcc[r.eccentricity] = { seen: 0, total: 0 };
            byEcc[r.eccentricity].total++;
            if (r.seen) byEcc[r.eccentricity].seen++;
        });
        navigation.navigate('EyeHealth', {
            peripheralResult: { vfi, byEccentricity: byEcc }
        });
        setPhase('done');
    }, [navigation]);

    // ── Instructions ────────────────────────────────────────────
    if (phase === 'instructions') {
        return (
            <SafeAreaView style={s.safe}>
                <ScrollView contentContainerStyle={s.wrap}>
                    <Text style={s.emoji}>🔦</Text>
                    <Text style={s.title}>परिधीय दृष्टि टेस्ट{'\n'}Peripheral Vision Test</Text>

                    <View style={s.card}>
                        <Text style={s.cardHead}>कैसे करें / How to do it:</Text>
                        <View style={s.stepRow}>
                            <Text style={s.stepNum}>1️⃣</Text>
                            <Text style={s.stepTxt}>बीच की हरी बिंदी पर नज़र टिकाएं — हिलाएं नहीं!{'\n'}Look at the green dot — don't look away!</Text>
                        </View>
                        <View style={s.stepRow}>
                            <Text style={s.stepNum}>2️⃣</Text>
                            <Text style={s.stepTxt}>जैसे ही किनारे पर कोई चमक दिखे, बोलें «हाँ»{'\n'}When you see a flash at the side, say "हाँ"</Text>
                        </View>
                        <View style={s.stepRow}>
                            <Text style={s.stepNum}>3️⃣</Text>
                            <Text style={s.stepTxt}>अगर न दिखे तो चुप रहें — कोई बात नहीं{'\n'}If you don't see it, stay silent — that's okay</Text>
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: '#FFF0F0' }]}>
                        <Text style={s.voiceTip}>🎙️ बस «हाँ» या «देखा» बोलें जब चमक दिखे{'\n'}Just say "हाँ" or "देखा" when you see the flash</Text>
                    </View>

                    <TouchableOpacity style={s.bigBtn} onPress={startTest}>
                        <Text style={s.bigBtnTxt}>🎙️ शुरू करें / Begin</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (phase === 'done') {
        return (
            <SafeAreaView style={s.safe}>
                <View style={s.center}>
                    <Text style={s.emoji}>🎉</Text>
                    <Text style={s.title}>टेस्ट पूरा!{'\n'}Test Complete!</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Test canvas ──────────────────────────────────────────────
    return (
        <SafeAreaView style={s.safe}>
            {/* Progress */}
            <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={s.progressTxt}>{Math.round(progress * 100)}% पूरा / done</Text>

            {/* Field Canvas */}
            <View style={s.canvasWrap}>
                <Svg width={CANVAS} height={CANVAS}>
                    {/* Background */}
                    <Rect width={CANVAS} height={CANVAS} fill="#111827" rx={14} />

                    {/* Flash point */}
                    {flashVisible && activePoint && (
                        <Circle
                            cx={activePoint.x}
                            cy={activePoint.y}
                            r={14}
                            fill={flashColor(trialQueue[queueIndex]?.intensity || 'bright')}
                        />
                    )}

                    {/* Fixation glow */}
                    <Circle cx={CX} cy={CY} r={22} fill="rgba(34,197,94,0.15)" />
                    <Circle cx={CX} cy={CY} r={10} fill="rgba(34,197,94,0.5)" />
                    <Circle cx={CX} cy={CY} r={6} fill="#22C55E" />
                    <Circle cx={CX} cy={CY} r={2.5} fill="#fff" />
                </Svg>
            </View>

            {/* Mic indicator */}
            <View style={s.micRow}>
                <Animated.View style={[s.micCircle, { transform: [{ scale: micPulse }] },
                listening ? s.micOn : s.micOff]}>
                    <Text style={s.micIcon}>{listening ? '🎙️' : '⏳'}</Text>
                </Animated.View>
                <Text style={s.micLabel}>
                    {listening
                        ? '«हाँ» / «देखा» बोलें!\nSay "हाँ" if you see a flash!'
                        : 'प्रतीक्षा करें…\nWait for flash…'}
                </Text>
            </View>

            {/* Fallback tap button */}
            <TouchableOpacity
                style={[s.tapBtn, !waitingResponse && s.tapBtnDisabled]}
                onPress={() => {
                    if (waitingResponse && !respondedRef.current) {
                        respondedRef.current = true;
                        recordResponse(true);
                    }
                }}
                disabled={!waitingResponse}
            >
                <Text style={s.tapBtnTxt}>👁️ देखा! / I Saw It!</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#111827' },
    wrap: { padding: 24, alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emoji: { fontSize: 60, marginBottom: 10 },
    title: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', marginBottom: 18, lineHeight: 30 },
    card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 14, width: '100%' },
    cardHead: { fontSize: 15, fontWeight: '700', color: '#60A5FA', marginBottom: 14 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
    stepNum: { fontSize: 22, lineHeight: 26 },
    stepTxt: { flex: 1, fontSize: 14, color: '#CBD5E1', lineHeight: 22 },
    voiceTip: { fontSize: 15, color: '#FCD34D', lineHeight: 24, textAlign: 'center' },
    bigBtn: { backgroundColor: '#2563EB', borderRadius: 18, paddingVertical: 18, width: '100%', alignItems: 'center', marginTop: 10 },
    bigBtnTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
    progressBar: { height: 6, backgroundColor: '#1E293B', marginHorizontal: 24, borderRadius: 3, overflow: 'hidden', marginTop: 12 },
    progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
    progressTxt: { textAlign: 'center', color: '#64748B', fontSize: 12, marginBottom: 8 },
    canvasWrap: { alignSelf: 'center', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
    micRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 14 },
    micCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    micOn: { backgroundColor: '#1E3A8A', borderWidth: 2, borderColor: '#3B82F6' },
    micOff: { backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#334155' },
    micIcon: { fontSize: 28 },
    micLabel: { fontSize: 14, color: '#94A3B8', lineHeight: 20 },
    tapBtn: { marginHorizontal: 24, marginTop: 14, paddingVertical: 18, borderRadius: 18, backgroundColor: '#1D4ED8', alignItems: 'center' },
    tapBtnDisabled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
    tapBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
