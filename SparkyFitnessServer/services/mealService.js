const mealRepository = require('../models/mealRepository');
const foodRepository = require('../models/foodRepository');
const { log } = require('../config/logging');

// --- Meal Template Service Functions ---

async function createMeal(userId, mealData) {
  try {
    mealData.user_id = userId;
    const newMeal = await mealRepository.createMeal(mealData);
    return newMeal;
  } catch (error) {
    log('error', `Error in mealService.createMeal for user ${userId}:`, error);
    throw error;
  }
}

async function getMeals(userId, isPublic = false) {
  try {
    const meals = await mealRepository.getMeals(userId, isPublic);
    return meals;
  } catch (error) {
    log('error', `Error in mealService.getMeals for user ${userId}:`, error);
    throw error;
  }
}

async function getMealById(userId, mealId) {
  try {
    const meal = await mealRepository.getMealById(mealId);
    if (!meal) {
      throw new Error('Meal not found.');
    }
    // Authorization check: User can access their own meals or public meals
    if (meal.user_id !== userId && !meal.is_public) {
      throw new Error('Forbidden: You do not have permission to access this meal.');
    }
    return meal;
  } catch (error) {
    log('error', `Error in mealService.getMealById for user ${userId}, meal ${mealId}:`, error);
    throw error;
  }
}

async function updateMeal(userId, mealId, updateData) {
  try {
    const meal = await mealRepository.getMealById(mealId);
    if (!meal) {
      throw new Error('Meal not found.');
    }
    // Authorization check: User can only update their own meals
    if (meal.user_id !== userId) {
      throw new Error('Forbidden: You do not have permission to update this meal.');
    }
    const updatedMeal = await mealRepository.updateMeal(mealId, userId, updateData);
    return updatedMeal;
  } catch (error) {
    log('error', `Error in mealService.updateMeal for user ${userId}, meal ${mealId}:`, error);
    throw error;
  }
}

async function deleteMeal(userId, mealId) {
  try {
    const meal = await mealRepository.getMealById(mealId);
    if (!meal) {
      throw new Error('Meal not found.');
    }
    // Authorization check: User can only delete their own meals
    if (meal.user_id !== userId) {
      throw new Error('Forbidden: You do not have permission to delete this meal.');
    }
    const success = await mealRepository.deleteMeal(mealId, userId);
    if (!success) {
      throw new Error('Failed to delete meal.');
    }
    return true;
  } catch (error) {
    log('error', `Error in mealService.deleteMeal for user ${userId}, meal ${mealId}:`, error);
    throw error;
  }
}

// --- Meal Plan Service Functions ---

async function createMealPlanEntry(userId, planData) {
  try {
    planData.user_id = userId;
    const newMealPlanEntry = await mealRepository.createMealPlanEntry(planData);
    return newMealPlanEntry;
  } catch (error) {
    log('error', `Error in mealService.createMealPlanEntry for user ${userId}:`, error);
    throw error;
  }
}

async function getMealPlanEntries(userId, startDate, endDate) {
  try {
    const mealPlanEntries = await mealRepository.getMealPlanEntries(userId, startDate, endDate);
    return mealPlanEntries;
  } catch (error) {
    log('error', `Error in mealService.getMealPlanEntries for user ${userId} from ${startDate} to ${endDate}:`, error);
    throw error;
  }
}

async function updateMealPlanEntry(userId, planId, updateData) {
  try {
    // First, verify ownership by fetching the entry by its ID for the specific user
    const mealPlanEntry = await mealRepository.getMealPlanEntryById(planId, userId);
    if (!mealPlanEntry) {
      throw new Error('Meal plan entry not found or not authorized.');
    }
    // If ownership is confirmed, proceed with the update
    const updatedMealPlanEntry = await mealRepository.updateMealPlanEntry(planId, userId, updateData);
    return updatedMealPlanEntry;
  } catch (error) {
    log('error', `Error in mealService.updateMealPlanEntry for user ${userId}, plan ${planId}:`, error);
    throw error;
  }
}

async function deleteMealPlanEntry(userId, planId) {
  try {
    // First, verify ownership by fetching the entry by its ID for the specific user
    const mealPlanEntry = await mealRepository.getMealPlanEntryById(planId, userId);
    if (!mealPlanEntry) {
      throw new Error('Meal plan entry not found or not authorized.');
    }
    // If ownership is confirmed, proceed with the deletion
    const success = await mealRepository.deleteMealPlanEntry(planId, userId);
    if (!success) {
      throw new Error('Failed to delete meal plan entry.');
    }
    return true;
  } catch (error) {
    log('error', `Error in mealService.deleteMealPlanEntry for user ${userId}, plan ${planId}:`, error);
    throw error;
  }
}

// --- Logging Meal Plan to Food Entries ---

async function logMealPlanEntryToDiary(userId, mealPlanId, targetDate) {
  try {
    const mealPlanEntry = await mealRepository.getMealPlanEntryById(mealPlanId, userId);
    if (!mealPlanEntry) {
      throw new Error('Meal plan entry not found or not authorized.');
    }

    const entriesToCreate = [];

    if (mealPlanEntry.meal_id) {
      // If it's a meal template, expand its foods
      const meal = await mealRepository.getMealById(mealPlanEntry.meal_id);
      if (!meal) {
        throw new Error('Associated meal template not found.');
      }
      for (const foodItem of meal.foods) {
        entriesToCreate.push({
          user_id: userId,
          food_id: foodItem.food_id,
          meal_type: mealPlanEntry.meal_type,
          quantity: foodItem.quantity,
          unit: foodItem.unit,
          entry_date: targetDate || mealPlanEntry.plan_date,
          variant_id: foodItem.variant_id,
          meal_plan_id: mealPlanId,
        });
      }
    } else if (mealPlanEntry.food_id) {
      // If it's a direct food entry
      entriesToCreate.push({
        user_id: userId,
        food_id: mealPlanEntry.food_id,
        meal_type: mealPlanEntry.meal_type,
        quantity: mealPlanEntry.quantity,
        unit: mealPlanEntry.unit,
        entry_date: targetDate || mealPlanEntry.plan_date,
        variant_id: mealPlanEntry.variant_id,
        meal_plan_id: mealPlanId,
      });
    } else {
      throw new Error('Meal plan entry is neither a meal nor a food.');
    }

    const createdFoodEntries = [];
    for (const entryData of entriesToCreate) {
      const newFoodEntry = await foodRepository.createFoodEntry(entryData);
      createdFoodEntries.push(newFoodEntry);
    }
    return createdFoodEntries;
  } catch (error) {
    log('error', `Error in mealService.logMealPlanEntryToDiary for user ${userId}, plan ${mealPlanId}:`, error);
    throw error;
  }
}

async function logDayMealPlanToDiary(userId, planDate, targetDate) {
  try {
    const mealPlanEntries = await mealRepository.getMealPlanEntries(userId, planDate, planDate);
    const createdFoodEntries = [];

    for (const entry of mealPlanEntries) {
      const newEntries = await logMealPlanEntryToDiary(userId, entry.id, targetDate);
      createdFoodEntries.push(...newEntries);
    }
    return createdFoodEntries;
  } catch (error) {
    log('error', `Error in mealService.logDayMealPlanToDiary for user ${userId}, date ${planDate}:`, error);
    throw error;
  }
}

module.exports = {
  createMeal,
  getMeals,
  getMealById,
  updateMeal,
  deleteMeal,
  createMealPlanEntry,
  getMealPlanEntries,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  logMealPlanEntryToDiary,
  logDayMealPlanToDiary,
};