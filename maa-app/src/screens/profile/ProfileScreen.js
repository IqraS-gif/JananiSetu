/**
 * ProfileScreen.js
 * User profile editor with:
 * - LMP → auto-calculates Pregnancy Week + Due Date
 * - Language toggle (Hindi / English)
 * - All clinical inputs in one scrollable form
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors, Dimensions } from '../../constants';
import { useLanguage } from '../../context/LanguageContext';
import { getUserProfile, saveUserProfile } from '../../services/database/DatabaseService';

// ── Clinical Helpers ──────────────────────────────────────────────

/** Derive pregnancy week from LMP date string (YYYY-MM-DD) */
function weekFromLMP(lmpString) {
    if (!lmpString || !/^\d{4}-\d{2}-\d{2}$/.test(lmpString)) return null;
    const lmp = new Date(lmpString);
    if (isNaN(lmp.getTime())) return null;
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const week = Math.floor((Date.now() - lmp.getTime()) / msPerWeek);
    return week > 0 && week <= 42 ? week : null;
}

/** Derive due date from LMP date string (LMP + 280 days) */
function dueDateFromLMP(lmpString) {
    if (!lmpString || !/^\d{4}-\d{2}-\d{2}$/.test(lmpString)) return '';
    const lmp = new Date(lmpString);
    if (isNaN(lmp.getTime())) return '';
    const due = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
    return due.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── Main Component ─────────────────────────────────────────────────

export default function ProfileScreen() {
    const { language, setLanguage } = useLanguage();
    const hi = language === 'hi';

    const [form, setForm] = useState({
        name: '',
        age: '',
        lmp_date: '',
        due_date: '',
        pregnancy_week: '',
        height_cm: '',
        start_weight_kg: '',
        current_weight_kg: '',
        asha_contact: '',
        emergency_contact: '',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const profile = await getUserProfile();
                if (profile) {
                    setForm({
                        name: profile.name || '',
                        age: profile.age?.toString() || '',
                        lmp_date: profile.lmp_date || '',
                        due_date: profile.due_date || '',
                        pregnancy_week: profile.pregnancy_week?.toString() || '',
                        height_cm: profile.height_cm?.toString() || '',
                        start_weight_kg: profile.start_weight_kg?.toString() || '',
                        current_weight_kg: profile.current_weight_kg?.toString() || '',
                        asha_contact: profile.asha_contact || '',
                        emergency_contact: profile.emergency_contact || '',
                    });
                }
            } catch (e) {
                console.error('[ProfileScreen] Load error:', e);
            }
        })();
    }, []);

    /** When LMP changes, auto-derive week and due date */
    const handleLMPChange = useCallback((lmp) => {
        const week = weekFromLMP(lmp);
        const due = dueDateFromLMP(lmp);
        setForm((prev) => ({
            ...prev,
            lmp_date: lmp,
            pregnancy_week: week ? String(week) : prev.pregnancy_week,
            due_date: due || prev.due_date,
        }));
    }, []);

    const handleSave = async () => {
        if (!form.name.trim()) {
            Alert.alert(
                hi ? '⚠️ ज़रूरी है' : '⚠️ Required',
                hi ? 'कृपया नाम डालें।' : 'Please enter your name.'
            );
            return;
        }
        setSaving(true);
        try {
            await saveUserProfile({
                name: form.name.trim(),
                age: parseInt(form.age, 10) || null,
                lmp_date: form.lmp_date || null,
                due_date: form.due_date || null,
                pregnancy_week: parseInt(form.pregnancy_week, 10) || null,
                height_cm: parseFloat(form.height_cm) || null,
                start_weight_kg: parseFloat(form.start_weight_kg) || null,
                current_weight_kg: parseFloat(form.current_weight_kg) || null,
                asha_contact: form.asha_contact || null,
                emergency_contact: form.emergency_contact || null,
                language,
            });
            Alert.alert(
                hi ? '✅ सेव हो गया' : '✅ Saved',
                hi ? 'प्रोफ़ाइल सेव हो गई!' : 'Profile saved successfully!'
            );
        } catch (e) {
            console.error('[ProfileScreen] Save error:', e);
            Alert.alert(hi ? '❌ गलती' : '❌ Error', hi ? 'कुछ गलत हुआ।' : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    const Field = ({ labelHi, labelEn, value, field, keyboardType = 'default', placeholder, onChange }) => (
        <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{hi ? labelHi : labelEn}</Text>
            <TextInput
                style={styles.input}
                value={value}
                placeholder={placeholder || (hi ? labelHi : labelEn)}
                placeholderTextColor={Colors.textLight}
                keyboardType={keyboardType}
                onChangeText={onChange || ((text) => setForm((prev) => ({ ...prev, [field]: text })))}
                cursorColor={Colors.primary}
                textAlignVertical="center"
            />
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>
                {hi ? '👤 प्रोफ़ाइल' : '👤 Profile'}
            </Text>

            {/* ── Language Toggle ── */}
            <View style={styles.languageRow}>
                <Text style={styles.languageLabel}>
                    {hi ? 'भाषा / Language' : 'Language / भाषा'}
                </Text>
                <View style={styles.languageOptions}>
                    <TouchableOpacity
                        style={[styles.langBtn, language === 'hi' && styles.langBtnActive]}
                        onPress={() => setLanguage('hi')}
                    >
                        <Text style={[styles.langBtnText, language === 'hi' && styles.langBtnTextActive]}>
                            हिन्दी
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                        onPress={() => setLanguage('en')}
                    >
                        <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>
                            English
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Personal Info ── */}
            <Text style={styles.sectionTitle}>
                {hi ? '👩 व्यक्तिगत जानकारी' : '👩 Personal Info'}
            </Text>
            <Field
                labelHi="नाम" labelEn="Name"
                value={form.name} field="name"
                placeholder={hi ? 'आपका नाम' : 'Your name'}
            />
            <Field
                labelHi="उम्र" labelEn="Age"
                value={form.age} field="age" keyboardType="numeric"
            />
            <Field
                labelHi="ऊँचाई (cm)" labelEn="Height (cm)"
                value={form.height_cm} field="height_cm" keyboardType="numeric"
            />

            {/* ── Pregnancy Details ── */}
            <Text style={styles.sectionTitle}>
                {hi ? '🤰 गर्भावस्था विवरण' : '🤰 Pregnancy Details'}
            </Text>

            <Field
                labelHi="आखिरी माहवारी (LMP)" labelEn="Last Period Date (LMP)"
                value={form.lmp_date}
                placeholder="YYYY-MM-DD"
                onChange={handleLMPChange}
            />

            {/* Auto-derived read-only display */}
            {form.pregnancy_week ? (
                <View style={styles.derivedRow}>
                    <Text style={styles.derivedLabel}>
                        {hi ? '📅 गर्भावस्था सप्ताह (auto):' : '📅 Pregnancy Week (auto):'}
                    </Text>
                    <Text style={styles.derivedValue}>
                        {hi ? `सप्ताह ${form.pregnancy_week}` : `Week ${form.pregnancy_week}`}
                    </Text>
                </View>
            ) : null}
            {form.due_date ? (
                <View style={styles.derivedRow}>
                    <Text style={styles.derivedLabel}>
                        {hi ? '🗓️ प्रसव की तारीख (auto):' : '🗓️ Due Date (auto):'}
                    </Text>
                    <Text style={styles.derivedValue}>{form.due_date}</Text>
                </View>
            ) : null}

            <Field
                labelHi="शुरुआती वज़न (kg)" labelEn="Starting Weight (kg)"
                value={form.start_weight_kg} field="start_weight_kg" keyboardType="numeric"
            />
            <Field
                labelHi="मौजूदा वज़न (kg)" labelEn="Current Weight (kg)"
                value={form.current_weight_kg} field="current_weight_kg" keyboardType="numeric"
            />

            {/* ── Emergency Contacts ── */}
            <Text style={styles.sectionTitle}>
                {hi ? '📞 आपातकालीन संपर्क' : '📞 Emergency Contacts'}
            </Text>
            <Field
                labelHi="ASHA कार्यकर्ता नंबर" labelEn="ASHA Worker Phone"
                value={form.asha_contact} field="asha_contact" keyboardType="phone-pad"
            />
            <Field
                labelHi="आपातकालीन संपर्क" labelEn="Family Emergency Contact"
                value={form.emergency_contact} field="emergency_contact" keyboardType="phone-pad"
            />

            {/* ── Save ── */}
            <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
            >
                <Text style={styles.saveBtnText}>
                    {saving
                        ? (hi ? 'सेव हो रहा है…' : 'Saving…')
                        : (hi ? '✅ सेव करें' : '✅ Save Profile')}
                </Text>
            </TouchableOpacity>

            <View style={{ height: 60 }} />
        </ScrollView>
    );
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { paddingHorizontal: Dimensions.screenPadding, paddingTop: 50 },
    pageTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },

    // Language toggle
    languageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.cardBackground,
        padding: 14,
        borderRadius: Dimensions.borderRadius,
        marginBottom: 20,
    },
    languageLabel: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
    languageOptions: { flexDirection: 'row', gap: 8 },
    langBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    langBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
    langBtnTextActive: { color: Colors.white },

    // Section
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: 12,
        marginTop: 8,
    },

    // Fields
    fieldWrap: { marginBottom: 14 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
    input: {
        backgroundColor: Colors.cardBackground,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1,
        borderColor: Colors.border,
    },

    // Auto-derived rows
    derivedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${Colors.success}15`,
        padding: 12,
        borderRadius: 10,
        marginBottom: 10,
        gap: 8,
    },
    derivedLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
    derivedValue: { fontSize: 15, fontWeight: '700', color: Colors.success },

    // Save button
    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Dimensions.borderRadius,
        padding: 18,
        alignItems: 'center',
        marginTop: 16,
        elevation: 4,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: Colors.white, fontSize: 18, fontWeight: '800' },
});
