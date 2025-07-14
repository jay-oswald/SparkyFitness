const express = require("express");
const router = express.Router();
const { Issuer, Client, generators, JWKS } = require("openid-client"); // Importing openid-client for OpenID Connect
const oidcSettingsRepository = require('./models/oidcSettingsRepository'); // Import the new repository
const userRepository = require('./models/userRepository'); // Import userRepository for auto-registration
const authService = require('./services/authService'); // Import authService for auto-registration
const { log } = require('./config/logging');

const context = {}; // This will hold our dynamically configured issuer and client

// Function to initialize the OIDC client dynamically
async function initializeOidcClient() {
  log('info', 'Attempting to initialize OIDC client...');
  try {
    const settings = await oidcSettingsRepository.getOidcSettings();

    if (!settings || !settings.is_active) {
      log('warn', 'OIDC integration is not active or settings are missing. Client will not be initialized.');
      context.client = null; // Ensure client is null if not active
      return;
    }

    log('info', `Discovering OIDC issuer: ${settings.issuer_url}`);
    const issuer = await Issuer.discover(settings.issuer_url);
    context.issuer = issuer;
    log('info', 'OpenID Connect Issuer discovered:', issuer.issuer);

    // Explicitly fetch JWKS if not provided by discovery
    if (!issuer.jwks && issuer.jwks_uri) {
      log('debug', `JWKS not found in discovery, fetching from jwks_uri: ${issuer.jwks_uri}`);
      const jwksResponse = await fetch(issuer.jwks_uri);
      if (!jwksResponse.ok) {
        throw new Error(`Failed to fetch JWKS from ${issuer.jwks_uri}: ${jwksResponse.statusText}`);
      }
      issuer.jwks = await jwksResponse.json();
      log('debug', 'Successfully fetched JWKS.');
    }

    log('info', `Registering OIDC client for client_id: ${settings.client_id}`);
    // Debugging: Log client_secret and issuer.jwks
    log('info', `Client Secret (decrypted): ${settings.client_secret ? 'Present' : 'Not Present'}`);
    //log('info', `Issuer JWKS: ${JSON.stringify(issuer.jwks, null, 2)}`);
    const client = new issuer.Client({
      client_id: settings.client_id,
      client_secret: settings.client_secret, // Use decrypted secret
      redirect_uris: settings.redirect_uris,
      scope: settings.scope, // Ensure scope is passed to client
      token_endpoint_auth_method: settings.token_endpoint_auth_method,
      response_types: settings.response_types,
      id_token_signed_response_alg: settings.id_token_signed_response_alg,
      userinfo_signed_response_alg: settings.userinfo_signed_response_alg,
    }); // The issuer's JWKS are discovered and held on the issuer object, no need to pass them here.
    context.client = client;
    context.settings = settings; // Store settings in context for auto-registration
    log('info', 'OpenID Connect Client registered successfully.');
  } catch (error) {
    log('error', 'Error during OpenID Connect setup:', error.message);
    context.client = null; // Ensure client is null on error
  }
}

// Middleware to ensure OIDC client is initialized before handling OIDC routes
router.use(async (req, res, next) => {
  if (!context.client) {
    await initializeOidcClient(); // Attempt to initialize if not already
  }
  if (!context.client) {
    log('error', 'OIDC client not initialized. Denying OIDC request.');
    return res.status(503).send('OIDC service unavailable. Configuration error.');
  }
  next();
});

router.use(express.json());

