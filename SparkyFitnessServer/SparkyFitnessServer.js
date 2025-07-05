const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from root directory

const express = require('express');

// Debugging: Log when the process is about to exit

const cors = require('cors'); // Import cors
const { Pool } = require('pg'); // Import pg Pool
const bcrypt = require('bcrypt'); // Import bcrypt
const { v4: uuidv4 } = require('uuid'); // Import uuid
const crypto = require('crypto'); // Import crypto
const { format } = require('date-fns'); // Import date-fns for date formatting

// Migration setup
const migrationsDir = path.join(__dirname, './db/migrations'); // Updated path

// Define logging levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

// Get desired log level from environment variable, default to INFO
const currentLogLevel = LOG_LEVELS[process.env.SPARKY_FITNESS_LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

// Custom logger function
function log(level, message, ...args) {
  if (LOG_LEVELS[level.toUpperCase()] >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    switch (level.toUpperCase()) {
      case 'DEBUG':
        console.debug(`[${timestamp}] [DEBUG] ${message}`, ...args);
        break;
      case 'INFO':
        console.info(`[${timestamp}] [INFO] ${message}`, ...args);
        break;
      case 'WARN':
        console.warn(`[${timestamp}] [WARN] ${message}`, ...args);
        break;
      case 'ERROR':
        console.error(`[${timestamp}] [ERROR] ${message}`, ...args);
        break;
      default:
        console.log(`[${timestamp}] [UNKNOWN] ${message}`, ...args);
    }
  }
}

const app = express();
const PORT = process.env.SPARKY_FITNESS_SERVER_PORT || 3010;

// Initialize PostgreSQL client globally
const pool = new Pool({
  user: process.env.SPARKY_FITNESS_DB_USER,
  host: process.env.SPARKY_FITNESS_DB_HOST,
  database: process.env.SPARKY_FITNESS_DB_NAME,
  password: process.env.SPARKY_FITNESS_DB_PASSWORD,
  port: process.env.SPARKY_FITNESS_DB_PORT,
});

pool.on('error', (err, client) => {
  log('error', 'Unexpected error on idle client', err);
  process.exit(-1);
});

// Use cors middleware to allow requests from your frontend
app.use(cors({
  origin: 'http://localhost:8080', // Allow requests from your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow common methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-id', 'x-api-key'], // Explicitly allow headers, including custom ones
}));

// Middleware to parse JSON bodies for all incoming requests
app.use(express.json());

const FATSECRET_OAUTH_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FATSECRET_API_BASE_URL = "https://platform.fatsecret.com/rest";

// Encryption key from environment variables
const ENCRYPTION_KEY = process.env.SPARKY_FITNESS_API_ENCRYPTION_KEY;
console.log('DEBUG: ENCRYPTION_KEY value:', ENCRYPTION_KEY ? 'Set' : 'Not Set');

if (!ENCRYPTION_KEY) {
  log('error', 'SPARKY_FITNESS_API_ENCRYPTION_KEY is not set in environment variables.');
  process.exit(1);
}

// Utility functions for encryption and decryption
async function encrypt(text, key) {
  const iv = crypto.randomBytes(12); // GCM recommended IV size is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return { encryptedText: encrypted, iv: iv.toString('base64'), tag: tag };
}

async function decrypt(encryptedText, ivString, tagString, key) {
  const iv = Buffer.from(ivString, 'base64');
  const tag = Buffer.from(tagString, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

let fatSecretAccessToken = null;
let tokenExpiryTime = 0;

// In-memory cache for FatSecret food nutrient data
const foodNutrientCache = new Map();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Function to get FatSecret OAuth 2.0 Access Token
async function getFatSecretAccessToken(clientId, clientSecret) {
  if (fatSecretAccessToken && Date.now() < tokenExpiryTime) {
    return fatSecretAccessToken;
  }

  try {
    log('info', `Attempting to get FatSecret Access Token from: ${FATSECRET_OAUTH_TOKEN_URL}`);
    log('debug', `Using Client ID: ${clientId}, Client Secret: ${clientSecret ? '********' : 'N/A'}`); // Mask secret
    const response = await fetch(FATSECRET_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "basic",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      log('error', "FatSecret OAuth Token API error:", errorData);
      throw new Error(`FatSecret authentication failed: ${errorData.error_description || response.statusText}`);
    }

    const data = await response.json();
    fatSecretAccessToken = data.access_token;
    tokenExpiryTime = Date.now() + (data.expires_in * 1000) - 60000; // Store token and set expiry 1 minute early

    return fatSecretAccessToken;
  } catch (error) {
    log('error', "Network error during FatSecret OAuth token acquisition:", error);
    throw new Error("Network error during FatSecret authentication. Please try again.");
  }
}

// Middleware to get FatSecret API keys from Supabase
app.use('/api/fatsecret', async (req, res, next) => {
  const providerId = req.headers['x-provider-id']; // Get providerId from custom header

  if (!providerId) {
    return res.status(400).json({ error: "Missing x-provider-id header" });
  }

  // Fetch API keys from Supabase based on providerId
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag FROM food_data_providers WHERE id = $1',
      [providerId]
    );
    client.release();

    const data = result.rows[0];

    if (!data?.encrypted_app_id || !data?.app_id_iv || !data?.app_id_tag || !data?.encrypted_app_key || !data?.app_key_iv || !data?.app_key_tag) {
      log('error', "Missing encrypted FatSecret API keys or IV/Tag for providerId:", providerId);
      return res.status(500).json({ error: "Failed to retrieve encrypted FatSecret API keys from database. Please check provider configuration." });
    }

    let decryptedAppId;
    let decryptedAppKey;
    try {
      decryptedAppId = await decrypt(data.encrypted_app_id, data.app_id_iv, data.app_id_tag, ENCRYPTION_KEY);
      decryptedAppKey = await decrypt(data.encrypted_app_key, data.app_key_iv, data.app_key_tag, ENCRYPTION_KEY);
    } catch (e) {
      log('error', 'Error during decryption of FatSecret API keys:', e);
      return res.status(500).json({ error: 'Decryption of FatSecret API keys failed.' });
    }
  } catch (error) {
    log('error', "Error fetching FatSecret API keys from PostgreSQL:", error);
    return res.status(500).json({ error: "Database error while fetching FatSecret API keys." });
  }

  req.clientId = decryptedAppId;
  req.clientSecret = decryptedAppKey;
  next();
});

// New endpoint to fetch food data provider details
app.get('/api/food-data-providers', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, provider_name, provider_type FROM food_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    client.release();

    res.status(200).json(result.rows || []); // Return empty array if no providers found
  } catch (error) {
    log('error', "Error fetching food data providers from PostgreSQL:", error);
    res.status(500).json({ error: "Internal server error while fetching food data providers." });
  }
});

// New endpoint to fetch food data providers by user ID (path parameter)
app.get('/api/food-data-providers/user/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  let client; // Declare client outside try block
  try {
    client = await pool.connect(); // Assign client here
    const result = await client.query(
      'SELECT id, provider_name, provider_type, encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag, is_active FROM food_data_providers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
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
    res.status(200).json(providers || []); // Return empty array if no providers found
  } catch (error) {
    log('error', "Error fetching food data providers by user ID from PostgreSQL:", error);
    res.status(500).json({ error: "Internal server error while fetching food data providers." });
  } finally {
    if (client) { // Check if client is defined before releasing
      client.release();
    }
  }
});

