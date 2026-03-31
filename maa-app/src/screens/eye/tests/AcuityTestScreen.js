/**
 * AcuityTestScreen.js
 * Visual Acuity Test — Tumbling E (3-down / 2-up staircase)
 *
 * INPUT METHOD: Voice (primary) + Arrow buttons (fallback)
 * Say: ऊपर / नीचे / बाएं / दाएं  (or up/down/left/right)
 * Tailored for rural pregnant women on Android phones.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, SafeAreaView, Dimensions, Animated,
} from 'react-native';
import Svg, { G, Rect, Circle } from 'react-native-svg';
import { useVoiceDirection } from '../../../hooks/useVoiceDirection';
import { Colors } from '../../../constants';

const { width: SW } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SW - 40, 360);
const TEST_DISTANCE_MM = 400; // phone at arm's length
const PIXELS_PER_MM = SW / 130;

const SIZE_STEPS = [88, 70, 55, 44, 35, 28, 22, 17, 14, 11, 8, 5];
const PHASES = ['दाईं आँख\nRight Eye', 'बाईं आँख\nLeft Eye', 'दोनों आँखें\nBoth Eyes'];
const ORIENTATIONS = ['up', 'down', 'left', 'right'];

function arcMinToPixels(arcMin) {
    const rad = (arcMin / 60) * (Math.PI / 180);
    const mm = Math.tan(rad) * TEST_DISTANCE_MM;
    return Math.max(mm * PIXELS_PER_MM, 22);
}
function arcMinToSnellen(arcMin) {
    const mar = arcMin / 5;
    return `20/${Math.round(20 * mar)}`;
}
function arcMinToLogMAR(arcMin) {
    return parseFloat(Math.log10(arcMin / 5).toFixed(2));
}

function TumblingE({ sizePx, orientation }) {
    const u = sizePx / 5;
    const off = -2.5 * u;
    const angleMap = { right: 0, up: -90, down: 90, left: 180 };
    const angleDeg = angleMap[orientation] ?? 0;
    const center = CANVAS_SIZE / 2;

    return (
        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
            <Rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#FFFFFF" />

            {/* Rotation Group: Moves to center and rotates */}
            <G transform={`translate(${center} ${center}) rotate(${angleDeg})`}>
                {/* Offset Group: Centers the E relative to its own 5u x 5u box */}
                <G transform={`translate(${off} ${off})`}>
                    <Rect x={0} y={0} width={u} height={5 * u} fill="#000000" />
                    <Rect x={0} y={0} width={5 * u} height={u} fill="#000000" />
                    <Rect x={0} y={2 * u} width={5 * u} height={u} fill="#000000" />
                    <Rect x={0} y={4 * u} width={5 * u} height={u} fill="#000000" />
                </G>
            </G>

            {/* Minimal fixation dot to help focus */}
            <Circle cx={center} cy={center} r={2} fill="#CBD5E1" opacity={0.3} />
        </Svg>
    );
}

