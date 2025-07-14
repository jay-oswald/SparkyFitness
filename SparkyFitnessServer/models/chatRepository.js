const pool = require('../db/connection');
const { encrypt, decrypt, ENCRYPTION_KEY } = require('../security/encryption');
const { log } = require('../config/logging');

async function upsertAiServiceSetting(settingData) {
  const client = await pool.connect();
  try {
    let encryptedApiKey = settingData.encrypted_api_key || null;
    let apiKeyIv = settingData.api_key_iv || null;
    let apiKeyTag = settingData.api_key_tag || null;

    if (settingData.api_key) {
      const { encryptedText, iv, tag } = await encrypt(settingData.api_key, ENCRYPTION_KEY);
      encryptedApiKey = encryptedText;
      apiKeyIv = iv;
      apiKeyTag = tag;
    }

    if (settingData.id) {
      // Update existing service
      const result = await client.query(
        `UPDATE ai_service_settings SET
          service_name = $1, service_type = $2, custom_url = $3,
          system_prompt = $4, is_active = $5, model_name = $6,
          encrypted_api_key = COALESCE($7, encrypted_api_key),
          api_key_iv = COALESCE($8, api_key_iv),
          api_key_tag = COALESCE($9, api_key_tag),
          updated_at = now()
        WHERE id = $10 AND user_id = $11 RETURNING *`,
        [
          settingData.service_name, settingData.service_type, settingData.custom_url,
          settingData.system_prompt, settingData.is_active, settingData.model_name,
          encryptedApiKey, apiKeyIv, apiKeyTag,
          settingData.id, settingData.user_id
        ]
      );
      return result.rows[0];
    } else {
      // Insert new service
      const result = await client.query(
        `INSERT INTO ai_service_settings (
          user_id, service_name, service_type, custom_url, system_prompt,
          is_active, model_name, encrypted_api_key, api_key_iv, api_key_tag, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) RETURNING *`,
        [
          settingData.user_id, settingData.service_name, settingData.service_type,
          settingData.custom_url, settingData.system_prompt, settingData.is_active,
          settingData.model_name, encryptedApiKey, apiKeyIv, apiKeyTag
        ]
      );
      return result.rows[0];
    }
  } finally {
    client.release();
  }
}

async function getAiServiceSettingById(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT encrypted_api_key, api_key_iv, api_key_tag, service_type, custom_url, model_name FROM ai_service_settings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    const setting = result.rows[0];
    if (!setting) return null;

    let decryptedApiKey = null;
    if (setting.encrypted_api_key && setting.api_key_iv && setting.api_key_tag) {
      try {
        decryptedApiKey = await decrypt(setting.encrypted_api_key, setting.api_key_iv, setting.api_key_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting API key for AI service setting:', id, e);
      }
    }
    return { ...setting, api_key: decryptedApiKey };
  } finally {
    client.release();
  }
}

async function deleteAiServiceSetting(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM ai_service_settings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function getAiServiceSettingsByUserId(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getActiveAiServiceSetting(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const setting = result.rows[0];
    if (!setting) return null;

    let decryptedApiKey = null;
    if (setting.encrypted_api_key && setting.api_key_iv && setting.api_key_tag) {
      try {
        decryptedApiKey = await decrypt(setting.encrypted_api_key, setting.api_key_iv, setting.api_key_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting API key for active AI service setting:', setting.id, e);
      }
    }
    return { ...setting, api_key: decryptedApiKey };
  } finally {
    client.release();
  }
}

async function clearOldChatHistory(userId) {
  const client = await pool.connect();
  try {
    await client.query(`
      DELETE FROM sparky_chat_history
      WHERE user_id = $1
      AND created_at < NOW() - INTERVAL '7 days'
    `, [userId]);
    return true;
  } finally {
    client.release();
  }
}

async function getChatHistoryByUserId(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT content, message_type, created_at FROM sparky_chat_history WHERE user_id = $1 ORDER BY created_at ASC LIMIT 5',
      [userId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

async function getChatHistoryEntryById(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM sparky_chat_history WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function getChatHistoryEntryOwnerId(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT user_id FROM sparky_chat_history WHERE id = $1',
      [id]
    );
    return result.rows[0]?.user_id;
  } finally {
    client.release();
  }
}

async function updateChatHistoryEntry(id, userId, updateData) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE sparky_chat_history SET
        content = COALESCE($1, content),
        message_type = COALESCE($2, message_type),
        metadata = COALESCE($3, metadata),
        session_id = COALESCE($4, session_id),
        message = COALESCE($5, message),
        response = COALESCE($6, response),
        updated_at = now()
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
      [updateData.content, updateData.message_type, updateData.metadata, updateData.session_id, updateData.message, updateData.response, id, userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function deleteChatHistoryEntry(id, userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM sparky_chat_history WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

async function clearAllChatHistory(userId) {
  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM sparky_chat_history WHERE user_id = $1',
      [userId]
    );
    return true;
  } finally {
    client.release();
  }
}

async function saveChatHistory(historyData) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO sparky_chat_history (user_id, content, message_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [historyData.user_id, historyData.content, historyData.messageType, historyData.metadata]
    );
    return true;
  } finally {
    client.release();
  }
}

module.exports = {
  upsertAiServiceSetting,
  getAiServiceSettingById,
  deleteAiServiceSetting,
  getAiServiceSettingsByUserId,
  getActiveAiServiceSetting,
  clearOldChatHistory,
  getChatHistoryByUserId,
  getChatHistoryEntryById,
  getChatHistoryEntryOwnerId,
  updateChatHistoryEntry,
  deleteChatHistoryEntry,
  clearAllChatHistory,
  saveChatHistory,
};