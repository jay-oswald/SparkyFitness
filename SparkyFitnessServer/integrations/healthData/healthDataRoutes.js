const express = require('express');
const router = express.Router();
const pool = require('../../db/connection'); // Keep pool for API key validation
const { log } = require('../../config/logging');
const measurementService = require('../../services/measurementService'); // Import the new service

// Middleware to authenticate API key for health data submission
router.use('/', async (req, res, next) => {
  const apiKey = req.headers['authorization']?.split(' ')[1] || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: "Unauthorized: Missing API Key" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT user_id, permissions FROM user_api_keys WHERE api_key = $1 AND is_active = TRUE',
      [apiKey]
    );
    client.release();

    const data = result.rows[0];

    if (!data) {
      log('error', "API Key validation error: No data found for API key.");
      return res.status(401).json({ error: "Unauthorized: Invalid or inactive API Key" });
    }

    if (!data.permissions || !data.permissions.health_data_write) {
      return res.status(403).json({ error: "Forbidden: API Key does not have health_data_write permission" });
    }

    req.userId = data.user_id;
    req.permissions = data.permissions;
    next();
  } catch (error) {
    log('error', "Error during API Key authentication:", error);
    res.status(500).json({ error: "Internal server error during authentication." });
  }
});

// Endpoint for receiving health data
router.post('/', express.text({ type: '*/*' }), async (req, res, next) => {
  const rawBody = req.body;
  let healthDataArray = [];

  if (rawBody.startsWith('[') && rawBody.endsWith(']')) {
    try {
      healthDataArray = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON array format." });
    }
  } else if (rawBody.includes('}{')) {
    const jsonStrings = rawBody.split('}{').map((part, index, arr) => {
      if (index === 0) return part + '}';
      if (index === arr.length - 1) return '{' + part;
      return '{' + part + '}';
    });
    for (const jsonStr of jsonStrings) {
      try {
        healthDataArray.push(JSON.parse(jsonStr));
      } catch (parseError) {
        log('error', "Error parsing individual concatenated JSON string:", jsonStr, parseError);
      }
    }
  } else {
    try {
      healthDataArray.push(JSON.parse(rawBody));
    } catch (e) {
      return res.status(400).json({ error: "Invalid single JSON format." });
    }
  }

  try {
    const result = await measurementService.processHealthData(healthDataArray, req.userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('{') && error.message.endsWith('}')) {
      const parsedError = JSON.parse(error.message);
      return res.status(400).json(parsedError);
    }
    next(error);
  }
});

module.exports = router;