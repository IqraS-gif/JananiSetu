/**
 * ImageService.js
 * Maa App – Service for fetching food images via SerpApi and caching in SQLite.
 */

import { API_CONFIG } from '../constants';
import { updateFoodImage } from './database/DatabaseService';

const SERPAPI_URL = 'https://serpapi.com/search.json';

/**
 * Clean food name for better search results.
 */
function cleanFoodName(name) {
    return name
        .replace(/\(.*\)/g, '')
        .replace(/[0-9%().]/g, '')
        .trim();
}

/**
 * Fetch a high-quality food image URL from SerpApi.
 * @param {string} foodNameEn 
 * @param {string} foodNameHi
 */
export async function fetchFoodImageFromSerp(foodNameEn, foodNameHi) {
    if (!API_CONFIG.SERPAPI_KEY) {
        console.warn('[ImageService] ⚠️ SerpApi key missing in API_CONFIG!');
        return null;
    }

    const cleanEn = cleanFoodName(foodNameEn);
    const cleanHi = foodNameHi ? foodNameHi.split(',')[0].trim() : '';

    console.log(`[ImageService] 🌐 Starting SerpApi search for: "${cleanEn}" / "${cleanHi}"`);

    // Try multiple query variations
    const queryVariations = [
        `${cleanEn} ${cleanHi} Indian dish food`.trim(),
        `${cleanEn} food recipe`.trim(),
    ].filter(q => q.length > 5);

    for (const query of queryVariations) {
        try {
            console.log(`[ImageService] 🔍 Querying SerpApi: "${query}"`);
            const params = new URLSearchParams({
                engine: 'google_images',
                q: query,
                api_key: API_CONFIG.SERPAPI_KEY,
                num: '3',
                gl: 'in',
                safe: 'active'
            });

            const response = await fetch(`${SERPAPI_URL}?${params.toString()}`);
            const data = await response.json();

            if (data.images_results && data.images_results.length > 0) {
                const url = data.images_results[0].thumbnail || data.images_results[0].original;
                console.log(`[ImageService] ✨ Found image for "${query}": ${url.substring(0, 50)}...`);
                return url;
            }
            console.log(`[ImageService] 😶 No results for query: "${query}"`);
        } catch (error) {
            console.error(`[ImageService] ❌ Error for query "${query}":`, error);
        }
    }
    console.warn(`[ImageService] 🛑 All variations failed for: ${foodNameEn}`);
    return null;
}

/**
 * Get image URL for a food item. Checks cache first, otherwise fetches and updates cache.
 * @param {object} food 
 */
export async function getAndCacheFoodImage(food) {
    // 1. Return existing cached path if available
    if (food.image_path && food.image_path.startsWith('http')) {
        console.log(`[ImageService] 🟢 Cache HIT for ${food.name_en}`);
        return food.image_path;
    }

    console.log(`[ImageService] 🟡 Cache MISS for ${food.name_en}. Fetching...`);

    // 2. Fetch from SerpApi
    const imageUrl = await fetchFoodImageFromSerp(food.name_en, food.name_hi);

    if (imageUrl) {
        // 3. Cache it in background
        try {
            await updateFoodImage(food.id, imageUrl);
            console.log(`[ImageService] ✅ Successfully cached image for ${food.name_en}`);
        } catch (e) {
            console.error(`[ImageService] ❌ Cache update failed for ${food.id}:`, e);
        }
        return imageUrl;
    }

    console.warn(`[ImageService] 🟠 No image found for ${food.name_en} after all variations.`);
    return null;
}
