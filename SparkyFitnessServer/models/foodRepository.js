const pool = require('../db/connection');
const { encrypt, decrypt, ENCRYPTION_KEY } = require('../security/encryption');
const { log } = require('../config/logging');
const format = require('pg-format'); // Required for bulkCreateFoodVariants

async function getFoodDataProviders(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, provider_name, provider_type FROM food_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getFoodDataProvidersByUserId(targetUserId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, provider_name, provider_type, encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag, is_active FROM food_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
      [targetUserId]
    );
    const providers = await Promise.all(result.rows.map(async (row) => {
      let decryptedAppId = null;
      let decryptedAppKey = null;

      if (row.encrypted_app_id && row.app_id_iv && row.app_id_tag) {
        try {
          decryptedAppId = await decrypt(row.encrypted_app_id, row.app_id_iv, row.app_id_tag, ENCRYPTION_KEY);
        } catch (e) {
          log('error', 'Error decrypting app_id for provider:', row.id, e);
        }
      }
      if (row.encrypted_app_key && row.app_key_iv && row.app_key_tag) {
        try {
          decryptedAppKey = await decrypt(row.encrypted_app_key, row.app_key_iv, row.app_key_tag, ENCRYPTION_KEY);
        } catch (e) {
          log('error', 'Error decrypting app_key for provider:', row.id, e);
        }
      }

      return {
        id: row.id,
        provider_name: row.provider_name,
        provider_type: row.provider_type,
        app_id: decryptedAppId,
        app_key: decryptedAppKey,
        is_active: row.is_active,
      };
    }));
    return providers;
  } finally {
    client.release();
  }
}

