const jwt = require('jsonwebtoken');
const { log } = require('../config/logging');
const { JWT_SECRET } = require('../security/encryption');
const userRepository = require('../models/userRepository'); // Import userRepository

const authenticateToken = (req, res, next) => {
  // Check for JWT token in Authorization header (for traditional login)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        log('warn', 'Authentication: Invalid or expired token.', err.message);
        return res.status(403).json({ error: 'Authentication: Invalid or expired token.' });
      }
      req.userId = user.userId; // Attach userId from JWT payload to request
      next();
    });
  } else if (req.session && req.session.user && req.session.user.userId) {
    // If no JWT token, check for session-based authentication (for OIDC)
    log('debug', `Session-based authentication: User ID from session: ${req.session.user.userId}`);
    req.userId = req.session.user.userId;
    next();
  } else {
    log('warn', 'Authentication: No token or active session provided.');
    return res.status(401).json({ error: 'Authentication: No token or active session provided.' });
  }
};

const authorizeAccess = (permissionType, getTargetUserIdFromRequest = null) => {
  return async (req, res, next) => {
    const authenticatedUserId = req.userId; // From authenticateToken middleware

    if (!authenticatedUserId) {
      log('error', `Authorization: authenticatedUserId is missing.`);
      return res.status(401).json({ error: 'Authorization: Authentication required.' });
    }

    let targetUserId;

    if (getTargetUserIdFromRequest) {
      // If a custom function is provided, use it to get the targetUserId
      targetUserId = getTargetUserIdFromRequest(req);
    } else { // No custom getTargetUserIdFromRequest function provided
      const resourceId = req.params.id;

      if (resourceId) {
        // If there's a resource ID in params, try to determine owner from repository
        let repository;
        let getOwnerIdFunction;

        switch (permissionType) {
          case 'exercise_log':
            repository = require('../models/exerciseRepository');
            getOwnerIdFunction = repository.getExerciseEntryOwnerId;
            break;
          case 'food_log':
            repository = require('../models/foodRepository');
            getOwnerIdFunction = repository.getFoodEntryOwnerId;
            break;
          case 'food_list':
            repository = require('../models/foodRepository');
            if (req.originalUrl.includes('/food-variants')) {
              getOwnerIdFunction = repository.getFoodVariantOwnerId;
            } else {
              getOwnerIdFunction = repository.getFoodOwnerId;
            }
            break;
          case 'meal_list': // For managing meal templates
            repository = require('../models/mealRepository');
            getOwnerIdFunction = repository.getMealOwnerId;
            break;
          case 'meal_plan':
            repository = require('../models/mealPlanTemplateRepository');
            getOwnerIdFunction = repository.getMealPlanTemplateOwnerId;
            break;
          case 'checkin':
            repository = require('../models/measurementRepository');
            // Distinguish between custom categories and custom measurement entries
            if (req.baseUrl.includes('/measurements') && req.path.includes('/custom-entries')) {
              getOwnerIdFunction = repository.getCustomMeasurementOwnerId;
            } else {
              getOwnerIdFunction = repository.getCustomCategoryOwnerId;
            }
            break;
          case 'goal':
            repository = require('../models/goalRepository');
            getOwnerIdFunction = repository.getGoalOwnerId;
            break;
          case 'preference':
            repository = require('../models/preferenceRepository');
            getOwnerIdFunction = repository.getPreferenceOwnerId;
            break;
          case 'report':
            repository = require('../models/reportRepository');
            getOwnerIdFunction = repository.getReportOwnerId;
            break;
          case 'chat':
            repository = require('../models/chatRepository');
            getOwnerIdFunction = repository.getChatOwnerId;
            break;
          default:
            // If permissionType is known but no specific owner function, or unknown permissionType
            log('warn', `Authorization: No specific owner ID function for permission type ${permissionType}. Defaulting to authenticated user.`);
            targetUserId = authenticatedUserId;
            break;
        }

        if (getOwnerIdFunction) {
          try {
            targetUserId = await getOwnerIdFunction(resourceId);
            if (!targetUserId) {
              log('warn', `Authorization: Owner ID not found for resource ${resourceId} with permission ${permissionType}.`);
              return res.status(404).json({ error: 'Authorization: Resource not found or owner could not be determined.' });
            }
          } catch (err) {
            log('error', `Authorization: Error getting owner ID for resource ${resourceId} with permission ${permissionType}:`, err);
            return res.status(500).json({ error: 'Authorization: Internal server error during owner ID retrieval.' });
          }
        }
      } else {
        // If no resource ID in params, assume the operation is on the authenticated user's own data
        targetUserId = authenticatedUserId;
      }
    }

    if (!targetUserId) {
      log('error', `Authorization: targetUserId could not be determined for permission ${permissionType}.`);
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

const isAdmin = async (req, res, next) => {
  if (!req.userId) {
    log('warn', 'Admin Check: No user ID found in request. User not authenticated.');
    return res.status(401).json({ error: 'Admin Check: Authentication required.' });
  }

  try {
    const userRole = await userRepository.getUserRole(req.userId);
    if (userRole === 'admin') {
      next();
    } else {
      log('warn', `Admin Check: User ${req.userId} with role '${userRole}' attempted to access admin resource.`);
      return res.status(403).json({ error: 'Admin Check: Access denied. Admin privileges required.' });
    }
  } catch (error) {
    log('error', `Admin Check: Error checking user role for user ${req.userId}: ${error.message}`);
    return res.status(500).json({ error: 'Admin Check: Internal server error during role check.' });
  }
};

module.exports = {
  authenticateToken,
  authorizeAccess,
  isAdmin
};