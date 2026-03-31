/**
 * AmslerTestScreen.js
 * Amsler Grid Test — Interactive 20×20 touch grid
 * Tap/drag to mark wavy or missing areas.
 * Bilingual Hindi/English, dark grid, large touch targets.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, SafeAreaView, Dimensions, PanResponder,
} from 'react-native';
import Svg, {
    Rect, Line, Circle, G,
} from 'react-native-svg';

const { width: SW } = Dimensions.get('window');
const GRID_PX = Math.min(SW - 32, 360);
const GRID_N = 20;
const CELL = GRID_PX / GRID_N;
const FIX_RADIUS = CELL * 1.5; // safety radius around center

const PHASES = ['दाईं आँख\nRight Eye', 'बाईं आँख\nLeft Eye', 'दोनों आँखें\nBoth Eyes'];

function cellKey(col, row) { return `${col},${row}`; }

function getQuadrant(col, row) {
    const h = col < GRID_N / 2 ? 'बाईं' : 'दाईं';
    const v = row < GRID_N / 2 ? 'ऊपरी' : 'निचली';
    return `${v} ${h}`;
}

function AmslerGrid({ markedCells }) {
    const cx = GRID_PX / 2;
    const cy = GRID_PX / 2;

    // Grid lines
    const lines = [];
    for (let i = 0; i <= GRID_N; i++) {
        const pos = i * CELL;
        lines.push(<Line key={`v${i}`} x1={pos} y1={0} x2={pos} y2={GRID_PX} stroke="#374151" strokeWidth={0.8} />);
        lines.push(<Line key={`h${i}`} x1={0} y1={pos} x2={GRID_PX} y2={pos} stroke="#374151" strokeWidth={0.8} />);
    }

    // Marked cells
    const marks = Array.from(markedCells).map(key => {
        const [c, r] = key.split(',').map(Number);
        return (
            <Rect
                key={key}
                x={c * CELL + 1}
                y={r * CELL + 1}
                width={CELL - 2}
                height={CELL - 2}
                fill="rgba(239,68,68,0.65)"
            />
        );
    });

    return (
        <Svg width={GRID_PX} height={GRID_PX} style={{ borderRadius: 10 }}>
            <Rect width={GRID_PX} height={GRID_PX} fill="#111827" rx={10} />
            {lines}
            {marks}
            {/* Fixation dot glow */}
            <Circle cx={cx} cy={cy} r={18} fill="rgba(34,197,94,0.15)" />
            <Circle cx={cx} cy={cy} r={8} fill="rgba(34,197,94,0.5)" />
            <Circle cx={cx} cy={cy} r={5} fill="#22C55E" />
            <Circle cx={cx} cy={cy} r={2} fill="#fff" />
        </Svg>
    );
}