// New endpoint to create a food data provider
app.post('/api/food-data-providers', async (req, res) => {
  const { provider_name, provider_type, app_id, app_key, user_id, is_active } = req.body;

  if (!provider_name || !provider_type || !user_id) {
    return res.status(400).json({ error: 'Provider name, type, and user ID are required.' });
  }

  let encryptedAppId = null;
  let appIdIv = null;
  let appIdTag = null;
  let encryptedAppKey = null;
  let appKeyIv = null;
  let appKeyTag = null;

  if (app_id) {
    try {
      const encryptedId = await encrypt(app_id, ENCRYPTION_KEY);
      encryptedAppId = encryptedId.encryptedText;
      appIdIv = encryptedId.iv;
      appIdTag = encryptedId.tag;
    } catch (e) {
      log('error', 'Error during encryption of app_id:', e);
      return res.status(500).json({ error: 'Encryption failed for app_id.' });
    }
  }
  if (app_key) {
    try {
      const encryptedKey = await encrypt(app_key, ENCRYPTION_KEY);
      encryptedAppKey = encryptedKey.encryptedText;
      appKeyIv = encryptedKey.iv;
      appKeyTag = encryptedKey.tag;
    } catch (e) {
      log('error', 'Error during encryption of app_key:', e);
      return res.status(500).json({ error: 'Encryption failed for app_key.' });
    }
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_data_providers (
        provider_name, provider_type, user_id, is_active,
        encrypted_app_id, app_id_iv, app_id_tag,
        encrypted_app_key, app_key_iv, app_key_tag,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) RETURNING id`,
      [
        provider_name, provider_type, user_id, is_active,
        encryptedAppId, appIdIv, appIdTag,
        encryptedAppKey, appKeyIv, appKeyTag
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating food data provider:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// New endpoint to update a food data provider
app.put('/api/food-data-providers/:id', async (req, res) => {
  const { id } = req.params;
  const { provider_name, provider_type, app_id, app_key, user_id, is_active } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Provider ID and User ID are required.' });
  }

  let encryptedAppId = null;
  let appIdIv = null;
  let appIdTag = null;
  let encryptedAppKey = null;
  let appKeyIv = null;
  let appKeyTag = null;

  if (app_id !== undefined) { // Only encrypt if app_id is explicitly provided
    try {
      const encryptedId = await encrypt(app_id, ENCRYPTION_KEY);
      encryptedAppId = encryptedId.encryptedText;
      appIdIv = encryptedId.iv;
      appIdTag = encryptedId.tag;
    } catch (e) {
      log('error', 'Error during encryption of app_id during update:', e);
      return res.status(500).json({ error: 'Encryption failed for app_id.' });
    }
  }
  if (app_key !== undefined) { // Only encrypt if app_key is explicitly provided
    try {
      const encryptedKey = await encrypt(app_key, ENCRYPTION_KEY);
      encryptedAppKey = encryptedKey.encryptedText;
      appKeyIv = encryptedKey.iv;
      appKeyTag = encryptedKey.tag;
    } catch (e) {
      log('error', 'Error during encryption of app_key during update:', e);
      return res.status(500).json({ error: 'Encryption failed for app_key.' });
    }
  }

  const client = await pool.connect();
  try {
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
        provider_name, provider_type, is_active,
        encryptedAppId, appIdIv, appIdTag,
        encryptedAppKey, appKeyIv, appKeyTag,
        id, user_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Food data provider not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating food data provider:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/food-data-providers/:id', async (req, res) => {
  const providerId = req.params.id;

  if (!providerId) {
    return res.status(400).json({ error: "Missing provider ID" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT encrypted_app_id, app_id_iv, app_id_tag, encrypted_app_key, app_key_iv, app_key_tag FROM food_data_providers WHERE id = $1',
      [providerId]
    );
    client.release();

    const data = result.rows[0];

    if (!data) {
      log('info', "No food data provider found for ID:", providerId);
      return res.status(200).json({}); // Return empty object if not found
    }

    let decryptedAppId = null;
    let decryptedAppKey = null;

    if (data.encrypted_app_id && data.app_id_iv && data.app_id_tag) {
      try {
        decryptedAppId = await decrypt(data.encrypted_app_id, data.app_id_iv, data.app_id_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting app_id for provider:', providerId, e);
        // Continue without app_id if decryption fails, or handle as an error
      }
    }
    if (data.encrypted_app_key && data.app_key_iv && data.app_key_tag) {
      try {
        decryptedAppKey = await decrypt(data.encrypted_app_key, data.app_key_iv, data.app_key_tag, ENCRYPTION_KEY);
      } catch (e) {
        log('error', 'Error decrypting app_key for provider:', providerId, e);
        // Continue without app_key if decryption fails, or handle as an error
      }
    }

    res.status(200).json({
      app_id: decryptedAppId,
      app_key: decryptedAppKey
    });
  } catch (error) {
    log('error', "Error fetching food data provider from PostgreSQL:", error);
    res.status(500).json({ error: "Internal server error while fetching food data provider." });
  }
});


// Proxy route for FatSecret food search
app.get('/api/fatsecret/search', async (req, res) => {
  const { query } = req.query;
  const { clientId, clientSecret } = req;

  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const accessToken = await getFatSecretAccessToken(clientId, clientSecret);
    const searchUrl = `${FATSECRET_API_BASE_URL}?${new URLSearchParams({
      method: "foods.search",
      search_expression: query,
      format: "json",
    }).toString()}`;
    log('info', `FatSecret Search URL: ${searchUrl}`);
    log('debug', `Using Access Token: ${accessToken ? '********' : 'N/A'}`); // Mask token
    const response = await fetch(
      searchUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json", // Keep this for now, as it was in their example
          "Accept": "application/json", // Add Accept header
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text(); // Get raw response text
      log('error', "FatSecret Food Search API error:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        return res.status(response.status).json({ error: errorData.message || response.statusText });
      } catch (jsonError) {
        // If it's not JSON, return the raw text as an error
        return res.status(response.status).json({ error: `FatSecret API returned non-JSON error: ${errorText}` });
      }
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    log('error', "Error in FatSecret search proxy:", error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy route for FatSecret nutrient lookup
app.get('/api/fatsecret/nutrients', async (req, res) => {
  const { foodId } = req.query;
  const { clientId, clientSecret } = req;

  if (!foodId) {
    return res.status(400).json({ error: "Missing foodId" });
  }

  // Check cache first
  const cachedData = foodNutrientCache.get(foodId);
  if (cachedData && Date.now() < cachedData.expiry) {
    log('info', `Returning cached data for foodId: ${foodId}`);
    return res.json(cachedData.data);
  }

  try {
    const accessToken = await getFatSecretAccessToken(clientId, clientSecret);
    const nutrientsUrl = `${FATSECRET_API_BASE_URL}?${new URLSearchParams({
      method: "food.get.v4",
      food_id: foodId,
      format: "json",
    }).toString()}`;
    log('info', `FatSecret Nutrients URL: ${nutrientsUrl}`);
    log('debug', `Using Access Token: ${accessToken ? '********' : 'N/A'}`); // Mask token
    const response = await fetch(
      nutrientsUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log('error', "FatSecret Food Get API error:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        return res.status(response.status).json({ error: errorData.message || response.statusText });
      } catch (jsonError) {
        return res.status(response.status).json({ error: `FatSecret API returned non-JSON error: ${errorText}` });
      }
    }

    const data = await response.json();
    // Store in cache
    foodNutrientCache.set(foodId, {
      data: data,
      expiry: Date.now() + CACHE_DURATION_MS
    });
    res.json(data);
  } catch (error) {
    log('error', "Error in FatSecret nutrient proxy:", error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware to authenticate API key for health data submission
app.use('/api/health-data', async (req, res, next) => {
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

// Helper function to upsert step data
async function upsertStepData(userId, value, date) {
  log('info', "Processing step data for user:", userId, "date:", date, "value:", value);

  // First, try to find an existing record for the user and date
  const client = await pool.connect();
  let existingRecord = null;
  try {
    const result = await client.query(
      'SELECT * FROM check_in_measurements WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    existingRecord = result.rows[0];
  } catch (error) {
    log('error', "Error checking for existing step data:", error);
    throw new Error(`Failed to check existing step data: ${error.message}`);
  } finally {
    client.release();
  }

  let result;
  if (existingRecord) {
    // If record exists, update only the steps field
    log('info', "Existing record found, updating steps.");
    const updateClient = await pool.connect();
    try {
      const result = await updateClient.query(
        'UPDATE check_in_measurements SET steps = $1, updated_at = $2 WHERE user_id = $3 AND entry_date = $4 RETURNING *',
        [value, new Date().toISOString(), userId, date]
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error updating step data:", error);
      throw new Error(`Failed to update step data: ${error.message}`);
    } finally {
      updateClient.release();
    }

    if (error) {
      log('error', "Error updating step data:", error);
      throw new Error(`Failed to update step data: ${error.message}`);
    }
    result = data;
  } else {
    // If no record exists, insert a new one
    log('info', "No existing record found, inserting new step data.");
    const insertClient = await pool.connect();
    try {
      const result = await insertClient.query(
        'INSERT INTO check_in_measurements (user_id, entry_date, steps, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, date, value, new Date().toISOString()]
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error inserting step data:", error);
      throw new Error(`Failed to insert step data: ${error.message}`);
    } finally {
      insertClient.release();
    }

    if (error) {
      log('error', "Error inserting step data:", error);
      throw new Error(`Failed to insert step data: ${error.message}`);
    }
    result = data;
  }
  return result;

  if (error) {
    log('error', "Error upserting step data:", error);
    throw new Error(`Failed to save step data: ${error.message}`);
  }
  return data;
}

// Helper function to upsert water data
async function upsertWaterData(userId, value, date) {
  log('info', "Processing water data for user:", userId, "date:", date, "value:", value);

  const client = await pool.connect();
  let existingRecord = null;
  try {
    const result = await client.query(
      'SELECT * FROM water_intake WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    existingRecord = result.rows[0];
  } catch (error) {
    log('error', "Error checking for existing water data:", error);
    throw new Error(`Failed to check existing water data: ${error.message}`);
  } finally {
    client.release();
  }

  let result;
  if (existingRecord) {
    log('info', "Existing record found, updating water intake.");
    const updateClient = await pool.connect();
    try {
      const result = await updateClient.query(
        'UPDATE water_intake SET glasses_consumed = $1, updated_at = $2 WHERE user_id = $3 AND entry_date = $4 RETURNING *',
        [value, new Date().toISOString(), userId, date]
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error updating water data:", error);
      throw new Error(`Failed to update water data: ${error.message}`);
    } finally {
      updateClient.release();
    }

    if (error) {
      log('error', "Error updating water data:", error);
      throw new Error(`Failed to update water data: ${error.message}`);
    }
    result = data;
  } else {
    log('info', "No existing record found, inserting new water data.");
    const insertClient = await pool.connect();
    try {
      const result = await insertClient.query(
        'INSERT INTO water_intake (user_id, entry_date, glasses_consumed, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, date, value, new Date().toISOString()]
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error inserting water data:", error);
      throw new Error(`Failed to insert water data: ${error.message}`);
    } finally {
      insertClient.release();
    }

    if (error) {
      log('error', "Error inserting water data:", error);
      throw new Error(`Failed to insert water data: ${error.message}`);
    }
    result = data;
  }
  return result;

  if (error) {
    log('error', "Error upserting water data:", error);
    throw new Error(`Failed to save water data: ${error.message}`);
  }
  return data;
}

// Endpoint to fetch water intake for a specific user and date
app.get('/api/water-intake/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT glasses_consumed FROM water_intake WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    const waterData = result.rows[0];

    if (!waterData) {
      return res.status(200).json({ glasses_consumed: 0 }); // Return 0 if no entry found
    }

    res.status(200).json(waterData);
  } catch (error) {
    log('error', 'Error fetching water intake:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to upsert water intake
app.post('/api/water-intake', async (req, res) => {
  const { user_id, entry_date, glasses_consumed } = req.body;

  if (!user_id || !entry_date || glasses_consumed === undefined) {
    return res.status(400).json({ error: 'User ID, entry date, and glasses consumed are required.' });
  }

  try {
    const result = await upsertWaterData(user_id, glasses_consumed, entry_date);
    res.status(200).json(result);
  } catch (error) {
    log('error', 'Error upserting water intake:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch water intake by ID
app.get('/api/water-intake/entry/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Water Intake Entry ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM water_intake WHERE id = $1',
      [id]
    );
    const entry = result.rows[0];

    if (!entry) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(entry);
  } catch (error) {
    log('error', 'Error fetching water intake entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update water intake
app.put('/api/water-intake/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, entry_date, glasses_consumed } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Water Intake Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE water_intake SET
        glasses_consumed = COALESCE($1, glasses_consumed),
        entry_date = COALESCE($2, entry_date),
        updated_at = now()
      WHERE id = $3 AND user_id = $4
      RETURNING *`,
      [glasses_consumed, entry_date, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Water intake entry not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating water intake:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete water intake
app.delete('/api/water-intake/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Water Intake Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM water_intake WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Water intake entry not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Water intake entry deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting water intake:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Helper function to get or create a default "Active Calories" exercise
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
    // Exercise not found, create it
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

    if (createError) {
      log('error', "Error creating active calories exercise:", createError);
      throw new Error(`Failed to create active calories exercise: ${createError.message}`);
    }
    exercise = newExercise;
  }
  return exercise.id;
}

// Helper function to upsert exercise entry data
async function upsertExerciseEntryData(userId, exerciseId, caloriesBurned, date) {
  log('info', "upsertExerciseEntryData received date parameter:", date);
  // For active calories, we don't have a duration, so we can set it to 0 or a small default.
  // The primary value is calories_burned.
  // For active calories, we don't have a duration, so we can set it to 0 or a small default.
  // The primary value is calories_burned.
  // First, check if an entry for this specific "Active Calories" exercise already exists for the user and date.
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
    // If an entry exists, update its calories_burned by adding the new value
    log('info', `Existing active calories entry found for ${date}, updating calories from ${existingEntry.calories_burned} to ${caloriesBurned}.`);
    const updateClient = await pool.connect();
    try {
      const result = await updateClient.query(
        'UPDATE exercise_entries SET calories_burned = $1, notes = $2 WHERE id = $3 RETURNING *',
        [caloriesBurned, 'Active calories logged from Apple Health (updated).', existingEntry.id]
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error updating active calories exercise entry:", error);
      throw new Error(`Failed to update active calories exercise entry: ${error.message}`);
    } finally {
      updateClient.release();
    }
  } else {
    // If no entry exists, insert a new one
    log('info', `No existing active calories entry found for ${date}, inserting new entry.`);
    const insertClient = await pool.connect();
    try {
      const result = await insertClient.query(
        `INSERT INTO exercise_entries (user_id, exercise_id, entry_date, calories_burned, duration_minutes, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, exerciseId, date, caloriesBurned, 0, 'Active calories logged from Apple Health.']
      );
      result = result.rows[0];
    } catch (error) {
      log('error', "Error inserting active calories exercise entry:", error);
      throw new Error(`Failed to insert active calories exercise entry: ${error.message}`);
    } finally {
      insertClient.release();
    }
  }
  return result;
}

// New endpoint for receiving health data
app.post('/api/health-data', express.text({ type: '*/*' }), async (req, res) => {
  log('info', "Request Content-Type:", req.headers['content-type']);
  log('info', "Type of req.body:", typeof req.body);
  const rawBody = req.body;
  log('debug', "Received raw health data request body:", rawBody);

  let healthDataArray = [];
  if (rawBody.startsWith('[') && rawBody.endsWith(']')) {
    // Already a valid JSON array
    try {
      healthDataArray = JSON.parse(rawBody);
    } catch (e) {
      log('error', "Error parsing JSON array body:", e);
      return res.status(400).json({ error: "Invalid JSON array format." });
    }
  } else if (rawBody.includes('}{')) {
    // Concatenated JSON objects
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
        // Continue processing other valid parts
      }
    }
  } else {
    // Assume it's a single JSON object
    try {
      healthDataArray.push(JSON.parse(rawBody));
    } catch (e) {
      log('error', "Error parsing single JSON body:", e);
      return res.status(400).json({ error: "Invalid single JSON format." });
    }
  }

  const userId = req.userId; // Set by the API key authentication middleware
  log('info', "User ID from API Key authentication:", userId);
  log('debug', "Parsed healthDataArray:", JSON.stringify(healthDataArray, null, 2));

  const processedResults = [];
  const errors = [];

  for (const dataEntry of healthDataArray) {
    const { value, type, unit, date } = dataEntry;

    if (!value || !type || !date) {
      errors.push({ error: "Missing required fields: value, type, date in one of the entries", entry: dataEntry });
      continue;
    }

    let parsedDate;
    try {
      log('debug', "Received date string for parsing:", date);
      const dateObj = new Date(date);
      log('debug', "Parsed date object (using new Date()):", dateObj);
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date received from shortcut: '${date}'.`);
      }
      parsedDate = dateObj.toISOString().split('T')[0]; // Ensure UTC date string
    } catch (e) {
      log('error', "Date parsing error:", e);
      errors.push({ error: `Invalid date format for entry: ${JSON.stringify(dataEntry)}. Error: ${e.message}`, entry: dataEntry });
      continue;
    }

    try {
      let result;
      switch (type) {
        case 'step':
          const stepValue = parseInt(value, 10);
          if (isNaN(stepValue) || !Number.isInteger(stepValue)) {
            errors.push({ error: "Invalid value for step. Must be an integer.", entry: dataEntry });
            break;
          }
          result = await upsertStepData(userId, stepValue, parsedDate);
          log('info', "Step data upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'water':
          const waterValue = parseInt(value, 10);
          if (isNaN(waterValue) || !Number.isInteger(waterValue)) {
            errors.push({ error: "Invalid value for water. Must be an integer.", entry: dataEntry });
            break;
          }
          result = await upsertWaterData(userId, waterValue, parsedDate);
          log('info', "Water data upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'Active Calories':
          const activeCaloriesValue = parseFloat(value);
          if (isNaN(activeCaloriesValue) || activeCaloriesValue < 0) {
            errors.push({ error: "Invalid value for active_calories. Must be a non-negative number.", entry: dataEntry });
            break;
          }
          const exerciseId = await getOrCreateActiveCaloriesExercise(userId);
          result = await upsertExerciseEntryData(userId, exerciseId, activeCaloriesValue, parsedDate);
          log('info', "Active Calories upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        default:
          errors.push({ error: `Unsupported health data type: ${type}`, entry: dataEntry });
          break;
      }
    } catch (error) {
      log('error', `Error processing ${type} data for entry ${JSON.stringify(dataEntry)}:`, error);
      errors.push({ error: `Failed to process ${type} data: ${error.message}`, entry: dataEntry });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      message: "Some health data entries could not be processed.",
      processed: processedResults,
      errors: errors
    });
  } else {
    res.status(200).json({
      message: "All health data successfully processed.",
      processed: processedResults
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const client = await pool.connect();
  try {
    // Retrieve user from auth.users (placeholder for actual auth system)
    const userResult = await client.query(
      'SELECT id, password_hash FROM auth.users WHERE email = $1',
      [email]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare provided password with hashed password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // For now, return user ID. In a real app, generate and return a JWT.
    res.status(200).json({ message: 'Login successful', userId: user.id });

  } catch (error) {
    log('error', 'Error during user login:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', (req, res) => {
  // In a real application, this would involve invalidating a JWT or session.
  // For now, it's a placeholder for client-side token removal.
  res.status(200).json({ message: 'Logout successful.' });
});

// Endpoint to upsert check-in measurements
app.post('/api/measurements/check-in', express.json(), async (req, res) => {
  const { user_id, entry_date, ...measurements } = req.body;

  if (!user_id || !entry_date) {
    return res.status(400).json({ error: 'User ID and entry date are required.' });
  }

  const client = await pool.connect();
  try {
    // Check if a record exists for the user and date
    const existingRecord = await client.query(
      'SELECT * FROM check_in_measurements WHERE user_id = $1 AND entry_date = $2',
      [user_id, entry_date]
    );

    let query;
    let values;
    if (existingRecord.rows.length > 0) {
      // Update existing record
      const fields = Object.keys(measurements).map((key, index) => `${key} = $${index + 3}`).join(', ');
      values = [user_id, entry_date, ...Object.values(measurements), new Date().toISOString()];
      query = `UPDATE check_in_measurements SET ${fields}, updated_at = $${values.length} WHERE user_id = $1 AND entry_date = $2 RETURNING *`;
    } else {
      // Insert new record
      const cols = ['user_id', 'entry_date', ...Object.keys(measurements), 'created_at', 'updated_at'];
      const placeholders = cols.map((_, index) => `$${index + 1}`).join(', ');
      values = [user_id, entry_date, ...Object.values(measurements), new Date().toISOString(), new Date().toISOString()];
      query = `INSERT INTO check_in_measurements (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    }

    const result = await client.query(query, values);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error upserting check-in measurements:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch check-in measurements for a specific user and date
app.get('/api/measurements/check-in/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM check_in_measurements WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    const measurement = result.rows[0];

    if (!measurement) {
      // Return an empty object if no measurement is found, instead of a 404
      return res.status(200).json({});
    }

    res.status(200).json(measurement);
  } catch (error) {
    log('error', 'Error fetching check-in measurement:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update check-in measurements
app.put('/api/measurements/check-in/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, entry_date, weight, neck, waist, hips, steps } = req.body;

  if (!id || !user_id || !entry_date) {
    return res.status(400).json({ error: 'ID, User ID, and entry date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE check_in_measurements SET
        weight = COALESCE($1, weight),
        neck = COALESCE($2, neck),
        waist = COALESCE($3, waist),
        hips = COALESCE($4, hips),
        steps = COALESCE($5, steps),
        updated_at = now()
      WHERE id = $6 AND user_id = $7 AND entry_date = $8
      RETURNING *`,
      [weight, neck, waist, hips, steps, id, user_id, entry_date]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Check-in measurement not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating check-in measurement:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete check-in measurements
app.delete('/api/measurements/check-in/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Check-in Measurement ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM check_in_measurements WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Check-in measurement not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Check-in measurement deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting check-in measurement:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to search for a custom category
app.get('/api/measurements/custom-categories/:userId/:name', async (req, res) => {
  const { userId, name } = req.params;

  if (!userId || !name) {
    return res.status(400).json({ error: 'User ID and category name are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM custom_categories WHERE user_id = $1 AND name = $2',
      [userId, name]
    );
    const category = result.rows[0];

    if (!category) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(category);
  } catch (error) {
    log('error', 'Error searching custom category:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a custom category by ID
app.get('/api/measurements/custom-categories/id/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Category ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, user_id, name, frequency, measurement_type FROM custom_categories WHERE id = $1',
      [id]
    );
    const category = result.rows[0];

    if (!category) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(category);
  } catch (error) {
    log('error', 'Error fetching custom category by ID:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a custom category
app.put('/api/measurements/custom-categories/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, name, frequency, measurement_type } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Category ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE custom_categories SET
        name = COALESCE($1, name),
        frequency = COALESCE($2, frequency),
        measurement_type = COALESCE($3, measurement_type),
        updated_at = now()
      WHERE id = $4 AND user_id = $5
      RETURNING *`,
      [name, frequency, measurement_type, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Custom category not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating custom category:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a custom category
app.delete('/api/custom-categories/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query; // Correctly extract user_id from query parameters

  if (!id || !user_id) { // Use user_id here
    return res.status(400).json({ error: 'Category ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM custom_categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user_id] // Use user_id here
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Custom category not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Custom category deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting custom category:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a custom category
app.post('/api/custom-categories', express.json(), async (req, res) => {
  const { user_id, name, frequency, measurement_type } = req.body;

  if (!user_id || !name || !frequency || !measurement_type) {
    return res.status(400).json({ error: 'User ID, name, frequency, and measurement type are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO custom_categories (user_id, name, frequency, measurement_type, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now()) RETURNING *',
      [user_id, name, frequency, measurement_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating custom category:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to insert custom measurement entry
app.post('/api/measurements/custom-entries', express.json(), async (req, res) => {
  const { user_id, category_id, entry_date, value, entry_timestamp } = req.body;

  if (!user_id || !category_id || !entry_date || value === undefined || !entry_timestamp) {
    return res.status(400).json({ error: 'User ID, category ID, entry date, value, and entry timestamp are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO custom_measurements (user_id, category_id, entry_date, value, entry_timestamp, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING *',
      [user_id, category_id, entry_date, value, entry_timestamp]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error inserting custom measurement entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a custom measurement entry by ID
app.get('/api/measurements/custom-entries/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Entry ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM custom_measurements WHERE id = $1',
      [id]
    );
    const entry = result.rows[0];

    if (!entry) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(entry);
  } catch (error) {
    log('error', 'Error fetching custom measurement entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a custom measurement entry
app.put('/api/measurements/custom-entries/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, category_id, entry_date, value, entry_timestamp } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE custom_measurements SET
        category_id = COALESCE($1, category_id),
        entry_date = COALESCE($2, entry_date),
        value = COALESCE($3, value),
        entry_timestamp = COALESCE($4, entry_timestamp),
        updated_at = now()
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
      [category_id, entry_date, value, entry_timestamp, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Custom measurement entry not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating custom measurement entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a custom measurement entry
app.delete('/api/measurements/custom-entries/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM custom_measurements WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Custom measurement entry not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Custom measurement entry deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting custom measurement entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/measurements/custom-entries/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT cm.*, cc.name AS custom_category_name, cc.measurement_type, cc.frequency
       FROM custom_measurements cm
       JOIN custom_categories cc ON cm.category_id = cc.id
       WHERE cm.user_id = $1 AND cm.entry_date = $2`,
      [userId, date]
    );
    res.status(200).json(result.rows || []);
  } catch (error) {
    log('error', 'Error fetching custom measurements by user and date:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/auth/user', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, email, created_at FROM auth.users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json(user);
  } catch (error) {
    log('error', 'Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Authentication Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }

  try {
    // Hash password (using bcrypt or similar, for now a placeholder)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const client = await pool.connect();
    try {
      // Insert into auth.users
      const userResult = await client.query(
        'INSERT INTO auth.users (id, email, password_hash, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, now(), now()) RETURNING id',
        [email, hashedPassword]
      );
      const userId = userResult.rows[0].id;

      // Insert into profiles
      await client.query(
        'INSERT INTO profiles (id, full_name, created_at, updated_at) VALUES ($1, $2, now(), now())',
        [userId, full_name]
      );

      // Insert into user_goals
      await client.query(
        'INSERT INTO user_goals (user_id, created_at, updated_at) VALUES ($1, now(), now())',
        [userId]
      );

      res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'User with this email already exists.' });
      }
      log('error', 'Error during user registration:', error);
      res.status(500).json({ error: 'Internal server error during registration.' });
    } finally {
      client.release();
    }
  } catch (error) {
    log('error', 'Error connecting to database for registration:', error);
    res.status(500).json({ error: 'Database connection error.' });
  }
});

app.get('/api/users/find-by-email', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ userId: user.id });
  } catch (error) {
    log('error', 'Error finding user by email:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});


app.post('/api/user/generate-api-key', async (req, res) => {
  const { userId, description } = req.body; // Assuming userId is passed in the request body for now

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const newApiKey = require('uuid').v4(); // Generate a UUID for the API key

    await client.query(
      `INSERT INTO user_api_keys (user_id, api_key, description, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [userId, newApiKey, description, { health_data_write: true }]
    );

    res.status(201).json({ message: 'API key generated successfully', apiKey: newApiKey });
  } catch (error) {
    log('error', 'Error generating API key:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/user/revoke-api-key', async (req, res) => {
  const { userId, apiKey } = req.body;

  if (!userId || !apiKey) {
    return res.status(400).json({ error: 'User ID and API Key are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE user_api_keys SET is_active = FALSE, updated_at = now() WHERE user_id = $1 AND api_key = $2 RETURNING *',
      [userId, apiKey]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'API Key not found for this user.' });
    }

    res.status(200).json({ message: 'API key revoked successfully.' });
  } catch (error) {
    log('error', 'Error revoking API key:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/user/revoke-all-api-keys', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE user_api_keys SET is_active = FALSE, updated_at = now() WHERE user_id = $1',
      [userId]
    );

    res.status(200).json({ message: 'All API keys revoked successfully for the user.' });
  } catch (error) {
    log('error', 'Error revoking all API keys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/users/accessible-users', async (req, res) => {
  const { userId } = req.query; // Assuming userId is passed as a query parameter

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         fa.owner_user_id AS user_id,
         p.full_name,
         au.email AS email,
         fa.access_permissions AS permissions,
         fa.access_end_date
       FROM family_access fa
       JOIN profiles p ON p.id = fa.owner_user_id
       JOIN auth.users au ON au.id = fa.owner_user_id
       WHERE fa.family_user_id = $1
         AND fa.is_active = TRUE
         AND (fa.access_end_date IS NULL OR fa.access_end_date > NOW())`,
      [userId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching accessible users:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch user profile by ID
app.get('/api/profiles/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, full_name, phone_number, date_of_birth, bio, avatar_url FROM profiles WHERE id = $1',
      [userId]
    );
    const profile = result.rows[0];

    if (!profile) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(profile);
  } catch (error) {
    log('error', 'Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update user profile by ID
app.put('/api/profiles/:userId', express.json(), async (req, res) => {
  const { userId } = req.params;
  const { full_name, phone_number, date_of_birth, bio, avatar_url } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE profiles
       SET full_name = COALESCE($2, full_name),
           phone_number = COALESCE($3, phone_number),
           date_of_birth = COALESCE($4, date_of_birth),
           bio = COALESCE($5, bio),
           avatar_url = COALESCE($6, avatar_url),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [userId, full_name, phone_number, date_of_birth, bio, avatar_url]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Profile not found or no changes made.' });
    }

    res.status(200).json({ message: 'Profile updated successfully.', profile: result.rows[0] });
  } catch (error) {
    log('error', 'Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch user API keys
app.get('/api/user-api-keys/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, description, api_key, created_at, last_used_at, is_active FROM user_api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching user API keys:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to generate a new API key
app.post('/api/user/generate-api-key', express.json(), async (req, res) => {
  const { userId, description } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const newApiKey = uuidv4(); // Generate a UUID for the API key

    const result = await client.query(
      `INSERT INTO user_api_keys (user_id, api_key, description, permissions, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now()) RETURNING id, api_key, description, created_at, is_active`,
      [userId, newApiKey, description, { health_data_write: true }] // Default permission
    );

    res.status(201).json({ message: 'API key generated successfully', apiKey: result.rows[0] });
  } catch (error) {
    log('error', 'Error generating API key:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to revoke an API key
app.post('/api/user/revoke-api-key', express.json(), async (req, res) => {
  const { userId, apiKeyId } = req.body;

  if (!userId || !apiKeyId) {
    return res.status(400).json({ error: 'User ID and API Key ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'UPDATE user_api_keys SET is_active = FALSE, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
      [apiKeyId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'API Key not found or already inactive for this user.' });
    }

    res.status(200).json({ message: 'API key revoked successfully.' });
  } catch (error) {
    log('error', 'Error revoking API key:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update user password
app.post('/api/auth/update-password', express.json(), async (req, res) => {
  const { userId, newPassword } = req.body; // Assuming currentPassword is validated on frontend or via session

  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required.' });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING id',
        [hashedPassword, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
      log('error', 'Error updating password:', error);
      res.status(500).json({ error: 'Internal server error during password update.' });
    } finally {
      client.release();
    }
  } catch (error) {
    log('error', 'Error hashing password:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Endpoint to update user email
app.post('/api/auth/update-email', express.json(), async (req, res) => {
  const { userId, newEmail } = req.body;

  if (!userId || !newEmail) {
    return res.status(400).json({ error: 'User ID and new email are required.' });
  }

  const client = await pool.connect();
  try {
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM auth.users WHERE email = $1',
      [newEmail]
    );

    if (existingUser.rows.length > 0 && existingUser.rows[0].id !== userId) {
      return res.status(409).json({ error: 'Email already in use by another account.' });
    }

    const result = await client.query(
      'UPDATE auth.users SET email = $1, updated_at = now() WHERE id = $2 RETURNING id',
      [newEmail, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ message: 'Email update initiated. User will need to verify new email.' });
  } catch (error) {
    log('error', 'Error updating email:', error);
    res.status(500).json({ error: 'Internal server error during email update.' });
  } finally {
    client.release();
  }
});

app.get('/api/access/can-access-user-data', async (req, res) => {
  const { targetUserId, permissionType, currentUserId } = req.query; // currentUserId will eventually come from JWT

  if (!targetUserId || !permissionType || !currentUserId) {
    return res.status(400).json({ error: 'targetUserId, permissionType, and currentUserId are required.' });
  }

  const client = await pool.connect();
  try {
    // If accessing own data, always allow
    if (targetUserId === currentUserId) {
      return res.status(200).json({ canAccess: true });
    }

    const result = await client.query(
      `SELECT 1
       FROM family_access fa
       WHERE fa.family_user_id = $1
         AND fa.owner_user_id = $2
         AND fa.is_active = TRUE
         AND (fa.access_end_date IS NULL OR fa.access_end_date > NOW())
         AND (
           (fa.access_permissions->>$3)::boolean = TRUE
           OR
           ($3 IN ('calorie', 'checkin') AND (fa.access_permissions->>'reports')::boolean = TRUE)
           OR
           ($3 = 'calorie' AND (fa.access_permissions->>'food_list')::boolean = TRUE)
         )`,
      [currentUserId, targetUserId, permissionType]
    );

    res.status(200).json({ canAccess: result.rowCount > 0 });
  } catch (error) {
    log('error', 'Error checking user data access:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/access/check-family-access', async (req, res) => {
  const { familyUserId, ownerUserId, permission } = req.query;

  if (!familyUserId || !ownerUserId || !permission) {
    return res.status(400).json({ error: 'familyUserId, ownerUserId, and permission are required.' });
  }

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

    res.status(200).json({ hasAccess: result.rowCount > 0 });
  } catch (error) {
    log('error', 'Error checking family access:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch family access entries for a user (as owner or family member)
app.get('/api/family-access', async (req, res) => {
  const { owner_user_id } = req.query;

  if (!owner_user_id) {
    return res.status(400).json({ error: 'Owner User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fa.id, fa.owner_user_id, fa.family_user_id, fa.family_email, fa.access_permissions,
              fa.access_start_date, fa.access_end_date, fa.is_active, fa.status,
              p_owner.full_name AS owner_full_name, p_family.full_name AS family_full_name
       FROM family_access fa
       LEFT JOIN profiles p_owner ON fa.owner_user_id = p_owner.id
       LEFT JOIN profiles p_family ON fa.family_user_id = p_family.id
       WHERE fa.owner_user_id = $1
       ORDER BY fa.created_at DESC`,
      [owner_user_id]
    );
    res.status(200).json(result.rows || []); // Return empty array if no entries found
  } catch (error) {
    log('error', 'Error fetching family access entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.get('/api/family-access/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fa.id, fa.owner_user_id, fa.family_user_id, fa.family_email, fa.access_permissions,
              fa.access_start_date, fa.access_end_date, fa.is_active, fa.status,
              p_owner.full_name AS owner_full_name, p_family.full_name AS family_full_name
       FROM family_access fa
       LEFT JOIN profiles p_owner ON fa.owner_user_id = p_owner.id
       LEFT JOIN profiles p_family ON fa.family_user_id = p_family.id
       WHERE fa.owner_user_id = $1 OR fa.family_user_id = $1
       ORDER BY fa.created_at DESC`,
      [userId]
    );
    res.status(200).json(result.rows || []); // Return empty array if no entries found
  } catch (error) {
    log('error', 'Error fetching family access entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new family access entry
app.post('/api/family-access', express.json(), async (req, res) => {
  const { owner_user_id, family_user_id, family_email, access_permissions, access_end_date, status } = req.body;

  if (!owner_user_id || !family_user_id || !family_email || !access_permissions) {
    return res.status(400).json({ error: 'Owner User ID, Family User ID, Family Email, and Access Permissions are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO family_access (owner_user_id, family_user_id, family_email, access_permissions, access_end_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'pending'), now(), now()) RETURNING *`,
      [owner_user_id, family_user_id, family_email, access_permissions, access_end_date, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating family access entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a family access entry
app.put('/api/family-access/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { owner_user_id, family_user_id, access_permissions, access_end_date, is_active, status } = req.body;

  if (!id || !owner_user_id) { // owner_user_id to ensure authorization
    return res.status(400).json({ error: 'Family Access ID and Owner User ID are required.' });
  }

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
      [access_permissions, access_end_date, is_active, status, id, owner_user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Family access entry not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating family access entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a family access entry
app.delete('/api/family-access/:id', async (req, res) => {
  const { id } = req.params;
  const { ownerUserId } = req.body; // Owner User ID to ensure authorization

  if (!id || !ownerUserId) {
    return res.status(400).json({ error: 'Family Access ID and Owner User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM family_access WHERE id = $1 AND owner_user_id = $2 RETURNING id',
      [id, ownerUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Family access entry not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Family access entry deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting family access entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});



app.post('/api/chat/clear-old-history', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query(`
      DELETE FROM sparky_chat_history
      WHERE user_id IN (
        SELECT user_id
        FROM user_preferences
        WHERE auto_clear_history = '7days'
      )
      AND created_at < NOW() - INTERVAL '7 days'
    `);
    res.status(200).json({ message: 'Old chat history cleared successfully.' });
  } catch (error) {
    log('error', 'Error clearing old chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// New endpoint to fetch goals for a specific user and date using query parameters (for client-side compatibility)
app.get('/api/goals', async (req, res) => {
  const { userId, selectedDate } = req.query;

  if (!userId || !selectedDate) {
    return res.status(400).json({ error: 'User ID and selectedDate are required.' });
  }

  const client = await pool.connect();
  try {
    // First try to get goal for the exact date
    let result = await client.query(
      `SELECT calories, protein, carbs, fat, water_goal,
              saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
              cholesterol, sodium, potassium, dietary_fiber, sugars,
              vitamin_a, vitamin_c, calcium, iron
       FROM user_goals
       WHERE user_id = $1 AND goal_date = $2
       LIMIT 1`,
      [userId, selectedDate]
    );

    let goals = result.rows[0];

    // If no exact date goal found, get the most recent goal before this date
    if (!goals) {
      result = await client.query(
        `SELECT calories, protein, carbs, fat, water_goal,
                saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
                cholesterol, sodium, potassium, dietary_fiber, sugars,
                vitamin_a, vitamin_c, calcium, iron
         FROM user_goals
         WHERE user_id = $1
           AND (goal_date < $2 OR goal_date IS NULL)
         ORDER BY goal_date DESC NULLS LAST
         LIMIT 1`,
        [userId, selectedDate]
      );
      goals = result.rows[0];
    }

    // If still no goal found, return default values
    if (!goals) {
      goals = {
        calories: 2000, protein: 150, carbs: 250, fat: 67, water_goal: 8,
        saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25, trans_fat: 0,
        cholesterol: 300, sodium: 2300, potassium: 3500, dietary_fiber: 25, sugars: 50,
        vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 18
      };
    }

    res.status(200).json(goals); // Always return 200 OK for goals, even if defaults are used
  } catch (error) {
    log('error', 'Error fetching goals:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Existing endpoint for goals with path parameters (if needed elsewhere)
app.get('/api/goals/for-date', async (req, res) => {
  const { userId, date } = req.query;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    // First try to get goal for the exact date
    let result = await client.query(
      `SELECT calories, protein, carbs, fat, water_goal,
              saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
              cholesterol, sodium, potassium, dietary_fiber, sugars,
              vitamin_a, vitamin_c, calcium, iron
       FROM user_goals
       WHERE user_id = $1 AND goal_date = $2
       LIMIT 1`,
      [userId, date]
    );

    let goals = result.rows[0];

    // If no exact date goal found, get the most recent goal before this date
    if (!goals) {
      result = await client.query(
        `SELECT calories, protein, carbs, fat, water_goal,
                saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
                cholesterol, sodium, potassium, dietary_fiber, sugars,
                vitamin_a, vitamin_c, calcium, iron
         FROM user_goals
         WHERE user_id = $1
           AND (goal_date < $2 OR goal_date IS NULL)
         ORDER BY goal_date DESC NULLS LAST
         LIMIT 1`,
        [userId, date]
      );
      goals = result.rows[0];
    }

    // If still no goal found, return default values
    if (!goals) {
      goals = {
        calories: 2000, protein: 150, carbs: 250, fat: 67, water_goal: 8,
        saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25, trans_fat: 0,
        cholesterol: 300, sodium: 2300, potassium: 3500, dietary_fiber: 25, sugars: 50,
        vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 18
      };
    }

    res.status(200).json(goals); // Always return 200 OK for goals, even if defaults are used
  } catch (error) {
    log('error', 'Error fetching goals for date:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/goals/manage-timeline', async (req, res) => {
  const {
    userId, p_start_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal,
    p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
    p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
    p_vitamin_a, p_vitamin_c, p_calcium, p_iron
  } = req.body;

  if (!userId || !p_start_date) {
    return res.status(400).json({ error: 'User ID and start date are required.' });
  }

  const client = await pool.connect();
  try {
    // If editing a past date (before today), only update that specific date
    if (new Date(p_start_date) < new Date(format(new Date(), 'yyyy-MM-dd'))) {
      await client.query(
        `INSERT INTO user_goals (
          user_id, goal_date, calories, protein, carbs, fat, water_goal,
          saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
          cholesterol, sodium, potassium, dietary_fiber, sugars,
          vitamin_a, vitamin_c, calcium, iron, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now())
        ON CONFLICT (user_id, COALESCE(goal_date, '1900-01-01'::date))
        DO UPDATE SET
          calories = EXCLUDED.calories,
          protein = EXCLUDED.protein,
          carbs = EXCLUDED.carbs,
          fat = EXCLUDED.fat,
          water_goal = EXCLUDED.water_goal,
          saturated_fat = EXCLUDED.saturated_fat,
          polyunsaturated_fat = EXCLUDED.polyunsaturated_fat,
          monounsaturated_fat = EXCLUDED.monounsaturated_fat,
          trans_fat = EXCLUDED.trans_fat,
          cholesterol = EXCLUDED.cholesterol,
          sodium = EXCLUDED.sodium,
          potassium = EXCLUDED.potassium,
          dietary_fiber = EXCLUDED.dietary_fiber,
          sugars = EXCLUDED.sugars,
          vitamin_a = EXCLUDED.vitamin_a,
          vitamin_c = EXCLUDED.vitamin_c,
          calcium = EXCLUDED.calcium,
          iron = EXCLUDED.iron,
          updated_at = now()`,
        [
          userId, p_start_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal,
          p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
          p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
          p_vitamin_a, p_vitamin_c, p_calcium, p_iron
        ]
      );
      return res.status(200).json({ message: 'Goal for past date updated successfully.' });
    }

    // For today or future dates: delete 6 months and insert new goals
    const startDate = new Date(p_start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6);

    // Delete all existing goals from start date for 6 months
    await client.query(
      `DELETE FROM user_goals
       WHERE user_id = $1
         AND goal_date >= $2
         AND goal_date < $3
         AND goal_date IS NOT NULL`,
      [userId, p_start_date, format(endDate, 'yyyy-MM-dd')]
    );

    // Insert new goals for each day in the 6-month range
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      await client.query(
        `INSERT INTO user_goals (
          user_id, goal_date, calories, protein, carbs, fat, water_goal,
          saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
          cholesterol, sodium, potassium, dietary_fiber, sugars,
          vitamin_a, vitamin_c, calcium, iron
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          userId, format(currentDate, 'yyyy-MM-dd'), p_calories, p_protein, p_carbs, p_fat, p_water_goal,
          p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
          p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
          p_vitamin_a, p_vitamin_c, p_calcium, p_iron
        ]
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Remove the default goal (NULL goal_date) to avoid conflicts
    await client.query(
      `DELETE FROM user_goals
       WHERE user_id = $1 AND goal_date IS NULL`,
      [userId]
    );

    res.status(200).json({ message: 'Goal timeline managed successfully.' });
  } catch (error) {
    log('error', 'Error managing goal timeline:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a user goal by ID
app.get('/api/user-goals/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Goal ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_goals WHERE id = $1',
      [id]
    );
    const goal = result.rows[0];

    if (!goal) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(goal);
  } catch (error) {
    log('error', 'Error fetching user goal:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a user goal
app.put('/api/user-goals/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const {
    user_id, goal_date, calories, protein, carbs, fat, water_goal,
    saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
    cholesterol, sodium, potassium, dietary_fiber, sugars,
    vitamin_a, vitamin_c, calcium, iron
  } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Goal ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE user_goals SET
        goal_date = COALESCE($1, goal_date),
        calories = COALESCE($2, calories),
        protein = COALESCE($3, protein),
        carbs = COALESCE($4, carbs),
        fat = COALESCE($5, fat),
        water_goal = COALESCE($6, water_goal),
        saturated_fat = COALESCE($7, saturated_fat),
        polyunsaturated_fat = COALESCE($8, polyunsaturated_fat),
        monounsaturated_fat = COALESCE($9, monounsaturated_fat),
        trans_fat = COALESCE($10, trans_fat),
        cholesterol = COALESCE($11, cholesterol),
        sodium = COALESCE($12, sodium),
        potassium = COALESCE($13, potassium),
        dietary_fiber = COALESCE($14, dietary_fiber),
        sugars = COALESCE($15, sugars),
        vitamin_a = COALESCE($16, vitamin_a),
        vitamin_c = COALESCE($17, vitamin_c),
        calcium = COALESCE($18, calcium),
        iron = COALESCE($19, iron),
        updated_at = now()
      WHERE id = $20 AND user_id = $21
      RETURNING *`,
      [
        goal_date, calories, protein, carbs, fat, water_goal,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, id, user_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User goal not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating user goal:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update user preferences
app.put('/api/user-preferences/:userId', express.json(), async (req, res) => {
  const { userId } = req.params;
  const {
    date_format, default_weight_unit, default_measurement_unit,
    system_prompt, auto_clear_history, logging_level, timezone,
    default_food_data_provider_id
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE user_preferences SET
        date_format = COALESCE($1, date_format),
        default_weight_unit = COALESCE($2, default_weight_unit),
        default_measurement_unit = COALESCE($3, default_measurement_unit),
        system_prompt = COALESCE($4, system_prompt),
        auto_clear_history = COALESCE($5, auto_clear_history),
        logging_level = COALESCE($6, logging_level),
        timezone = COALESCE($7, timezone),
        default_food_data_provider_id = COALESCE($8, default_food_data_provider_id),
        updated_at = now()
      WHERE user_id = $9
      RETURNING *`,
      [
        date_format, default_weight_unit, default_measurement_unit,
        system_prompt, auto_clear_history, logging_level, timezone,
        default_food_data_provider_id, userId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User preferences not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating user preferences:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete user preferences
app.delete('/api/user-preferences/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM user_preferences WHERE user_id = $1 RETURNING user_id',
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User preferences not found.' });
    }

    res.status(200).json({ message: 'User preferences deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting user preferences:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a user goal
app.delete('/api/user-goals/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Goal ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM user_goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User goal not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'User goal deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting user goal:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch user preferences
app.get('/api/user-preferences/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    const preferences = result.rows[0];

    if (!preferences) {
      return res.status(404).json({ error: 'User preferences not found.' });
    }

    res.status(200).json(preferences);
  } catch (error) {
    log('error', 'Error fetching user preferences:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to upsert user preferences
app.post('/api/user-preferences', express.json(), async (req, res) => {
  const {
    user_id, date_format, default_weight_unit, default_measurement_unit,
    system_prompt, auto_clear_history, logging_level, timezone,
    default_food_data_provider_id
  } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO user_preferences (
        user_id, date_format, default_weight_unit, default_measurement_unit,
        system_prompt, auto_clear_history, logging_level, timezone,
        default_food_data_provider_id, created_at, updated_at
      ) VALUES ($1, COALESCE($2, 'yyyy-MM-dd'), COALESCE($3, 'lbs'), COALESCE($4, 'in'), COALESCE($5, ''), COALESCE($6, 'never'), COALESCE($7, 'INFO'), COALESCE($8, 'UTC'), $9, now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        date_format = COALESCE(EXCLUDED.date_format, user_preferences.date_format),
        default_weight_unit = COALESCE(EXCLUDED.default_weight_unit, user_preferences.default_weight_unit),
        default_measurement_unit = COALESCE(EXCLUDED.default_measurement_unit, user_preferences.default_measurement_unit),
        system_prompt = COALESCE(EXCLUDED.system_prompt, user_preferences.system_prompt),
        auto_clear_history = COALESCE(EXCLUDED.auto_clear_history, user_preferences.auto_clear_history),
        logging_level = COALESCE(EXCLUDED.logging_level, user_preferences.logging_level),
        timezone = COALESCE(EXCLUDED.timezone, user_preferences.timezone),
        default_food_data_provider_id = COALESCE(EXCLUDED.default_food_data_provider_id, user_preferences.default_food_data_provider_id),
        updated_at = now()
      RETURNING *`,
      [
        user_id, date_format, default_weight_unit, default_measurement_unit,
        system_prompt, auto_clear_history, logging_level, timezone,
        default_food_data_provider_id
      ]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error upserting user preferences:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, service_config, action, service_data } = req.body;

    // Handle saving/updating AI service settings
    if (action === 'save_ai_service_settings' && service_data) {
      const { id, service_name, service_type, api_key, custom_url, system_prompt, is_active, model_name, user_id } = service_data;

      const upsertData = {
        user_id: user_id, // Assuming user_id is passed in service_data for now
        service_name,
        service_type,
        custom_url: custom_url || null,
        system_prompt: system_prompt || '',
        is_active,
        model_name: model_name || null,
      };

      if (api_key) { // Only encrypt and update if API key is provided
        try {
          const { encryptedText, iv, tag } = await encrypt(api_key, ENCRYPTION_KEY);
          upsertData.encrypted_api_key = encryptedText;
          upsertData.api_key_iv = iv;
          upsertData.api_key_tag = tag;
        } catch (e) {
          log('error', 'Error during encryption:', e);
          return res.status(500).json({ error: 'Encryption failed.' });
        }
      } else if (!id) { // If it's a new service (no ID) and no API key, throw error
        log('error', 'New service creation attempted without API key.');
        return res.status(400).json({ error: 'API key is required for adding a new AI service.' });
      }

      const client = await pool.connect();
      try {
        if (id) {
          // Update existing service
          await client.query(
            `UPDATE ai_service_settings SET
              service_name = $1, service_type = $2, custom_url = $3,
              system_prompt = $4, is_active = $5, model_name = $6,
              encrypted_api_key = COALESCE($7, encrypted_api_key),
              api_key_iv = COALESCE($8, api_key_iv),
              api_key_tag = COALESCE($9, api_key_tag)
            WHERE id = $10 AND user_id = $11`,
            [
              upsertData.service_name, upsertData.service_type, upsertData.custom_url,
              upsertData.system_prompt, upsertData.is_active, upsertData.model_name,
              upsertData.encrypted_api_key, upsertData.api_key_iv, upsertData.api_key_tag,
              id, upsertData.user_id
            ]
          );
        } else {
          // Insert new service
          await client.query(
            `INSERT INTO ai_service_settings (
              user_id, service_name, service_type, custom_url, system_prompt,
              is_active, model_name, encrypted_api_key, api_key_iv, api_key_tag
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              upsertData.user_id, upsertData.service_name, upsertData.service_type,
              upsertData.custom_url, upsertData.system_prompt, upsertData.is_active,
              upsertData.model_name, upsertData.encrypted_api_key, upsertData.api_key_iv, upsertData.api_key_tag
            ]
          );
        }
        return res.status(200).json({ message: 'AI service settings saved successfully.' });
      } catch (error) {
        log('error', 'Error saving AI service settings:', error);
        return res.status(500).json({ error: 'Failed to save AI service settings.' });
      } finally {
        client.release();
      }
    }

    // Validate messages structure for multimodal input for chat requests
    if (!Array.isArray(messages) || messages.length === 0) {
      log('error', 'Invalid messages format received');
      return res.status(400).json({ error: 'Invalid messages format.' });
    }

    if (!service_config || !service_config.id) {
      return res.status(400).json({ error: 'AI service configuration ID is missing.' });
    }

    // Fetch AI service settings from the database
    const client = await pool.connect();
    let aiService;
    try {
      const result = await client.query(
        'SELECT encrypted_api_key, api_key_iv, api_key_tag, service_type, custom_url, model_name FROM ai_service_settings WHERE id = $1 AND user_id = $2',
        [service_config.id, req.userId] // Assuming req.userId is set by auth middleware
      );
      aiService = result.rows[0];
    } catch (error) {
      log('error', 'Error fetching AI service settings:', error);
      return res.status(500).json({ error: 'Failed to retrieve AI service configuration.' });
    } finally {
      client.release();
    }

    if (!aiService) {
      return res.status(200).json({}); // Return empty object if not found
    }

    if (!aiService.encrypted_api_key || !aiService.api_key_iv || !aiService.api_key_tag) {
      log('error', 'Encrypted API key, IV, or Tag missing for fetched service.');
      return res.status(500).json({ error: 'Encrypted API key, IV, or Tag missing for selected AI service.' });
    }

    let decryptedApiKey;
    try {
      decryptedApiKey = await decrypt(aiService.encrypted_api_key, aiService.api_key_iv, aiService.api_key_tag, ENCRYPTION_KEY);
    } catch (e) {
      log('error', 'Error during decryption:', e);
      return res.status(500).json({ error: 'Decryption failed.' });
    }

    let response;
    const model = aiService.model_name || getDefaultModel(aiService.service_type);

    // Extract system prompt and clean it for Google AI
    const systemMessage = messages.find(msg => msg.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    const userMessages = messages.filter(msg => msg.role !== 'system');

    // Clean system prompt for Google AI (remove special characters and trim length)
    const cleanSystemPrompt = systemPrompt
      .replace(/[^\w\s\-.,!?:;()\[\]{}'"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit length for Google AI

    switch (aiService.service_type) {
      case 'openai':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'openai_compatible':
        response = await fetch(`${aiService.custom_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'anthropic':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': decryptedApiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1000,
            messages: userMessages,
            system: systemPrompt,
          }),
        });
        break;

      case 'google':
        // Google AI (Gemini) supports multimodal input using the 'parts' structure
        const googleBody = {
          contents: messages.map(msg => {
            // Map roles: 'user' to 'user', 'assistant' to 'model', 'system' is handled separately
            const role = msg.role === 'assistant' ? 'model' : 'user';

            // Handle content which can be a string (text) or an array of parts (text + image)
            let parts = [];
            if (typeof msg.content === 'string') {
              parts.push({ text: msg.content });
            } else if (Array.isArray(msg.content)) {
              // Assuming content is an array of parts like [{type: 'text', text: '...'}, {type: 'image_url', image_url: {url: '...'}}]
              parts = msg.content.map(part => {
                if (part.type === 'text') {
                  return { text: part.text };
                } else if (part.type === 'image_url' && part.image_url?.url) {
                  // Google AI expects image data in a specific format
                  // The URL should be a data URL (Base64)
                  try {
                    const urlParts = part.image_url.url.split(';base64,');
                    if (urlParts.length !== 2) {
                      log('error', 'Invalid data URL format for image part. Expected "data:[mimeType];base64,[data]".');
                      return null; // Skip invalid image part
                    }
                    const mimeTypeMatch = urlParts[0].match(/^data:(.*?)(;|$)/);
                    let mimeType = '';
                    if (mimeTypeMatch && mimeTypeMatch[1]) {
                      mimeType = mimeTypeMatch[1];
                    } else {
                      log('error', 'Could not extract mime type from data URL prefix:', urlParts[0]);
                      return null; // Skip if mime type cannot be extracted
                    }
                    const base64Data = urlParts[1];
                    return {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                      }
                    };
                  } catch (e) {
                    log('error', 'Error processing image data URL:', e);
                    return null; // Skip if error occurs
                  }
                }
                return null; // Ignore unsupported part types
              }).filter(part => part !== null); // Filter out any null parts
            }

            // If no valid parts were generated (e.g., due to malformed image data),
            // but the original message content was an array and contained an image,
            // add an empty text part to ensure the message is not filtered out.
            if (parts.length === 0 && Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url')) {
              parts.push({ text: '' });
            }

            return {
              parts: parts,
              role: role,
            };
          }).filter(content => content.parts.length > 0), // Filter out messages with no valid parts
        };

        // Add check for empty contents
        if (googleBody.contents.length === 0) {
          log('error', 'Google API request body has empty contents. No valid text or image parts found.');
          return res.status(400).json({ error: 'No valid content (text or image) found to send to Google AI.' });
        }

        // Only add system instruction if it's not empty and clean
        if (cleanSystemPrompt && cleanSystemPrompt.length > 0) {
          googleBody.systemInstruction = {
            parts: [{ text: cleanSystemPrompt }]
          };
        }

        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleBody),
        });
        break;

      case 'mistral':
        response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'groq':
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'ollama':
        response = await fetch(`${aiService.custom_url}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
          }),
        });
        break;

      case 'custom':
        if (!aiService.custom_url) {
          throw new Error('Custom URL is required for custom service');
        }
        response = await fetch(aiService.custom_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages,
            model: model,
            temperature: 0.7,
          }),
        });
        break;

      default:
        // For other service types, check if image data is present and inform the user if not supported
        const hasImage = messages.some(msg => Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url'));
        if (hasImage) {
          return res.status(400).json({ error: `Image analysis is not supported for the selected AI service type: ${aiService.service_type}. Please select a multimodal model like Google Gemini in settings.` });
        }
        // If no image, proceed with text-only for other services (assuming they support text)
        throw new Error(`Unsupported service type for image analysis: ${aiService.service_type}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      log('error', `AI service API call error for ${aiService.service_type}:`, errorText);
      return res.status(response.status).json({ error: `AI service API call error: ${response.status} - ${errorText}` });
    }

    const data = await response.json();
    let content = '';

    switch (aiService.service_type) {
      case 'openai':
      case 'openai_compatible':
      case 'mistral':
      case 'groq':
      case 'custom':
        content = data.choices?.[0]?.message?.content || 'No response from AI service';
        break;
      case 'anthropic':
        content = data.content?.[0]?.text || 'No response from AI service';
        break;
      case 'google':
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI service';
        break;
      case 'ollama':
        content = data.message?.content || 'No response from AI service';
        break;
    }

    return res.status(200).json({ content });

  } catch (error) {
    log('error', 'Caught error in chat endpoint:', error);
    return res.status(500).json({ error: 'An unexpected error occurred in the chat endpoint.' });
  }
});

function getDefaultModel(serviceType) {
  switch (serviceType) {
    case 'openai':
    case 'openai_compatible':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'google':
      return 'gemini-pro';
    case 'mistral':
      return 'mistral-large-latest';
    case 'groq':
      return 'llama3-8b-8192';
    default:
      return 'gpt-3.5-turbo';
  }
}

// Endpoint to search for foods
app.get('/api/foods/search', async (req, res) => {
  const { name, userId, exactMatch, broadMatch, checkCustom } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Food name is required.' });
  }

  const client = await pool.connect();
  try {
    let query = 'SELECT id, name, serving_unit, serving_size, calories, protein, carbs, fat FROM foods WHERE ';
    const queryParams = [];
    let paramIndex = 1;

    if (exactMatch === 'true') {
      query += `name ILIKE $${paramIndex++} AND user_id = $${paramIndex++}`;
      queryParams.push(name, userId);
    } else if (broadMatch === 'true') {
      query += `name ILIKE $${paramIndex++} AND (user_id = $${paramIndex++} OR is_custom = FALSE)`;
      queryParams.push(`%${name}%`, userId);
    } else if (checkCustom === 'true') {
      query += `name = $${paramIndex++} AND user_id = $${paramIndex++}`;
      queryParams.push(name, userId);
    } else {
      return res.status(400).json({ error: 'Invalid search parameters.' });
    }

    query += ' LIMIT 3'; // Limit results for broad search

    const result = await client.query(query, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error searching foods:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new food
app.post('/api/foods', express.json(), async (req, res) => {
  const {
    name, calories, protein, carbs, fat, serving_size, serving_unit,
    saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
    cholesterol, sodium, potassium, dietary_fiber, sugars,
    vitamin_a, vitamin_c, calcium, iron, is_custom, user_id
  } = req.body;

  if (!name || !user_id) {
    return res.status(400).json({ error: 'Food name and user ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO foods (
        name, calories, protein, carbs, fat, serving_size, serving_unit,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_custom, user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, now(), now()) RETURNING id`,
      [
        name, calories, protein, carbs, fat, serving_size, serving_unit,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_custom, user_id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating food:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to search for food variants
app.get('/api/food-variants/search', async (req, res) => {
  const { foodId, servingUnit } = req.query;

  if (!foodId || !servingUnit) {
    return res.status(400).json({ error: 'Food ID and serving unit are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM food_variants WHERE food_id = $1 AND serving_unit = $2',
      [foodId, servingUnit]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error searching food variants:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a food by ID
app.get('/api/foods/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM foods WHERE id = $1',
      [id]
    );
    const food = result.rows[0];

    if (!food) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(food);
  } catch (error) {
    log('error', 'Error fetching food:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a food
app.put('/api/foods/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const {
    name, calories, protein, carbs, fat, serving_size, serving_unit,
    saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
    cholesterol, sodium, potassium, dietary_fiber, sugars,
    vitamin_a, vitamin_c, calcium, iron, is_custom, user_id, brand, barcode,
    provider_external_id, shared_with_public, provider_type
  } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Food ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE foods SET
        name = COALESCE($1, name),
        calories = COALESCE($2, calories),
        protein = COALESCE($3, protein),
        carbs = COALESCE($4, carbs),
        fat = COALESCE($5, fat),
        serving_size = COALESCE($6, serving_size),
        serving_unit = COALESCE($7, serving_unit),
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
        is_custom = COALESCE($21, is_custom),
        brand = COALESCE($22, brand),
        barcode = COALESCE($23, barcode),
        provider_external_id = COALESCE($24, provider_external_id),
        shared_with_public = COALESCE($25, shared_with_public),
        provider_type = COALESCE($26, provider_type),
        updated_at = now()
      WHERE id = $27 AND user_id = $28
      RETURNING *`,
      [
        name, calories, protein, carbs, fat, serving_size, serving_unit,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, is_custom, brand, barcode,
        provider_external_id, shared_with_public, provider_type, id, user_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Food not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating food:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a food
app.delete('/api/foods/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query; // userId is now sent as a query parameter

  if (!id || !userId) {
    return res.status(400).json({ error: 'Food ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM foods WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Food not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Food deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting food:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch foods with search, filter, and pagination
app.get('/api/foods', async (req, res) => {
  const { searchTerm, foodFilter, currentPage, itemsPerPage, userId, sortBy } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    let whereClauses = ['1=1']; // Start with a true condition
    const queryParams = [];
    const countQueryParams = [];
    let paramIndex = 1;

    if (searchTerm) {
      whereClauses.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${searchTerm}%`);
      countQueryParams.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (foodFilter === 'mine') {
      whereClauses.push(`user_id = $${paramIndex}`);
      queryParams.push(userId);
      countQueryParams.push(userId);
      paramIndex++;
    } else if (foodFilter === 'family') {
      whereClauses.push(`user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))`);
      queryParams.push(userId);
      countQueryParams.push(userId);
      paramIndex++;
    } else if (foodFilter === 'public') {
      whereClauses.push(`shared_with_public = TRUE`);
    } else if (foodFilter === 'all') {
      whereClauses.push(`(
        user_id IS NULL OR user_id = $${paramIndex} OR shared_with_public = TRUE OR
        user_id IN (SELECT owner_user_id FROM family_access WHERE family_user_id = $${paramIndex} AND is_active = TRUE AND (access_end_date IS NULL OR access_end_date > NOW()))
      )`);
      queryParams.push(userId);
      countQueryParams.push(userId);
      paramIndex++;
    }

    let query = `
      SELECT id, name, brand, calories, protein, carbs, fat, serving_size, serving_unit, is_custom, user_id, shared_with_public
      FROM foods
      WHERE ${whereClauses.join(' AND ')}
    `;
    const countQuery = `
      SELECT COUNT(*)
      FROM foods
      WHERE ${whereClauses.join(' AND ')}
    `;

    let orderByClause = 'name ASC'; // Default sort
    if (sortBy) {
      const [sortField, sortOrder] = sortBy.split(':');
      const allowedSortFields = ['name', 'calories', 'protein', 'carbs', 'fat']; // Whitelist allowed fields
      const allowedSortOrders = ['asc', 'desc'];

      if (allowedSortFields.includes(sortField) && allowedSortOrders.includes(sortOrder)) {
        orderByClause = `${sortField} ${sortOrder.toUpperCase()}`;
      } else {
        log('warn', `Invalid sortBy parameter received: ${sortBy}. Using default sort.`);
      }
    }
    query += ` ORDER BY ${orderByClause}`;

    const limit = parseInt(itemsPerPage, 10) || 10;
    const offset = ((parseInt(currentPage, 10) || 1) - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const [foodsResult, countResult] = await Promise.all([
      client.query(query, queryParams),
      client.query(countQuery, countQueryParams)
    ]);

    res.status(200).json({
      foods: foodsResult.rows,
      totalCount: parseInt(countResult.rows[0].count, 10)
    });
  } catch (error) {
    log('error', 'Error fetching foods:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to search for food variants
app.get('/api/food-variants/search', async (req, res) => {
  const { foodId, servingUnit } = req.query;

  if (!foodId || !servingUnit) {
    return res.status(400).json({ error: 'Food ID and serving unit are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM food_variants WHERE food_id = $1 AND serving_unit = $2',
      [foodId, servingUnit]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error searching food variants:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new food variant
app.post('/api/food-variants', express.json(), async (req, res) => {
  const {
    food_id, serving_size, serving_unit, calories, protein, carbs, fat,
    saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
    cholesterol, sodium, potassium, dietary_fiber, sugars,
    vitamin_a, vitamin_c, calcium, iron
  } = req.body;

  if (!food_id || !serving_size || !serving_unit) {
    return res.status(400).json({ error: 'Food ID, serving size, and serving unit are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_variants (
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, now(), now()) RETURNING id`,
      [
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating food variant:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new food entry
app.post('/api/food-entries', async (req, res) => {
  const { user_id, food_id, meal_type, quantity, unit, entry_date, variant_id } = req.body;

  if (!user_id || !food_id || !meal_type || !quantity || !entry_date) {
    return res.status(400).json({ error: 'User ID, food ID, meal type, quantity, and entry date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_entries (user_id, food_id, meal_type, quantity, unit, entry_date, variant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
      [user_id, food_id, meal_type, quantity, unit, entry_date, variant_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating food entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a food variant by ID
app.get('/api/food-variants/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Food Variant ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM food_variants WHERE id = $1',
      [id]
    );
    const variant = result.rows[0];

    if (!variant) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(variant);
  } catch (error) {
    log('error', 'Error fetching food variant:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a food variant
app.put('/api/food-variants/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const {
    food_id, serving_size, serving_unit, calories, protein, carbs, fat,
    saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
    cholesterol, sodium, potassium, dietary_fiber, sugars,
    vitamin_a, vitamin_c, calcium, iron
  } = req.body;

  if (!id || !food_id) {
    return res.status(400).json({ error: 'Food Variant ID and Food ID are required.' });
  }

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
        updated_at = now()
      WHERE id = $21
      RETURNING *`,
      [
        food_id, serving_size, serving_unit, calories, protein, carbs, fat,
        saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
        cholesterol, sodium, potassium, dietary_fiber, sugars,
        vitamin_a, vitamin_c, calcium, iron, id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Food variant not found.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating food variant:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a food variant
app.delete('/api/food-variants/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Food Variant ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM food_variants WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Food variant not found.' });
    }

    res.status(200).json({ message: 'Food variant deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting food variant:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch food variants by food_id
app.get('/api/food-variants', async (req, res) => {
  const { food_id } = req.query;

  if (!food_id) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM food_variants WHERE food_id = $1',
      [food_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching food variants:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new food entry
app.post('/api/food-entries', express.json(), async (req, res) => {
  const { user_id, food_id, meal_type, quantity, unit, entry_date, variant_id } = req.body;

  if (!user_id || !food_id || !meal_type || !quantity || !entry_date) {
    return res.status(400).json({ error: 'User ID, food ID, meal type, quantity, and entry date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO food_entries (user_id, food_id, meal_type, quantity, unit, entry_date, variant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *`,
      [user_id, food_id, meal_type, quantity, unit, entry_date, variant_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating food entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to search for exercises
app.get('/api/exercises/search/:name', async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ error: 'Exercise name is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, calories_per_hour FROM exercises WHERE name ILIKE $1 LIMIT 1',
      [`%${name}%`]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error searching exercises:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to create a new exercise
app.post('/api/exercises', express.json(), async (req, res) => {
  const { name, category, calories_per_hour, is_custom, user_id } = req.body;

  if (!name || !user_id) {
    return res.status(400).json({ error: 'Exercise name and user ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO exercises (name, category, calories_per_hour, is_custom, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now()) RETURNING id, calories_per_hour`,
      [name, category, calories_per_hour, is_custom, user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error creating exercise:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to insert an exercise entry
app.post('/api/exercise-entries', express.json(), async (req, res) => {
  const { user_id, exercise_id, duration_minutes, calories_burned, entry_date, notes } = req.body;

  if (!user_id || !exercise_id || !duration_minutes || !calories_burned || !entry_date) {
    return res.status(400).json({ error: 'User ID, exercise ID, duration, calories burned, and entry date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO exercise_entries (user_id, exercise_id, duration_minutes, calories_burned, entry_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now()) RETURNING *`,
      [user_id, exercise_id, duration_minutes, calories_burned, entry_date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error inserting exercise entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch an exercise entry by ID
app.get('/api/exercise-entries/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Exercise Entry ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercise_entries WHERE id = $1',
      [id]
    );
    const entry = result.rows[0];

    if (!entry) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(entry);
  } catch (error) {
    log('error', 'Error fetching exercise entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update an exercise entry
app.put('/api/exercise-entries/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, exercise_id, duration_minutes, calories_burned, entry_date, notes } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Exercise Entry ID and User ID are required.' });
  }

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
      [exercise_id, duration_minutes, calories_burned, entry_date, notes, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise entry not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating exercise entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete an exercise entry
app.delete('/api/exercise-entries/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Exercise Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM exercise_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise entry not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Exercise entry deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting exercise entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch an exercise by ID
app.get('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Exercise ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercises WHERE id = $1',
      [id]
    );
    const exercise = result.rows[0];

    if (!exercise) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(exercise);
  } catch (error) {
    log('error', 'Error fetching exercise:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update an exercise
app.put('/api/exercises/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { name, category, calories_per_hour, description, is_custom, shared_with_public, user_id } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Exercise ID and User ID are required.' });
  }

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
      [name, category, calories_per_hour, description, is_custom, shared_with_public, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating exercise:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete an exercise
app.delete('/api/exercises/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Exercise ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM exercises WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Exercise not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Exercise deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting exercise:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// New endpoint to fetch food entries for a specific user and date using query parameters
app.get('/api/food-entries', async (req, res) => {
  const { userId, selectedDate } = req.query;

  if (!userId || !selectedDate) {
    return res.status(400).json({ error: 'User ID and selectedDate are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fe.*, f.name AS food_name, f.calories, f.protein, f.carbs, f.fat, f.serving_size, f.serving_unit
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       WHERE fe.user_id = $1 AND fe.entry_date = $2`,
      [userId, selectedDate]
    );
    res.status(200).json(result.rows || []); // Return empty array if no entries found
  } catch (error) {
    log('error', 'Error fetching food entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch food entries for a specific user and date (path parameters)
app.get('/api/food-entries/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fe.*, f.name AS food_name, f.calories, f.protein, f.carbs, f.fat, f.serving_size, f.serving_unit
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       WHERE fe.user_id = $1 AND fe.entry_date = $2`,
      [userId, date]
    );
    // Return an empty array if no entries are found, instead of a 404
    res.status(200).json(result.rows || []);
  } catch (error) {
    log('error', 'Error fetching food entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch food entries for a specific user and date range
app.get('/api/food-entries-range/:userId/:startDate/:endDate', async (req, res) => {
  const { userId, startDate, endDate } = req.params;

  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, start date, and end date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT fe.*, f.name AS food_name, f.calories, f.protein, f.carbs, f.fat, f.serving_size, f.serving_unit
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       ORDER BY fe.entry_date`,
      [userId, startDate, endDate]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching food entries by date range:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// New endpoint to fetch exercise entries for a specific user and date using query parameters
app.get('/api/exercise-entries', async (req, res) => {
  const { userId, selectedDate } = req.query;

  if (!userId || !selectedDate) {
    return res.status(400).json({ error: 'User ID and selectedDate are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercise_entries WHERE user_id = $1 AND entry_date = $2',
      [userId, selectedDate]
    );
    res.status(200).json(result.rows || []); // Return empty array if no entries found
  } catch (error) {
    log('error', 'Error fetching exercise entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch exercise entries for a specific user and date (path parameters)
app.get('/api/exercise-entries/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;

  if (!userId || !date) {
    return res.status(400).json({ error: 'User ID and date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM exercise_entries WHERE user_id = $1 AND entry_date = $2',
      [userId, date]
    );
    // Return an empty array if no entries are found, instead of a 404
    res.status(200).json(result.rows || []);
  } catch (error) {
    log('error', 'Error fetching exercise entries:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch check-in measurements for a specific user and date range
app.get('/api/check-in-measurements-range/:userId/:startDate/:endDate', async (req, res) => {
  const { userId, startDate, endDate } = req.params;

  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, start date, and end date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM check_in_measurements WHERE user_id = $1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date',
      [userId, startDate, endDate]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching check-in measurements by date range:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch custom measurements for a specific user, category, and date range
app.get('/api/custom-measurements-range/:userId/:categoryId/:startDate/:endDate', async (req, res) => {
  const { userId, categoryId, startDate, endDate } = req.params;

  if (!userId || !categoryId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, category ID, start date, and end date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM custom_measurements WHERE user_id = $1 AND category_id = $2 AND entry_date BETWEEN $3 AND $4 ORDER BY entry_date, entry_timestamp',
      [userId, categoryId, startDate, endDate]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching custom measurements by date range:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch mini nutrition trends for a specific user and date range
app.get('/api/mini-nutrition-trends', async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, start date, and end date are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
         fe.entry_date,
         SUM(f.calories * fe.quantity / f.serving_size) AS total_calories,
         SUM(f.protein * fe.quantity / f.serving_size) AS total_protein,
         SUM(f.carbs * fe.quantity / f.serving_size) AS total_carbs,
         SUM(f.fat * fe.quantity / f.serving_size) AS total_fat
       FROM food_entries fe
       JOIN foods f ON fe.food_id = f.id
       WHERE fe.user_id = $1 AND fe.entry_date BETWEEN $2 AND $3
       GROUP BY fe.entry_date
       ORDER BY fe.entry_date`,
      [userId, startDate, endDate]
    );

    // Format the results to match the frontend's expected DayData interface
    const formattedResults = result.rows.map(row => ({
      date: row.entry_date,
      calories: parseFloat(row.total_calories || 0),
      protein: parseFloat(row.total_protein || 0),
      carbs: parseFloat(row.total_carbs || 0),
      fat: parseFloat(row.total_fat || 0),
    }));

    res.status(200).json(formattedResults);
  } catch (error) {
    log('error', 'Error fetching mini nutrition trends:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch AI service settings for a user
app.get('/api/ai-service-settings/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1',
      [userId]
    );
    const settings = result.rows[0];

    if (!settings) {
      // Return an empty array if no settings are found, as the client expects an array.
      return res.status(200).json([]);
    }

    res.status(200).json(settings);
  } catch (error) {
    log('error', 'Error fetching AI service settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch active AI service settings for a user
app.get('/api/ai-service-settings/active/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [userId]
    );
    const activeSettings = result.rows[0];

    if (!activeSettings) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(activeSettings);
  } catch (error) {
    log('error', 'Error fetching active AI service settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch custom categories for a user
app.get('/api/custom-categories', async (req, res) => {
  const { user_id } = req.query;
  log('info', `Received request for /api/custom-categories with user_id: ${user_id}`); // Added for debugging

  if (!user_id) {
    log('warn', 'Missing user ID for /api/custom-categories request.');
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, frequency, measurement_type FROM custom_categories WHERE user_id = $1',
      [user_id]
    );
    res.status(200).json(result.rows || []);
  } catch (error) {
    log('error', 'Error fetching custom categories:', error.message, error.stack); // Enhanced error logging
    res.status(500).json({ error: 'Internal server error.', details: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/custom-categories/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT name, frequency, measurement_type FROM custom_categories WHERE user_id = $1',
      [userId]
    );
    res.status(200).json(result.rows || []); // Return empty array if no categories found
  } catch (error) {
    log('error', 'Error fetching custom categories:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch Sparky chat history for a user
app.get('/api/sparky-chat-history/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT content, message_type FROM sparky_chat_history WHERE user_id = $1 ORDER BY created_at ASC LIMIT 5',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching Sparky chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch a single chat history entry by ID
app.get('/api/sparky-chat-history/entry/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Chat History Entry ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM sparky_chat_history WHERE id = $1',
      [id]
    );
    const entry = result.rows[0];

    if (!entry) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(entry);
  } catch (error) {
    log('error', 'Error fetching chat history entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to update a chat history entry
app.put('/api/sparky-chat-history/:id', express.json(), async (req, res) => {
  const { id } = req.params;
  const { user_id, content, message_type, metadata, session_id, message, response } = req.body;

  if (!id || !user_id) {
    return res.status(400).json({ error: 'Chat History Entry ID and User ID are required.' });
  }

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
        created_at = now() -- Assuming created_at is updated on modification
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
      [content, message_type, metadata, session_id, message, response, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Chat history entry not found or not authorized to update.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    log('error', 'Error updating chat history entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete a chat history entry
app.delete('/api/sparky-chat-history/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'Chat History Entry ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM sparky_chat_history WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Chat history entry not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'Chat history entry deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting chat history entry:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});


// Endpoint to delete all Sparky chat history for a user
app.post('/api/chat/clear-all-history', express.json(), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM sparky_chat_history WHERE user_id = $1',
      [userId]
    );
    res.status(200).json({ message: 'All chat history cleared successfully.' });
  } catch (error) {
    log('error', 'Error clearing all chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});


// Endpoint to save Sparky chat history
app.post('/api/chat/save-history', express.json(), async (req, res) => {
  const { userId, content, messageType, metadata } = req.body;

  if (!userId || !content || !messageType) {
    return res.status(400).json({ error: 'User ID, content, and message type are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO sparky_chat_history (user_id, content, message_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [userId, content, messageType, metadata]
    );
    res.status(201).json({ message: 'Chat history saved successfully.' });
  } catch (error) {
    log('error', 'Error saving chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});


// Endpoint to fetch AI service settings for a user
app.get('/api/ai-service-settings/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1',
      [userId]
    );
    const settings = result.rows[0];

    if (!settings) {
      return res.status(404).json({ error: 'AI service settings not found for this user.' });
    }

    res.status(200).json(settings);
  } catch (error) {
    log('error', 'Error fetching AI service settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch active AI service settings for a user
app.get('/api/ai-service-settings/active/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM ai_service_settings WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
      [userId]
    );
    const activeSettings = result.rows[0];

    if (!activeSettings) {
      return res.status(200).json({}); // Return empty object if not found
    }

    res.status(200).json(activeSettings);
  } catch (error) {
    log('error', 'Error fetching active AI service settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete AI service settings
app.delete('/api/ai-service-settings/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the body for authorization

  if (!id || !userId) {
    return res.status(400).json({ error: 'AI Service ID and User ID are required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'DELETE FROM ai_service_settings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'AI service settings not found or not authorized to delete.' });
    }

    res.status(200).json({ message: 'AI service settings deleted successfully.' });
  } catch (error) {
    log('error', 'Error deleting AI service settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch custom categories for a user
app.get('/api/custom-categories/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, frequency, measurement_type FROM custom_categories WHERE user_id = $1',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching custom categories:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to fetch Sparky chat history for a user
app.get('/api/sparky-chat-history/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT content, message_type FROM sparky_chat_history WHERE user_id = $1 ORDER BY created_at ASC LIMIT 5',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    log('error', 'Error fetching Sparky chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});


// Endpoint to save Sparky chat history
app.post('/api/chat/save-history', express.json(), async (req, res) => {
  const { userId, content, messageType, metadata } = req.body;

  if (!userId || !content || !messageType) {
    return res.status(400).json({ error: 'User ID, content, and message type are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO sparky_chat_history (user_id, content, message_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [userId, content, messageType, metadata]
    );
    res.status(201).json({ message: 'Chat history saved successfully.' });
  } catch (error) {
    log('error', 'Error saving chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

// Endpoint to delete all Sparky chat history for a user
app.post('/api/chat/clear-all-history', express.json(), async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      'DELETE FROM sparky_chat_history WHERE user_id = $1',
      [userId]
    );
    res.status(200).json({ message: 'All chat history cleared successfully.' });
  } catch (error) {
    log('error', 'Error clearing all chat history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

async function applyMigrations() {
  const client = await pool.connect();
  try {
    // Ensure the schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    log('info', 'Ensured schema_migrations table exists.');

    const appliedMigrationsResult = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    const appliedMigrations = new Set(appliedMigrationsResult.rows.map(row => row.name));
    log('info', 'Applied migrations:', Array.from(appliedMigrations));

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (!appliedMigrations.has(file)) {
        log('info', `Applying migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        log('info', `Successfully applied migration: ${file}`);
      } else {
        log('info', `Migration already applied: ${file}`);
      }
    }
  } catch (error) {
    log('error', 'Error applying migrations:', error);
    process.exit(1); // Exit if migrations fail
  } finally {
    client.release();
  }
}

console.log('DEBUG: Attempting to start server...');
applyMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`DEBUG: Server started and listening on port ${PORT}`); // Direct console log
    log('info', `SparkyFitnessServer listening on port ${PORT}`);
  });
}).catch(error => {
  log('error', 'Failed to apply migrations and start server:', error);
  process.exit(1);
});

// Catch-all for 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` });
});