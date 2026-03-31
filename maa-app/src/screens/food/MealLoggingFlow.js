/**
 * MealLoggingFlow.js
 * Maa App – Streamlined 3-Step Meal Logging Flow
 *
 * Step 1: Selection (Auto-detect Meal Type + Paginated Food Search / Grid)
 * Step 2: Portions  (Adjust multipliers for selected items)
 * Step 3: Review & Save (Concise summary + safety check)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    FlatList, Alert, TextInput, ActivityIndicator,
} from 'react-native';

import FoodCard from '../../components/common/FoodCard';
import EmptyState from '../../components/common/EmptyState';
import LoadingPlaceholder from '../../components/common/LoadingPlaceholder';
import {
    getFoodsByCategoryPaginated,
    searchFoodsPaginated,
    getFoodById,
    saveMealLog,
    getAllFoodsPaginated,
} from '../../services/database/DatabaseService';
import { calculateMealNutrition } from '../../services/nutrition/NutritionCalculator';
import { Colors, Dimensions, Labels, FoodKeywords, QuickMeals } from '../../constants';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { VoiceRecognitionService } from '../../services/VoiceRecognitionService';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getAutoMealType = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 16) return 'lunch';
    if (hour >= 16 && hour < 19) return 'snack';
    return 'dinner';
};

const MEAL_META = {
    breakfast: { emoji: '🌅', hi: 'नाश्ता', en: 'Breakfast', color: '#FF9800' },
    lunch: { emoji: '☀️', hi: 'दोपहर का खाना', en: 'Lunch', color: '#4CAF50' },
    dinner: { emoji: '🌙', hi: 'रात का खाना', en: 'Dinner', color: '#3F51B5' },
    snack: { emoji: '🍪', hi: 'स्नैक', en: 'Snack', color: '#E91E63' },
};

const LIMIT = 30;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FLOW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MealLoggingFlow({ navigation }) {
    const [step, setStep] = useState(1);
    const [mealType, setMealType] = useState(getAutoMealType());
    const [selectedFoods, setSelectedFoods] = useState([]);
    const [saving, setSaving] = useState(false);

    const goBack = () => {
        if (step > 1) setStep(step - 1);
        else navigation.goBack();
    };

    const handleSaveMeal = async () => {
        setSaving(true);
        try {
            const items = selectedFoods.map(sf => ({
                food_id: sf.food.id,
                portion_multiplier: sf.portion_multiplier,
            }));
            await saveMealLog({ mealType, items });
            Alert.alert(
                '✅ ' + Labels.mealSaved.hi,
                Labels.mealSaved.en,
                [{ text: '👍 ठीक है / OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('[MealLog] Save error:', error);
            Alert.alert('❌', 'कुछ गलत हुआ / Something went wrong');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header / Progress Bar */}
            <View style={styles.topNav}>
                <TouchableOpacity onPress={goBack} style={styles.headerBackBtn}
                    accessibilityRole="button" accessibilityLabel="Go back">
                    <Text style={styles.headerBackText}>← पीछे / Back</Text>
                </TouchableOpacity>
                <View
                    style={styles.progressContainer}
                    accessible
                    accessibilityLabel={`Step ${step} of 3`}
                    accessibilityRole="progressbar"
                >
                    {[1, 2, 3].map(s => (
                        <View key={s} style={[styles.progressPin, s <= step && styles.progressPinActive]} />
                    ))}
                </View>
                <View style={{ width: 80 }} />
            </View>

            {step === 1 && (
                <StepSelection
                    mealType={mealType}
                    setMealType={setMealType}
                    selectedIds={selectedFoods.map(sf => sf.food.id)}
                    onFoodsChange={(foods) =>
                        setSelectedFoods(foods.map(f => ({ food: f, portion_multiplier: 1.0 })))
                    }
                    onNext={() => setStep(2)}
                />
            )}

            {step === 2 && (
                <StepPortions
                    selectedFoods={selectedFoods}
                    onUpdate={setSelectedFoods}
                    onNext={() => setStep(3)}
                />
            )}

            {step === 3 && (
                <StepReview
                    mealType={mealType}
                    selectedFoods={selectedFoods}
                    saving={saving}
                    onSave={handleSaveMeal}
                />
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: INTEGRATED SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

function StepSelection({ mealType, setMealType, selectedIds, onFoodsChange, onNext }) {
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedObjects, setSelectedObjects] = useState([]);
    const [inputMethod, setInputMethod] = useState('grid'); // 'grid' | 'voice' | 'quick'

    // Use refs for pagination so loadFoods always reads current values (avoids stale closure)
    const offsetRef = useRef(0);
    const hasMoreRef = useRef(true);
    const isLoadingRef = useRef(false);

    // Voice state
    const [textInput, setTextInput] = useState('');
    const [detectedFoods, setDetectedFoods] = useState([]);
    const [isListening, setIsListening] = useState(false);

    const loadFoods = useCallback(async (isNewSearch = false) => {
        if (isLoadingRef.current && !isNewSearch) return;
        if (!hasMoreRef.current && !isNewSearch) return;

        isLoadingRef.current = true;
        setLoading(true);

        const currentOffset = isNewSearch ? 0 : offsetRef.current;
        try {
            let result = [];
            if (query.trim()) {
                result = await searchFoodsPaginated(query.trim(), LIMIT, currentOffset);
            } else if (activeCategory !== 'all') {
                result = await getFoodsByCategoryPaginated(activeCategory, LIMIT, currentOffset);
            } else {
                result = await getAllFoodsPaginated(LIMIT, currentOffset);
            }

            if (isNewSearch) {
                setFoods(result);
                offsetRef.current = LIMIT;
            } else {
                setFoods(prev => {
                    const ids = new Set(prev.map(f => f.id));
                    const unique = result.filter(f => !ids.has(f.id));
                    return [...prev, ...unique];
                });
                offsetRef.current = currentOffset + LIMIT;
            }
            hasMoreRef.current = result.length === LIMIT;
        } catch (e) {
            console.error('[StepSelection] loadFoods:', e);
        } finally {
            isLoadingRef.current = false;
            setLoading(false);
        }
    }, [query, activeCategory]);

    useEffect(() => {
        // Reset pagination refs on new search
        offsetRef.current = 0;
        hasMoreRef.current = true;
        const timer = setTimeout(() => loadFoods(true), 350);
        return () => clearTimeout(timer);
    }, [query, activeCategory, loadFoods]);

    const toggleFood = (food) => {
        let newSel;
        if (selectedIds.includes(food.id)) {
            newSel = selectedObjects.filter(f => f.id !== food.id);
        } else {
            newSel = [...selectedObjects, food];
        }
        setSelectedObjects(newSel);
        onFoodsChange(newSel);
    };

    // Voice helpers
    useSpeechRecognitionEvent('result', (event) => {
        const transcript = event.results?.[0]?.transcript;
        if (transcript) handleVoiceText(transcript);
    });
    useSpeechRecognitionEvent('end', () => setIsListening(false));

    const parseTextForFoods = useCallback(async (text) => {
        if (!text.trim()) return;
        const fullText = text.toLowerCase();
        const foodIds = new Set();
        for (const [keyword, foodId] of Object.entries(FoodKeywords)) {
            if (fullText.includes(keyword.toLowerCase())) foodIds.add(foodId);
        }
        const foods = [];
        for (const id of foodIds) {
            const food = await getFoodById(id);
            if (food) foods.push(food);
        }
        setDetectedFoods(foods);
        // Also merge into selectedObjects
        const merged = [...selectedObjects, ...foods.filter(f => !selectedObjects.find(s => s.id === f.id))];
        setSelectedObjects(merged);
        onFoodsChange(merged);
    }, [selectedObjects, onFoodsChange]);

    const handleVoiceText = (text) => {
        setTextInput(text);
        parseTextForFoods(text);
    };

    const toggleListening = async () => {
        try {
            if (isListening) {
                await VoiceRecognitionService.stop();
                setIsListening(false);
            } else {
                const granted = await VoiceRecognitionService.requestPermissions();
                if (!granted) { Alert.alert('Permission Denied', 'Microphone access required.'); return; }
                setIsListening(true);
                await VoiceRecognitionService.start();
            }
        } catch (e) {
            setIsListening(false);
            if (e.message?.includes('not available')) {
                Alert.alert('Dev Build Required', 'Voice requires a custom dev build. Use keyboard mic as workaround.');
            }
        }
    };

    const handleQuickMeal = async (qm) => {
        const foods = [];
        for (const item of qm.foods) {
            const food = await getFoodById(item.food_id);
            if (food) { food.preset_portion = item.portion; foods.push(food); }
        }
        const merged = [...selectedObjects, ...foods.filter(f => !selectedObjects.find(s => s.id === f.id))];
        setSelectedObjects(merged);
        onFoodsChange(merged);
    };

    const categories = [
        { id: 'all', hi: 'सब', en: 'All' },
        { id: 'grain', hi: 'अनाज', en: 'Grains' },
        { id: 'vegetable', hi: 'सब्ज़ी', en: 'Veg' },
        { id: 'protein', hi: 'प्रोटीन', en: 'Protein' },
        { id: 'dairy', hi: 'डेरी', en: 'Dairy' },
        { id: 'fruit', hi: 'फल', en: 'Fruit' },
    ];

    return (
        <View style={{ flex: 1 }}>
            {/* Meal Type Toggle */}
            <View style={styles.mealToggleRow}>
                {Object.entries(MEAL_META).map(([type, meta]) => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.mealToggleBtn, mealType === type && { backgroundColor: meta.color, borderColor: meta.color }]}
                        onPress={() => setMealType(type)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: mealType === type }}
                        accessibilityLabel={`${meta.en}, ${meta.hi}`}
                    >
                        <Text style={styles.mealToggleEmoji}>{meta.emoji}</Text>
                        <Text style={[styles.mealToggleText, mealType === type && { color: Colors.white }]}>{meta.hi}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Input Method Tabs */}
            <View style={styles.methodTabRow}>
                {[{ id: 'grid', label: '📸 चुनें' }, { id: 'voice', label: '🎤 बोलें' }, { id: 'quick', label: '📋 जल्दी' }].map(m => (
                    <TouchableOpacity
                        key={m.id}
                        style={[styles.methodTab, inputMethod === m.id && styles.methodTabActive]}
                        onPress={() => setInputMethod(m.id)}
                    >
                        <Text style={[styles.methodTabText, inputMethod === m.id && styles.methodTabTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Grid Mode */}
            {inputMethod === 'grid' && (
                <View style={{ flex: 1 }}>
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="🔍 खोजें / Search food..."
                            placeholderTextColor={Colors.textLight}
                            value={query}
                            onChangeText={setQuery}
                            cursorColor={Colors.primary}
                        />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.catTab, activeCategory === cat.id && styles.catTabActive]}
                                onPress={() => setActiveCategory(cat.id)}
                            >
                                <Text style={[styles.catTabText, activeCategory === cat.id && styles.catTabTextActive]}>{cat.hi}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {/* Food Grid or Skeleton/Empty */}
                    {loading && foods.length === 0
                        ? <LoadingPlaceholder variant="grid" rows={2} />
                        : foods.length === 0
                            ? (
                                <EmptyState
                                    emoji="🔍"
                                    titleHi="कोई खाना नहीं मिला"
                                    titleEn="No foods found"
                                    subtitleEn={query ? `Try a different search term for "${query}"` : 'Try a different category'}
                                />
                            )
                            : (
                                <FlatList
                                    data={foods}
                                    numColumns={3}
                                    keyExtractor={(item, index) => `${item.id}_${index}`}
                                    renderItem={({ item }) => (
                                        <FoodCard
                                            food={item}
                                            selected={selectedIds.includes(item.id)}
                                            onPress={() => toggleFood(item)}
                                        />
                                    )}
                                    onEndReached={() => loadFoods(false)}
                                    onEndReachedThreshold={0.5}
                                    ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 20 }} color={Colors.primary} /> : <View style={{ height: 100 }} />}
                                    contentContainerStyle={styles.gridContainer}
                                />
                            )
                    }
                </View>
            )}

            {/* Voice Mode */}
            {inputMethod === 'voice' && (
                <ScrollView contentContainerStyle={styles.stepContent}>
                    <TouchableOpacity
                        style={[styles.micButton, isListening && styles.micButtonActive]}
                        onPress={toggleListening}
                    >
                        <Text style={styles.micEmoji}>{isListening ? '🔴' : '🎤'}</Text>
                        <Text style={styles.micLabel}>
                            {isListening ? 'सुन रहा है... / Listening...' : 'टैप करें / Tap to speak'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.orText}>या टाइप करें / Or type:</Text>
                    <TextInput
                        style={styles.voiceInput}
                        placeholder="दाल चावल रोटी / dal chawal roti..."
                        placeholderTextColor={Colors.textLight}
                        value={textInput}
                        onChangeText={handleVoiceText}
                        multiline
                        cursorColor={Colors.primary}
                    />
                    {detectedFoods.length > 0 && (
                        <View style={styles.detectedSection}>
                            <Text style={styles.detectedTitle}>✅ पहचाने गए / Detected:</Text>
                            <View style={styles.chipRow}>
                                {detectedFoods.map(food => (
                                    <View key={food.id} style={styles.foodChip}>
                                        <Text style={styles.chipText}>{food.name_hi || food.name_en}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Quick Meals Mode */}
            {inputMethod === 'quick' && (
                <ScrollView contentContainerStyle={styles.stepContent}>
                    <Text style={styles.stepTitle}>📋 जल्दी चुनें / Quick Meals</Text>
                    {QuickMeals.map(qm => (
                        <TouchableOpacity key={qm.id} style={styles.quickMealCard} onPress={() => handleQuickMeal(qm)}>
                            <Text style={styles.quickMealEmoji}>{qm.emoji}</Text>
                            <View style={styles.quickMealInfo}>
                                <Text style={styles.quickMealHi}>{qm.name_hi}</Text>
                                <Text style={styles.quickMealEn}>{qm.name_en}</Text>
                            </View>
                            <Text style={styles.arrow}>→</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Floating Next Button */}
            {selectedIds.length > 0 && (
                <View style={styles.floatingAction}>
                    <View style={styles.floatingInfo}>
                        <Text style={styles.floatingTitle}>{selectedIds.length} आइटम चुने / items selected</Text>
                    </View>
                    <TouchableOpacity style={styles.floatingBtn} onPress={onNext}>
                        <Text style={styles.floatingBtnText}>आगे / Next →</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: INLINE PORTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function StepPortions({ selectedFoods, onUpdate, onNext }) {
    const portions = [
        { label: '🥄', hi: 'कम', mult: 0.5 },
        { label: '🍽️', hi: 'मध्यम', mult: 1.0 },
        { label: '🍲', hi: 'ज़्यादा', mult: 1.5 },
    ];

    const updateMult = (foodId, mult) => {
        onUpdate(prev => prev.map(sf => sf.food.id === foodId ? { ...sf, portion_multiplier: mult } : sf));
    };

    return (
        <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>🥄 कितना खाया? / How much?</Text>
            {selectedFoods.map(sf => (
                <View key={sf.food.id} style={styles.portionCard}>
                    <Text style={styles.portionName}>{sf.food.name_hi || sf.food.name_en}</Text>
                    <Text style={styles.portionNameEn}>{sf.food.name_en}</Text>
                    <View style={styles.portionPicker}>
                        {portions.map(p => (
                            <TouchableOpacity
                                key={p.mult}
                                style={[styles.pOption, sf.portion_multiplier === p.mult && styles.pOptionActive]}
                                onPress={() => updateMult(sf.food.id, p.mult)}
                            >
                                <Text style={styles.pEmoji}>{p.label}</Text>
                                <Text style={[styles.pLabel, sf.portion_multiplier === p.mult && { color: Colors.white }]}>{p.hi}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={onNext}>
                <Text style={styles.primaryBtnText}>👀 रिव्यू करें / Review →</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: REVIEW & SAVE
// ═══════════════════════════════════════════════════════════════════════════════

function StepReview({ mealType, selectedFoods, saving, onSave }) {
    const meta = MEAL_META[mealType] || MEAL_META.snack;
    const nutrition = calculateMealNutrition(
        selectedFoods.map(sf => ({ ...sf.food, portion_multiplier: sf.portion_multiplier }))
    );
    const unsafe = selectedFoods.filter(sf => sf.food.safety_status !== 'safe');

    return (
        <ScrollView contentContainerStyle={styles.stepContent}>
            <View style={styles.reviewHeader}>
                <Text style={styles.reviewEmoji}>{meta.emoji}</Text>
                <View>
                    <Text style={styles.reviewTitle}>{meta.hi} / {meta.en}</Text>
                    <Text style={styles.reviewDate}>{new Date().toLocaleDateString()}</Text>
                </View>
            </View>

            <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>📊 पोषण / Nutrition</Text>
                <View style={styles.nutRow}>
                    <View style={styles.nutItem}>
                        <Text style={styles.nutVal}>{Math.round(nutrition.calories)}</Text>
                        <Text style={styles.nutLab}>kcal</Text>
                    </View>
                    <View style={styles.nutItem}>
                        <Text style={styles.nutVal}>{Math.round(nutrition.protein)}</Text>
                        <Text style={styles.nutLab}>प्रो. (g)</Text>
                    </View>
                    <View style={styles.nutItem}>
                        <Text style={styles.nutVal}>{Math.round(nutrition.iron)}</Text>
                        <Text style={styles.nutLab}>आयरन (mg)</Text>
                    </View>
                    <View style={styles.nutItem}>
                        <Text style={styles.nutVal}>{Math.round(nutrition.calcium)}</Text>
                        <Text style={styles.nutLab}>Ca (mg)</Text>
                    </View>
                </View>
            </View>

            {unsafe.length > 0 && (
                <View style={styles.alertBox}>
                    <Text style={styles.alertTitle}>⚠️ सावधानी / Safety Alert</Text>
                    {unsafe.map(sf => (
                        <Text key={sf.food.id} style={styles.alertText}>
                            • {sf.food.name_hi}: {sf.food.safety_status === 'avoid' ? 'परहेज करें (Avoid)' : 'कम मात्रा में (Caution)'}
                        </Text>
                    ))}
                </View>
            )}

            <View style={styles.itemListBox}>
                <Text style={styles.itemListTitle}>🍽️ आइटम / Items</Text>
                {selectedFoods.map(sf => (
                    <View key={sf.food.id} style={styles.itemRow}>
                        <Text style={styles.itemName}>{sf.food.name_hi || sf.food.name_en}</Text>
                        <Text style={styles.itemPortion}>
                            {sf.portion_multiplier === 0.5 ? 'कम' : sf.portion_multiplier === 1.5 ? 'ज़्यादा' : 'मध्यम'}
                        </Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={onSave}
                disabled={saving}
            >
                {saving
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.saveBtnText}>✅ {Labels.saveMeal?.hi || 'सुरक्षित करें'} / Save Meal</Text>
                }
            </TouchableOpacity>
        </ScrollView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerBackBtn: { width: 80 },
    headerBackText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
    progressContainer: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
    progressPin: { width: 30, height: 6, borderRadius: 3, backgroundColor: Colors.border },
    progressPinActive: { backgroundColor: Colors.primary, width: 48 },

    mealToggleRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: Colors.white, gap: 6 },
    mealToggleBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: Colors.background,
        borderWidth: 1.5,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    mealToggleEmoji: { fontSize: 18 },
    mealToggleText: { fontSize: 12, fontWeight: '700', marginTop: 2, color: Colors.textSecondary },

    methodTabRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: Colors.white,
        gap: 8,
    },
    methodTab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    methodTabText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    methodTabTextActive: { color: Colors.white },

    searchContainer: { paddingHorizontal: 14, paddingVertical: 8 },
    searchInput: {
        backgroundColor: Colors.white,
        borderRadius: 14,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.textPrimary,
        textAlignVertical: 'center',
    },
    catScroll: { paddingHorizontal: 14, paddingBottom: 10, gap: 8, alignItems: 'center' },
    catTab: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 44,
    },
    catTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    catTabText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    catTabTextActive: { color: Colors.white },
    gridContainer: { paddingHorizontal: 10, paddingBottom: 120 },

    floatingAction: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: Colors.textPrimary,
        borderRadius: 22,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 12,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    floatingInfo: { flex: 1 },
    floatingTitle: { color: Colors.white, fontSize: 15, fontWeight: '800' },
    floatingBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
    floatingBtnText: { color: Colors.white, fontWeight: '800' },

    stepContent: { padding: Dimensions.screenPadding, paddingBottom: 50 },
    stepTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 20 },

    // Voice
    micButton: {
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: Colors.info, justifyContent: 'center', alignItems: 'center',
        alignSelf: 'center', marginVertical: 20, elevation: 6,
    },
    micButtonActive: { backgroundColor: Colors.danger },
    micEmoji: { fontSize: 40 },
    micLabel: { color: Colors.white, fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
    orText: { textAlign: 'center', fontSize: 14, color: Colors.textLight, marginVertical: 10 },
    voiceInput: {
        backgroundColor: Colors.white,
        borderRadius: 14,
        padding: 14,
        fontSize: 18,
        minHeight: 80,
        borderWidth: 1,
        borderColor: Colors.border,
        textAlignVertical: 'top',
        color: Colors.textPrimary,
    },
    detectedSection: { marginTop: 16 },
    detectedTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    foodChip: {
        backgroundColor: Colors.primary + '15', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.primary,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

    // Quick Meals
    quickMealCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
        borderRadius: 16, padding: 16, marginBottom: 10, elevation: 2,
    },
    quickMealEmoji: { fontSize: 36, marginRight: 14 },
    quickMealInfo: { flex: 1 },
    quickMealHi: {
        fontSize: 17,
        fontWeight: '700',
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    quickMealEn: { fontSize: 13, color: Colors.textSecondary },
    arrow: { fontSize: 20, color: Colors.textLight },

    // Portions
    portionCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 16, marginBottom: 14, elevation: 2 },
    portionName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
    portionNameEn: { fontSize: 13, color: Colors.textLight, marginBottom: 12 },
    portionPicker: { flexDirection: 'row', justifyContent: 'space-between' },
    pOption: {
        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, marginHorizontal: 4,
        backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    },
    pOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    pEmoji: { fontSize: 24, marginBottom: 4 },
    pLabel: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
    primaryBtn: { backgroundColor: Colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 10 },
    primaryBtnText: { color: Colors.white, fontSize: 18, fontWeight: '800' },

    // Review
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    reviewEmoji: { fontSize: 48, marginRight: 16 },
    reviewTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
    reviewDate: { fontSize: 14, color: Colors.textLight, marginTop: 2 },
    summaryBox: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 20 },
    summaryTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
    nutRow: { flexDirection: 'row', justifyContent: 'space-between' },
    nutItem: { alignItems: 'center', flex: 1 },
    nutVal: { fontSize: 20, fontWeight: '900', color: Colors.primary },
    nutLab: { fontSize: 10, color: Colors.textLight, fontWeight: '700', textAlign: 'center' },
    alertBox: {
        backgroundColor: Colors.danger + '10', borderRadius: 15, padding: 16, marginBottom: 20,
        borderLeftWidth: 4, borderLeftColor: Colors.danger,
    },
    alertTitle: { fontSize: 15, fontWeight: '800', color: Colors.danger, marginBottom: 8 },
    alertText: { fontSize: 13, color: Colors.textPrimary, marginBottom: 4 },
    itemListBox: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 30 },
    itemListTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14 },
    itemRow: {
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    itemName: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
    itemPortion: { fontSize: 14, color: Colors.primary, fontWeight: '800' },
    saveBtn: {
        backgroundColor: Colors.success, padding: 20, borderRadius: 18,
        alignItems: 'center', elevation: 4,
    },
    saveBtnText: { color: Colors.white, fontSize: 17, fontWeight: '900' },
});
