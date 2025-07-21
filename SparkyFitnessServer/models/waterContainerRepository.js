const pool = require('../db/connection');

async function createWaterContainer(userId, containerData) {
  const { name, volume, unit, is_primary } = containerData;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_water_containers (user_id, name, volume, unit, is_primary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, name, volume, unit, is_primary]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getWaterContainersByUserId(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_water_containers WHERE user_id = $1 ORDER BY created_at',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function updateWaterContainer(id, userId, updateData) {
  const { name, volume, unit, is_primary } = updateData;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE user_water_containers SET
        name = COALESCE($1, name),
        volume = COALESCE($2, volume),
        unit = COALESCE($3, unit),
        is_primary = COALESCE($4, is_primary),
        updated_at = now()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, volume, unit, is_primary, id, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteWaterContainer(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM user_water_containers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function setPrimaryWaterContainer(id, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // First, set all containers for this user to not be primary
        await client.query(
            'UPDATE user_water_containers SET is_primary = false WHERE user_id = $1',
            [userId]
        );
        // Then, set the specified container to be primary
        const result = await client.query(
            'UPDATE user_water_containers SET is_primary = true, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
  createWaterContainer,
  getWaterContainersByUserId,
  updateWaterContainer,
  deleteWaterContainer,
  setPrimaryWaterContainer,
};