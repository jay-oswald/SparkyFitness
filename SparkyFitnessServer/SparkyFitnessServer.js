require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import cors
const { createClient } = require('@supabase/supabase-js'); // Import Supabase client
const { format } = require('date-fns'); // Import date-fns for date formatting

const app = express();
const PORT = process.env.SPARKY_FITNESS_SERVER_PORT || 3010;

// Initialize Supabase client globally
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Supabase URL or Service Role Key not configured in environment variables.");
  process.exit(1); // Exit if essential Supabase config is missing
}
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Use cors middleware to allow requests from your frontend
app.use(cors({
  origin: 'http://localhost:8080', // Allow requests from your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow common methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-id', 'x-api-key'], // Explicitly allow headers, including custom ones
}));

// Test route
app.get('/test', (req, res) => {
  res.send('Test route is working!');
});

const FATSECRET_OAUTH_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FATSECRET_API_BASE_URL = "https://platform.fatsecret.com/rest";

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
    console.log(`Attempting to get FatSecret Access Token from: ${FATSECRET_OAUTH_TOKEN_URL}`);
    console.log(`Using Client ID: ${clientId}, Client Secret: ${clientSecret ? '********' : 'N/A'}`); // Mask secret
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
      console.error("FatSecret OAuth Token API error:", errorData);
      throw new Error(`FatSecret authentication failed: ${errorData.error_description || response.statusText}`);
    }

    const data = await response.json();
    fatSecretAccessToken = data.access_token;
    tokenExpiryTime = Date.now() + (data.expires_in * 1000) - 60000; // Store token and set expiry 1 minute early

    return fatSecretAccessToken;
  } catch (error) {
    console.error("Network error during FatSecret OAuth token acquisition:", error);
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
  const { data, error } = await supabase
    .from('food_data_providers')
    .select('app_id, app_key')
    .eq('id', providerId)
    .single();

  if (error || !data?.app_id || !data?.app_key) {
    console.error("Error fetching FatSecret API keys from Supabase:", error);
    return res.status(500).json({ error: "Failed to retrieve FatSecret API keys from database. Please check provider configuration." });
  }

  req.clientId = data.app_id;
  req.clientSecret = data.app_key;
  next();
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
    console.log(`FatSecret Search URL: ${searchUrl}`);
    console.log(`Using Access Token: ${accessToken ? '********' : 'N/A'}`); // Mask token
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
      console.error("FatSecret Food Search API error:", errorText);
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
    console.error("Error in FatSecret search proxy:", error);
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
    console.log(`Returning cached data for foodId: ${foodId}`);
    return res.json(cachedData.data);
  }

  try {
    const accessToken = await getFatSecretAccessToken(clientId, clientSecret);
    const nutrientsUrl = `${FATSECRET_API_BASE_URL}?${new URLSearchParams({
      method: "food.get.v4",
      food_id: foodId,
      format: "json",
    }).toString()}`;
    console.log(`FatSecret Nutrients URL: ${nutrientsUrl}`);
    console.log(`Using Access Token: ${accessToken ? '********' : 'N/A'}`); // Mask token
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
      console.error("FatSecret Food Get API error:", errorText);
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
    console.error("Error in FatSecret nutrient proxy:", error);
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
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('user_id, permissions')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error("API Key validation error:", error);
      return res.status(401).json({ error: "Unauthorized: Invalid or inactive API Key" });
    }

    if (!data.permissions || !data.permissions.health_data_write) {
      return res.status(403).json({ error: "Forbidden: API Key does not have health_data_write permission" });
    }

    req.userId = data.user_id;
    req.permissions = data.permissions;
    next();
  } catch (error) {
    console.error("Error during API Key authentication:", error);
    res.status(500).json({ error: "Internal server error during authentication." });
  }
});

