const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const goalService = require('../services/goalService');

router.get('/', authenticateToken, authorizeAccess('goals'), async (req, res, next) => {
  const { userId: targetUserId, selectedDate } = req.query;

  if (!targetUserId || !selectedDate) {
    return res.status(400).json({ error: 'Target User ID and selectedDate are required.' });
  }

  try {
    const goals = await goalService.getUserGoals(req.userId, targetUserId, selectedDate);
    res.status(200).json(goals);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/for-date', authenticateToken, authorizeAccess('goals'), async (req, res, next) => {
  const { userId: targetUserId, date } = req.query;

  if (!targetUserId || !date) {
    return res.status(400).json({ error: 'Target User ID and date are required.' });
  }

  try {
    const goals = await goalService.getUserGoals(req.userId, targetUserId, date);
    res.status(200).json(goals);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/manage-timeline', authenticateToken, authorizeAccess('goals'), async (req, res, next) => {
  const { userId: targetUserId, ...goalData } = req.body;

  if (!targetUserId || !goalData.p_start_date) {
    return res.status(400).json({ error: 'Target User ID and start date are required.' });
  }

  try {
    const result = await goalService.manageGoalTimeline(req.userId, { userId: targetUserId, ...goalData });
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;