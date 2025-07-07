const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const foodService = require('../services/foodService');
const { log } = require('../config/logging');
const { getFatSecretAccessToken, foodNutrientCache, CACHE_DURATION_MS, FATSECRET_API_BASE_URL } = require('../integrations/fatsecret/fatsecretService');
const { searchOpenFoodFacts, searchOpenFoodFactsByBarcode } = require('../integrations/openfoodfacts/openFoodFactsService');
const { searchNutritionixFoods, getNutritionixNutrients, getNutritionixBrandedNutrients } = require('../integrations/nutritionix/nutritionixService');

router.use(express.json());

// Middleware to get FatSecret API keys from Supabase
router.use('/fatsecret', authenticateToken, async (req, res, next) => {
  const providerId = req.headers['x-provider-id'];

  if (!providerId) {
    return res.status(400).json({ error: "Missing x-provider-id header" });
  }

  try {
    const providerDetails = await foodService.getFoodDataProviderDetails(req.userId, providerId);
    if (!providerDetails || !providerDetails.app_id || !providerDetails.app_key) {
      return next(new Error("Failed to retrieve FatSecret API keys. Please check provider configuration."));
    }
    req.clientId = providerDetails.app_id;
    req.clientSecret = providerDetails.app_key;
    next();
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-data-providers', authenticateToken, async (req, res, next) => {
  try {
    const providers = await foodService.getFoodDataProviders(req.userId);
    res.status(200).json(providers);
  } catch (error) {
    next(error);
  }
});

router.get('/food-data-providers/user/:targetUserId', authenticateToken, authorizeAccess('food_list', (req) => req.params.targetUserId), async (req, res, next) => {
  const { targetUserId } = req.params;
  if (!targetUserId) {
    return res.status(400).json({ error: "Missing target user ID" });
  }
  try {
    const providers = await foodService.getFoodDataProvidersForUser(req.userId, targetUserId);
    res.status(200).json(providers);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/food-data-providers', authenticateToken, async (req, res, next) => {
  try {
    const newProvider = await foodService.createFoodDataProvider(req.userId, req.body);
    res.status(201).json(newProvider);
  } catch (error) {
    next(error);
  }
});

router.put('/food-data-providers/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Provider ID is required.' });
  }
  try {
    const updatedProvider = await foodService.updateFoodDataProvider(req.userId, id, req.body);
    res.status(200).json(updatedProvider);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food data provider not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});
 
