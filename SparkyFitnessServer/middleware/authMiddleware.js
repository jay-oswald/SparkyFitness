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
    const targetUserId = req.params.userId || req.body.userId || req.query.userId || req.userId; // Assuming userId is in params, body, query, or is the authenticated user
    const authenticatedUserId = req.userId; // From authenticateToken middleware

    if (!targetUserId || !authenticatedUserId) {
      log('error', `Authorization: Missing targetUserId or authenticatedUserId. Target: ${targetUserId}, Auth: ${authenticatedUserId}`);
      return res.status(400).json({ error: 'Authorization: Missing user IDs for access check.' });
    }

    try {
      const { pool } = require('../db/db'); // Import pool here to avoid circular dependency
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
      log('error', `Authorization: Error checking access for user ${authenticatedUserId} to ${targetUserId} with permission ${permissionType}:`, error.message);
      return res.status(500).json({ error: 'Authorization: Internal server error during access check.' });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeAccess
};