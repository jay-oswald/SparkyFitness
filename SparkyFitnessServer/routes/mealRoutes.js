const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const mealService = require('../services/mealService');
const { log } = require('../config/logging');

router.use(express.json());

// --- Meal Plan Routes ---

// Create a new meal plan entry
router.post('/plan', authenticateToken, authorizeAccess('meal_plan'), async (req, res, next) => {
  try {
    const newMealPlanEntry = await mealService.createMealPlanEntry(req.userId, req.body);
    res.status(201).json(newMealPlanEntry);
  } catch (error) {
    log('error', `Error creating meal plan entry:`, error);
    next(error);
  }
});

// Get meal plan entries for a specific date or date range
router.get('/plan', authenticateToken, authorizeAccess('meal_plan'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required for meal plan retrieval.' });
    }
    const mealPlanEntries = await mealService.getMealPlanEntries(req.userId, startDate, endDate);
    res.status(200).json(mealPlanEntries);
  } catch (error) {
    log('error', `Error getting meal plan entries:`, error);
    next(error);
  }
});

// Update a meal plan entry
router.put('/plan/:id', authenticateToken, authorizeAccess('meal_plan'), async (req, res, next) => {
  try {
    const updatedMealPlanEntry = await mealService.updateMealPlanEntry(req.userId, req.params.id, req.body);
    res.status(200).json(updatedMealPlanEntry);
  } catch (error) {
    log('error', `Error updating meal plan entry ${req.params.id}:`, error);
    if (error.message === 'Meal plan entry not found or not authorized.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Delete a meal plan entry
router.delete('/plan/:id', authenticateToken, authorizeAccess('meal_plan'), async (req, res, next) => {
  try {
    await mealService.deleteMealPlanEntry(req.userId, req.params.id);
    res.status(200).json({ message: 'Meal plan entry deleted successfully.' });
  } catch (error) {
    log('error', `Error deleting meal plan entry ${req.params.id}:`, error);
    if (error.message === 'Meal plan entry not found or not authorized.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// --- Meal Template Routes ---

// Create a new meal template
router.post('/', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const newMeal = await mealService.createMeal(req.userId, req.body);
    res.status(201).json(newMeal);
  } catch (error) {
    log('error', `Error creating meal:`, error);
    next(error);
  }
});

// Get all meal templates for the user (and public ones)
router.get('/', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const isPublic = req.query.is_public === 'true';
    const meals = await mealService.getMeals(req.userId, isPublic);
    res.status(200).json(meals);
  } catch (error) {
    log('error', `Error getting meals:`, error);
    next(error);
  }
});

// Get a specific meal template by ID
router.get('/:id', authenticateToken, authorizeAccess('meal'), async (req, res, next) => {
  try {
    const meal = await mealService.getMealById(req.userId, req.params.id);
    res.status(200).json(meal);
  } catch (error) {
    log('error', `Error getting meal by ID ${req.params.id}:`, error);
    if (error.message === 'Meal not found.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Update an existing meal template
router.put('/:id', authenticateToken, authorizeAccess('meal'), async (req, res, next) => {
  try {
    const updatedMeal = await mealService.updateMeal(req.userId, req.params.id, req.body);
    res.status(200).json(updatedMeal);
  } catch (error) {
    log('error', `Error updating meal ${req.params.id}:`, error);
    if (error.message === 'Meal not found.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// Delete a meal template
router.delete('/:id', authenticateToken, authorizeAccess('meal'), async (req, res, next) => {
  try {
    await mealService.deleteMeal(req.userId, req.params.id);
    res.status(200).json({ message: 'Meal deleted successfully.' });
  } catch (error) {
    log('error', `Error deleting meal ${req.params.id}:`, error);
    if (error.message === 'Meal not found.') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

// --- Logging Meal Plan to Food Entries ---

// Log a specific meal plan entry to the food diary
router.post('/plan/:id/log-to-diary', authenticateToken, authorizeAccess('food_log'), async (req, res, next) => {
  try {
    const { target_date } = req.body;
    const createdFoodEntries = await mealService.logMealPlanEntryToDiary(req.userId, req.params.id, target_date);
    res.status(201).json(createdFoodEntries);
  } catch (error) {
    log('error', `Error logging meal plan entry ${req.params.id} to diary:`, error);
    if (error.message === 'Meal plan entry not found or not authorized.' || error.message === 'Associated meal template not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// Log all meal plan entries for a specific day to the food diary
router.post('/plan/log-day-to-diary', authenticateToken, authorizeAccess('food_log'), async (req, res, next) => {
  try {
    const { plan_date, target_date } = req.body;
    if (!plan_date) {
      return res.status(400).json({ error: 'plan_date is required.' });
    }
    const createdFoodEntries = await mealService.logDayMealPlanToDiary(req.userId, plan_date, target_date);
    res.status(201).json(createdFoodEntries);
  } catch (error) {
    log('error', `Error logging day meal plan to diary for date ${req.body.plan_date}:`, error);
    next(error);
  }
});

module.exports = router;