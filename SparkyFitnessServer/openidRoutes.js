const express = require("express");
const router = express.Router();
const openidClient = require("openid-client"); // Importing openid-client for OpenID Connect

router.use(express.json());

const context = {};

// 1. Discover the provider’s metadata
openidClient.Issuer.discover(
  "http://localhost:8080/.well-known/openid-configuration"
)
  .then((issuer) => {
    context.issuer = issuer;
    console.log(context);

    // 2. Register your client
    return new issuer.Client({
      client_id: "sparky",
    //   client_secret: "sparky",
      redirect_uris: [`http://localhost:3010/openid/callback`],
      token_endpoint_auth_method: "none",
      response_types: ["code"],
    });
  })
  .then((client) => {
    context.client = client;
    console.log("Client registered:", client);
  })
  .catch((error) => {
    console.error("Error during OpenID Connect setup:", error);
  });

// Kick off the flow
router.get("/login", (req, res) => {
  const codeVerifier = openidClient.generators.codeVerifier(); // PKCE
  const codeChallenge = openidClient.generators.codeChallenge(codeVerifier);

  req.session.codeVerifier = codeVerifier;
  console.log("session", req.session);

  const url = context.client.authorizationUrl({
    scope: "openid",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  res.redirect(url);
});

// Handle the callback
router.get("/callback", async (req, res, next) => {
  try {
    const params = context.client.callbackParams(req);
    const tokenSet = await context.client.callback(
      "http://localhost:3010/openid/callback",
      params,
      { code_verifier: req.session.codeVerifier }
    );

    console.log("received and validated tokens", tokenSet);
    console.log("validated ID Token claims", tokenSet.claims());

    req.session.user = tokenSet.claims(); // id_token payload
    req.session.tokens = tokenSet; // refresh_token if any
    res.redirect("/openid/api/me");
  } catch (e) {
    next(e);
  }
});

// Protect an API route
router.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.json(req.session.user);
});

module.exports = router;
