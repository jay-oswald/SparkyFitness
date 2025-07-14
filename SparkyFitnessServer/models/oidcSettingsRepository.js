const pool = require('../db/connection');
const { encrypt, decrypt, ENCRYPTION_KEY } = require('../security/encryption');
const { log } = require('../config/logging');

async function getOidcSettings() {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                id, issuer_url, client_id,
                encrypted_client_secret, client_secret_iv, client_secret_tag,
                redirect_uris, scope, token_endpoint_auth_method, response_types, is_active,
                id_token_signed_response_alg, userinfo_signed_response_alg, request_timeout, auto_register
            FROM oidc_settings
            ORDER BY created_at DESC
            LIMIT 1`
        );
        const settings = result.rows[0];

        if (!settings) {
            return null;
        }

        let decryptedClientSecret = null;
        if (settings.encrypted_client_secret && settings.client_secret_iv && settings.client_secret_tag) {
            try {
                decryptedClientSecret = await decrypt(
                    settings.encrypted_client_secret,
                    settings.client_secret_iv,
                    settings.client_secret_tag,
                    ENCRYPTION_KEY
                );
            } catch (e) {
                log('error', 'Error decrypting OIDC client secret:', e);
            }
        }

        return {
            id: settings.id,
            issuer_url: settings.issuer_url,
            client_id: settings.client_id,
            client_secret: decryptedClientSecret,
            redirect_uris: settings.redirect_uris,
            scope: settings.scope,
            token_endpoint_auth_method: settings.token_endpoint_auth_method,
            response_types: settings.response_types,
            is_active: settings.is_active,
            id_token_signed_response_alg: settings.id_token_signed_response_alg,
            userinfo_signed_response_alg: settings.userinfo_signed_response_alg,
            request_timeout: settings.request_timeout,
            auto_register: settings.auto_register,
        };
    } finally {
        client.release();
    }
}

async function saveOidcSettings(settingsData) {
    const client = await pool.connect();
    try {
        // 1. Check for existing settings
        const existingSettingsResult = await client.query(
            `SELECT id, encrypted_client_secret, client_secret_iv, client_secret_tag
             FROM oidc_settings ORDER BY created_at DESC LIMIT 1`
        );
        const existingSettings = existingSettingsResult.rows[0];

        let encryptedClientSecret = null;
        let clientSecretIv = null;
        let clientSecretTag = null;

        // 2. Handle client_secret conditionally
        if (settingsData.client_secret && settingsData.client_secret !== '*****') {
            // Encrypt new secret if provided and it's not the placeholder
            log('info', 'OIDC client secret is being updated.');
            const encrypted = await encrypt(settingsData.client_secret, ENCRYPTION_KEY);
            encryptedClientSecret = encrypted.encryptedText;
            clientSecretIv = encrypted.iv;
            clientSecretTag = encrypted.tag;
        } else if (existingSettings) {
            log('info', 'OIDC client secret is being retained (not updated).');
            // Retain existing secret if no new one is provided or it's the placeholder
            encryptedClientSecret = existingSettings.encrypted_client_secret;
            clientSecretIv = existingSettings.client_secret_iv;
            clientSecretTag = existingSettings.client_secret_tag;
        } else {
            log('info', 'No OIDC client secret provided for new settings.');
        }

        if (existingSettings) {
            // 3. UPDATE existing settings
            const result = await client.query(
                `UPDATE oidc_settings SET
                    issuer_url = $1, client_id = $2,
                    encrypted_client_secret = $3, client_secret_iv = $4, client_secret_tag = $5,
                    redirect_uris = $6, scope = $7, token_endpoint_auth_method = $8, response_types = $9, is_active = $10,
                    id_token_signed_response_alg = $11, userinfo_signed_response_alg = $12, request_timeout = $13, auto_register = $14,
                    updated_at = NOW()
                WHERE id = $15
                RETURNING id`,
                [
                    settingsData.issuer_url,
                    settingsData.client_id,
                    encryptedClientSecret,
                    clientSecretIv,
                    clientSecretTag,
                    settingsData.redirect_uris,
                    settingsData.scope,
                    settingsData.token_endpoint_auth_method,
                    settingsData.response_types,
                    settingsData.is_active,
                    settingsData.id_token_signed_response_alg,
                    settingsData.userinfo_signed_response_alg,
                    settingsData.request_timeout,
                    settingsData.auto_register,
                    existingSettings.id // Use the ID of the existing record
                ]
            );
            return result.rows[0];
        } else {
            // 4. INSERT new settings
            const result = await client.query(
                `INSERT INTO oidc_settings (
                    issuer_url, client_id,
                    encrypted_client_secret, client_secret_iv, client_secret_tag,
                    redirect_uris, scope, token_endpoint_auth_method, response_types, is_active,
                    id_token_signed_response_alg, userinfo_signed_response_alg, request_timeout, auto_register
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id`,
                [
                    settingsData.issuer_url,
                    settingsData.client_id,
                    encryptedClientSecret,
                    clientSecretIv,
                    clientSecretTag,
                    settingsData.redirect_uris,
                    settingsData.scope,
                    settingsData.token_endpoint_auth_method,
                    settingsData.response_types,
                    settingsData.is_active,
                    settingsData.id_token_signed_response_alg,
                    settingsData.userinfo_signed_response_alg,
                    settingsData.request_timeout,
                    settingsData.auto_register,
                ]
            );
            return result.rows[0];
        }
    } finally {
        client.release();
    }
}

module.exports = {
    getOidcSettings,
    saveOidcSettings,
};