router.delete('/food-data-providers/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Provider ID is required.' });
  }
  try {
    await foodService.deleteFoodDataProvider(req.userId, id);
    res.status(200).json({ message: 'Food data provider deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food data provider not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});
 
router.get('/food-data-providers/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Missing provider ID" });
  }
  try {
    const providerDetails = await foodService.getFoodDataProviderDetails(req.userId, id);
    res.status(200).json(providerDetails);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/fatsecret/search', async (req, res, next) => {
  const { query } = req.query;
  const { clientId, clientSecret } = req;

  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    const data = await foodService.searchFatSecretFoods(query, clientId, clientSecret);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/fatsecret/nutrients', async (req, res, next) => {
  const { foodId } = req.query;
  const { clientId, clientSecret } = req;

  if (!foodId) {
    return res.status(400).json({ error: "Missing foodId" });
  }

  try {
    const data = await foodService.getFatSecretNutrients(foodId, clientId, clientSecret);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/openfoodfacts/search', authenticateToken, async (req, res, next) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Missing search query" });
  }
  try {
    const data = await searchOpenFoodFacts(query);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/openfoodfacts/barcode/:barcode', authenticateToken, async (req, res, next) => {
  const { barcode } = req.params;
  if (!barcode) {
    return res.status(400).json({ error: "Missing barcode" });
  }
  try {
    const data = await searchOpenFoodFactsByBarcode(barcode);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/nutritionix/search', authenticateToken, async (req, res, next) => {
  const { query, providerId } = req.query;
  if (!query || !providerId) {
    return res.status(400).json({ error: "Missing search query or providerId" });
  }
  try {
    const data = await searchNutritionixFoods(query, providerId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/nutritionix/nutrients', authenticateToken, async (req, res, next) => {
  const { query, providerId } = req.query;
  if (!query || !providerId) {
    return res.status(400).json({ error: "Missing search query or providerId" });
  }
  try {
    const data = await getNutritionixNutrients(query, providerId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/nutritionix/item', authenticateToken, async (req, res, next) => {
  const { nix_item_id, providerId } = req.query;
  if (!nix_item_id || !providerId) {
    return res.status(400).json({ error: "Missing nix_item_id or providerId" });
  }
  try {
    const data = await getNutritionixBrandedNutrients(nix_item_id, providerId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticateToken, authorizeAccess('food_list', (req) => req.userId), async (req, res, next) => {
  const { name, exactMatch, broadMatch, checkCustom } = req.query;
 
  if (!name) {
    return res.status(400).json({ error: 'Food name is required.' });
  }
 
  try {
    const foods = await foodService.searchFoods(req.userId, name, req.userId, exactMatch === 'true', broadMatch === 'true', checkCustom === 'true');
    res.status(200).json(foods);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Invalid search parameters.') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const foodData = { ...req.body, user_id: req.userId }; // Ensure user_id is set for the food
    const newFood = await foodService.createFood(req.userId, foodData);
    res.status(201).json(newFood);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});
router.post('/food-entries', authenticateToken, authorizeAccess('food_log'), async (req, res, next) => {
  try {
    const newEntry = await foodService.createFoodEntry(req.userId, req.body);
    res.status(201).json(newEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});
router.put('/food-entries/:id', authenticateToken, authorizeAccess('food_log'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food entry ID is required.' });
  }
  try {
    const updatedEntry = await foodService.updateFoodEntry(req.userId, id, req.body);
    res.status(200).json(updatedEntry);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food entry not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/food-entries/:id', authenticateToken, authorizeAccess('food_log'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food entry ID is required.' });
  }
  try {
    await foodService.deleteFoodEntry(req.userId, id);
    res.status(200).json({ message: 'Food entry deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food entry not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-entries', authenticateToken, authorizeAccess('food_log', (req) => req.userId), async (req, res, next) => {
  const { selectedDate } = req.query;
  if (!selectedDate) {
    return res.status(400).json({ error: 'Selected date is required.' });
  }
  try {
    const entries = await foodService.getFoodEntriesByDate(req.userId, req.userId, selectedDate);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-entries/:date', authenticateToken, authorizeAccess('food_log', (req) => req.userId), async (req, res, next) => {
  const { date } = req.params;
  if (!date) {
    return res.status(400).json({ error: 'Date is required.' });
  }
  try {
    const entries = await foodService.getFoodEntriesByDate(req.userId, req.userId, date);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-entries-range/:startDate/:endDate', authenticateToken, authorizeAccess('food_log', (req) => req.userId), async (req, res, next) => {
  const { startDate, endDate } = req.params;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required.' });
  }
  try {
    const entries = await foodService.getFoodEntriesByDateRange(req.userId, req.userId, startDate, endDate);
    res.status(200).json(entries);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});
router.get('/foods-paginated', authenticateToken, async (req, res, next) => {
  const { searchTerm, foodFilter, currentPage, itemsPerPage, sortBy } = req.query;
  try {
    const { foods, totalCount } = await foodService.getFoodsWithPagination(req.userId, searchTerm, foodFilter, currentPage, itemsPerPage, sortBy);
    res.status(200).json({ foods, totalCount });
  } catch (error) {
    next(error);
  }
});

router.post('/food-variants', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const newVariant = await foodService.createFoodVariant(req.userId, req.body);
    res.status(201).json(newVariant);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-variants', authenticateToken, authorizeAccess('food_list', (req) => req.userId), async (req, res, next) => {
  const { food_id } = req.query;
  if (!food_id) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }
  try {
    const variants = await foodService.getFoodVariantsByFoodId(req.userId, food_id);
    res.status(200).json(variants);
  } catch (error) {
    // Let the centralized error handler manage the status codes and messages
    next(error);
  }
});

router.post('/food-variants/bulk', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const variantsData = req.body;
    const createdVariants = await foodService.bulkCreateFoodVariants(req.userId, variantsData);
    res.status(201).json(createdVariants);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/food-variants/:id', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food Variant ID is required.' });
  }
  try {
    const variant = await foodService.getFoodVariantById(req.userId, id);
    res.status(200).json(variant);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food variant not found.' || error.message === 'Associated food not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/food-variants/:id', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { id } = req.params;
  const { food_id } = req.body; // food_id is needed for authorization in service layer
  if (!id || !food_id) {
    return res.status(400).json({ error: 'Food Variant ID and Food ID are required.' });
  }
  try {
    const updatedVariant = await foodService.updateFoodVariant(req.userId, id, req.body);
    res.status(200).json(updatedVariant);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food variant not found.' || error.message === 'Associated food not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/food-variants/:id', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food Variant ID is required.' });
  }
  try {
    await foodService.deleteFoodVariant(req.userId, id);
    res.status(200).json({ message: 'Food variant deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food variant not found.' || error.message === 'Associated food not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/create-or-get', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  try {
    const { foodSuggestion } = req.body;
    const food = await foodService.createOrGetFood(req.userId, foodSuggestion);
    res.status(200).json({ foodId: food.id });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/:foodId', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { foodId } = req.params;
  if (!foodId) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }
  try {
    const food = await foodService.getFoodById(req.userId, foodId);
    res.status(200).json(food);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food not found.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/:id', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }
  try {
    const updatedFood = await foodService.updateFood(req.userId, id, req.body);
    res.status(200).json(updatedFood);
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food not found or not authorized to update.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:id', authenticateToken, authorizeAccess('food_list'), async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Food ID is required.' });
  }
  try {
    await foodService.deleteFood(req.userId, id);
    res.status(200).json({ message: 'Food deleted successfully.' });
  } catch (error) {
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Food not found or not authorized to delete.') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});
module.exports = router;