// Kick off the flow
router.get("/login", (req, res, next) => {
  log('debug', 'Received request to /openid/login');
  if (!context.client) {
    log('error', 'OIDC service not configured or initialized.');
    return res.status(503).json({ error: 'OIDC service not configured.' });
  }
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();
  const nonce = generators.nonce();

  req.session.codeVerifier = codeVerifier;
  req.session.state = state;
  req.session.nonce = nonce;
  log('debug', `[OIDC Login] Session ID: ${req.session.id}`);
  log('debug', `[OIDC Login] Session object before save: ${JSON.stringify(req.session, null, 2)}`);
  log('debug', `[OIDC Login] Storing in session: state=${state}, nonce=${nonce}, codeVerifier=${codeVerifier}`);

  const redirectUri = `${process.env.SPARKY_FITNESS_FRONTEND_URL}/oidc-callback`;

  const authorizationUrl = context.client.authorizationUrl({
    scope: context.settings.scope,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  req.session.save((err) => {
    if (err) {
      log('error', 'Failed to save session before sending OIDC auth URL:', err);
      return next(err);
    }
    log('info', `Sending OIDC authorization URL to frontend: ${authorizationUrl}`);
    res.json({ authorizationUrl });
  });
});

// Handle the callback from the frontend
router.post("/callback", async (req, res, next) => {
  log('debug', 'Received request to /openid/callback from frontend');
  if (!context.client) {
    log('error', 'OIDC service not configured or initialized for callback.');
    return res.status(503).json({ error: 'OIDC service not configured.' });
  }
  try {
    const { code, state } = req.body;
    log('debug', `[OIDC Callback] Received request with code: ${code ? 'present' : 'missing'}`);
    log('debug', `[OIDC Callback] Session ID: ${req.session.id}`);
    log('debug', `[OIDC Callback] Session content before callback: ${JSON.stringify(req.session, null, 2)}`);
    log('debug', `[OIDC Callback] Expected state from session: ${req.session.state}`);
    log('debug', `[OIDC Callback] Received state in body: ${state}`);

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is missing.' });
    }

    // Retrieve the redirect_uri that would have been used.
    // IMPORTANT: This must match one of the URIs registered with the OIDC provider.
    // This now points to the FRONTEND callback handler.
    const redirectUri = `${process.env.SPARKY_FITNESS_FRONTEND_URL}/oidc-callback`;

    const params = { code, state };

    const tokenSet = await context.client.callback(
      redirectUri,
      params,
      {
        code_verifier: req.session.codeVerifier,
        state: req.session.state,
        nonce: req.session.nonce
      }
    );

    log('info', "Successfully received and validated tokens from OIDC provider.");
    log('debug', "Validated ID Token claims:", tokenSet.claims());
 
    const claims = tokenSet.claims();
    log('info', 'OIDC callback: Received claims:', claims);
    const userEmail = claims.email;
    const oidcSub = claims.sub;

    // Auto-registration logic
    if (context.settings && context.settings.auto_register && userEmail && oidcSub) {
      log('info', `OIDC callback: Auto-registration enabled for ${userEmail}.`);
      try {
        log('info', `OIDC callback: Checking database for user ${userEmail}.`);
        let user = await userRepository.findUserByEmail(userEmail);
        log('info', `OIDC callback: Database check completed. User found: ${!!user}`);

        if (!user) {
          log('info', `OIDC callback: User ${userEmail} not found. Attempting auto-registration.`);
          const newUserId = await authService.registerOidcUser(userEmail, claims.name || userEmail, oidcSub);
          log('info', `OIDC callback: Auto-registered new user with ID: ${newUserId}. Refetching user from DB.`);
          user = await userRepository.findUserByEmail(userEmail);
          log('info', `OIDC callback: Refetched user successfully. User: ${JSON.stringify(user)}`);
        } else if (!user.oidc_sub) {
          log('info', `OIDC callback: User ${userEmail} found, but missing oidc_sub. Updating now.`);
          await userRepository.updateUserOidcSub(user.id, oidcSub);
          log('info', `OIDC callback: Updated oidc_sub for existing user: ${userEmail}`);
        } else {
          log('info', `OIDC callback: User ${userEmail} found with oidc_sub. Proceeding to session creation.`);
        }

        if (user && user.id) {
          req.session.user = { ...claims, userId: user.id };
          log('info', `OIDC callback: User session created for userId: ${user.id}. Session content: ${JSON.stringify(req.session.user)}`);
        } else {
          log('error', `OIDC callback: Failed to create or find a valid user for ${userEmail}. Cannot set session.`);
          // Fallback to storing claims directly if user object is invalid
          req.session.user = claims;
        }
      } catch (regError) {
        log('error', `OIDC callback: Error during auto-registration for ${userEmail}:`, regError.message);
        req.session.user = claims; // Store claims as a fallback
      }
    } else {
      log('warn', `OIDC callback: Auto-registration not enabled or required claims (email, sub) are missing. Storing claims directly. Email: ${userEmail}, Sub: ${oidcSub}`);
      req.session.user = claims;
    }

    req.session.tokens = tokenSet; // refresh_token if any
    log('info', 'OIDC authentication successful. Redirecting to /openid/api/me');
    res.json({ success: true, redirectUrl: "/" });
  } catch (e) {
    log('error', 'OIDC callback error:', e.message);
    next(e);
  }
});

// Protect an API route
router.get("/api/me", async (req, res) => {
  if (!req.session.user || !req.session.user.userId) {
    return res.status(401).json({ error: "Unauthorized", message: "No active session or user ID found." });
  }
  try {
    // Fetch the user's role from the database to ensure it's up-to-date
    const user = await userRepository.findUserById(req.session.user.userId);
    if (user) {
      // Combine session data with the role from the database
      const userData = {
        ...req.session.user,
        role: user.role // Ensure the role is included
      };
      return res.json(userData);
    } else {
      return res.status(404).json({ error: "Not Found", message: "User not found in database." });
    }
  } catch (error) {
    log('error', 'Error fetching user data for /openid/api/me:', error);
    return res.status(500).json({ error: "Internal Server Error", message: "Failed to retrieve user data." });
  }
});

module.exports = {
  router,
  initializeOidcClient // Export the initialization function
};
