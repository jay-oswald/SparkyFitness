const express = require('express');
const router = express.Router();
const oidcSettingsRepository = require('../models/oidcSettingsRepository');
const { log } = require('../config/logging');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const { initializeOidcClient } = require('../openidRoutes'); // Import the OIDC client initializer

// GET OIDC Settings (Admin Only)
router.get('/', isAdmin, async (req, res) => {
    try {
        const settings = await oidcSettingsRepository.getOidcSettings();
        // Do not send encrypted client secret to frontend
        if (settings) {
            const { client_secret, ...safeSettings } = settings;
            res.json(safeSettings);
        } else {
            res.json(null); // No settings found
        }
    } catch (error) {
        log('error', `Error getting OIDC settings: ${error.message}`);
        res.status(500).json({ message: 'Error retrieving OIDC settings' });
    }
});

// PUT/Update OIDC Settings (Admin Only)
router.put('/', isAdmin, async (req, res) => {
    try {
        const settingsData = req.body;
        if (!settingsData.issuer_url || !settingsData.client_id || !settingsData.redirect_uris || !settingsData.scope) {
            log('warn', 'Missing required OIDC settings fields in update request.');
            return res.status(400).json({ message: 'Missing required OIDC settings fields.' });
        }

        // Save new settings (this will create a new record as per repository design)
        const newSettings = await oidcSettingsRepository.saveOidcSettings(settingsData);
        log('info', 'OIDC settings updated successfully. Re-initializing OIDC client...');
        
        // Re-initialize the OIDC client with the new settings
        await initializeOidcClient();

        res.status(200).json({ message: 'OIDC settings updated and client re-initialized successfully', id: newSettings.id });
    } catch (error) {
        log('error', `Error updating OIDC settings: ${error.message}`);
        res.status(500).json({ message: 'Error updating OIDC settings' });
    }
});

module.exports = router;