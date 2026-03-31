/**
 * FoodMappingService.js
 * Logic to map identified food names to the CSV dataset and local database.
 */

import { searchFoods } from '../database/DatabaseService';
import { parseCsvContent } from './CsvParser';
import { getDynamicInsights } from './GroqService';

// We'll store the CSV data in memory after the first load
let cachedCsvData = null;

/**
 * Load and cache the CSV data.
 * @param {string} csvContent - The raw content of the CSV file.
 */
export function loadCsvData(csvContent) {
    cachedCsvData = parseCsvContent(csvContent);
}

/**
 * Find the closest match for a food name in our data sources.
 * Priority: 1. Indian Food CSV, 2. Local SQLite DB, 3. Groq AI Fallback
 * @param {string} foodName - Name of the food to search.
 * @returns {Promise<Object|null>} Nutrients object or null if not found.
 */
export async function getNutrientsForFood(foodName) {
    if (!foodName) return null;
    const cleanInput = foodName.toLowerCase().trim();

    // 1. Try CSV Dataset (Tier 1 - Primary Dataset)
    if (cachedCsvData) {
        console.log(`[Mapping] (Tier 1) Dataset search for: "${cleanInput}"`);

        let bestMatch = null;
        let bestScore = -1;

        cachedCsvData.forEach(item => {
            const rawDishName = item['Dish Name']?.toLowerCase() || '';
            const dishNameClean = rawDishName.replace(/[()]/g, ' ').trim();

            // Perfect Match
            if (rawDishName === cleanInput || dishNameClean === cleanInput) {
                bestMatch = item;
                bestScore = 100;
                return;
            }

            if (bestScore === 100) return;

            // Simple Keyword Intersection
            const inputWords = cleanInput.split(/\s+/).filter(w => w.length >= 3);
            const dishWords = dishNameClean.split(/\s+/).filter(w => w.length >= 3);

            let currentScore = 0;
            inputWords.forEach(iw => {
                if (dishWords.includes(iw)) currentScore += 10;
                else if (dishNameClean.includes(iw)) currentScore += 2;
            });

            if (currentScore > bestScore) {
                bestScore = currentScore;
                bestMatch = item;
            }
        });

        if (bestMatch && bestScore > 5) { // Minimum threshold for fuzzy match
            console.log(`[Mapping] ✅ Found match in dataset: "${bestMatch['Dish Name']}" (Score: ${bestScore})`);
            return {
                name: bestMatch['Dish Name'],
                calories: bestMatch['Calories (kcal)'],
                protein: bestMatch['Protein (g)'],
                iron: bestMatch['Iron (mg)'],
                calcium: bestMatch['Calcium (mg)'],
                folate: bestMatch['Folate (µg)'],
                source: 'dataset'
            };
        }
    }

    // 2. Try Local SQLite DB (Tier 2 - Fallback DB)
    try {
        console.log(`[Mapping] (Tier 2) Database search for: "${foodName}"`);
        // Remove brackets for cleaner search
        const dbQuery = cleanInput.replace(/\(.*?\)/g, '').trim();
        const dbResults = await searchFoods(dbQuery);

        if (dbResults && dbResults.length > 0) {
            // Find an exact match if possible, otherwise first result
            const match = dbResults.find(r =>
                (r.name_en && r.name_en.toLowerCase() === cleanInput) ||
                (r.name_hi && r.name_hi.toLowerCase() === cleanInput)
            ) || dbResults[0];

            console.log(`[Mapping] ✅ Found match in Database: "${match.name_en || match.name_hi}"`);
            return {
                name: match.name_en || match.name_hi,
                calories: match.calories,
                protein: match.protein,
                iron: match.iron,
                calcium: match.calcium,
                folate: match.folate,
                source: 'database'
            };
        }
    } catch (e) {
        console.warn('[Mapping] DB Search failed:', e);
    }

    // 3. Groq AI Fallback (Tier 3 - Smart Fallback)
    try {
        console.log(`[Mapping] (Tier 3) AI Fallback search for: "${foodName}"`);

        const aiResults = await getAIFoodNutrition(foodName);
        if (aiResults && aiResults.length > 0) {
            const af = aiResults[0];
            console.log(`[Mapping] ✅ AI estimated nutrients for: "${af.name}"`);
            return {
                name: af.name,
                name_hi: af.name_hi,
                calories: af.calories,
                protein: af.protein,
                iron: af.iron,
                calcium: af.calcium,
                folate: af.folate,
                source: 'ai_fallback',
                is_ai_generated: true
            };
        }
    } catch (e) {
        console.warn('[Mapping] AI Fallback failed:', e);
    }

    console.log(`[Mapping] ❌ No match found for: "${foodName}" across all tiers.`);
    return null;
}