export default function AcuityTestScreen({ navigation }) {
    const [phase, setPhase] = useState('instructions');
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [orientation, setOrientation] = useState('right');
    const [stepIndex, setStepIndex] = useState(0);
    const [correctStreak, setCorrectStreak] = useState(0);
    const [incorrectStreak, setIncorrectStreak] = useState(0);
    const [reversals, setReversals] = useState(0);
    const [lastDir, setLastDir] = useState(null);
    const [results, setResults] = useState([]);
    const [allPhaseResults, setAllPhaseResults] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [locked, setLocked] = useState(false);
    const [listening, setListening] = useState(false);
    const micPulse = useRef(new Animated.Value(1)).current;

    const nextOrientation = useCallback((prev) => {
        let o;
        do { o = ORIENTATIONS[Math.floor(Math.random() * 4)]; } while (o === prev);
        return o;
    }, []);

    // Mic pulse animation
    useEffect(() => {
        if (listening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(micPulse, { toValue: 1.25, duration: 500, useNativeDriver: true }),
                    Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            micPulse.stopAnimation();
            micPulse.setValue(1);
        }
    }, [listening]);

    const handleAnswer = useCallback((dir) => {
        if (locked) return;
        setLocked(true);
        setListening(false);

        const isCorrect = dir === orientation;
        setFeedback(isCorrect ? 'correct' : 'wrong');

        setResults(prev => {
            const newResults = [...prev, { size: SIZE_STEPS[stepIndex], correct: isCorrect }];

            let newStep = stepIndex;
            let newCorrect = correctStreak + (isCorrect ? 1 : 0);
            let newWrong = isCorrect ? 0 : incorrectStreak + 1;
            let newReversals = reversals;
            let newLastDir = lastDir;

            if (isCorrect && newCorrect >= 3) {
                if (lastDir === 'larger') newReversals++;
                newLastDir = 'smaller';
                newStep = Math.min(SIZE_STEPS.length - 1, stepIndex + 1);
                newCorrect = 0;
            } else if (!isCorrect && newWrong >= 2) {
                if (lastDir === 'smaller') newReversals++;
                newLastDir = 'larger';
                newStep = Math.max(0, stepIndex - 1);
                newWrong = 0;
            }

            const done = newReversals >= 8 || newResults.length >= 25;
            setTimeout(() => {
                if (done) {
                    finishPhase(newResults, newStep);
                } else {
                    setStepIndex(newStep);
                    setCorrectStreak(newCorrect);
                    setIncorrectStreak(newWrong);
                    setReversals(newReversals);
                    setLastDir(newLastDir);
                    setQuestionCount(c => c + 1);
                    setOrientation(prev2 => nextOrientation(prev2));
                    setFeedback(null);
                    setLocked(false);
                    // Auto-start next mic session
                    startListeningAfterDelay();
                }
            }, 700);

            return newResults;
        });
    }, [locked, orientation, stepIndex, correctStreak, incorrectStreak, reversals, lastDir, nextOrientation]);

    const { startListening, stopListening } = useVoiceDirection({
        onDirection: handleAnswer,
        active: listening,
    });

    const startListeningAfterDelay = useCallback(() => {
        setTimeout(async () => {
            setListening(true);
            await startListening();
        }, 400);
    }, [startListening]);

    const finishPhase = useCallback((phaseResults, lastStepIdx) => {
        const summary = {};
        phaseResults.forEach(r => {
            if (!summary[r.size]) summary[r.size] = { total: 0, correct: 0 };
            summary[r.size].total++;
            if (r.correct) summary[r.size].correct++;
        });
        const sorted = Object.keys(summary).map(Number).sort((a, b) => a - b);
        let best = sorted[sorted.length - 1] ?? SIZE_STEPS[lastStepIdx];
        for (const s of sorted) {
            if (summary[s].correct / summary[s].total >= 0.625) { best = s; break; }
        }
        const result = { snellen: arcMinToSnellen(best), logMAR: arcMinToLogMAR(best) };

        const phaseName = PHASES[phaseIndex];
        const updated = { ...allPhaseResults, [phaseName]: result };
        setAllPhaseResults(updated);

        if (phaseIndex < PHASES.length - 1) {
            setPhaseIndex(pi => pi + 1);
            setFeedback(null);
            setPhase('intermission');
        } else {
            const binocular = updated[PHASES[2]] || updated[PHASES[1]] || result;
            navigation.navigate('EyeHealth', {
                acuityResult: { logMAR: binocular.logMAR, snellen: binocular.snellen, eyeData: updated }
            });
            setPhase('done');
        }
    }, [phaseIndex, navigation, allPhaseResults]);

    const startPhase = useCallback(() => {
        setStepIndex(0); setCorrectStreak(0); setIncorrectStreak(0);
        setReversals(0); setLastDir(null); setResults([]);
        setQuestionCount(0); setLocked(false); setFeedback(null);
        const o = nextOrientation(null);
        setOrientation(o);
        setPhase('test');
        startListeningAfterDelay();
    }, [nextOrientation, startListeningAfterDelay]);

    // ── Instructions ──────────────────────────────────────────
    if (phase === 'instructions') {
        return (
            <SafeAreaView style={s.safe}>
                <ScrollView contentContainerStyle={s.wrap}>
                    <Text style={s.emoji}>👁️</Text>
                    <Text style={s.title}>दृष्टि परीक्षण{'\n'}Visual Acuity Test</Text>

                    <View style={s.card}>
                        <Text style={s.cardHead}>बोलकर बताएं / Say the direction:</Text>
                        <View style={s.dirRow}>
                            {[['⬆️', 'ऊपर\nup'], ['⬇️', 'नीचे\ndown'], ['⬅️', 'बाएं\nleft'], ['➡️', 'दाएं\nright']].map(([ic, lbl]) => (
                                <View key={lbl} style={s.dirItem}>
                                    <Text style={s.dirIcon}>{ic}</Text>
                                    <Text style={s.dirLabel}>{lbl}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={s.cardNote}>जिस तरफ "E" की उंगलियाँ हों वो बोलें{'\n'}Say where the "E" opening points</Text>
                    </View>

                    <View style={[s.card, { backgroundColor: '#FFF8E7' }]}>
                        <Text style={s.warnText}>⚠️ एक आँख को हाथ से ढकें{'\n'}   Cover one eye as told</Text>
                    </View>

                    <TouchableOpacity style={s.bigBtn} onPress={startPhase}>
                        <Text style={s.bigBtnTxt}>🎙️ शुरू करें / Start</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ── Intermission ──────────────────────────────────────────
    if (phase === 'intermission') {
        const nextEye = PHASES[phaseIndex].split('\n')[0];
        return (
            <SafeAreaView style={s.safe}>
                <View style={s.center}>
                    <Text style={s.emoji}>✅</Text>
                    <Text style={s.title}>शाबाश! / Well done!</Text>
                    <Text style={s.subTitle}>अब: {nextEye}</Text>
                    <Text style={s.noteText}>दूसरी आँख ढकें।{'\n'}Switch eye cover.</Text>
                    <TouchableOpacity style={[s.bigBtn, { marginTop: 32 }]} onPress={startPhase}>
                        <Text style={s.bigBtnTxt}>🎙️ जारी रखें / Continue</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ── Done ──────────────────────────────────────────────────
    if (phase === 'done') {
        return (
            <SafeAreaView style={s.safe}>
                <View style={s.center}>
                    <Text style={s.emoji}>🎉</Text>
                    <Text style={s.title}>टेस्ट पूरा!{'\n'}Test Complete!</Text>
                    <Text style={s.noteText}>परिणाम स्वतः भर गया है।{'\n'}Results auto-filled.</Text>
                </View>
            </SafeAreaView>
        );
    }

    // ── Test ──────────────────────────────────────────────────
    const currentSize = SIZE_STEPS[stepIndex];
    const sizePx = arcMinToPixels(currentSize);

    return (
        <SafeAreaView style={s.safe}>
            {/* Top bar */}
            <View style={s.topBar}>
                <View style={s.badge}>
                    <Text style={s.badgeTxt}>{PHASES[phaseIndex].split('\n')[0]}</Text>
                </View>
                <Text style={s.topInfo}>
                    {arcMinToSnellen(currentSize)} · प्रश्न {questionCount + 1}
                </Text>
            </View>

            {/* E Canvas */}
            <View style={[s.eBox,
            feedback === 'correct' && { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
            feedback === 'wrong' && { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
            ]}>
                <TumblingE sizePx={sizePx} orientation={orientation} />
            </View>

            {/* Mic indicator */}
            <View style={s.micRow}>
                <Animated.View style={[s.micCircle, { transform: [{ scale: micPulse }] },
                listening ? s.micActive : s.micIdle]}>
                    <Text style={s.micIcon}>{listening ? '🎙️' : '🔇'}</Text>
                </Animated.View>
                <Text style={s.micHint}>
                    {listening
                        ? 'सुन रहा है… बोलें!\nListening… speak!'
                        : 'तैयार हो रहा है…\nPreparing…'}
                </Text>
            </View>

            {/* Arrow buttons — fallback */}
            <Text style={s.fallbackHdr}>या तीर दबाएं / or tap an arrow:</Text>
            <View style={s.arrowWrap}>
                <TouchableOpacity style={s.arrBtn} onPress={() => handleAnswer('up')}>
                    <Text style={s.arrTxt}>↑</Text>
                </TouchableOpacity>
                <View style={s.arrowRow}>
                    <TouchableOpacity style={s.arrBtn} onPress={() => handleAnswer('left')}>
                        <Text style={s.arrTxt}>←</Text>
                    </TouchableOpacity>
                    <View style={{ width: 72 }} />
                    <TouchableOpacity style={s.arrBtn} onPress={() => handleAnswer('right')}>
                        <Text style={s.arrTxt}>→</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.arrBtn} onPress={() => handleAnswer('down')}>
                    <Text style={s.arrTxt}>↓</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    wrap: { padding: 24, alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emoji: { fontSize: 60, marginBottom: 10 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 18, lineHeight: 30 },
    subTitle: { fontSize: 18, fontWeight: '700', color: '#3B82F6', textAlign: 'center', marginBottom: 8 },
    noteText: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 24 },
    card: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 18, marginBottom: 14, width: '100%' },
    cardHead: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 14, textAlign: 'center' },
    cardNote: { fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 12, lineHeight: 20 },
    dirRow: { flexDirection: 'row', justifyContent: 'space-around' },
    dirItem: { alignItems: 'center' },
    dirIcon: { fontSize: 32 },
    dirLabel: { fontSize: 13, color: '#374151', textAlign: 'center', marginTop: 4, lineHeight: 18 },
    warnText: { fontSize: 14, color: '#92400E', lineHeight: 22 },
    bigBtn: { backgroundColor: '#2563EB', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 36, width: '100%', alignItems: 'center', marginTop: 10 },
    bigBtnTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    badge: { backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    badgeTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
    topInfo: { color: '#64748B', fontSize: 14 },
    eBox: { alignSelf: 'center', borderRadius: 14, borderWidth: 2, borderColor: '#E2E8F0', overflow: 'hidden' },
    micRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, gap: 14 },
    micCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    micActive: { backgroundColor: '#DBEAFE', borderWidth: 2, borderColor: '#2563EB' },
    micIdle: { backgroundColor: '#F1F5F9', borderWidth: 2, borderColor: '#CBD5E1' },
    micIcon: { fontSize: 28 },
    micHint: { fontSize: 14, color: '#475569', lineHeight: 20 },
    fallbackHdr: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 14, marginBottom: 4 },
    arrowWrap: { alignItems: 'center' },
    arrowRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    arrBtn: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', margin: 4, elevation: 2 },
    arrTxt: { fontSize: 30, color: '#1E293B' },
});
