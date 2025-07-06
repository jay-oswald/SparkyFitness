const pool = require('../db/connection');
const { log } = require('../config/logging');

async function getExerciseById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercises WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getExerciseOwnerId(id) {
  const client = await pool.connect();
  try {
    const exerciseResult = await client.query(
      'SELECT user_id FROM exercises WHERE id = $1',
      [id]
    );
    return exerciseResult.rows[0]?.user_id;
  } finally {
    client.release();
  }
}

async function getOrCreateActiveCaloriesExercise(userId) {
  const exerciseName = "Active Calories";
  const client = await pool.connect();
  let exercise = null;
  try {
    const result = await client.query(
      'SELECT id FROM exercises WHERE name = $1 AND user_id = $2',
      [exerciseName, userId]
    );
    exercise = result.rows[0];
  } catch (error) {
    log('error', "Error fetching active calories exercise:", error);
    throw new Error(`Failed to retrieve active calories exercise: ${error.message}`);
  } finally {
    client.release();
  }

  if (!exercise) {
    log('info', `Creating default exercise: ${exerciseName} for user ${userId}`);
    const insertClient = await pool.connect();
    let newExercise = null;
    try {
      const result = await insertClient.query(
        `INSERT INTO exercises (user_id, name, category, calories_per_hour, description, is_custom, shared_with_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [userId, exerciseName, 'Cardio', 600, 'Automatically logged active calories from a health tracking shortcut.', true, false]
      );
      newExercise = result.rows[0];
    } catch (createError) {
      log('error', "Error creating active calories exercise:", createError);
      throw new Error(`Failed to create active calories exercise: ${createError.message}`);
    } finally {
      insertClient.release();
    }
    exercise = newExercise;
  }
  return exercise.id;
}

async function upsertExerciseEntryData(userId, exerciseId, caloriesBurned, date) {
  log('info', "upsertExerciseEntryData received date parameter:", date);
  const client = await pool.connect();
  let existingEntry = null;
  try {
    const result = await client.query(
      'SELECT id, calories_burned FROM exercise_entries WHERE user_id = $1 AND exercise_id = $2 AND entry_date = $3',
      [userId, exerciseId, date]
    );
    existingEntry = result.rows[0];
  } catch (error) {
    log('error', "Error checking for existing active calories exercise entry:", error);
    throw new Error(`Failed to check existing active calories exercise entry: ${error.message}`);
  } finally {
    client.release();
  }

  let result;
  if (existingEntry) {
    log('info', `Existing active calories entry found for ${date}, updating calories from ${existingEntry.calories_burned} to ${caloriesBurned}.`);
    const updateClient = await pool.connect();
    try {
      const updateResult = await updateClient.query(
        'UPDATE exercise_entries SET calories_burned = $1, notes = $2 WHERE id = $3 RETURNING *',
        [caloriesBurned, 'Active calories logged from Apple Health (updated).', existingEntry.id]
      );
      result = updateResult.rows[0];
    } catch (error) {
      log('error', "Error updating active calories exercise entry:", error);
      throw new Error(`Failed to update active calories exercise entry: ${error.message}`);
    } finally {
      updateClient.release();
    }
  } else {
    log('info', `No existing active calories entry found for ${date}, inserting new entry.`);
    const insertClient = await pool.connect();
    try {
      const insertResult = await insertClient.query(
        `INSERT INTO exercise_entries (user_id, exercise_id, entry_date, calories_burned, duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, exerciseId, date, caloriesBurned, 0, 'Active calories logged from Apple Health.']
      );
      result = insertResult.rows[0];
    } catch (error) {
      log('error', "Error inserting active calories exercise entry:", error);
      throw new Error(`Failed to insert active calories exercise entry: ${error.message}`);
    } finally {
      insertClient.release();
    }
  }
  return result;
}

