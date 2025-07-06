const jwt = require('jsonwebtoken');
const { log } = require('../config/logging');
const { JWT_SECRET } = require('../security/encryption');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    log('warn', 'Authentication: No token provided.');
    return res.status(401).json({ error: 'Authentication: No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      log('warn', 'Authentication: Invalid or expired token.', err.message);
      return res.status(403).json({ error: 'Authentication: Invalid or expired token.' });
    }
    req.userId = user.userId; // Attach userId from JWT payload to request
    next();
  });
};

const authorizeAccess = (permissionType) => {
  return async (req, res, next) => {
    const authenticatedUserId = req.userId; // From authenticateToken middleware

    // Determine targetUserId: prioritize from params, body, query, then default to authenticatedUserId
    const targetUserId = req.params.userId || req.body.userId || req.query.userId || authenticatedUserId;

    if (!authenticatedUserId) {
      log('error', `Authorization: authenticatedUserId is missing.`);
      return res.status(401).json({ error: 'Authorization: Authentication required.' });
    }

    if (!targetUserId) {
      log('error', `Authorization: targetUserId is missing. Target: ${targetUserId}, Auth: ${authenticatedUserId}`);
      return res.status(400).json({ error: 'Authorization: Target user ID is missing for access check.' });
    }

    try {
      const pool = require('../db/connection'); // Import pool from connection.js
      const client = await pool.connect();
      const result = await client.query(
        `SELECT public.can_access_user_data($1, $2, $3) AS can_access`,
        [targetUserId, permissionType, authenticatedUserId]
      );
      client.release();

      if (result.rows[0].can_access) {
        next();
      } else {
        log('warn', `Authorization: User ${authenticatedUserId} denied ${permissionType} access to data for user ${targetUserId}.`);
        return res.status(403).json({ error: 'Authorization: Access denied.' });
      }
    } catch (error) {
      log('error', `Authorization: Error checking access for user ${authenticatedUserId} to ${targetUserId} with permission ${permissionType}:`, error); // Log the entire error object
      return res.status(500).json({ error: 'Authorization: Internal server error during access check.' });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeAccess
};