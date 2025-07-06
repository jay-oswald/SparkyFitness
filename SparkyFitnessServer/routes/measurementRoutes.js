const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const measurementService = require('../services/measurementService');
const { log } = require('../config/logging');

// Middleware to authenticate API key for health data submission
router.use('/health-data', async (req, res, next) => {
  const apiKey = req.headers['authorization']?.split(' ')[1] || req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: "Unauthorized: Missing API Key" });
  }

  try {
    const client = await pool.connect(); // Need pool here for API key validation
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
    next(error);
  }
});

// New endpoint for receiving health data
router.post('/health-data', express.text({ type: '*/*' }), async (req, res, next) => {
  const rawBody = req.body;
  let healthDataArray = [];

  if (rawBody.startsWith('[') && rawBody.endsWith(']')) {
    try {
      healthDataArray = JSON.parse(rawBody);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON array format." });
    }
  } else if (rawBody.includes('}{')) {
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
      }
    }
  } else {
    try {
      healthDataArray.push(JSON.parse(rawBody));
    } catch (e) {
      return res.status(400).json({ error: "Invalid single JSON format." });
    }
  }

  try {
    const result = await measurementService.processHealthData(healthDataArray, req.userId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('{') && error.message.endsWith('}')) {
      const parsedError = JSON.parse(error.message);
      return res.status(400).json(parsedError);
    }
    next(error);
  }
});

// Endpoint to fetch water intake for a specific user and date
router.get('/water-intake/:targetUserId/:date', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { targetUserId, date } = req.params;
  if (!targetUserId || !date) {
    return res.status(400).json({ error: 'Target User ID and date are required.' });
  }
  try {
    const waterData = await measurementService.getWaterIntake(req.userId, targetUserId, date);
    res.status(200).json(waterData);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to upsert water intake
router.post('/water-intake', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { user_id, entry_date, glasses_consumed } = req.body;
  if (!user_id || !entry_date || glasses_consumed === undefined) {
    return res.status(400).json({ error: 'User ID, entry date, and glasses consumed are required.' });
  }
  try {
    const result = await measurementService.upsertWaterIntake(req.userId, user_id, entry_date, glasses_consumed);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch water intake by ID
router.get('/water-intake/entry/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Water Intake Entry ID is required.' });
  }
  try {
    const entry = await measurementService.getWaterIntakeEntryById(req.userId, id);
    res.status(200).json(entry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Water intake entry not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update water intake
router.put('/water-intake/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { user_id, ...updateData } = req.body;
  if (!id || !user_id) {
    return res.status(400).json({ error: 'Water Intake Entry ID and User ID are required.' });
  }
  try {
    const updatedEntry = await measurementService.updateWaterIntake(req.userId, id, user_id, updateData);
    res.status(200).json(updatedEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Water intake entry not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete water intake
router.delete('/water-intake/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Water Intake Entry ID and User ID are required.' });
  }
  try {
    const result = await measurementService.deleteWaterIntake(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Water intake entry not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to upsert check-in measurements
router.post('/check-in', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { user_id, entry_date, ...measurements } = req.body;
  if (!user_id || !entry_date) {
    return res.status(400).json({ error: 'User ID and entry date are required.' });
  }
  try {
    const result = await measurementService.upsertCheckInMeasurements(req.userId, user_id, entry_date, measurements);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch check-in measurements for a specific user and date
router.get('/check-in/:targetUserId/:date', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { targetUserId, date } = req.params;
  if (!targetUserId || !date) {
    return res.status(400).json({ error: 'Target User ID and date are required.' });
  }
  try {
    const measurement = await measurementService.getCheckInMeasurements(req.userId, targetUserId, date);
    res.status(200).json(measurement);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update check-in measurements
router.put('/check-in/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { user_id, entry_date, ...updateData } = req.body;
  if (!id || !user_id || !entry_date) {
    return res.status(400).json({ error: 'ID, User ID, and entry date are required.' });
  }
  try {
    const updatedMeasurement = await measurementService.updateCheckInMeasurements(req.userId, id, user_id, entry_date, updateData);
    res.status(200).json(updatedMeasurement);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Check-in measurement not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete check-in measurements
router.delete('/check-in/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Check-in Measurement ID and User ID are required.' });
  }
  try {
    const result = await measurementService.deleteCheckInMeasurements(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Check-in measurement not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch custom categories for a user
router.get('/custom-categories', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { userId: targetUserId } = req.query;
  try {
    const categories = await measurementService.getCustomCategories(req.userId, targetUserId);
    res.status(200).json(categories);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to create a new custom category
router.post('/custom-categories', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  try {
    const newCategory = await measurementService.createCustomCategory(req.userId, req.body);
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update a custom category
router.put('/custom-categories/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { user_id, ...updateData } = req.body;
  if (!id || !user_id) {
    return res.status(400).json({ error: 'Category ID and User ID are required.' });
  }
  try {
    const updatedCategory = await measurementService.updateCustomCategory(req.userId, id, user_id, updateData);
    res.status(200).json(updatedCategory);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Custom category not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete a custom category
router.delete('/custom-categories/:id', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Category ID and User ID are required.' });
  }
  try {
    const result = await measurementService.deleteCustomCategory(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Custom category not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch custom measurement entries
router.get('/custom-entries', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { userId: targetUserId, limit, orderBy, filter } = req.query;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }
  try {
    const entries = await measurementService.getCustomMeasurementEntries(req.userId, targetUserId, limit, orderBy, filter);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch custom measurement entries for a specific user and date
router.get('/custom-entries/:userId/:date', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { userId: targetUserId, date } = req.params;
  if (!targetUserId || !date) {
    return res.status(400).json({ error: 'Target User ID and date are required.' });
  }
  try {
    const entries = await measurementService.getCustomMeasurementEntriesByDate(req.userId, targetUserId, date);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch check-in measurements for a specific user and date range
router.get('/check-in-measurements-range/:userId/:startDate/:endDate', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { userId: targetUserId, startDate, endDate } = req.params;
  if (!targetUserId || !startDate || !endDate) {
    return res.status(400).json({ error: 'User ID, start date, and end date are required.' });
  }
  try {
    const measurements = await measurementService.getCheckInMeasurementsByDateRange(req.userId, targetUserId, startDate, endDate);
    res.status(200).json(measurements);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch custom measurements for a specific user, category, and date range
router.get('/custom-measurements-range/:userId/:categoryId/:startDate/:endDate', authenticateToken, authorizeAccess('checkin'), async (req, res, next) => {
  const { userId: targetUserId, categoryId, startDate, endDate } = req.params;
  if (!targetUserId || !categoryId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Target User ID, category ID, start date, and end date are required.' });
  }
  try {
    const measurements = await measurementService.getCustomMeasurementsByDateRange(req.userId, targetUserId, categoryId, startDate, endDate);
    res.status(200).json(measurements);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;