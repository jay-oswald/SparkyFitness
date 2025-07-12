const pool = require('../db/connection');
const { log } = require('../config/logging');
const format = require('pg-format');

// --- Meal Template CRUD Operations ---

async function createMeal(mealData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mealResult = await client.query(
      `INSERT INTO meals (user_id, name, description, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now()) RETURNING id, user_id, name, description, is_public`,
      [mealData.user_id, mealData.name, mealData.description, mealData.is_public]
    );
    const newMeal = mealResult.rows[0];

    if (mealData.foods && mealData.foods.length > 0) {
      const mealFoodsValues = mealData.foods.map(food => [
        newMeal.id, food.food_id, food.variant_id, food.quantity, food.unit, 'now()', 'now()'
      ]);
      const mealFoodsQuery = format(
        `INSERT INTO meal_foods (meal_id, food_id, variant_id, quantity, unit, created_at, updated_at) VALUES %L RETURNING id`,
        mealFoodsValues
      );
      await client.query(mealFoodsQuery);
    }

    await client.query('COMMIT');
    return newMeal;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error creating meal:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function getMeals(userId, isPublic = false) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT id, user_id, name, description, is_public, created_at, updated_at
      FROM meals
      WHERE user_id = $1`;
    const queryParams = [userId];

    if (isPublic) {
      query += ` OR is_public = TRUE`;
    }
    query += ` ORDER BY name ASC`;

    const result = await client.query(query, queryParams);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getMealById(mealId) {
  const client = await pool.connect();
  try {
    const mealResult = await client.query(
      `SELECT id, user_id, name, description, is_public, created_at, updated_at
       FROM meals WHERE id = $1`,
      [mealId]
    );
    const meal = mealResult.rows[0];

    if (meal) {
      const mealFoodsResult = await client.query(
        `SELECT mf.id, mf.food_id, mf.variant_id, mf.quantity, mf.unit,
                f.name AS food_name, f.brand,
                fv.serving_size, fv.serving_unit, fv.calories, fv.protein, fv.carbs, fv.fat
         FROM meal_foods mf
         JOIN foods f ON mf.food_id = f.id
         LEFT JOIN food_variants fv ON mf.variant_id = fv.id
         WHERE mf.meal_id = $1`,
        [mealId]
      );
      meal.foods = mealFoodsResult.rows;
    }
    return meal;
  } finally {
    client.release();
  }
}

async function updateMeal(mealId, userId, updateData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE meals SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_public = COALESCE($3, is_public),
        updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, name, description, is_public`,
      [updateData.name, updateData.description, updateData.is_public, mealId, userId]
    );
    const updatedMeal = result.rows[0];

    if (updatedMeal && updateData.foods !== undefined) {
      // Delete existing meal_foods for this meal
      await client.query('DELETE FROM meal_foods WHERE meal_id = $1', [mealId]);

      // Insert new meal_foods
      if (updateData.foods.length > 0) {
        const mealFoodsValues = updateData.foods.map(food => [
          mealId, food.food_id, food.variant_id, food.quantity, food.unit, 'now()', 'now()'
        ]);
        const mealFoodsQuery = format(
          `INSERT INTO meal_foods (meal_id, food_id, variant_id, quantity, unit, created_at, updated_at) VALUES %L RETURNING id`,
          mealFoodsValues
        );
        await client.query(mealFoodsQuery);
      }
    }

    await client.query('COMMIT');
    return updatedMeal;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error updating meal ${mealId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMeal(mealId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // meal_foods will be cascade deleted due to ON DELETE CASCADE on meal_id
    const result = await client.query(
      'DELETE FROM meals WHERE id = $1 AND user_id = $2 RETURNING id',
      [mealId, userId]
    );
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    log('error', `Error deleting meal ${mealId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

// --- Meal Plan CRUD Operations ---

async function createMealPlanEntry(planData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO meal_plans (user_id, meal_id, food_id, variant_id, quantity, unit, plan_date, meal_type, is_template, template_name, day_of_week, meal_plan_template_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now()) RETURNING *`,
      [
        planData.user_id, planData.meal_id, planData.food_id, planData.variant_id,
        planData.quantity, planData.unit, planData.plan_date, planData.meal_type,
        planData.is_template, planData.template_name, planData.day_of_week, planData.meal_plan_template_id
      ]
    );
    return result.rows[0];
  } catch (error) {
    log('error', `Error creating meal plan entry:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function getMealPlanEntries(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        mp.id, mp.user_id, mp.meal_id, mp.food_id, mp.variant_id, mp.quantity, mp.unit,
        mp.plan_date, mp.meal_type, mp.is_template, mp.template_name, mp.day_of_week,
        m.name AS meal_name, m.description AS meal_description,
        f.name AS food_name, f.brand AS food_brand,
        fv.serving_size, fv.serving_unit, fv.calories, fv.protein, fv.carbs, fv.fat
       FROM meal_plans mp
       LEFT JOIN meals m ON mp.meal_id = m.id
       LEFT JOIN foods f ON mp.food_id = f.id
       LEFT JOIN food_variants fv ON mp.variant_id = fv.id
       WHERE mp.user_id = $1 AND mp.plan_date BETWEEN $2 AND $3
       ORDER BY mp.plan_date, mp.meal_type`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function updateMealPlanEntry(planId, userId, updateData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE meal_plans SET
        meal_id = COALESCE($1, meal_id),
        food_id = COALESCE($2, food_id),
        variant_id = COALESCE($3, variant_id),
        quantity = COALESCE($4, quantity),
        unit = COALESCE($5, unit),
        plan_date = COALESCE($6, plan_date),
        meal_type = COALESCE($7, meal_type),
        is_template = COALESCE($8, is_template),
        template_name = COALESCE($9, template_name),
        day_of_week = COALESCE($10, day_of_week),
        meal_plan_template_id = COALESCE($11, meal_plan_template_id),
        updated_at = now()
       WHERE id = $12 AND user_id = $13
       RETURNING *`,
      [
        updateData.meal_id, updateData.food_id, updateData.variant_id,
        updateData.quantity, updateData.unit, updateData.plan_date, updateData.meal_type,
        updateData.is_template, updateData.template_name, updateData.day_of_week,
        updateData.meal_plan_template_id, planId, userId
      ]
    );
    return result.rows[0];
  } catch (error) {
    log('error', `Error updating meal plan entry ${planId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMealPlanEntry(planId, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM meal_plans WHERE id = $1 AND user_id = $2 RETURNING id',
      [planId, userId]
    );
    return result.rowCount > 0;
  } catch (error) {
    log('error', `Error deleting meal plan entry ${planId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function getMealPlanEntryById(planId, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        mp.id, mp.user_id, mp.meal_id, mp.food_id, mp.variant_id, mp.quantity, mp.unit,
        mp.plan_date, mp.meal_type,
        m.name AS meal_name,
        f.name AS food_name
       FROM meal_plans mp
       LEFT JOIN meals m ON mp.meal_id = m.id
       LEFT JOIN foods f ON mp.food_id = f.id
       WHERE mp.id = $1 AND mp.user_id = $2`,
      [planId, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// --- Helper for logging meal plan to food entries ---

async function createFoodEntryFromMealPlan(entryData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_entries (user_id, food_id, meal_type, quantity, unit, entry_date, variant_id, meal_plan_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
      [
        entryData.user_id, entryData.food_id, entryData.meal_type, entryData.quantity,
        entryData.unit, entryData.entry_date, entryData.variant_id, entryData.meal_plan_id
      ]
    );
    return result.rows[0];
  } catch (error) {
    log('error', `Error creating food entry from meal plan:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function deleteMealPlanEntriesByTemplateId(templateId, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM meal_plans WHERE meal_plan_template_id = $1 AND user_id = $2 RETURNING id',
      [templateId, userId]
    );
    return result.rowCount;
  } catch (error) {
    log('error', `Error deleting meal plan entries for template ${templateId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createMeal,
  getMeals,
  getMealById,
  updateMeal,
  deleteMeal,
  createMealPlanEntry,
  getMealPlanEntries,
  getMealPlanEntryById,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  deleteMealPlanEntriesByTemplateId,
  createFoodEntryFromMealPlan,
  getMealOwnerId,
  getMealPlanOwnerId,
};

async function getMealOwnerId(mealId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id FROM meals WHERE id = $1',
      [mealId]
    );
    return result.rows[0] ? result.rows[0].user_id : null;
  } finally {
    client.release();
  }
}

async function getMealPlanOwnerId(mealPlanId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id FROM meal_plans WHERE id = $1',
      [mealPlanId]
    );
    return result.rows[0] ? result.rows[0].user_id : null;
  } finally {
    client.release();
  }
}