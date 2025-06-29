require('dotenv').config();
const express = require('express');
const cors = require('cors'); // Import cors
const { createClient } = require('@supabase/supabase-js'); // Import Supabase client

const app = express();
const PORT = process.env.SPARKY_FITNESS_SERVER_PORT || 3010;

// Use cors middleware to allow requests from your frontend
app.use(cors({
  origin: 'http://localhost:8080', // Allow requests from your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow common methods
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-id'], // Explicitly allow headers, including custom ones
}));
app.use(express.json()); // For parsing application/json

// Test route
app.get('/test', (req, res) => {
  res.send('Test route is working!');
});

const FATSECRET_OAUTH_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const FATSECRET_API_BASE_URL = "https://platform.fatsecret.com/rest";

let fatSecretAccessToken = null;
let tokenExpiryTime = 0;

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

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Supabase URL or Service Role Key not configured in environment variables.");
    return res.status(500).json({ error: "Supabase configuration missing on server." });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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

  try {
    const accessToken = await getFatSecretAccessToken(clientId, clientSecret);
    const nutrientsUrl = `${FATSECRET_API_BASE_URL}?${new URLSearchParams({
      method: "food.get",
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
          "Content-Type": "application/json", // Keep this for now, as it was in their example
          "Accept": "application/json", // Add Accept header
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text(); // Get raw response text
      console.error("FatSecret Food Get API error:", errorText);
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
    console.error("Error in FatSecret nutrient proxy:", error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all for 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", message: `The requested URL ${req.originalUrl} was not found on this server.` });
});

app.listen(PORT, () => {
  console.log(`SparkyFitnessServer listening on port ${PORT}`);
});