const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const exerciseService = require('../services/exerciseService');

// Endpoint to fetch exercises with search, filter, and pagination
router.get('/', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { userId: targetUserId, searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage } = req.query;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target User ID is required.' });
  }

  try {
    const { exercises, totalCount } = await exerciseService.getExercisesWithPagination(req.userId, targetUserId, searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage);
    res.status(200).json({ exercises, totalCount });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to search for exercises
router.get('/search/:name', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { name } = req.params;
  const { userId: targetUserId } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Exercise name is required.' });
  }

  try {
    const exercises = await exerciseService.searchExercises(req.userId, name, targetUserId);
    res.status(200).json(exercises);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to create a new exercise
router.post('/', authenticateToken, authorizeAccess('exercise_list'), express.json(), async (req, res, next) => {
  try {
    const newExercise = await exerciseService.createExercise(req.userId, req.body);
    res.status(201).json(newExercise);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to insert an exercise entry
router.post('/entries', authenticateToken, authorizeAccess('exercise_log'), express.json(), async (req, res, next) => {
  try {
    const newEntry = await exerciseService.createExerciseEntry(req.userId, req.body);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch an exercise entry by ID
router.get('/entries/:id', authenticateToken, authorizeAccess('exercise_log'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Exercise Entry ID is required.' });
  }
  try {
    const entry = await exerciseService.getExerciseEntryById(req.userId, id);
    res.status(200).json(entry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise entry not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update an exercise entry
router.put('/entries/:id', authenticateToken, authorizeAccess('exercise_log'), express.json(), async (req, res, next) => {
  const { id } = req.params;
  const { user_id: targetUserId, ...updateData } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Exercise Entry ID and Target User ID are required.' });
  }
  try {
    const updatedEntry = await exerciseService.updateExerciseEntry(req.userId, id, targetUserId, updateData);
    res.status(200).json(updatedEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise entry not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete an exercise entry
router.delete('/entries/:id', authenticateToken, authorizeAccess('exercise_log'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Exercise Entry ID and Target User ID are required.' });
  }
  try {
    const result = await exerciseService.deleteExerciseEntry(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise entry not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch an exercise by ID
router.get('/:id', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Exercise ID is required.' });
  }
  try {
    const exercise = await exerciseService.getExerciseById(req.userId, id);
    res.status(200).json(exercise);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update an exercise
router.put('/:id', authenticateToken, authorizeAccess('exercise_list'), express.json(), async (req, res, next) => {
  const { id } = req.params;
  const { user_id: targetUserId, ...updateData } = req.body;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Exercise ID and Target User ID are required.' });
  }
  try {
    const updatedExercise = await exerciseService.updateExercise(req.userId, id, targetUserId, updateData);
    res.status(200).json(updatedExercise);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to delete an exercise
router.delete('/:id', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.query;
  if (!id || !targetUserId) {
    return res.status(400).json({ error: 'Exercise ID and Target User ID are required.' });
  }
  try {
    const result = await exerciseService.deleteExercise(req.userId, id, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Exercise not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch exercise entries for a specific user and date using query parameters
router.get('/entries-by-date', authenticateToken, authorizeAccess('exercise_log'), async (req, res, next) => {
  const { userId: targetUserId, selectedDate } = req.query;
  if (!targetUserId || !selectedDate) {
    return res.status(400).json({ error: 'User ID and selectedDate are required.' });
  }
  try {
    const entries = await exerciseService.getExerciseEntriesByDate(req.userId, targetUserId, selectedDate);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to fetch exercise entries for a specific user and date (path parameters)
router.get('/entries/:userId/:date', authenticateToken, authorizeAccess('exercise_log'), async (req, res, next) => {
  const { userId: targetUserId, date } = req.params;
  if (!targetUserId || !date) {
    return res.status(400).json({ error: 'Target User ID and date are required.' });
  }
  try {
    const entries = await exerciseService.getExerciseEntriesByDate(req.userId, targetUserId, date);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;