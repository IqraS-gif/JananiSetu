/**
 * DatabaseService.js
 * Maa App – Comprehensive SQLite database service
 * Provides all CRUD operations, initialization, and seeding.
 */

import * as SQLite from 'expo-sqlite';
import foodsData from '../../../database/seed-data/foods.json';
import requirementsData from '../../../database/seed-data/requirements.json';
import { ANCSchedule } from '../../constants';

const DB_NAME = 'maa_app.db';
let db = null;
let dbPromise = null;

/**
 * Opens (or creates) the database and returns the connection.
 * Uses a promise-based singleton pattern to avoid race conditions.
 */
export async function getDatabase() {
    if (db) return db;
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
        try {
            const database = await SQLite.openDatabaseAsync(DB_NAME);
            db = database;
            return database;
        } catch (e) {
            console.error("Failed to open database:", e);
            dbPromise = null; // Reset on failure
            throw e;
        }
    })();

    return dbPromise;
}

/**
 * Full initialization: create tables → seed data.
 * Safe to call multiple times – uses IF NOT EXISTS.
 */
export async function initDatabase() {
    try {
        console.log('[DB] Starting initialization...');
        const database = await getDatabase();
        console.log('[DB] Database opened');
        await createTables(database);
        console.log('[DB] Tables created');
        await seedFoodData(database);
        console.log('[DB] Foods seeded');
        await seedNutritionRequirements(database);
        console.log('[DB] Requirements seeded');
        await seedANCSchedule(database);
        console.log('[DB] ANC seeded');
        await seedSupplementSchedule(database);
        console.log('[DB] Supplements seeded');
        console.log('[DB] Database initialized successfully');
        return database;
    } catch (error) {
        console.error('[DB] Initialization error:', error);
        throw error;
    }
}

/**
 * Create all tables – SINGLE runAsync calls per table
 */