async function getExercisesWithPagination(targetUserId, searchTerm, categoryFilter, ownershipFilter, limit, offset) {
  const client = await pool.connect();
  try {
    let whereClauses = ['1=1'];
    const queryParams = [];
    let paramIndex = 1;

    if (searchTerm) {
      whereClauses.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (categoryFilter && categoryFilter !== 'all') {
      whereClauses.push(`category = $${paramIndex}`);
      queryParams.push(categoryFilter);
      paramIndex++;
    }

    if (ownershipFilter === 'own') {
      whereClauses.push(`user_id = $${paramIndex}`);
      queryParams.push(targetUserId);
      paramIndex++;
    } else if (ownershipFilter === 'public') {
      whereClauses.push(`user_id IS NULL OR shared_with_public = TRUE`);
    } else if (ownershipFilter === 'family') {
      whereClauses.push(`user_id != $${paramIndex} AND is_custom = TRUE`);
      queryParams.push(targetUserId);
      paramIndex++;
    } else if (ownershipFilter === 'all') {
      whereClauses.push(`(user_id IS NULL OR user_id = $${paramIndex} OR shared_with_public = TRUE OR user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW())))`);
      queryParams.push(targetUserId);
      paramIndex++;
    }

    let query = `
      SELECT id, name, category, calories_per_hour, description, user_id, is_custom, shared_with_public, created_at, updated_at
      FROM exercises
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    queryParams.push(limit, offset);

    const result = await client.query(query, queryParams);
    return result.rows;
  } finally {
    client.release();
  }
}

async function countExercises(targetUserId, searchTerm, categoryFilter, ownershipFilter) {
  const client = await pool.connect();
  try {
    let whereClauses = ['1=1'];
    const queryParams = [];
    let paramIndex = 1;

    if (searchTerm) {
      whereClauses.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (categoryFilter && categoryFilter !== 'all') {
      whereClauses.push(`category = $${paramIndex}`);
      queryParams.push(categoryFilter);
      paramIndex++;
    }

    if (ownershipFilter === 'own') {
      whereClauses.push(`user_id = $${paramIndex}`);
      queryParams.push(targetUserId);
      paramIndex++;
    } else if (ownershipFilter === 'public') {
      whereClauses.push(`user_id IS NULL OR shared_with_public = TRUE`);
    } else if (ownershipFilter === 'family') {
      whereClauses.push(`user_id != $${paramIndex} AND is_custom = TRUE`);
      queryParams.push(targetUserId);
      paramIndex++;
    } else if (ownershipFilter === 'all') {
      whereClauses.push(`(user_id IS NULL OR user_id = $${paramIndex} OR shared_with_public = TRUE OR user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW())))`);
      queryParams.push(targetUserId);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*)
      FROM exercises
      WHERE ${whereClauses.join(' AND ')}
    `;
    const result = await client.query(countQuery, queryParams);
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

async function searchExercises(name) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, calories_per_hour FROM exercises WHERE name ILIKE $1 LIMIT 1',
      [`%${name}%`]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function createExercise(exerciseData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO exercises (name, category, calories_per_hour, description, is_custom, user_id, shared_with_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING id, calories_per_hour`,
      [exerciseData.name, exerciseData.category, exerciseData.calories_per_hour, exerciseData.description, exerciseData.is_custom, exerciseData.user_id, exerciseData.shared_with_public]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function createExerciseEntry(entryData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO exercise_entries (user_id, exercise_id, duration_minutes, calories_burned, entry_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now()) RETURNING *`,
      [entryData.user_id, entryData.exercise_id, entryData.duration_minutes, entryData.calories_burned, entryData.entry_date, entryData.notes]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getExerciseEntryById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercise_entries WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getExerciseEntryOwnerId(id) {
  const client = await pool.connect();
  try {
    const entryResult = await client.query(
      'SELECT user_id FROM exercise_entries WHERE id = $1',
      [id]
    );
    return entryResult.rows[0]?.user_id;
  } finally {
    client.release();
  }
}

async function updateExerciseEntry(id, userId, updateData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE exercise_entries SET
        exercise_id = COALESCE($1, exercise_id),
        duration_minutes = COALESCE($2, duration_minutes),
        calories_burned = COALESCE($3, calories_burned),
        entry_date = COALESCE($4, entry_date),
        notes = COALESCE($5, notes),
        updated_at = now()
      WHERE id = $6 AND user_id = $7
      RETURNING *`,
      [updateData.exercise_id, updateData.duration_minutes, updateData.calories_burned, updateData.entry_date, updateData.notes, id, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteExerciseEntry(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM exercise_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function updateExercise(id, userId, updateData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE exercises SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        calories_per_hour = COALESCE($3, calories_per_hour),
        description = COALESCE($4, description),
        is_custom = COALESCE($5, is_custom),
        shared_with_public = COALESCE($6, shared_with_public),
        updated_at = now()
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
      [updateData.name, updateData.category, updateData.calories_per_hour, updateData.description, updateData.is_custom, updateData.shared_with_public, id, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteExercise(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM exercises WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function getExerciseEntriesByDate(userId, selectedDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercise_entries WHERE user_id = $1 AND entry_date = $2',
      [userId, selectedDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  getExerciseById,
  getExerciseOwnerId,
  getOrCreateActiveCaloriesExercise,
  upsertExerciseEntryData,
  getExercisesWithPagination,
  countExercises,
  searchExercises,
  createExercise,
  createExerciseEntry,
  getExerciseEntryById,
  getExerciseEntryOwnerId,
  updateExerciseEntry,
  deleteExerciseEntry,
  updateExercise,
  deleteExercise,
  getExerciseEntriesByDate,
};