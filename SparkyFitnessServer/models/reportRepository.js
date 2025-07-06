const pool = require('../db/connection');

async function getNutritionData(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         fe.entry_date AS date,
         SUM(f.calories * fe.quantity / f.serving_size) AS calories,
         SUM(f.protein * fe.quantity / f.serving_size) AS protein,
         SUM(f.carbs * fe.quantity / f.serving_size) AS carbs,
         SUM(f.fat * fe.quantity / f.serving_size) AS fat,
         SUM(COALESCE(f.saturated_fat, 0) * fe.quantity / f.serving_size) AS saturated_fat,
         SUM(COALESCE(f.polyunsaturated_fat, 0) * fe.quantity / f.serving_size) AS polyunsaturated_fat,
         SUM(COALESCE(f.monounsaturated_fat, 0) * fe.quantity / f.serving_size) AS monounsaturated_fat,
         SUM(COALESCE(f.trans_fat, 0) * fe.quantity / f.serving_size) AS trans_fat,
         SUM(COALESCE(f.cholesterol, 0) * fe.quantity / f.serving_size) AS cholesterol,
         SUM(COALESCE(f.sodium, 0) * fe.quantity / f.serving_size) AS sodium,
         SUM(COALESCE(f.potassium, 0) * fe.quantity / f.serving_size) AS potassium,
         SUM(COALESCE(f.dietary_fiber, 0) * fe.quantity / f.serving_size) AS dietary_fiber,
         SUM(COALESCE(f.sugars, 0) * fe.quantity / f.serving_size) AS sugars,
         SUM(COALESCE(f.vitamin_a, 0) * fe.quantity / f.serving_size) AS vitamin_a,
         SUM(COALESCE(f.vitamin_c, 0) * fe.quantity / f.serving_size) AS vitamin_c,
         SUM(COALESCE(f.calcium, 0) * fe.quantity / f.serving_size) AS calcium,
         SUM(COALESCE(f.iron, 0) * fe.quantity / f.serving_size) AS iron
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
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
      `SELECT fe.*, f.name AS food_name, f.brand, f.calories, f.protein, f.carbs, f.fat,
              f.saturated_fat, f.polyunsaturated_fat, f.monounsaturated_fat, f.trans_fat,
              f.cholesterol, f.sodium, f.potassium, f.dietary_fiber, f.sugars,
              f.vitamin_a, f.vitamin_c, f.calcium, f.iron, f.serving_size
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
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
      'SELECT entry_date, weight, neck, waist, hips, steps FROM check_in_measurements WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date',
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
      'SELECT category_id, entry_date AS date, EXTRACT(HOUR FROM entry_timestamp) AS hour, value, entry_timestamp AS timestamp FROM custom_measurements WHERE user_id = $1 AND category_id = $2 AND entry_date BETWEEN $3 AND $4 ORDER BY entry_date, entry_timestamp',
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
         fe.entry_date,
         SUM(f.calories * fe.quantity / f.serving_size) AS total_calories,
         SUM(f.protein * fe.quantity / f.serving_size) AS total_protein,
         SUM(f.carbs * fe.quantity / f.serving_size) AS total_carbs,
         SUM(f.fat * fe.quantity / f.serving_size) AS total_fat
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
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