async function createFoodDataProvider(providerData) {
  const client = await pool.connect();
  try {
    let encryptedAppId = null;
    let appIdIv = null;
    let appIdTag = null;
    let encryptedAppKey = null;
    let appKeyIv = null;
    let appKeyTag = null;

    if (providerData.app_id) {
      const encryptedId = await encrypt(providerData.app_id, ENCRYPTION_KEY);
      encryptedAppId = encryptedId.encryptedText;
      appIdIv = encryptedId.iv;
      appIdTag = encryptedId.tag;
    }
    if (providerData.app_key) {
      const encryptedKey = await encrypt(providerData.app_key, ENCRYPTION_KEY);
      encryptedAppKey = encryptedKey.encryptedText;
      appKeyIv = encryptedKey.iv;
      appKeyTag = encryptedKey.tag;
    }

    const result = await client.query(
      `INSERT INTO food_data_providers (
        provider_name, provider_type, user_id, is_active,
        encrypted_app_id, app_id_iv, app_id_tag,
        encrypted_app_key, app_key_iv, app_key_tag,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) RETURNING id`,
      [
        providerData.provider_name, providerData.provider_type, providerData.user_id, providerData.is_active,
        encryptedAppId, appIdIv, appIdTag,
        encryptedAppKey, appKeyIv, appKeyTag
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateFoodDataProvider(id, userId, updateData) {
  const client = await pool.connect();
  try {
    let encryptedAppId = updateData.encryptedAppId || null;
    let appIdIv = updateData.appIdIv || null;
    let appIdTag = updateData.appIdTag || null;
    let encryptedAppKey = updateData.encryptedAppKey || null;
    let appKeyIv = updateData.appKeyIv || null;
    let appKeyTag = updateData.appKeyTag || null;

    if (updateData.app_id !== undefined) {
      const encryptedId = await encrypt(updateData.app_id, ENCRYPTION_KEY);
      encryptedAppId = encryptedId.encryptedText;
      appIdIv = encryptedId.iv;
      appIdTag = encryptedId.tag;
    }
    if (updateData.app_key !== undefined) {
      const encryptedKey = await encrypt(updateData.app_key, ENCRYPTION_KEY);
      encryptedAppKey = encryptedKey.encryptedText;
      appKeyIv = encryptedKey.iv;
      appKeyTag = encryptedKey.tag;
    }

    const result = await client.query(
      `UPDATE food_data_providers SET
        provider_name = COALESCE($1, provider_name),
        provider_type = COALESCE($2, provider_type),
        is_active = COALESCE($3, is_active),
        encrypted_app_id = COALESCE($4, encrypted_app_id),
        app_id_iv = COALESCE($5, app_id_iv),
        app_id_tag = COALESCE($6, app_id_tag),
        encrypted_app_key = COALESCE($7, encrypted_app_key),
        app_key_iv = COALESCE($8, app_key_iv),
        app_key_tag = COALESCE($9, app_key_tag),
        updated_at = now()
      WHERE id = $10 AND user_id = $11
      RETURNING *`,
      [
        updateData.provider_name, updateData.provider_type, updateData.is_active,
        encryptedAppId, appIdIv, appIdTag,
        encryptedAppKey, appKeyIv, appKeyTag,
        id, userId
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getFoodDataProviderById(providerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag FROM food_data_providers WHERE id = $1',
      [providerId]
    );
    const data = result.rows[0];
    if (!data) return null;

    let decryptedAppId = null;
    let decryptedAppKey = null;

    if (data.encrypted_app_id && data.app_id_iv && data.app_id_tag) {
      try {
        decryptedAppId = await decrypt(data.encrypted_app_id, data.app_id_iv, data.app_id_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting app_id for provider:', providerId, e);
      }
    }
    if (data.encrypted_app_key && data.app_key_iv && data.app_key_tag) {
      try {
        decryptedAppKey = await decrypt(data.encrypted_app_key, data.app_key_iv, data.app_key_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting app_key for provider:', providerId, e);
      }
    }
    return { app_id: decryptedAppId, app_key: decryptedAppKey };
  } finally {
    client.release();
  }
}

async function checkFoodDataProviderOwnership(providerId, userId) {
  const client = await pool.connect();
  try {
    const checkOwnership = await client.query(
      'SELECT 1 FROM food_data_providers WHERE id = $1 AND user_id = $2',
      [providerId, userId]
    );
    return checkOwnership.rowCount > 0;
  } finally {
    client.release();
  }
}
 
async function deleteFoodDataProvider(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM food_data_providers WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}
 
async function searchFoods(name, userId, exactMatch, broadMatch, checkCustom) {
  const client = await pool.connect();
  try {
    let query = `
      SELECT
        f.id, f.name, f.brand, f.is_custom, f.user_id, f.shared_with_public, f.provider_external_id, f.provider_type,
        json_build_object(
          'id', fv.id,
          'serving_size', fv.serving_size,
          'serving_unit', fv.serving_unit,
          'calories', fv.calories,
          'protein', fv.protein,
          'carbs', fv.carbs,
          'fat', fv.fat,
          'saturated_fat', fv.saturated_fat,
          'polyunsaturated_fat', fv.polyunsaturated_fat,
          'monounsaturated_fat', fv.monounsaturated_fat,
          'trans_fat', fv.trans_fat,
          'cholesterol', fv.cholesterol,
          'sodium', fv.sodium,
          'potassium', fv.potassium,
          'dietary_fiber', fv.dietary_fiber,
          'sugars', fv.sugars,
          'vitamin_a', fv.vitamin_a,
          'vitamin_c', fv.vitamin_c,
          'calcium', fv.calcium,
          'iron', fv.iron,
          'is_default', fv.is_default
        ) AS default_variant
      FROM foods f
      LEFT JOIN food_variants fv ON f.id = fv.food_id AND fv.is_default = TRUE
      WHERE `;
    const queryParams = [];
    let paramIndex = 1;
 
    if (exactMatch) {
      query += `f.name ILIKE $${paramIndex++} AND f.user_id = $${paramIndex++}`;
      queryParams.push(name, userId);
    } else if (broadMatch) {
      query += `f.name ILIKE $${paramIndex++} AND (f.user_id = $${paramIndex++} OR f.is_custom = FALSE)`;
      queryParams.push(`%${name}%`, userId);
    } else if (checkCustom) {
      query += `f.name = $${paramIndex++} AND f.user_id = $${paramIndex++}`;
      queryParams.push(name, userId);
    } else {
      throw new Error('Invalid search parameters.');
    }
 
    query += ' LIMIT 3';
    const result = await client.query(query, queryParams);
    return result.rows;
  } finally {
    client.release();
  }
}

async function createFood(foodData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Create the food entry
    const foodResult = await client.query(
      `INSERT INTO foods (
        name, is_custom, user_id, brand, barcode, provider_external_id, shared_with_public, provider_type, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now()) RETURNING id, name, brand, is_custom, user_id, shared_with_public`,
      [
        foodData.name, foodData.is_custom, foodData.user_id, foodData.brand, foodData.barcode, foodData.provider_external_id, foodData.shared_with_public, foodData.provider_type
      ]
    );
    const newFood = foodResult.rows[0];

    // 2. Create the primary food variant and mark it as default
    const variantResult = await client.query(
      `INSERT INTO food_variants (
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_default, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, TRUE, now(), now()) RETURNING id`,
      [
        newFood.id, foodData.serving_size, foodData.serving_unit, foodData.calories, foodData.protein, foodData.carbs, foodData.fat,
        foodData.saturated_fat, foodData.polyunsaturated_fat, foodData.monounsaturated_fat, foodData.trans_fat,
        foodData.cholesterol, foodData.sodium, foodData.potassium, foodData.dietary_fiber, foodData.sugars,
        foodData.vitamin_a, foodData.vitamin_c, foodData.calcium, foodData.iron
      ]
    );
    const newVariantId = variantResult.rows[0].id;

    await client.query('COMMIT'); // Commit transaction

    // Return the new food with its default variant details
    return {
      ...newFood,
      default_variant: {
        id: newVariantId,
        serving_size: foodData.serving_size,
        serving_unit: foodData.serving_unit,
        calories: foodData.calories,
        protein: foodData.protein,
        carbs: foodData.carbs,
        fat: foodData.fat,
        saturated_fat: foodData.saturated_fat,
        polyunsaturated_fat: foodData.polyunsaturated_fat,
        monounsaturated_fat: foodData.monounsaturated_fat,
        trans_fat: foodData.trans_fat,
        cholesterol: foodData.cholesterol,
        sodium: foodData.sodium,
        potassium: foodData.potassium,
        dietary_fiber: foodData.dietary_fiber,
        sugars: foodData.sugars,
        vitamin_a: foodData.vitamin_a,
        vitamin_c: foodData.vitamin_c,
        calcium: foodData.calcium,
        iron: foodData.iron,
        is_default: true,
      }
    };
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback transaction on error
    throw error;
  } finally {
    client.release();
  }
}

async function getFoodById(foodId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        f.id, f.name, f.brand, f.is_custom, f.user_id, f.shared_with_public,
        json_build_object(
          'id', fv.id,
          'serving_size', fv.serving_size,
          'serving_unit', fv.serving_unit,
          'calories', fv.calories,
          'protein', fv.protein,
          'carbs', fv.carbs,
          'fat', fv.fat,
          'saturated_fat', fv.saturated_fat,
          'polyunsaturated_fat', fv.polyunsaturated_fat,
          'monounsaturated_fat', fv.monounsaturated_fat,
          'trans_fat', fv.trans_fat,
          'cholesterol', fv.cholesterol,
          'sodium', fv.sodium,
          'potassium', fv.potassium,
          'dietary_fiber', fv.dietary_fiber,
          'sugars', fv.sugars,
          'vitamin_a', fv.vitamin_a,
          'vitamin_c', fv.vitamin_c,
          'calcium', fv.calcium,
          'iron', fv.iron,
          'is_default', fv.is_default
        ) AS default_variant
      FROM foods f
      LEFT JOIN food_variants fv ON f.id = fv.food_id AND fv.is_default = TRUE
      WHERE f.id = $1`,
      [foodId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getFoodOwnerId(foodId) {
  const client = await pool.connect();
  try {
    const foodResult = await client.query(
      'SELECT user_id FROM foods WHERE id = $1',
      [foodId]
    );
    const ownerId = foodResult.rows[0]?.user_id;
    log('info', `getFoodOwnerId: Food ID ${foodId} owner: ${ownerId}`);
    return ownerId;
  } finally {
    client.release();
  }
}

async function updateFood(id, userId, foodData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE foods SET
        name = COALESCE($1, name),
        is_custom = COALESCE($2, is_custom),
        brand = COALESCE($3, brand),
        barcode = COALESCE($4, barcode),
        provider_external_id = COALESCE($5, provider_external_id),
        shared_with_public = COALESCE($6, shared_with_public),
        provider_type = COALESCE($7, provider_type),
        updated_at = now()
      WHERE id = $8 AND user_id = $9
      RETURNING *`,
      [
        foodData.name, foodData.is_custom, foodData.brand, foodData.barcode,
        foodData.provider_external_id, foodData.shared_with_public, foodData.provider_type, id, userId
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteFood(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function getFoodsWithPagination(searchTerm, foodFilter, authenticatedUserId, limit, offset, sortBy) {
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

    if (foodFilter === 'mine') {
      whereClauses.push(`user_id = $${paramIndex}`);
      queryParams.push(authenticatedUserId);
      paramIndex++;
    } else if (foodFilter === 'family') {
      whereClauses.push(`user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))`);
      queryParams.push(authenticatedUserId);
      paramIndex++;
    } else if (foodFilter === 'public') {
      whereClauses.push(`shared_with_public = TRUE`);
    } else if (foodFilter === 'all') {
      whereClauses.push(`(
        user_id IS NULL OR user_id = $${paramIndex} OR shared_with_public = TRUE OR
        user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))
      )`);
      queryParams.push(authenticatedUserId);
      paramIndex++;
    }

    let query = `
      SELECT
        f.id, f.name, f.brand, f.is_custom, f.user_id, f.shared_with_public,
        json_build_object(
          'id', fv.id,
          'serving_size', fv.serving_size,
          'serving_unit', fv.serving_unit,
          'calories', fv.calories,
          'protein', fv.protein,
          'carbs', fv.carbs,
          'fat', fv.fat,
          'saturated_fat', fv.saturated_fat,
          'polyunsaturated_fat', fv.polyunsaturated_fat,
          'monounsaturated_fat', fv.monounsaturated_fat,
          'trans_fat', fv.trans_fat,
          'cholesterol', fv.cholesterol,
          'sodium', fv.sodium,
          'potassium', fv.potassium,
          'dietary_fiber', fv.dietary_fiber,
          'sugars', fv.sugars,
          'vitamin_a', fv.vitamin_a,
          'vitamin_c', fv.vitamin_c,
          'calcium', fv.calcium,
          'iron', fv.iron,
          'is_default', fv.is_default
        ) AS default_variant
      FROM foods f
      LEFT JOIN food_variants fv ON f.id = fv.food_id AND fv.is_default = TRUE
      WHERE ${whereClauses.join(' AND ')}
    `;

    let orderByClause = 'name ASC';
    if (sortBy) {
      const [sortField, sortOrder] = sortBy.split(':');
      const allowedSortFields = ['name', 'calories', 'protein', 'carbs', 'fat'];
      const allowedSortOrders = ['asc', 'desc'];

      if (allowedSortFields.includes(sortField) && allowedSortOrders.includes(sortOrder)) {
        orderByClause = `${sortField} ${sortOrder.toUpperCase()}`;
      } else {
        log('warn', `Invalid sortBy parameter received: ${sortBy}. Using default sort.`);
      }
    }
    query += ` ORDER BY ${orderByClause}`;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const foodsResult = await client.query(query, queryParams);
    return foodsResult.rows;
  } finally {
    client.release();
  }
}

async function countFoods(searchTerm, foodFilter, authenticatedUserId) {
  const client = await pool.connect();
  try {
    let whereClauses = ['1=1'];
    const countQueryParams = [];
    let paramIndex = 1;

    if (searchTerm) {
      whereClauses.push(`name ILIKE $${paramIndex}`);
      countQueryParams.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (foodFilter === 'mine') {
      whereClauses.push(`user_id = $${paramIndex}`);
      countQueryParams.push(authenticatedUserId);
      paramIndex++;
    } else if (foodFilter === 'family') {
      whereClauses.push(`user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))`);
      countQueryParams.push(authenticatedUserId);
      paramIndex++;
    } else if (foodFilter === 'public') {
      whereClauses.push(`shared_with_public = TRUE`);
    } else if (foodFilter === 'all') {
      whereClauses.push(`(
        user_id IS NULL OR user_id = $${paramIndex} OR shared_with_public = TRUE OR
        user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))
      )`);
      countQueryParams.push(authenticatedUserId);
      paramIndex++;
    }

    const countQuery = `
      SELECT COUNT(*)
      FROM foods
      WHERE ${whereClauses.join(' AND ')}
    `;
    const countResult = await client.query(countQuery, countQueryParams);
    return parseInt(countResult.rows[0].count, 10);
  } finally {
    client.release();
  }
}

async function createFoodVariant(variantData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_variants (
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_default, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, now(), now()) RETURNING id`,
      [
        variantData.food_id, variantData.serving_size, variantData.serving_unit, variantData.calories, variantData.protein, variantData.carbs, variantData.fat,
        variantData.saturated_fat, variantData.polyunsaturated_fat, variantData.monounsaturated_fat, variantData.trans_fat,
        variantData.cholesterol, variantData.sodium, variantData.potassium, variantData.dietary_fiber, variantData.sugars,
        variantData.vitamin_a, variantData.vitamin_c, variantData.calcium, variantData.iron, variantData.is_default || false
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getFoodVariantById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM food_variants WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
async function getFoodVariantOwnerId(variantId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT f.user_id
       FROM food_variants fv
       JOIN foods f ON fv.food_id = f.id
       WHERE fv.id = $1`,
      [variantId]
    );
    const ownerId = result.rows[0]?.user_id;
    log('info', `getFoodVariantOwnerId: Variant ID ${variantId} owner: ${ownerId}`);
    return ownerId;
  } finally {
    client.release();
  }
}

async function getFoodVariantsByFoodId(foodId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM food_variants WHERE food_id = $1',
      [foodId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function updateFoodVariant(id, variantData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE food_variants SET
        food_id = COALESCE($1, food_id),
        serving_size = COALESCE($2, serving_size),
        serving_unit = COALESCE($3, serving_unit),
        calories = COALESCE($4, calories),
        protein = COALESCE($5, protein),
        carbs = COALESCE($6, carbs),
        fat = COALESCE($7, fat),
        saturated_fat = COALESCE($8, saturated_fat),
        polyunsaturated_fat = COALESCE($9, polyunsaturated_fat),
        monounsaturated_fat = COALESCE($10, monounsaturated_fat),
        trans_fat = COALESCE($11, trans_fat),
        cholesterol = COALESCE($12, cholesterol),
        sodium = COALESCE($13, sodium),
        potassium = COALESCE($14, potassium),
        dietary_fiber = COALESCE($15, dietary_fiber),
        sugars = COALESCE($16, sugars),
        vitamin_a = COALESCE($17, vitamin_a),
        vitamin_c = COALESCE($18, vitamin_c),
        calcium = COALESCE($19, calcium),
        iron = COALESCE($20, iron),
        is_default = COALESCE($21, is_default),
        updated_at = now()
      WHERE id = $22
      RETURNING *`,
      [
        variantData.food_id, variantData.serving_size, variantData.serving_unit, variantData.calories, variantData.protein, variantData.carbs, variantData.fat,
        variantData.saturated_fat, variantData.polyunsaturated_fat, variantData.monounsaturated_fat, variantData.trans_fat,
        variantData.cholesterol, variantData.sodium, variantData.potassium, variantData.dietary_fiber, variantData.sugars,
        variantData.vitamin_a, variantData.vitamin_c, variantData.calcium, variantData.iron, variantData.is_default, id
      ]
    );

    // If this variant is being set as default, ensure all other variants for this food_id are not default
    if (variantData.is_default) {
      await client.query(
        `UPDATE food_variants SET is_default = FALSE WHERE food_id = $1 AND id != $2`,
        [variantData.food_id, id]
      );
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteFoodVariant(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM food_variants WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function createFoodEntry(entryData) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `INSERT INTO food_entries (user_id, food_id, meal_type, quantity, unit, entry_date, variant_id, meal_plan_template_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [entryData.user_id, entryData.food_id, entryData.meal_type, entryData.quantity, entryData.unit, entryData.entry_date, entryData.variant_id, entryData.meal_plan_template_id]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}
 
async function getFoodEntryOwnerId(entryId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id FROM food_entries WHERE id = $1',
      [entryId]
    );
    return result.rows[0]?.user_id;
  } finally {
    client.release();
  }
}

async function deleteFoodEntry(entryId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM food_entries WHERE id = $1 RETURNING id',
      [entryId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}
async function updateFoodEntry(entryId, userId, entryData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE food_entries SET
        meal_type = COALESCE($1, meal_type),
        quantity = COALESCE($2, quantity),
        unit = COALESCE($3, unit),
        entry_date = COALESCE($4, entry_date),
        variant_id = COALESCE($5, variant_id)
      WHERE id = $6 AND user_id = $7
      RETURNING *`,
      [
        entryData.meal_type,
        entryData.quantity,
        entryData.unit,
        entryData.entry_date,
        entryData.variant_id,
        entryId,
        userId
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getFoodEntriesByDate(userId, selectedDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        fe.id, fe.food_id, fe.meal_type, fe.quantity, fe.unit, fe.variant_id, fe.entry_date, fe.meal_plan_template_id,
        json_build_object(
          'id', f.id,
          'name', f.name,
          'brand', f.brand,
          'is_custom', f.is_custom,
          'user_id', f.user_id,
          'shared_with_public', f.shared_with_public
        ) AS foods,
        json_build_object(
          'id', fv.id,
          'serving_size', fv.serving_size,
          'serving_unit', fv.serving_unit,
          'calories', fv.calories,
          'protein', fv.protein,
          'carbs', fv.carbs,
          'fat', fv.fat,
          'saturated_fat', fv.saturated_fat,
          'polyunsaturated_fat', fv.polyunsaturated_fat,
          'monounsaturated_fat', fv.monounsaturated_fat,
          'trans_fat', fv.trans_fat,
          'cholesterol', fv.cholesterol,
          'sodium', fv.sodium,
          'potassium', fv.potassium,
          'dietary_fiber', fv.dietary_fiber,
          'sugars', fv.sugars,
          'vitamin_a', fv.vitamin_a,
          'vitamin_c', fv.vitamin_c,
          'calcium', fv.calcium,
          'iron', fv.iron
        ) AS food_variants
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       JOIN food_variants fv ON fe.variant_id = fv.id
       WHERE fe.user_id = $1 AND fe.entry_date = $2`,
      [userId, selectedDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getFoodEntriesByDateRange(userId, startDate, endDate) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        fe.id, fe.food_id, fe.meal_type, fe.quantity, fe.unit, fe.variant_id, fe.entry_date, fe.meal_plan_template_id,
        f.name AS food_name, f.brand, f.is_custom, f.user_id, f.shared_with_public,
        fv.serving_size, fv.serving_unit, fv.calories, fv.protein, fv.carbs, fv.fat,
        fv.saturated_fat, fv.polyunsaturated_fat, fv.monounsaturated_fat, fv.trans_fat,
        fv.cholesterol, fv.sodium, fv.potassium, fv.dietary_fiber, fv.sugars,
        fv.vitamin_a, fv.vitamin_c, fv.calcium, fv.iron
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       JOIN food_variants fv ON fe.variant_id = fv.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       ORDER BY fe.entry_date`,
      [userId, startDate, endDate]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function findFoodByNameAndBrand(name, brand, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        f.id, f.name, f.brand, f.is_custom, f.user_id, f.shared_with_public,
        fv.serving_size, fv.serving_unit, fv.calories, fv.protein, fv.carbs, fv.fat,
        json_build_object(
          'id', fv.id,
          'serving_size', fv.serving_size,
          'serving_unit', fv.serving_unit,
          'calories', fv.calories,
          'protein', fv.protein,
          'carbs', fv.carbs,
          'fat', fv.fat,
          'saturated_fat', fv.saturated_fat,
          'polyunsaturated_fat', fv.polyunsaturated_fat,
          'monounsaturated_fat', fv.monounsaturated_fat,
          'trans_fat', fv.trans_fat,
          'cholesterol', fv.cholesterol,
          'sodium', fv.sodium,
          'potassium', fv.potassium,
          'dietary_fiber', fv.dietary_fiber,
          'sugars', fv.sugars,
          'vitamin_a', fv.vitamin_a,
          'vitamin_c', fv.vitamin_c,
          'calcium', fv.calcium,
          'iron', fv.iron,
          'is_default', fv.is_default
        ) AS default_variant
       FROM foods f
       LEFT JOIN food_variants fv ON f.id = fv.food_id AND fv.is_default = TRUE
       WHERE f.name ILIKE $1 AND (f.brand IS NULL OR f.brand ILIKE $2)
         AND (f.user_id = $3 OR f.is_custom = FALSE)`,
      [name, brand || null, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function bulkCreateFoodVariants(variantsData) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO food_variants (
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_default, created_at, updated_at
      ) VALUES %L RETURNING id`;

    const values = variantsData.map(variant => [
      variant.food_id, variant.serving_size, variant.serving_unit, variant.calories, variant.protein, variant.carbs, variant.fat,
      variant.saturated_fat, variant.polyunsaturated_fat, variant.monounsaturated_fat, variant.trans_fat,
      variant.cholesterol, variant.sodium, variant.potassium, variant.dietary_fiber, variant.sugars,
      variant.vitamin_a, variant.vitamin_c, variant.calcium, variant.iron, variant.is_default || false, 'now()', 'now()'
    ]);

    const formattedQuery = format(query, values);
    const result = await client.query(formattedQuery);
    return result.rows;
  } finally {
    client.release();
  }
}

async function deleteFoodEntriesByMealPlanId(mealPlanId, userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'DELETE FROM food_entries WHERE meal_plan_template_id = $1 AND user_id = $2 RETURNING id',
            [mealPlanId, userId]
        );
        return result.rowCount;
    } catch (error) {
        log('error', `Error deleting food entries for meal plan ${mealPlanId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function deleteFoodEntriesByTemplateId(templateId, userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `DELETE FROM food_entries WHERE meal_plan_template_id = $1 AND user_id = $2`,
            [templateId, userId]
        );
        return result.rowCount;
    } catch (error) {
        log('error', `Error deleting food entries for template ${templateId}:`, error);
        throw error;
    } finally {
        client.release();
    }
}

async function createFoodEntriesFromTemplate(templateId, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        log('info', `Creating food entries from template ${templateId} for user ${userId}`);

        const templateQuery = `
            SELECT
                t.start_date,
                t.end_date,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'day_of_week', a.day_of_week,
                                'meal_type', a.meal_type,
                                'meal_id', a.meal_id
                            )
                        )
                        FROM meal_plan_template_assignments a
                        WHERE a.template_id = t.id
                    ),
                    '[]'::json
                ) as assignments
            FROM meal_plan_templates t
            WHERE t.id = $1 AND t.user_id = $2
        `;
        const templateResult = await client.query(templateQuery, [templateId, userId]);
        if (templateResult.rows.length === 0) {
            throw new Error('Meal plan template not found or access denied.');
        }

        const { start_date, end_date, assignments } = templateResult.rows[0];
        if (!assignments || assignments.length === 0) {
            log('info', `No assignments for template ${templateId}, skipping food entry creation.`);
            await client.query('COMMIT');
            return;
        }

        let currentDate = new Date(start_date);
        const lastDate = new Date(end_date);

        while (currentDate <= lastDate) {
            const dayOfWeek = currentDate.getDay();
            const assignmentsForDay = assignments.filter(a => a.day_of_week === dayOfWeek);

            for (const assignment of assignmentsForDay) {
                const mealFoodsResult = await client.query(
                    `SELECT food_id, variant_id, quantity, unit FROM meal_foods WHERE meal_id = $1`,
                    [assignment.meal_id]
                );

                if (mealFoodsResult.rows.length > 0) {
                    const foodEntries = mealFoodsResult.rows.map(mf => ([
                        userId,
                        mf.food_id,
                        assignment.meal_type,
                        mf.quantity,
                        mf.unit,
                        currentDate,
                        mf.variant_id,
                        templateId
                    ]));

                    const insertQuery = format(
                        `INSERT INTO food_entries (user_id, food_id, meal_type, quantity, unit, entry_date, variant_id, meal_plan_template_id) VALUES %L`,
                        foodEntries
                    );
                    await client.query(insertQuery);
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        await client.query('COMMIT');
        log('info', `Successfully created food entries from template ${templateId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        log('error', `Error creating food entries from template ${templateId}: ${error.message}`, error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
  getFoodDataProviders,
  getFoodDataProvidersByUserId,
  createFoodDataProvider,
  updateFoodDataProvider,
  getFoodDataProviderById,
  checkFoodDataProviderOwnership,
  searchFoods,
  createFood,
  getFoodById,
  getFoodOwnerId,
  updateFood,
  deleteFood,
  getFoodsWithPagination,
  countFoods,
  createFoodVariant,
  getFoodVariantById,
  getFoodVariantOwnerId,
  getFoodVariantsByFoodId,
  updateFoodVariant,
  deleteFoodVariant,
  createFoodEntry,
  getFoodEntryOwnerId,
  updateFoodEntry,
  deleteFoodEntry,
  getFoodEntriesByDate,
  getFoodEntriesByDateRange,
  findFoodByNameAndBrand,
  bulkCreateFoodVariants,
  deleteFoodDataProvider,
  deleteFoodEntriesByTemplateId,
  createFoodEntriesFromTemplate,
};