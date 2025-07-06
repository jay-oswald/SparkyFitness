const pool = require('../db/connection');

async function checkFamilyAccessPermission(familyUserId, ownerUserId, permission) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 1
       FROM family_access
       WHERE family_user_id = $1
         AND owner_user_id = $2
         AND is_active = TRUE
         AND (access_end_date IS NULL OR access_end_date > NOW())
         AND (access_permissions->>$3)::boolean = TRUE`,
      [familyUserId, ownerUserId, permission]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function getFamilyAccessEntriesByOwner(ownerUserId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fa.id, fa.owner_user_id, fa.family_user_id, fa.family_email, fa.access_permissions,
              fa.access_start_date, fa.access_end_date, fa.is_active, fa.status,
              p_owner.full_name AS owner_full_name, p_family.full_name AS family_full_name
       FROM family_access fa
       LEFT JOIN profiles p_owner ON fa.owner_user_id = p_owner.id
       LEFT JOIN auth.users au ON au.id = fa.owner_user_id
       LEFT JOIN profiles p_family ON fa.family_user_id = p_family.id
       WHERE fa.owner_user_id = $1
       ORDER BY fa.created_at DESC`,
      [ownerUserId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getFamilyAccessEntriesByUserId(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fa.id, fa.owner_user_id, fa.family_user_id, fa.family_email, fa.access_permissions,
              fa.access_start_date, fa.access_end_date, fa.is_active, fa.status,
              p_owner.full_name AS owner_full_name, p_family.full_name AS family_full_name
       FROM family_access fa
       LEFT JOIN profiles p_owner ON fa.owner_user_id = p_owner.id
       LEFT JOIN auth.users au ON au.id = fa.owner_user_id
       LEFT JOIN profiles p_family ON fa.family_user_id = p_family.id
       WHERE fa.owner_user_id = $1 OR fa.family_user_id = $1
       ORDER BY fa.created_at DESC`,
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function createFamilyAccessEntry(ownerUserId, familyUserId, familyEmail, accessPermissions, accessEndDate, status) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO family_access (owner_user_id, family_user_id, family_email, access_permissions, access_end_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'pending'), now(), now()) RETURNING *`,
      [ownerUserId, familyUserId, familyEmail, accessPermissions, accessEndDate, status]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function updateFamilyAccessEntry(id, ownerUserId, accessPermissions, accessEndDate, isActive, status) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE family_access SET
        access_permissions = COALESCE($1, access_permissions),
        access_end_date = COALESCE($2, access_end_date),
        is_active = COALESCE($3, is_active),
        status = COALESCE($4, status),
        updated_at = now()
      WHERE id = $5 AND owner_user_id = $6
      RETURNING *`,
      [accessPermissions, accessEndDate, isActive, status, id, ownerUserId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteFamilyAccessEntry(id, ownerUserId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM family_access WHERE id = $1 AND owner_user_id = $2 RETURNING id',
      [id, ownerUserId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

module.exports = {
  checkFamilyAccessPermission,
  getFamilyAccessEntriesByOwner,
  getFamilyAccessEntriesByUserId,
  createFamilyAccessEntry,
  updateFamilyAccessEntry,
  deleteFamilyAccessEntry,
};