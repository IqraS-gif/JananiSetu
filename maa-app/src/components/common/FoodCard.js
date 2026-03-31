/**
 * FoodCard.js
 * Maa App – Grid food card with image placeholder, safety badge, and select state.
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, Dimensions } from '../../constants';

const SAFETY_BADGE = {
    safe: null,
    limit: { text: '⚠️', color: Colors.warning },
    avoid: { text: '⛔', color: Colors.danger },
};

/**
 * @param {Object} props
 * @param {Object} props.food - Food object from DB
 * @param {boolean} props.selected - Whether this food is selected
 * @param {Function} props.onPress - Tap handler
 */
export default function FoodCard({ food, selected, onPress }) {
    const badge = SAFETY_BADGE[food.safety_status];

    return (
        <TouchableOpacity
            style={[styles.card, selected && styles.cardSelected]}
            onPress={onPress}
            activeOpacity={0.8}
            accessible
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            accessibilityLabel={`${food.name_hi || food.name_en}, ${food.name_en}, ${food.calories} calories${food.safety_status !== 'safe' ? ', ' + (food.safety_status === 'avoid' ? 'avoid during pregnancy' : 'eat in limited quantity') : ''}`}
            accessibilityHint={selected ? 'Double tap to deselect' : 'Double tap to select'}
        >
            {/* Image placeholder – shows emoji/initial since we don't have real images */}
            <View style={[styles.imagePlaceholder, selected && styles.imagePlaceholderSelected]}>
                <Text style={styles.foodEmoji}>{getCategoryEmoji(food.category)}</Text>
            </View>

            {/* Safety badge */}
            {badge && (
                <View style={[styles.badge, { backgroundColor: badge.color }]}>
                    <Text style={styles.badgeText}>{badge.text}</Text>
                </View>
            )}

            {/* Checkmark overlay */}
            {selected && (
                <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                </View>
            )}

            {/* Labels */}
            <Text style={styles.nameHi} numberOfLines={1}>{food.name_hi || food.name_en}</Text>
            <Text style={styles.nameEn} numberOfLines={1}>{food.name_en}</Text>
            <View style={styles.foodDetailsRow}>
                <Text style={styles.cal}>{food.calories} cal</Text>
                {food.source && food.source !== 'app' && (
                    <Text style={styles.sourceText}>• {food.source === 'Open Food Facts' ? 'OFF' : food.source}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

function getCategoryEmoji(category) {
    const map = {
        grain: '🌾', protein: '🥜', vegetable: '🥬', fruit: '🍎',
        dairy: '🥛', snack: '🍪', drink: '🥤',
    };
    return map[category] || '🍴';
}

const styles = StyleSheet.create({
    card: {
        width: '31%',
        backgroundColor: Colors.cardBackground,
        borderRadius: 14,
        padding: 10,
        marginBottom: 10,
        alignItems: 'center',
        elevation: 2,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.surfaceLight,
    },
    imagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFF0F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    imagePlaceholderSelected: {
        backgroundColor: Colors.primaryLight,
    },
    foodEmoji: {
        fontSize: 30,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        borderRadius: 10,
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 12,
    },
    checkmark: {
        position: 'absolute',
        top: 4,
        left: 4,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: Colors.white,
        fontWeight: '800',
        fontSize: 14,
    },
    nameHi: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        lineHeight: 18,
    },
    nameEn: {
        fontSize: 10,
        color: Colors.textLight,
        textAlign: 'center',
    },
    cal: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    foodDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    sourceText: {
        fontSize: 9,
        color: Colors.primary,
        marginLeft: 4,
        fontWeight: 'bold',
    },
});