export default function AmslerTestScreen({ navigation }) {
    const [phase, setPhase] = useState('instructions');
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [markedCells, setMarkedCells] = useState(new Set());
    const [allPhaseResults, setAllPhaseResults] = useState({});
    const gridRef = useRef(null);
    const gridLayout = useRef({ x: 0, y: 0 });

    const markAt = useCallback((pageX, pageY) => {
        const lx = pageX - gridLayout.current.x;
        const ly = pageY - gridLayout.current.y;
        const col = Math.floor(lx / CELL);
        const row = Math.floor(ly / CELL);

        if (col < 0 || col >= GRID_N || row < 0 || row >= GRID_N) return;

        // Safety: don't allow marking the central fixation area
        const dx = lx - GRID_PX / 2;
        const dy = ly - GRID_PX / 2;
        if (Math.sqrt(dx * dx + dy * dy) < FIX_RADIUS) return;

        const key = cellKey(col, row);
        setMarkedCells(prev => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    }, []);

    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => markAt(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderMove: (e) => markAt(e.nativeEvent.pageX, e.nativeEvent.pageY),
    })).current;

    const calcPhaseScore = useCallback((cells) => {
        const arr = Array.from(cells).map(k => {
            const [c, r] = k.split(',').map(Number);
            return { col: c, row: r };
        });
        const count = arr.length;
        let severity = 'सामान्य / Normal';
        let riskScore = 0;
        if (count > 0 && count <= 5) { severity = 'हल्का / Mild'; riskScore = 25; }
        else if (count <= 20) { severity = 'मध्यम / Moderate'; riskScore = 60; }
        else if (count > 20) { severity = 'गंभीर / Severe'; riskScore = 90; }

        const quadrants = [...new Set(arr.map(c => getQuadrant(c.col, c.row)))];
        return { hasDistortion: count > 0, count, severity, riskScore, quadrants };
    }, []);

    const submitPhase = useCallback(() => {
        const score = calcPhaseScore(markedCells);
        const phaseName = PHASES[phaseIndex];
        const updated = { ...allPhaseResults, [phaseName]: score };
        setAllPhaseResults(updated);

        if (phaseIndex < PHASES.length - 1) {
            setPhaseIndex(pi => pi + 1);
            setMarkedCells(new Set());
            setPhase('intermission');
        } else {
            // Aggregate & navigate
            const worst = Object.values(updated).reduce((a, b) => b.riskScore > a.riskScore ? b : a, score);
            navigation.navigate('EyeHealth', {
                amslerResult: {
                    hasDistortion: worst.hasDistortion,
                    severity: worst.severity,
                    riskScore: worst.riskScore,
                    eyeData: updated,
                }
            });
            setPhase('done');
        }
    }, [markedCells, phaseIndex, calcPhaseScore, navigation, allPhaseResults]);

    if (phase === 'instructions') {
        return (
            <SafeAreaView style={s.safe}>
                <ScrollView contentContainerStyle={s.wrap}>
                    <Text style={s.emoji}>📐</Text>
                    <Text style={s.title}>आम्सलर ग्रिड टेस्ट{'\n'}Amsler Grid Test</Text>
                    <View style={s.card}>
                        <Text style={s.cardHead}>क्या करना है / What to do:</Text>
                        <Text style={s.instrTxt}>
                            • बीच की हरी बिंदी पर नज़र टिकाए रखें{'\n'}
                            (Keep eyes fixed on the green dot){'\n\n'}
                            • अगर कोई लकीर टेढ़ी या गायब लगे, उसे उँगली से दबाएं{'\n'}
                            (If lines look wavy or missing, tap them){'\n\n'}
                            • हरी बिंदी से आँख न हटाएं!{'\n'}
                            (Do NOT look away from the dot!)
                        </Text>
                    </View>
                    <View style={[s.card, { backgroundColor: '#FFF8E7' }]}>
                        <Text style={s.warnTxt}>⚠️ एक आँख ढकें जब कहा जाए{'\n'}   Cover one eye as instructed</Text>
                    </View>
                    <TouchableOpacity style={s.bigBtn} onPress={() => setPhase('test')}>
                        <Text style={s.bigBtnTxt}>तैयार हूँ / I'm Ready</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (phase === 'intermission') {
        return (
            <SafeAreaView style={s.safe}>
                <View style={s.center}>
                    <Text style={s.emoji}>✅</Text>
                    <Text style={s.title}>चरण पूरा!{'\n'}Phase Done!</Text>
                    <Text style={s.subTitle}>अब: {PHASES[phaseIndex].split('\n')[0]}</Text>
                    <Text style={s.noteTxt}>दूसरी आँख ढकें।{'\n'}Switch eye cover.</Text>
                    <TouchableOpacity style={[s.bigBtn, { marginTop: 32 }]} onPress={() => setPhase('test')}>
                        <Text style={s.bigBtnTxt}>आगे / Continue</Text>
                    </TouchableOpacity>
                </View>
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

    // Test
    return (
        <SafeAreaView style={s.safe}>
            <View style={s.topBar}>
                <View style={s.badge}>
                    <Text style={s.badgeTxt}>{PHASES[phaseIndex].split('\n')[0]}</Text>
                </View>
                <Text style={s.topInfo}>
                    {markedCells.size === 0 ? 'कुछ नहीं / None marked' : `${markedCells.size} क्षेत्र / areas`}
                </Text>
            </View>

            <Text style={s.fixHint}>🟢 हरी बिंदी पर नज़र रखें — टेढ़ी जगह दबाएं{'\n'}Keep eyes on dot — tap wavy/missing areas</Text>

            {/* Grid with touch */}
            <View
                ref={gridRef}
                onLayout={(e) => {
                    gridRef.current?.measure((fx, fy, w, h, px, py) => {
                        gridLayout.current = { x: px, y: py };
                    });
                }}
                style={s.gridWrap}
                {...panResponder.panHandlers}
            >
                <AmslerGrid markedCells={markedCells} />
            </View>

            <View style={s.btnRow}>
                <TouchableOpacity
                    style={s.clearBtn}
                    onPress={() => setMarkedCells(new Set())}
                >
                    <Text style={s.clearBtnTxt}>🗑️ साफ़ करें / Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={submitPhase}>
                    <Text style={s.submitBtnTxt}>जमा करें / Submit ✓</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    wrap: { padding: 24, alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emoji: { fontSize: 60, marginBottom: 10 },
    title: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', marginBottom: 18, lineHeight: 30 },
    subTitle: { fontSize: 18, fontWeight: '700', color: '#60A5FA', textAlign: 'center', marginBottom: 8 },
    noteTxt: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 24 },
    card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 14, width: '100%' },
    cardHead: { fontSize: 15, fontWeight: '700', color: '#60A5FA', marginBottom: 10 },
    instrTxt: { fontSize: 15, color: '#CBD5E1', lineHeight: 26 },
    warnTxt: { fontSize: 14, color: '#FCD34D', lineHeight: 22 },
    bigBtn: { backgroundColor: '#2563EB', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 36, width: '100%', alignItems: 'center', marginTop: 10 },
    bigBtnTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    badge: { backgroundColor: '#3B82F6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    badgeTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
    topInfo: { color: '#94A3B8', fontSize: 14 },
    fixHint: { textAlign: 'center', color: '#94A3B8', fontSize: 12, marginBottom: 10, lineHeight: 18, paddingHorizontal: 16 },
    gridWrap: { alignSelf: 'center', borderRadius: 12, overflow: 'hidden' },
    btnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
    clearBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: '#1E293B', borderWidth: 1.5, borderColor: '#334155', alignItems: 'center' },
    clearBtnTxt: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
    submitBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center' },
    submitBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
