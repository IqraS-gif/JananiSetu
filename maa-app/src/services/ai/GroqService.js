const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY; // Managed via .env for security
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Generate dynamic nutritional insights using Groq.
 */
export async function getDynamicInsights(foodItems, nutritionTotals) {
    if (GROQ_API_KEY.includes('YOUR_KEY_HERE')) {
        console.log('[Groq] API Key not set, skipping dynamic insights.');
        return null;
    }

    try {
        const foodList = foodItems.map(f => f.name || f.name_en).join(', ');
        const prompt = `
            As a nutritionist for pregnant women in India, analyze this meal:
            Foods: ${foodList}
            Total Nutrients (Calculated): ${nutritionTotals.calories}kcal, ${nutritionTotals.protein}g protein, ${nutritionTotals.iron}mg iron, ${nutritionTotals.calcium}mg calcium.
            
            Instructions:
            1. Check if ANY food is highly processed, packaged, or contains high sodium/sugar/preservatives (e.g., sauces, instant noodles, sodas).
            2. Identify if the meal supports pregnancy needs (Protein for growth, Iron for blood, Calcium for bones).
            3. Provide 2 short, impactful insights (max 15 words each):
               - A 'food_alert': Regarding the specific food choices (positive or warning).
               - A 'nutrition_alert': Regarding the overall balance for pregnancy.
            
            Return ONLY a JSON array of 2 objects:
            [
              {"type": "food_alert", "sentiment": "warning/positive/caution", "hi": "Hindi insight", "en": "English insight"},
              {"type": "nutrition_alert", "sentiment": "warning/positive/caution", "hi": "Hindi insight", "en": "English insight"}
            ]
        `;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        let content;
        try {
            content = JSON.parse(data.choices[0].message.content);
        } catch (e) {
            console.error('[Groq] JSON Parse failed, raw:', data.choices[0].message.content);
            return null;
        }

        // Extract array from possible wrapper objects
        if (Array.isArray(content)) return content;
        if (content.alerts && Array.isArray(content.alerts)) return content.alerts;
        if (content.insights && Array.isArray(content.insights)) return content.insights;

        // If it's a single object, wrap it
        return [content];
    } catch (error) {
        console.error('[Groq] Error fetching insights:', error);
        return null;
    }
}

/**
 * Transcribe audio using Groq Whisper.
 * @param {string} uri - Local URI of the audio file
 */
