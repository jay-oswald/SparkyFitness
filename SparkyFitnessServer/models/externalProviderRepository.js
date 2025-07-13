const pool = require('../db/connection');
const { encrypt, decrypt, ENCRYPTION_KEY } = require('../security/encryption');
const { log } = require('../config/logging');

async function getExternalDataProviders(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, provider_name, provider_type, is_active FROM external_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    log('debug', `getExternalDataProviders: Raw query results for user ${userId}:`, result.rows);
    return result.rows;
  } finally {
    client.release();
  }
}

async function getExternalDataProvidersByUserId(targetUserId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, provider_name, provider_type, encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag, is_active FROM external_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
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

async function createExternalDataProvider(providerData) {
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
      `INSERT INTO external_data_providers (
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

async function updateExternalDataProvider(id, userId, updateData) {
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
      `UPDATE external_data_providers SET
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

async function getExternalDataProviderById(providerId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag FROM external_data_providers WHERE id = $1',
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

async function checkExternalDataProviderOwnership(providerId, userId) {
  const client = await pool.connect();
  try {
    const checkOwnership = await client.query(
      'SELECT 1 FROM external_data_providers WHERE id = $1 AND user_id = $2',
      [providerId, userId]
    );
    return checkOwnership.rowCount > 0;
  } finally {
    client.release();
  }
}
 
async function deleteExternalDataProvider(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM external_data_providers WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

module.exports = {
  getExternalDataProviders,
  getExternalDataProvidersByUserId,
  createExternalDataProvider,
  updateExternalDataProvider,
  getExternalDataProviderById,
  checkExternalDataProviderOwnership,
  deleteExternalDataProvider,
};