/**
 * Get collective nutrients for a list of identified items.
 * @param {Array<string>} items - List of food names.
 * @returns {Promise<Object>} Collective summary and breakdown.
 */
export async function getCollectiveNutrients(items) {
    const results = [];
    const totals = {
        calories: 0,
        protein: 0,
        iron: 0,
        calcium: 0,
        folate: 0
    };

    for (const item of items) {
        const nutrients = await getNutrientsForFood(item);
        if (nutrients) {
            results.push(nutrients);
            totals.calories += (nutrients.calories || 0);
            totals.protein += (nutrients.protein || 0);
            totals.iron += (nutrients.iron || 0);
            totals.calcium += (nutrients.calcium || 0);
            totals.folate += (nutrients.folate || 0);
        } else {
            // Fallback for missing items - could add a 'generic' estimate or just skip
            results.push({ name: item, unknown: true });
        }
    }

    // Round totals
    Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k] * 10) / 10);

    const foodAlerts = getFoodSafetyInsights(results).map(a => ({ ...a, category: 'food' }));
    const nutritionAlerts = calculateNutritionalSafety(totals).map(a => ({ ...a, category: 'nutrition' }));

    // Fetch Dynamic AI insights from Groq
    try {
        const dynamic = await getDynamicInsights(results, totals);
        if (dynamic && Array.isArray(dynamic)) {
            dynamic.forEach(d => {
                if (d.type === 'food_alert') {
                    foodAlerts.push({ ...d, category: 'food', type: d.sentiment || 'warning' });
                } else if (d.type === 'nutrition_alert') {
                    nutritionAlerts.push({ ...d, category: 'nutrition', type: d.sentiment || 'warning' });
                }
            });
        }
    } catch (e) {
        console.warn('[Mapping] Groq dynamic insights failed:', e);
    }

    return { totals, breakdown: results, foodAlerts, nutritionAlerts };
}

/**
 * Generate food-specific safety insights.
 */