// Helper function to upsert step data
async function upsertStepData(userId, value, date) {
  console.log("Processing step data for user:", userId, "date:", date, "value:", value);

  // First, try to find an existing record for the user and date
  const { data: existingRecord, error: selectError } = await supabase
    .from('check_in_measurements')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error checking for existing step data:", selectError);
    throw new Error(`Failed to check existing step data: ${selectError.message}`);
  }

  let result;
  if (existingRecord) {
    // If record exists, update only the steps field
    console.log("Existing record found, updating steps.");
    const { data, error } = await supabase
      .from('check_in_measurements')
      .update({
        steps: value,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('entry_date', date)
      .select();

    if (error) {
      console.error("Error updating step data:", error);
      throw new Error(`Failed to update step data: ${error.message}`);
    }
    result = data;
  } else {
    // If no record exists, insert a new one
    console.log("No existing record found, inserting new step data.");
    const { data, error } = await supabase
      .from('check_in_measurements')
      .insert({
        user_id: userId,
        entry_date: date,
        steps: value,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("Error inserting step data:", error);
      throw new Error(`Failed to insert step data: ${error.message}`);
    }
    result = data;
  }
  return result;

  if (error) {
    console.error("Error upserting step data:", error);
    throw new Error(`Failed to save step data: ${error.message}`);
  }
  return data;
}

// Helper function to upsert water data
async function upsertWaterData(userId, value, date) {
  console.log("Processing water data for user:", userId, "date:", date, "value:", value);

  const { data: existingRecord, error: selectError } = await supabase
    .from('water_intake')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error("Error checking for existing water data:", selectError);
    throw new Error(`Failed to check existing water data: ${selectError.message}`);
  }

  let result;
  if (existingRecord) {
    console.log("Existing record found, updating water intake.");
    const { data, error } = await supabase
      .from('water_intake')
      .update({
        glasses_consumed: value,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('entry_date', date)
      .select();

    if (error) {
      console.error("Error updating water data:", error);
      throw new Error(`Failed to update water data: ${error.message}`);
    }
    result = data;
  } else {
    console.log("No existing record found, inserting new water data.");
    const { data, error } = await supabase
      .from('water_intake')
      .insert({
        user_id: userId,
        entry_date: date,
        glasses_consumed: value,
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("Error inserting water data:", error);
      throw new Error(`Failed to insert water data: ${error.message}`);
    }
    result = data;
  }
  return result;

  if (error) {
    console.error("Error upserting water data:", error);
    throw new Error(`Failed to save water data: ${error.message}`);
  }
  return data;
}

// Helper function to get or create a default "Active Calories" exercise
async function getOrCreateActiveCaloriesExercise(userId) {
  const exerciseName = "Active Calories (Apple Health)";
  let { data: exercise, error } = await supabase
    .from('exercises')
    .select('id')
    .eq('name', exerciseName)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error fetching active calories exercise:", error);
    throw new Error(`Failed to retrieve active calories exercise: ${error.message}`);
  }

  if (!exercise) {
    // Exercise not found, create it
    console.log(`Creating default exercise: ${exerciseName} for user ${userId}`);
    const { data: newExercise, error: createError } = await supabase
      .from('exercises')
      .insert([
        {
          user_id: userId,
          name: exerciseName,
          category: 'Cardio', // Or a more appropriate category
          calories_per_hour: 600, // A placeholder, as actual calories are provided by Apple Health
          description: 'Automatically logged active calories from Apple Health via iPhone shortcut.',
          is_custom: true,
          shared_with_public: false,
        }
      ])
      .select('id')
      .single();

    if (createError) {
      console.error("Error creating active calories exercise:", createError);
      throw new Error(`Failed to create active calories exercise: ${createError.message}`);
    }
    exercise = newExercise;
  }
  return exercise.id;
}

// Helper function to upsert exercise entry data
async function upsertExerciseEntryData(userId, exerciseId, caloriesBurned, date) {
  // For active calories, we don't have a duration, so we can set it to 0 or a small default.
  // The primary value is calories_burned.
  const { data, error } = await supabase
    .from('exercise_entries')
    .upsert(
      {
        user_id: userId,
        exercise_id: exerciseId,
        entry_date: date,
        calories_burned: caloriesBurned,
        duration_minutes: 0, // No duration for active calories from Apple Health
        notes: 'Active calories logged from Apple Health.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: ['user_id', 'exercise_id', 'entry_date'], ignoreDuplicates: false }
    )
    .select();

  if (error) {
    console.error("Error upserting exercise entry data:", error);
    throw new Error(`Failed to save exercise entry data: ${error.message}`);
  }
  return data;
}

// New endpoint for receiving health data
app.post('/api/health-data', express.text({ type: '*/*' }), async (req, res) => {
  console.log("Request Content-Type:", req.headers['content-type']);
  console.log("Type of req.body:", typeof req.body);
  const rawBody = req.body;
  console.log("Received raw health data request body:", rawBody);

  let healthDataArray = [];
  if (rawBody.startsWith('[') && rawBody.endsWith(']')) {
    // Already a valid JSON array
    try {
      healthDataArray = JSON.parse(rawBody);
    } catch (e) {
      console.error("Error parsing JSON array body:", e);
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
        console.error("Error parsing individual concatenated JSON string:", jsonStr, parseError);
        // Continue processing other valid parts
      }
    }
  } else {
    // Assume it's a single JSON object
    try {
      healthDataArray.push(JSON.parse(rawBody));
    } catch (e) {
      console.error("Error parsing single JSON body:", e);
      return res.status(400).json({ error: "Invalid single JSON format." });
    }
  }

  const userId = req.userId; // Set by the API key authentication middleware
  console.log("User ID from API Key authentication:", userId);

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
      console.log("Received date string for parsing:", date);
      const dateObj = new Date(date);
      console.log("Parsed date object (using new Date()):", dateObj);
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date received from shortcut: '${date}'.`);
      }
      parsedDate = format(dateObj, 'yyyy-MM-dd');
    } catch (e) {
      console.error("Date parsing error:", e);
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
          console.log("Step data upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'water':
          const waterValue = parseInt(value, 10);
          if (isNaN(waterValue) || !Number.isInteger(waterValue)) {
            errors.push({ error: "Invalid value for water. Must be an integer.", entry: dataEntry });
            break;
          }
          result = await upsertWaterData(userId, waterValue, parsedDate);
          console.log("Water data upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'active_calories':
          const activeCaloriesValue = parseFloat(value);
          if (isNaN(activeCaloriesValue) || activeCaloriesValue < 0) {
            errors.push({ error: "Invalid value for active_calories. Must be a non-negative number.", entry: dataEntry });
            break;
          }
          const exerciseId = await getOrCreateActiveCaloriesExercise(userId);
          result = await upsertExerciseEntryData(userId, exerciseId, activeCaloriesValue, parsedDate);
          console.log("Active Calories upsert result:", JSON.stringify(result, null, 2));
          processedResults.push({ type, status: 'success', data: result });
          break;
        default:
          errors.push({ error: `Unsupported health data type: ${type}`, entry: dataEntry });
          break;
      }
    } catch (error) {
      console.error(`Error processing ${type} data for entry ${JSON.stringify(dataEntry)}:`, error);
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

// Catch-all for 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` });
});

app.listen(PORT, () => {
  console.log(`SparkyFitnessServer listening on port ${PORT}`);
});