export async function transcribeAudio(uri) {
    try {
        const formData = new FormData();
        formData.append('file', {
            uri,
            name: 'audio.m4a',
            type: 'audio/m4a',
        });
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'hi'); // Default to Hindi for JananiSetu
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('[Groq STT] Error:', errBody);
            throw new Error(`Groq STT failed: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('[Groq STT] Error transcribing audio:', error);
        throw error;
    }
}

/**
 * Extract food items from text and estimate nutrition using AI.
 * Used as a fallback when local DB/Dataset search fails.
 * @param {string} text - The transcribed text from voice
 * @param {Array<string>} excludedItems - Items already found locally
 */
export async function getAIFoodNutrition(text, excludedItems = []) {
    try {
        const prompt = `
            You are a nutrition expert for pregnancy.
            The user said: "${text}"
            We already found these items locally: ${excludedItems.join(', ')}.
            
            Find any ADDITIONAL food items mentioned in the text that are NOT in the excluded list.
            For each additional item, estimate the nutritional content for a standard serving (Middium portion/1 katori/medium size).
            
            Return a JSON array of objects:
            [
              {
                "name": "Food Name (English)",
                "name_hi": "Food Name (Hindi)",
                "calories": number,
                "protein": number,
                "iron": number,
                "calcium": number,
                "folate": number,
                "confidence": number (0-1)
              }
            ]
            If no additional foods are found, return [].
            Only return the JSON array, no extra text.
        `;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            }),
        });

        if (!response.ok) throw new Error(`Groq API failed: ${response.status}`);

        const result = await response.json();
        let content = JSON.parse(result.choices[0].message.content);

        // Return the array directly if it's the root, or check for common keys
        if (Array.isArray(content)) return content;
        if (content.foods) return content.foods;
        if (content.items) return content.items;

        return [];
    } catch (error) {
        console.error('[Groq AI Nutrition] Error:', error);
        return [];
    }
}

/**
 * Extract an array of food names from a given sentence.
 * Useful for high-level identification before tiered lookup.
 */
export async function extractFoodNames(text) {
    if (!text || text.length < 3) return [];

    try {
        const prompt = `
            Extract all distinct food/drink items from this sentence: "${text}".
            Return only a simple JSON array of strings in English.
            Example: ["dal", "rice", "pizza"]
            If no foods found, return [].
        `;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
                response_format: { type: 'json_object' }
            }),
        });

        if (!response.ok) throw new Error(`Groq API failed: ${response.status}`);

        const result = await response.json();
        const content = JSON.parse(result.choices[0].message.content);

        if (Array.isArray(content)) return content;
        if (content.foods) return content.foods;
        if (content.items) return content.items;

        return [];
    } catch (error) {
        console.error('[Groq Extract Names] Error:', error);
        return [];
    }
}

/**
 * Verify if the user's speech matches the target direction using LLM.
 * Returns "right" or "wrong".
 */
export async function verifyDirection(targetDir, userSpeech) {
    if (!userSpeech || userSpeech.length < 2) return "wrong";

    try {
        const prompt = `
            Correct Direction: ${targetDir}
            User Said: "${userSpeech}"
            
            Instructions:
            1. If the user's speech (in Hindi or English) matches the Correct Direction, return "right".
            2. If user said a different direction or something unrelated, return "wrong".
            3. Common Hindi matches: "ऊपर/upar" -> up, "नीचे/neeche" -> down, "बाएं/baayen" -> left, "दाएं/daayen" -> right.
            
            Return ONLY the word "right" or "wrong". No punctuation or extra text.
        `;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0,
            }),
        });

        if (!response.ok) throw new Error(`Groq API failed: ${response.status}`);

        const result = await response.json();
        const content = result.choices[0].message.content.toLowerCase().trim();

        if (content.includes('right')) return 'right';
        return 'wrong';
    } catch (error) {
        console.error('[Groq Verify Dir] Error:', error);
        return 'wrong';
    }
}

/**
 * Extract health parameters from a medical test report image.
 * @param {string} base64Image - Base64 encoded image data.
 * @returns {Promise<object>} Extracted health data.
 */
export async function extractHealthDataFromReport(base64Image) {
    if (!GROQ_API_KEY || GROQ_API_KEY.includes('YOUR_KEY_HERE')) {
        throw new Error("Groq API Key is not set.");
    }

    const prompt = `
        You are a medical data extraction assistant. Analyze this medical lab report image.
        Extract the following health parameters if present:
        1. Blood Pressure: Systolic and Diastolic values (e.g., 120/80).
        2. Blood Sugar (Glucose): General level in mg/dL.
        3. HbA1c: Glycated Hemoglobin level in %.
        4. FBS: Fasting Blood Sugar in mg/dL.
        5. PPBS: Post-Prandial Blood Sugar in mg/dL.
        6. Age: of the patient.
        7. Gender: of the patient (Male/Female).
        8. Height: in centimeters (cm).
        9. Weight: in kilograms (kg).

        Return ONLY a JSON object with these keys:
        {
          "systolic": number | null,
          "diastolic": number | null,
          "blood_sugar": number | null,
          "hba1c": number | null,
          "fbs": number | null,
          "ppbs": number | null,
          "age": number | null,
          "gender": string | null,
          "height_cm": number | null,
          "weight_kg": number | null
        }
        Do not include any other text or explanation. If a value is not found, use null.
    `;

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.2-11b-vision-preview',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('[Groq Extraction] API Error:', err);
            throw new Error(err.error?.message || `Groq API failed: ${response.status}`);
        }

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);

        console.log('[Groq Extraction] Success:', content);
        return {
            systolic: content.systolic || null,
            diastolic: content.diastolic || null,
            blood_sugar: content.blood_sugar || null,
            hba1c: content.hba1c || null,
            fbs: content.fbs || null,
            ppbs: content.ppbs || null,
            age: content.age || null,
            gender: content.gender || null,
            height_cm: content.height_cm || null,
            weight_kg: content.weight_kg || null
        };
    } catch (error) {
        console.error('[Groq Extraction] Error:', error);
        throw error;
    }
}

