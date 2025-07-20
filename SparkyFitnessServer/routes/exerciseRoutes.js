const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const exerciseService = require('../services/exerciseService');


// Endpoint to fetch exercises with search, filter, and pagination
router.get('/', authenticateToken, authorizeAccess('exercise_list', (req) => req.userId), async (req, res, next) => {
  const { searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage } = req.query;
 
  try {
    const { exercises, totalCount } = await exerciseService.getExercisesWithPagination(req.userId, req.userId, searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage);
    res.status(200).json({ exercises, totalCount });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to get suggested exercises
router.get('/suggested', authenticateToken, authorizeAccess('exercise_list', (req) => req.userId), async (req, res, next) => {
  const { limit } = req.query;
  try {
    const suggestedExercises = await exerciseService.getSuggestedExercises(req.userId, limit);
    res.status(200).json(suggestedExercises);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});
// Endpoint to search for exercises
router.get('/search/:name', authenticateToken, authorizeAccess('exercise_list', (req) => req.userId), async (req, res, next) => {
  const { name } = req.params;
 
  if (!name) {
    return res.status(400).json({ error: 'Exercise name is required.' });
  }
 
  try {
    const exercises = await exerciseService.searchExercises(req.userId, name, req.userId);
    res.status(200).json(exercises);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to search for exercises from Wger
router.get('/search-external', authenticateToken, authorizeAccess('exercise_list', (req) => req.userId), async (req, res, next) => {
  const { query, providerId, providerType } = req.query; // Get providerId and providerType from query
  if (!query) {
    return res.status(400).json({ error: 'Search query is required.' });
  }
  if (!providerId || !providerType) {
    return res.status(400).json({ error: 'Provider ID and Type are required for external search.' });
  }
  try {
    const exercises = await exerciseService.searchExternalExercises(req.userId, query, providerId, providerType); // Pass authenticatedUserId, query, providerId, and providerType
    res.status(200).json(exercises);
  } catch (error) {
    next(error);
  }
});

// Endpoint to add an external exercise to user's exercises
router.post('/add-external', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { wgerExerciseId } = req.body;
  if (!wgerExerciseId) {
    return res.status(400).json({ error: 'Wger exercise ID is required.' });
  }
  try {
    const newExercise = await exerciseService.addExternalExerciseToUserExercises(req.userId, wgerExerciseId);
    res.status(201).json(newExercise);
  } catch (error) {
    next(error);
  }
});

// Endpoint to add a Nutritionix exercise to user's exercises
router.post('/add-nutritionix-exercise', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const nutritionixExerciseData = req.body;
  if (!nutritionixExerciseData) {
    return res.status(400).json({ error: 'Nutritionix exercise data is required.' });
  }
  try {
    const newExercise = await exerciseService.addNutritionixExerciseToUserExercises(req.userId, nutritionixExerciseData);
    res.status(201).json(newExercise);
  } catch (error) {
    next(error);
  }
});


// Endpoint to fetch an exercise by ID
router.get('/:id', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Exercise ID is required and must be a valid UUID.' });
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

// Endpoint to create a new exercise
router.post('/', authenticateToken, authorizeAccess('exercise_list'), express.json(), async (req, res, next) => {
  try {
    const newExercise = await exerciseService.createExercise(req.userId, { ...req.body, user_id: req.userId });
    res.status(201).json(newExercise);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Endpoint to update an exercise
router.put('/:id', authenticateToken, authorizeAccess('exercise_list'), express.json(), async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Exercise ID is required and must be a valid UUID.' });
  }
  try {
    const updatedExercise = await exerciseService.updateExercise(req.userId, id, updateData);
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

// Endpoint to get deletion impact for an exercise
router.get('/:id/deletion-impact', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Exercise ID is required and must be a valid UUID.' });
    }
    try {
        const impact = await exerciseService.getExerciseDeletionImpact(req.userId, id);
        res.status(200).json(impact);
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

// Endpoint to delete an exercise
router.delete('/:id', authenticateToken, authorizeAccess('exercise_list'), async (req, res, next) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Exercise ID is required and must be a valid UUID.' });
  }
  try {
    const result = await exerciseService.deleteExercise(req.userId, id);
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


module.exports = router;