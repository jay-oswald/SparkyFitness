const pool = require('../db/connection');
const format = require('pg-format');

const TABLE_NAME = 'user_nutrient_display_preferences';

async function getNutrientDisplayPreferences(userId) {
    const query = `SELECT * FROM ${TABLE_NAME} WHERE user_id = $1`;
    const { rows } = await pool.query(query, [userId]);
    return rows;
}

async function upsertNutrientDisplayPreference(userId, viewGroup, platform, visibleNutrients) {
    const query = `
        INSERT INTO ${TABLE_NAME} (user_id, view_group, platform, visible_nutrients)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, view_group, platform)
        DO UPDATE SET visible_nutrients = EXCLUDED.visible_nutrients, updated_at = NOW()
        RETURNING *;
    `;
    const { rows } = await pool.query(query, [userId, viewGroup, platform, JSON.stringify(visibleNutrients)]);
    return rows[0];
}

async function deleteNutrientDisplayPreference(userId, viewGroup, platform) {
    const query = `DELETE FROM ${TABLE_NAME} WHERE user_id = $1 AND view_group = $2 AND platform = $3`;
    await pool.query(query, [userId, viewGroup, platform]);
}

async function createDefaultNutrientPreferences(userId, defaultPreferences) {
    const values = defaultPreferences.map(pref => [
        userId,
        pref.view_group,
        pref.platform,
        JSON.stringify(pref.visible_nutrients)
    ]);

    const query = format(
        'INSERT INTO %I (user_id, view_group, platform, visible_nutrients) VALUES %L RETURNING *',
        TABLE_NAME,
        values
    );

    const { rows } = await pool.query(query);
    return rows;
}

module.exports = {
    getNutrientDisplayPreferences,
    upsertNutrientDisplayPreference,
    deleteNutrientDisplayPreference,
    createDefaultNutrientPreferences
};