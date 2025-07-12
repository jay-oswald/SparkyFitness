const mealPlanTemplateRepository = require('../models/mealPlanTemplateRepository');
const mealRepository = require('../models/mealRepository');
const foodRepository = require('../models/foodRepository');
const { log } = require('../config/logging');

async function createMealPlanTemplate(userId, planData) {
    log('info', `createMealPlanTemplate service - received planData:`, planData);
    try {
        if (planData.is_active) {
            await mealPlanTemplateRepository.deactivateAllMealPlanTemplates(userId);
        }
        const newPlan = await mealPlanTemplateRepository.createMealPlanTemplate({ ...planData, user_id: userId });
        log('info', 'createMealPlanTemplate service - newPlan:', newPlan);
        if (newPlan.is_active) {
            await foodRepository.createFoodEntriesFromTemplate(newPlan.id, userId);
        }
        return newPlan;
    } catch (error) {
        log('error', `Error creating meal plan template for user ${userId}: ${error.message}`, error);
        throw new Error('Failed to create meal plan template.');
    }
}

async function getMealPlanTemplates(userId) {
    try {
        return await mealPlanTemplateRepository.getMealPlanTemplatesByUserId(userId);
    } catch (error) {
        log('error', `Error fetching meal plan templates for user ${userId}:`, error);
        throw new Error('Failed to fetch meal plan templates.');
    }
}

async function updateMealPlanTemplate(planId, userId, planData) {
    try {
        // When a plan is updated, remove the old food entries that were created from it.
        // The new entries will be generated on-the-fly when the diary is viewed.
        await foodRepository.deleteFoodEntriesByTemplateId(planId, userId);

        if (planData.is_active) {
            await mealPlanTemplateRepository.deactivateAllMealPlanTemplates(userId);
        }
        const updatedPlan = await mealPlanTemplateRepository.updateMealPlanTemplate(planId, { ...planData, user_id: userId });
        if (updatedPlan.is_active) {
            await foodRepository.createFoodEntriesFromTemplate(updatedPlan.id, userId);
        }
        return updatedPlan;
    } catch (error) {
        log('error', `Error updating meal plan template ${planId} for user ${userId}: ${error.message}`, error);
        throw new Error('Failed to update meal plan template.');
    }
}

async function deleteMealPlanTemplate(planId, userId) {
    try {
        // Also delete associated food entries
        await foodRepository.deleteFoodEntriesByTemplateId(planId, userId);
        return await mealPlanTemplateRepository.deleteMealPlanTemplate(planId, userId);
    } catch (error) {
        log('error', `Error deleting meal plan template ${planId} for user ${userId}: ${error.message}`, error);
        throw new Error('Failed to delete meal plan template.');
    }
}

module.exports = {
    createMealPlanTemplate,
    getMealPlanTemplates,
    updateMealPlanTemplate,
    deleteMealPlanTemplate,
};