export function getFoodSafetyInsights(foodList) {
    const alerts = [];
    foodList.forEach(food => {
        const name = (food.name || food.name_en || '').toLowerCase();

        // ⚠️ CAUTIONARY / WARNINGS
        if (name.includes('pizza') || name.includes('burger') || name.includes('chowmein') || name.includes('noodles')) {
            alerts.push({
                type: 'warning',
                en: `${food.name} is high in refined flour and processed fat. Avoid in pregnancy.`,
                hi: `${food.name} में मैदा और प्रोसेस्ड फैट अधिक है। गर्भावस्था में इससे बचें।`
            });
        } else if (name.includes('fried') || name.includes('chips') || name.includes('samosa') || name.includes('pakora') || name.includes('vada')) {
            alerts.push({
                type: 'warning',
                en: `Deep fried foods like ${food.name} can cause acidity and unwanted weight gain.`,
                hi: `${food.name} जैसे तले हुए भोजन से एसिडिटी और वजन बढ़ सकता है।`
            });
        } else if (name.includes('sauce') || name.includes('ketchup') || name.includes('maggi') || name.includes('instant') || name.includes('preserved')) {
            alerts.push({
                type: 'caution',
                en: `${food.name} may contain high sodium or preservatives. Use sparingly.`,
                hi: `${food.name} में अधिक नमक या प्रिजरवेटिव हो सकते हैं। कम मात्रा में उपयोग करें।`
            });
        } else if (name.includes('soda') || name.includes('cola') || name.includes('soft drink') || name.includes('sugar') || name.includes('candy')) {
            alerts.push({
                type: 'warning',
                en: `High sugar items like ${food.name} can increase gestational diabetes risk.`,
                hi: `${food.name} जैसे अधिक चीनी वाले खाद्य पदार्थ जेस्टेशनल डायबिटीज का खतरा बढ़ा सकते हैं।`
            });
        }

        // ✅ POSITIVE / GOOD CHOICE
        if (name.includes('dal') || name.includes('lentil') || name.includes('daal') || name.includes('pulse')) {
            alerts.push({
                type: 'positive',
                en: `${food.name || 'Dal'} is a great source of protein. Excellent choice!`,
                hi: `${food.name || 'दाल'} प्रोटीन का एक बड़ा स्रोत है। बहुत बढ़िया विकल्प!`
            });
        } else if (name.includes('egg') || name.includes('paneer') || name.includes('milk') || name.includes('curd') || name.includes('yoghurt')) {
            alerts.push({
                type: 'positive',
                en: `${food.name} provides essential calcium and protein for baby's development.`,
                hi: `${food.name} बच्चे के विकास के लिए आवश्यक कैल्शियम और प्रोटीन प्रदान करता है।`
            });
        } else if (name.includes('spinach') || name.includes('palak') || name.includes('methi') || name.includes('broccoli') || name.includes('leafy')) {
            alerts.push({
                type: 'positive',
                en: `Green leafy vegetables like ${food.name} are rich in folic acid and iron.`,
                hi: `${food.name} जैसी हरी पत्तेदार सब्जियां फोलिक एसिड और आयरन से भरपूर होती हैं।`
            });
        } else if (name.includes('fruit') || name.includes('banana') || name.includes('apple') || name.includes('orange') || name.includes('juice')) {
            alerts.push({
                type: 'positive',
                en: `Fruits like ${food.name} are packed with vitamins and natural fiber.`,
                hi: `${food.name} जैसे फल विटामिन और प्राकृतिक फाइबर से भरपूर होते हैं।`
            });
        } else if (name.includes('rice') || name.includes('roti') || name.includes('chawal')) {
            alerts.push({
                type: 'positive',
                en: `${food.name || 'Meal staple'} is healthy in moderate portions. Good choice!`,
                hi: `${food.name || 'भोजन'} सीमित मात्रा में स्वास्थ्यवर्धक है। अच्छा विकल्प!`
            });
        }
    });
    return alerts;
}

/**
 * Generate nutritional safety alerts.
 */
export function calculateNutritionalSafety(totals) {
    const alerts = [];
    if (totals.iron > 5) {
        alerts.push({
            type: 'positive',
            en: 'High Iron meal! Excellent for baby\'s growth.',
            hi: 'आयरन से भरपूर भोजन! बच्चे के स्वास्थ्य के लिए बेहतरीन।'
        });
    }
    if (totals.protein > 15) {
        alerts.push({
            type: 'positive',
            en: 'High Protein meal! Helps in muscle development.',
            hi: 'प्रोटीन से भरपूर भोजन! बच्चे के विकास में सहायक।'
        });
    }
    if (totals.calories > 800) {
        alerts.push({
            type: 'caution',
            en: 'High calorie meal. Monitor your total daily intake.',
            hi: 'अधिक कैलोरी वाला भोजन। अपने दैनिक आहार पर ध्यान दें।'
        });
    }
    return alerts;
}
