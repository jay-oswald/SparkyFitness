const pool = require('../db/connection');

async function getNutritionData(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         TO_CHAR(fe.entry_date, 'YYYY-MM-DD') AS date,
         SUM(fv.calories * fe.quantity / fv.serving_size) AS calories,
         SUM(fv.protein * fe.quantity / fv.serving_size) AS protein,
         SUM(fv.carbs * fe.quantity / fv.serving_size) AS carbs,
         SUM(fv.fat * fe.quantity / fv.serving_size) AS fat,
         SUM(COALESCE(fv.saturated_fat, 0) * fe.quantity / fv.serving_size) AS saturated_fat,
         SUM(COALESCE(fv.polyunsaturated_fat, 0) * fe.quantity / fv.serving_size) AS polyunsaturated_fat,
         SUM(COALESCE(fv.monounsaturated_fat, 0) * fe.quantity / fv.serving_size) AS monounsaturated_fat,
         SUM(COALESCE(fv.trans_fat, 0) * fe.quantity / fv.serving_size) AS trans_fat,
         SUM(COALESCE(fv.cholesterol, 0) * fe.quantity / fv.serving_size) AS cholesterol,
         SUM(COALESCE(fv.sodium, 0) * fe.quantity / fv.serving_size) AS sodium,
         SUM(COALESCE(fv.potassium, 0) * fe.quantity / fv.serving_size) AS potassium,
         SUM(COALESCE(fv.dietary_fiber, 0) * fe.quantity / fv.serving_size) AS dietary_fiber,
         SUM(COALESCE(fv.sugars, 0) * fe.quantity / fv.serving_size) AS sugars,
         SUM(COALESCE(fv.vitamin_a, 0) * fe.quantity / fv.serving_size) AS vitamin_a,
         SUM(COALESCE(fv.vitamin_c, 0) * fe.quantity / fv.serving_size) AS vitamin_c,
         SUM(COALESCE(fv.calcium, 0) * fe.quantity / fv.serving_size) AS calcium,
         SUM(COALESCE(fv.iron, 0) * fe.quantity / fv.serving_size) AS iron
       FROM food_entries fe
       JOIN food_variants fv ON fe.variant_id = fv.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       GROUP BY fe.entry_date
       ORDER BY fe.entry_date`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getTabularFoodData(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT TO_CHAR(fe.entry_date, 'YYYY-MM-DD') AS entry_date, fe.meal_type, fe.quantity, fe.unit, fe.food_id, fe.variant_id, fe.user_id, f.name AS food_name, f.brand,
              fv.calories, fv.protein, fv.carbs, fv.fat,
              fv.saturated_fat, fv.polyunsaturated_fat, fv.monounsaturated_fat, fv.trans_fat,
              fv.cholesterol, fv.sodium, fv.potassium, fv.dietary_fiber, fv.sugars,
              fv.vitamin_a, fv.vitamin_c, fv.calcium, fv.iron, fv.serving_size, fv.serving_unit
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       JOIN food_variants fv ON fe.variant_id = fv.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       ORDER BY fe.entry_date, fe.meal_type`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getMeasurementData(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
       `SELECT TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date, weight, neck, waist, hips, steps FROM check_in_measurements WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getCustomMeasurementsData(userId, categoryId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
       `SELECT category_id, TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date, EXTRACT(HOUR FROM entry_timestamp) AS hour, value, entry_timestamp AS timestamp FROM custom_measurements WHERE user_id = $1 AND category_id = $2 AND entry_date BETWEEN $3 AND $4 ORDER BY entry_date, entry_timestamp`,
      [userId, categoryId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getMiniNutritionTrends(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         TO_CHAR(fe.entry_date, 'YYYY-MM-DD') AS entry_date,
         SUM(fv.calories * fe.quantity / fv.serving_size) AS total_calories,
         SUM(fv.protein * fe.quantity / fv.serving_size) AS total_protein,
         SUM(fv.carbs * fe.quantity / fv.serving_size) AS total_carbs,
         SUM(fv.fat * fe.quantity / fv.serving_size) AS total_fat
       FROM food_entries fe
       JOIN food_variants fv ON fe.variant_id = fv.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       GROUP BY fe.entry_date
       ORDER BY fe.entry_date`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  getNutritionData,
  getTabularFoodData,
  getMeasurementData,
  getCustomMeasurementsData,
  getMiniNutritionTrends,
};