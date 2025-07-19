const reportRepository = require('../models/reportRepository');
const measurementRepository = require('../models/measurementRepository'); // For custom categories
const userRepository = require('../models/userRepository');
const goalRepository = require('../models/goalRepository'); // Import goalRepository
const { log } = require('../config/logging');

async function getReportsData(authenticatedUserId, targetUserId, startDate, endDate) {
  try {

    const [
      fetchedNutritionData,
      tabularDataRaw,
      measurementData,
      customCategoriesResult
    ] = await Promise.all([
      reportRepository.getNutritionData(targetUserId, startDate, endDate),
      reportRepository.getTabularFoodData(targetUserId, startDate, endDate),
      reportRepository.getMeasurementData(targetUserId, startDate, endDate),
      measurementRepository.getCustomCategories(targetUserId) // Reusing from measurementRepository
    ]);

    const customMeasurementsData = {};
    for (const category of customCategoriesResult) {
      const customMeasurementResult = await reportRepository.getCustomMeasurementsData(targetUserId, category.id, startDate, endDate);
      customMeasurementsData[category.id] = customMeasurementResult;
    }

    const tabularData = tabularDataRaw.map(row => ({
      ...row,
      foods: {
        name: row.food_name,
        brand: row.brand,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        saturated_fat: row.saturated_fat,
        polyunsaturated_fat: row.polyunsaturated_fat,
        monounsaturated_fat: row.monounsaturated_fat,
        trans_fat: row.trans_fat,
        cholesterol: row.cholesterol,
        sodium: row.sodium,
        potassium: row.potassium,
        dietary_fiber: row.dietary_fiber,
        sugars: row.sugars,
        vitamin_a: row.vitamin_a,
        vitamin_c: row.vitamin_c,
        calcium: row.calcium,
        iron: row.iron,
        serving_size: row.serving_size,
      }
    }));

    const nutritionData = fetchedNutritionData.map(item => ({
      date: item.date,
      calories: parseFloat(item.calories) || 0,
      protein: parseFloat(item.protein) || 0,
      carbs: parseFloat(item.carbs) || 0,
      fat: parseFloat(item.fat) || 0,
      saturated_fat: parseFloat(item.saturated_fat) || 0,
      polyunsaturated_fat: parseFloat(item.polyunsaturated_fat) || 0,
      monounsaturated_fat: parseFloat(item.monounsaturated_fat) || 0,
      trans_fat: parseFloat(item.trans_fat) || 0,
      cholesterol: parseFloat(item.cholesterol) || 0,
      sodium: parseFloat(item.sodium) || 0,
      potassium: parseFloat(item.potassium) || 0,
      dietary_fiber: parseFloat(item.dietary_fiber) || 0,
      sugars: parseFloat(item.sugars) || 0,
      vitamin_a: parseFloat(item.vitamin_a) || 0,
      vitamin_c: parseFloat(item.vitamin_c) || 0,
      calcium: parseFloat(item.calcium) || 0,
      iron: parseFloat(item.iron) || 0,
    }));

    return {
      nutritionData,
      tabularData,
      measurementData,
      customCategories: customCategoriesResult,
      customMeasurementsData,
    };
  } catch (error) {
    log('error', `Error fetching reports data for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getMiniNutritionTrends(authenticatedUserId, targetUserId, startDate, endDate) {
  try {

    if (!targetUserId) {
      log('error', 'getMiniNutritionTrends: targetUserId is undefined. Returning empty array.');
      return [];
    }
    const result = await reportRepository.getMiniNutritionTrends(targetUserId, startDate, endDate);

    const formattedResults = result.map(row => ({
      date: row.entry_date,
      calories: parseFloat(row.total_calories || 0),
      protein: parseFloat(row.total_protein || 0),
      carbs: parseFloat(row.total_carbs || 0),
      fat: parseFloat(row.total_fat || 0),
      dietary_fiber: parseFloat(row.total_dietary_fiber || 0),
    }));

    return formattedResults;
  } catch (error) {
    log('error', `Error fetching mini nutrition trends for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getNutritionTrendsWithGoals(authenticatedUserId, targetUserId, startDate, endDate) {
  try {
    // Fetch daily nutrition data
    const nutritionData = await reportRepository.getNutritionData(targetUserId, startDate, endDate);

    // Create a map for quick lookup of nutrition data by date
    const nutritionMap = new Map(nutritionData.map(item => [item.date.toISOString().split('T')[0], item]));

    const trendData = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const formattedDate = currentDate.toISOString().split('T')[0];
      const dailyNutrition = nutritionMap.get(formattedDate) || {};

      // Fetch the most recent goal for the current date
      const dailyGoal = await goalRepository.getMostRecentGoalBeforeDate(targetUserId, formattedDate);

      trendData.push({
        date: formattedDate,
        calories: parseFloat(dailyNutrition.calories || 0),
        protein: parseFloat(dailyNutrition.protein || 0),
        carbs: parseFloat(dailyNutrition.carbs || 0),
        fat: parseFloat(dailyNutrition.fat || 0),
        calorieGoal: parseFloat(dailyGoal?.calories || 0),
        proteinGoal: parseFloat(dailyGoal?.protein || 0),
        carbsGoal: parseFloat(dailyGoal?.carbs || 0),
        fatGoal: parseFloat(dailyGoal?.fat || 0),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return trendData;
  } catch (error) {
    log('error', `Error fetching nutrition trends with goals for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

module.exports = {
  getReportsData,
  getMiniNutritionTrends,
  getNutritionTrendsWithGoals,
};