async function createTables(database) {
    // using runAsync instead of execAsync to avoid potential native argument issues
    const run = async (sql) => {
        await database.runAsync(sql);
    };

    await run(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER,
        lmp_date TEXT,
        due_date TEXT,
        pregnancy_week INTEGER,
        height_cm REAL,
        start_weight_kg REAL,
        current_weight_kg REAL,
        language TEXT DEFAULT 'hi',
        asha_contact TEXT,
        emergency_contact TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'user_profile');

    await run(`
      CREATE TABLE IF NOT EXISTS foods (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_hi TEXT,
        calories REAL,
        protein REAL,
        carbs REAL,
        fats REAL,
        fiber REAL,
        iron REAL,
        calcium REAL,
        folate REAL,
        vitamin_a REAL,
        vitamin_c REAL,
        category TEXT,
        safety_status TEXT DEFAULT 'safe',
        image_path TEXT,
        source TEXT DEFAULT 'app'
      )
    `, 'foods');

    await run('CREATE INDEX IF NOT EXISTS idx_foods_name_en ON foods(name_en)');
    await run('CREATE INDEX IF NOT EXISTS idx_foods_name_hi ON foods(name_hi)');
    await run('CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category)');

    await run(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_type TEXT,
        log_date TEXT DEFAULT (date('now')),
        log_time TEXT DEFAULT (time('now')),
        total_calories REAL,
        total_protein REAL,
        total_iron REAL,
        total_calcium REAL,
        total_folate REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'meal_logs');

    await run(`
      CREATE TABLE IF NOT EXISTS meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_log_id INTEGER,
        food_id TEXT,
        quantity_g REAL,
        portion_multiplier REAL DEFAULT 1.0,
        calories REAL,
        protein REAL,
        iron REAL,
        calcium REAL,
        folate REAL,
        FOREIGN KEY (meal_log_id) REFERENCES meal_logs(id),
        FOREIGN KEY (food_id) REFERENCES foods(id)
      )
    `, 'meal_items');

    await run(`
      CREATE TABLE IF NOT EXISTS daily_summary (
        date TEXT PRIMARY KEY,
        total_calories REAL DEFAULT 0,
        total_protein REAL DEFAULT 0,
        total_iron REAL DEFAULT 0,
        total_calcium REAL DEFAULT 0,
        total_folate REAL DEFAULT 0,
        water_glasses INTEGER DEFAULT 0,
        supplements_taken INTEGER DEFAULT 0,
        mood TEXT,
        symptoms TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'daily_summary');

    await run(`
      CREATE TABLE IF NOT EXISTS supplement_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplement_type TEXT,
        taken_at TEXT DEFAULT CURRENT_TIMESTAMP,
        date TEXT DEFAULT (date('now'))
      )
    `, 'supplement_logs');

    await run(`
      CREATE TABLE IF NOT EXISTS supplement_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplement_type TEXT,
        frequency_per_day INTEGER,
        start_week INTEGER,
        end_week INTEGER,
        details_en TEXT,
        details_hi TEXT
      )
    `, 'supplement_schedule');

    await run(`
      CREATE TABLE IF NOT EXISTS weight_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT DEFAULT (date('now')),
        weight_kg REAL,
        week_of_pregnancy INTEGER,
        notes TEXT
      )
    `, 'weight_tracking');

    await run(`
      CREATE TABLE IF NOT EXISTS nutrition_requirements (
        trimester INTEGER PRIMARY KEY,
        min_calories REAL,
        min_protein REAL,
        min_iron REAL,
        min_calcium REAL,
        min_folate REAL,
        hydration_liters REAL
      )
    `, 'nutrition_requirements');

    await run(`
      CREATE TABLE IF NOT EXISTS anc_schedule (
        visit_number INTEGER PRIMARY KEY,
        recommended_week INTEGER,
        description_en TEXT,
        description_hi TEXT,
        checkups_list TEXT,
        is_completed INTEGER DEFAULT 0,
        completed_date TEXT,
        notes TEXT
      )
    `, 'anc_schedule');

    await run(`
      CREATE TABLE IF NOT EXISTS kick_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        count INTEGER NOT NULL,
        duration_min INTEGER,
        date TEXT DEFAULT (date('now')),
        time TEXT DEFAULT (time('now')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'kick_logs');

    await run(`
      CREATE TABLE IF NOT EXISTS symptom_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symptom_id TEXT NOT NULL,
        severity TEXT, -- mild, moderate, severe
        notes TEXT,
        date TEXT DEFAULT (date('now')),
        time TEXT DEFAULT (time('now')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'symptom_logs');

    await run(`
      CREATE TABLE IF NOT EXISTS vitals_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        systolic INTEGER,
        diastolic INTEGER,
        blood_sugar REAL,
        pulse INTEGER,
        notes TEXT,
        date TEXT DEFAULT (date('now')),
        time TEXT DEFAULT (time('now')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'vitals_logs');

    await run(`
      CREATE TABLE IF NOT EXISTS eye_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        risk_level TEXT,
        risk_score REAL,
        confidence REAL,
        method TEXT,
        age REAL,
        family_history INTEGER,
        log_mar REAL,
        log_cs REAL,
        vfi REAL,
        amsler_distortion INTEGER,
        recommendations TEXT,
        assessed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, 'eye_assessments');

    // MIGRATIONS: Handle schema changes for existing databases
    try {
        const tableInfo = await database.getAllAsync("PRAGMA table_info(foods)");
        const hasSource = tableInfo.some(col => col.name === 'source');
        if (!hasSource) {
            console.log('[DB] Migrating: Adding source column to foods table');
            await run('ALTER TABLE foods ADD COLUMN source TEXT DEFAULT "app"');
        }

        const ancInfo = await database.getAllAsync("PRAGMA table_info(anc_schedule)");
        const hasReport = ancInfo.some(col => col.name === 'report_uri');
        if (!hasReport) {
            console.log('[DB] Migrating: Adding report_uri column to anc_schedule');
            await run('ALTER TABLE anc_schedule ADD COLUMN report_uri TEXT');
        }
    } catch (e) {
        console.error('[DB] Migration error:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDING
// ═══════════════════════════════════════════════════════════════════════════════

async function seedFoodData(database) {
    const totalItems = foodsData.length;
    const dbCountResult = await database.getFirstAsync('SELECT COUNT(*) as cnt FROM foods');
    const dbCount = dbCountResult?.cnt || 0;

    if (dbCount >= totalItems) {
        console.log(`[DB] Foods table up to date (${dbCount}/${totalItems}). Skipping seed.`);
        return;
    }

    console.log(`[DB] Seeding ${totalItems - dbCount} new foods (${dbCount} existing)...`);
    const start = Date.now();

    // Determine which IDs are already in the DB to avoid re-inserting
    const existing = new Set();
    if (dbCount > 0) {
        const rows = await database.getAllAsync('SELECT id FROM foods');
        rows.forEach(r => existing.add(r.id));
    }
    const toInsert = foodsData.filter(f => !existing.has(f.id));

    if (toInsert.length === 0) {
        console.log('[DB] No new foods to insert.');
        return;
    }

    // ── Chunked bulk INSERT (250 rows per batch) ───────────────────────────
    //    Reduces ~7k individual round-trips → ~28 batch statements
    const CHUNK_SIZE = 250;
    const COLS = 17;

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        const placeholders = chunk.map(() => `(${Array(COLS).fill('?').join(',')})`).join(',');
        const values = [];
        chunk.forEach(food => {
            values.push(
                food.id, food.name_en, food.name_hi,
                food.calories, food.protein, food.carbs, food.fats, food.fiber,
                food.iron, food.calcium, food.folate,
                food.vitamin_a ?? 0, food.vitamin_c ?? 0,
                food.category, food.safety_status, food.image_path,
                food.source ?? 'app'
            );
        });

        await database.withTransactionAsync(async () => {
            await database.runAsync(
                `INSERT OR IGNORE INTO foods
                 (id, name_en, name_hi, calories, protein, carbs, fats, fiber,
                  iron, calcium, folate, vitamin_a, vitamin_c, category,
                  safety_status, image_path, source)
                 VALUES ${placeholders}`,
                values
            );
        });
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    const finalCount = await database.getFirstAsync('SELECT COUNT(*) as cnt FROM foods');
    console.log(`[DB] Seeded ${toInsert.length} foods in ${elapsed}s. Total: ${finalCount.cnt}`);
}

async function seedNutritionRequirements(database) {
    const count = await database.getFirstAsync('SELECT COUNT(*) as cnt FROM nutrition_requirements');
    if (count && count.cnt > 0) return;

    for (const req of requirementsData) {
        await database.runAsync(
            `INSERT INTO nutrition_requirements (trimester, min_calories, min_protein, min_iron, min_calcium, min_folate, hydration_liters)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.trimester, req.min_calories, req.min_protein,
            req.min_iron, req.min_calcium, req.min_folate, req.hydration_liters]
        );
    }
}

