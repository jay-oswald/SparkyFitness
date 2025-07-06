const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const preferenceService = require('../services/preferenceService');

// Endpoint to update user preferences
router.put('/:targetUserId', authenticateToken, authorizeAccess('preferences'), async (req, res, next) => {
  const { targetUserId } = req.params;
  const preferenceData = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const updatedPreferences = await preferenceService.updateUserPreferences(req.userId, targetUserId, preferenceData);
    res.status(200).json(updatedPreferences);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User preferences not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete user preferences
router.delete('/:targetUserId', authenticateToken, authorizeAccess('preferences'), async (req, res, next) => {
  const { targetUserId } = req.params;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const result = await preferenceService.deleteUserPreferences(req.userId, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User preferences not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch user preferences
router.get('/:targetUserId', authenticateToken, authorizeAccess('preferences'), async (req, res, next) => {
  const { targetUserId } = req.params;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const preferences = await preferenceService.getUserPreferences(req.userId, targetUserId);
    res.status(200).json(preferences);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'User preferences not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to upsert user preferences
router.post('/', authenticateToken, authorizeAccess('preferences'), async (req, res, next) => {
  const preferenceData = req.body;

  if (!preferenceData.user_id) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const newPreferences = await preferenceService.upsertUserPreferences(req.userId, preferenceData);
    res.status(200).json(newPreferences);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;