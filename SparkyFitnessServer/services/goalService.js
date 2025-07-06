const goalRepository = require('../models/goalRepository');
const userRepository = require('../models/userRepository');
const { log } = require('../config/logging');
const { format } = require('date-fns');

async function getUserGoals(authenticatedUserId, targetUserId, selectedDate) {
  try {
    if (!targetUserId) {
      log('error', 'getUserGoals: targetUserId is undefined. Returning default goals.');
      return {
        calories: 2000, protein: 150, carbs: 250, fat: 67, water_goal: 8,
        saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25, trans_fat: 0,
        cholesterol: 300, sodium: 2300, potassium: 3500, dietary_fiber: 25, sugars: 50,
        vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 18
      };
    }

    let goals = await goalRepository.getGoalByDate(targetUserId, selectedDate);

    if (!goals) {
      goals = await goalRepository.getMostRecentGoalBeforeDate(targetUserId, selectedDate);
    }

    if (!goals) {
      goals = {
        calories: 2000, protein: 150, carbs: 250, fat: 67, water_goal: 8,
        saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25, trans_fat: 0,
        cholesterol: 300, sodium: 2300, potassium: 3500, dietary_fiber: 25, sugars: 50,
        vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 18
      };
    }
    return goals;
  } catch (error) {
    log('error', `Error fetching goals for user ${targetUserId} by ${authenticatedUserId} on ${selectedDate}:`, error);
    throw error;
  }
}

async function manageGoalTimeline(authenticatedUserId, goalData) {
  try {

    const {
      p_start_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal,
      p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
      p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
      p_vitamin_a, p_vitamin_c, p_calcium, p_iron
    } = goalData;

    // If editing a past date (before today), only update that specific date
    if (new Date(p_start_date) < new Date(format(new Date(), 'yyyy-MM-dd'))) {
      await goalRepository.upsertGoal({
        user_id: authenticatedUserId, goal_date: p_start_date, calories: p_calories, protein: p_protein, carbs: p_carbs, fat: p_fat, water_goal: p_water_goal,
        saturated_fat: p_saturated_fat, polyunsaturated_fat: p_polyunsaturated_fat, monounsaturated_fat: p_monounsaturated_fat, trans_fat: p_trans_fat,
        cholesterol: p_cholesterol, sodium: p_sodium, potassium: p_potassium, dietary_fiber: p_dietary_fiber, sugars: p_sugars,
        vitamin_a: p_vitamin_a, vitamin_c: p_vitamin_c, calcium: p_calcium, iron: p_iron
      });
      return { message: 'Goal for past date updated successfully.' };
    }

    // For today or future dates: delete 6 months and insert new goals
    const startDate = new Date(p_start_date);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6);

    await goalRepository.deleteGoalsInRange(authenticatedUserId, p_start_date, format(endDate, 'yyyy-MM-dd'));

    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      await goalRepository.upsertGoal({
        user_id: authenticatedUserId, goal_date: format(currentDate, 'yyyy-MM-dd'), calories: p_calories, protein: p_protein, carbs: p_carbs, fat: p_fat, water_goal: p_water_goal,
        saturated_fat: p_saturated_fat, polyunsaturated_fat: p_polyunsaturated_fat, monounsaturated_fat: p_monounsaturated_fat, trans_fat: p_trans_fat,
        cholesterol: p_cholesterol, sodium: p_sodium, potassium: p_potassium, dietary_fiber: p_dietary_fiber, sugars: p_sugars,
        vitamin_a: p_vitamin_a, vitamin_c: p_vitamin_c, calcium: p_calcium, iron: p_iron
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    await goalRepository.deleteDefaultGoal(authenticatedUserId);

    return { message: 'Goal timeline managed successfully.' };
  } catch (error) {
    log('error', `Error managing goal timeline for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

module.exports = {
  getUserGoals,
  manageGoalTimeline,
};