async function seedANCSchedule(database) {
    const count = await database.getFirstAsync('SELECT COUNT(*) as cnt FROM anc_schedule');
    if (count && count.cnt > 0) return;

    for (const visit of ANCSchedule) {
        await database.runAsync(
            `INSERT INTO anc_schedule (visit_number, recommended_week, description_en, description_hi, checkups_list)
       VALUES (?, ?, ?, ?, ?)`,
            [visit.visit, visit.week, visit.en, visit.hi, JSON.stringify(visit.checkups)]
        );
    }
}

async function seedSupplementSchedule(database) {
    const count = await database.getFirstAsync('SELECT COUNT(*) as cnt FROM supplement_schedule');
    if (count && count.cnt > 0) return;

    const supplements = [
        { type: 'iron', freq: 1, start: 1, end: 40, en: 'Iron + Folic Acid tablet daily', hi: 'आयरन + फोलिक एसिड गोली रोज़' },
        { type: 'calcium', freq: 2, start: 14, end: 40, en: 'Calcium tablet twice daily', hi: 'कैल्शियम गोली दिन में दो बार' },
        { type: 'folic_acid', freq: 1, start: 1, end: 12, en: 'Folic Acid daily (first trimester)', hi: 'फोलिक एसिड रोज़ (पहली तिमाही)' },
    ];

    for (const s of supplements) {
        await database.runAsync(
            `INSERT INTO supplement_schedule (supplement_type, frequency_per_day, start_week, end_week, details_en, details_hi)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [s.type, s.freq, s.start, s.end, s.en, s.hi]
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveUserProfile(profile) {
    const database = await getDatabase();
    const existing = await database.getFirstAsync('SELECT id FROM user_profile LIMIT 1');

    if (existing) {
        await database.runAsync(
            `UPDATE user_profile SET
        name = ?, age = ?, lmp_date = ?, due_date = ?, pregnancy_week = ?,
        height_cm = ?, start_weight_kg = ?, current_weight_kg = ?,
        language = ?, asha_contact = ?, emergency_contact = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
            [
                profile.name, profile.age, profile.lmp_date, profile.due_date,
                profile.pregnancy_week, profile.height_cm, profile.start_weight_kg,
                profile.current_weight_kg, profile.language || 'hi',
                profile.asha_contact, profile.emergency_contact, existing.id
            ]
        );
        return existing.id;
    } else {
        const result = await database.runAsync(
            `INSERT INTO user_profile (name, age, lmp_date, due_date, pregnancy_week, height_cm, start_weight_kg, current_weight_kg, language, asha_contact, emergency_contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                profile.name, profile.age, profile.lmp_date, profile.due_date,
                profile.pregnancy_week, profile.height_cm, profile.start_weight_kg,
                profile.current_weight_kg, profile.language || 'hi',
                profile.asha_contact, profile.emergency_contact
            ]
        );
        return result.lastInsertRowId;
    }
}

export async function getUserProfile() {
    const database = await getDatabase();
    return await database.getFirstAsync('SELECT * FROM user_profile LIMIT 1');
}

export async function updatePregnancyWeek(week) {
    const database = await getDatabase();
    await database.runAsync(
        'UPDATE user_profile SET pregnancy_week = ?, updated_at = CURRENT_TIMESTAMP',
        [week]
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEAL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save a complete meal log with items.
 * @param {Object} mealData - { mealType, items: [{ food_id, portion_multiplier }] }
 * @returns {number} mealLogId
 */
export async function saveMealLog(mealData) {
    const database = await getDatabase();
    const { mealType, items } = mealData;

    // Calculate totals
    let totalCalories = 0, totalProtein = 0, totalIron = 0, totalCalcium = 0, totalFolate = 0;

    const enrichedItems = [];
    for (const item of items) {
        const food = await database.getFirstAsync('SELECT * FROM foods WHERE id = ?', [item.food_id]);
        if (!food) continue;

        const multiplier = item.portion_multiplier || 1.0;
        const cal = food.calories * multiplier;
        const pro = food.protein * multiplier;
        const iro = food.iron * multiplier;
        const cac = food.calcium * multiplier;
        const fol = food.folate * multiplier;

        totalCalories += cal;
        totalProtein += pro;
        totalIron += iro;
        totalCalcium += cac;
        totalFolate += fol;

        enrichedItems.push({
            food_id: item.food_id,
            quantity_g: 100 * multiplier,
            portion_multiplier: multiplier,
            calories: cal,
            protein: pro,
            iron: iro,
            calcium: cac,
            folate: fol,
        });
    }

    // Insert meal log
    const result = await database.runAsync(
        `INSERT INTO meal_logs (meal_type, total_calories, total_protein, total_iron, total_calcium, total_folate)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [
            mealType,
            Math.round(totalCalories * 10) / 10,
            Math.round(totalProtein * 10) / 10,
            Math.round(totalIron * 10) / 10,
            Math.round(totalCalcium * 10) / 10,
            Math.round(totalFolate * 10) / 10
        ]
    );
    const mealLogId = result.lastInsertRowId;

    // Insert each item
    for (const ei of enrichedItems) {
        await database.runAsync(
            `INSERT INTO meal_items (meal_log_id, food_id, quantity_g, portion_multiplier, calories, protein, iron, calcium, folate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [mealLogId, ei.food_id, ei.quantity_g, ei.portion_multiplier,
                ei.calories, ei.protein, ei.iron, ei.calcium, ei.folate]
        );
    }

    // Update daily summary
    await updateDailySummary(database);

    return mealLogId;
}

export async function getTodayMeals() {
    const database = await getDatabase();
    const meals = await database.getAllAsync(
        `SELECT * FROM meal_logs WHERE log_date = date('now') ORDER BY created_at DESC`
    );
    // Attach items to each meal
    for (const meal of meals) {
        meal.items = await database.getAllAsync(
            `SELECT mi.*, f.name_en, f.name_hi, f.image_path, f.safety_status, f.category
       FROM meal_items mi JOIN foods f ON mi.food_id = f.id
       WHERE mi.meal_log_id = ?`,
            [meal.id]
        );
    }
    return meals;
}

export async function getMealHistory(startDate, endDate) {
    const database = await getDatabase();
    return await database.getAllAsync(
        `SELECT * FROM meal_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date DESC, created_at DESC`,
        [startDate, endDate]
    );
}

export async function deleteMeal(mealId) {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM meal_items WHERE meal_log_id = ?', [mealId]);
    await database.runAsync('DELETE FROM meal_logs WHERE id = ?', [mealId]);
    await updateDailySummary(database);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getAllFoods() {
    return await getAllFoodsPaginated(50, 0);
}

export async function getAllFoodsPaginated(limit = 50, offset = 0) {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM foods ORDER BY name_en LIMIT ? OFFSET ?', [limit, offset]);
}

export async function getCommonFoods() {
    const database = await getDatabase();
    return await database.getAllAsync(
        `SELECT * FROM foods WHERE category IN ('grain', 'protein', 'vegetable', 'dairy', 'fruit') AND safety_status = 'safe' ORDER BY name_en`
    );
}

export async function getFoodsByCategory(category) {
    return await getFoodsByCategoryPaginated(category, 50, 0);
}

export async function getFoodsByCategoryPaginated(category, limit = 50, offset = 0) {
    const database = await getDatabase();
    return await database.getAllAsync(
        'SELECT * FROM foods WHERE category = ? ORDER BY name_en LIMIT ? OFFSET ?',
        [category, limit, offset]
    );
}

export async function searchFoods(query) {
    return await searchFoodsPaginated(query, 50, 0);
}

export async function searchFoodsPaginated(query, limit = 50, offset = 0) {
    const database = await getDatabase();
    const q = `%${query}%`;
    return await database.getAllAsync(
        'SELECT * FROM foods WHERE name_en LIKE ? OR name_hi LIKE ? OR id LIKE ? ORDER BY name_en LIMIT ? OFFSET ?',
        [q, q, q, limit, offset]
    );
}

export async function getFoodById(foodId) {
    const database = await getDatabase();
    return await database.getFirstAsync('SELECT * FROM foods WHERE id = ?', [foodId]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY SUMMARY & NUTRITION
// ═══════════════════════════════════════════════════════════════════════════════

async function updateDailySummary(database) {
    const today = new Date().toISOString().split('T')[0];
    const totals = await database.getFirstAsync(
        `SELECT
       COALESCE(SUM(total_calories), 0) as total_calories,
       COALESCE(SUM(total_protein), 0) as total_protein,
       COALESCE(SUM(total_iron), 0) as total_iron,
       COALESCE(SUM(total_calcium), 0) as total_calcium,
       COALESCE(SUM(total_folate), 0) as total_folate
     FROM meal_logs WHERE log_date = ?`,
        [today]
    );

    await database.runAsync(
        `INSERT OR REPLACE INTO daily_summary (date, total_calories, total_protein, total_iron, total_calcium, total_folate, water_glasses, supplements_taken, updated_at)
     VALUES (?,
       ?,?,?,?,?,
       COALESCE((SELECT water_glasses FROM daily_summary WHERE date = ?), 0),
       COALESCE((SELECT supplements_taken FROM daily_summary WHERE date = ?), 0),
       CURRENT_TIMESTAMP
     )`,
        [
            today,
            totals.total_calories, totals.total_protein, totals.total_iron, totals.total_calcium, totals.total_folate,
            today, today
        ]
    );
}

export async function getDailySummary(date) {
    const database = await getDatabase();
    const d = date || new Date().toISOString().split('T')[0];
    let summary = await database.getFirstAsync('SELECT * FROM daily_summary WHERE date = ?', [d]);
    if (!summary) {
        summary = {
            date: d,
            total_calories: 0, total_protein: 0, total_iron: 0,
            total_calcium: 0, total_folate: 0, water_glasses: 0,
            supplements_taken: 0,
        };
    }
    return summary;
}

export async function logWater() {
    const database = await getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const existing = await database.getFirstAsync('SELECT water_glasses FROM daily_summary WHERE date = ?', [today]);

    if (existing) {
        await database.runAsync(
            'UPDATE daily_summary SET water_glasses = water_glasses + 1, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
            [today]
        );
        return existing.water_glasses + 1;
    } else {
        await database.runAsync(
            `INSERT INTO daily_summary (date, water_glasses) VALUES (?, 1)`,
            [today]
        );
        return 1;
    }
}

export async function getNutritionRequirements(week) {
    const database = await getDatabase();
    let trimester = 1;
    if (week > 28) trimester = 3;
    else if (week > 13) trimester = 2;

    return await database.getFirstAsync(
        'SELECT * FROM nutrition_requirements WHERE trimester = ?',
        [trimester]
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function logSupplement(type) {
    const database = await getDatabase();
    await database.runAsync(
        'INSERT INTO supplement_logs (supplement_type) VALUES (?)',
        [type]
    );
    // Update daily summary count
    const today = new Date().toISOString().split('T')[0];
    const count = await database.getFirstAsync(
        'SELECT COUNT(*) as cnt FROM supplement_logs WHERE date = ?', [today]
    );
    const existing = await database.getFirstAsync('SELECT * FROM daily_summary WHERE date = ?', [today]);
    if (existing) {
        await database.runAsync(
            'UPDATE daily_summary SET supplements_taken = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
            [count.cnt, today]
        );
    } else {
        await database.runAsync(
            'INSERT INTO daily_summary (date, supplements_taken) VALUES (?, ?)',
            [today, count.cnt]
        );
    }
    return count.cnt;
}

export async function getTodaySupplements() {
    const database = await getDatabase();
    return await database.getAllAsync(
        `SELECT * FROM supplement_logs WHERE date = date('now') ORDER BY taken_at DESC`
    );
}

export async function getSupplementAdherence(days = 7) {
    const database = await getDatabase();
    return await database.getAllAsync(
        `SELECT date, COUNT(*) as count, GROUP_CONCAT(supplement_type) as types
     FROM supplement_logs
     WHERE date >= date('now', '-' || ? || ' days')
     GROUP BY date ORDER BY date`,
        [days]
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEIGHT TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export async function logWeight(weightKg, weekOfPregnancy, notes = '') {
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO weight_tracking (weight_kg, week_of_pregnancy, notes) VALUES (?, ?, ?)',
        [weightKg, weekOfPregnancy, notes]
    );
    // Also update user profile current weight
    await database.runAsync(
        'UPDATE user_profile SET current_weight_kg = ?, updated_at = CURRENT_TIMESTAMP',
        [weightKg]
    );
    return result.lastInsertRowId;
}

export async function getWeightHistory() {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM weight_tracking ORDER BY date DESC');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANC SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

export async function getANCSchedule() {
    const database = await getDatabase();
    return await database.getAllAsync('SELECT * FROM anc_schedule ORDER BY visit_number');
}

export async function getNextANC(currentWeek) {
    const database = await getDatabase();
    return await database.getFirstAsync(
        'SELECT * FROM anc_schedule WHERE recommended_week >= ? AND is_completed = 0 ORDER BY recommended_week LIMIT 1',
        [currentWeek]
    );
}

export async function markANCCompleted(visitNumber, notes = '') {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE anc_schedule SET is_completed = 1, completed_date = date('now'), notes = ? WHERE visit_number = ?`,
        [notes, visitNumber]
    );
}

export async function attachReportToVisit(visitNumber, reportUri) {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE anc_schedule SET report_uri = ? WHERE visit_number = ?`,
        [reportUri, visitNumber]
    );
}
// ═══════════════════════════════════════════════════════════════════════════════
// NEW HEALTH FEATURES: KICKS, SYMPTOMS, VITALS
// ═══════════════════════════════════════════════════════════════════════════════

export async function logKicks(count, durationMin = 60) {
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO kick_logs (count, duration_min) VALUES (?, ?)',
        [count, durationMin]
    );
    return result.lastInsertRowId;
}

export async function getKickHistory(limit = 7) {
    const database = await getDatabase();
    return await database.getAllAsync(
        'SELECT * FROM kick_logs ORDER BY date DESC, time DESC LIMIT ?',
        [limit]
    );
}

export async function logSymptom(symptomId, severity, notes = '') {
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO symptom_logs (symptom_id, severity, notes) VALUES (?, ?, ?)',
        [symptomId, severity, notes]
    );
    return result.lastInsertRowId;
}

export async function getSymptomHistory(limit = 10) {
    const database = await getDatabase();
    return await database.getAllAsync(
        'SELECT * FROM symptom_logs ORDER BY date DESC, time DESC LIMIT ?',
        [limit]
    );
}

export async function logVitals(vitals) {
    const { systolic, diastolic, bloodSugar, pulse, notes = '' } = vitals;
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO vitals_logs (systolic, diastolic, blood_sugar, pulse, notes) VALUES (?, ?, ?, ?, ?)',
        [systolic, diastolic, bloodSugar, pulse, notes]
    );
    return result.lastInsertRowId;
}

export async function getVitalsHistory(limit = 10) {
    const database = await getDatabase();
    return await database.getAllAsync(
        'SELECT * FROM vitals_logs ORDER BY date DESC, time DESC LIMIT ?',
        [limit]
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EYE HEALTH ASSESSMENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save an eye health risk assessment result to local history.
 * @param {object} params - the inputs + result from RiskRadarService
 */
export async function saveEyeAssessment({ riskLevel, riskScore, confidence, method, age, familyHistory, logMAR, logCS, vfi, amslerDistortion, recommendations }) {
    const database = await getDatabase();
    const result = await database.runAsync(
        `INSERT INTO eye_assessments
         (risk_level, risk_score, confidence, method, age, family_history, log_mar, log_cs, vfi, amsler_distortion, recommendations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [riskLevel, riskScore, confidence, method, age, familyHistory ? 1 : 0, logMAR, logCS, vfi, amslerDistortion ? 1 : 0, JSON.stringify(recommendations ?? [])]
    );
    return result.lastInsertRowId;
}

/**
 * Fetch the most recent eye health assessments.
 * @param {number} limit
 */
export async function getEyeAssessments(limit = 10) {
    const database = await getDatabase();
    return await database.getAllAsync(
        'SELECT * FROM eye_assessments ORDER BY assessed_at DESC LIMIT ?',
        [limit]
    );
}
