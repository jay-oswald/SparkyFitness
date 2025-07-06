const measurementRepository = require('../models/measurementRepository');
const userRepository = require('../models/userRepository');
const exerciseRepository = require('../models/exerciseRepository'); // For active calories
const { log } = require('../config/logging');

async function processHealthData(healthDataArray, userId) {
  const processedResults = [];
  const errors = [];

  for (const dataEntry of healthDataArray) {
    const { value, type, unit, date } = dataEntry;

    if (!value || !type || !date) {
      errors.push({ error: "Missing required fields: value, type, date in one of the entries", entry: dataEntry });
      continue;
    }

    let parsedDate;
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date received from shortcut: '${date}'.`);
      }
      parsedDate = dateObj.toISOString().split('T')[0];
    } catch (e) {
      log('error', "Date parsing error:", e);
      errors.push({ error: `Invalid date format for entry: ${JSON.stringify(dataEntry)}. Error: ${e.message}`, entry: dataEntry });
      continue;
    }

    try {
      let result;
      switch (type) {
        case 'step':
          const stepValue = parseInt(value, 10);
          if (isNaN(stepValue) || !Number.isInteger(stepValue)) {
            errors.push({ error: "Invalid value for step. Must be an integer.", entry: dataEntry });
            break;
          }
          result = await measurementRepository.upsertStepData(userId, stepValue, parsedDate);
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'water':
          const waterValue = parseInt(value, 10);
          if (isNaN(waterValue) || !Number.isInteger(waterValue)) {
            errors.push({ error: "Invalid value for water. Must be an integer.", entry: dataEntry });
            break;
          }
          result = await measurementRepository.upsertWaterData(userId, waterValue, parsedDate);
          processedResults.push({ type, status: 'success', data: result });
          break;
        case 'Active Calories':
          const activeCaloriesValue = parseFloat(value);
          if (isNaN(activeCaloriesValue) || activeCaloriesValue < 0) {
            errors.push({ error: "Invalid value for active_calories. Must be a non-negative number.", entry: dataEntry });
            break;
          }
          const exerciseId = await exerciseRepository.getOrCreateActiveCaloriesExercise(userId);
          result = await exerciseRepository.upsertExerciseEntryData(userId, exerciseId, activeCaloriesValue, parsedDate);
          processedResults.push({ type, status: 'success', data: result });
          break;
        default:
          errors.push({ error: `Unsupported health data type: ${type}`, entry: dataEntry });
          break;
      }
    } catch (error) {
      log('error', `Error processing health data entry ${JSON.stringify(dataEntry)}:`, error);
      errors.push({ error: `Failed to process entry: ${error.message}`, entry: dataEntry });
    }
  }

  if (errors.length > 0) {
    throw new Error(JSON.stringify({
      message: "Some health data entries could not be processed.",
      processed: processedResults,
      errors: errors
    }));
  } else {
    return {
      message: "All health data successfully processed.",
      processed: processedResults
    };
  }
}

async function getWaterIntake(authenticatedUserId, targetUserId, date) {
  try {
    const waterData = await measurementRepository.getWaterIntakeByDate(targetUserId, date);
    return waterData || { glasses_consumed: 0 };
  } catch (error) {
    log('error', `Error fetching water intake for user ${targetUserId} on ${date} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function upsertWaterIntake(authenticatedUserId, userId, entryDate, glassesConsumed) {
  try {
    const result = await measurementRepository.upsertWaterData(userId, glassesConsumed, entryDate);
    return result;
  } catch (error) {
    log('error', `Error upserting water intake for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getWaterIntakeEntryById(authenticatedUserId, id) {
  try {
    const entryOwnerId = await measurementRepository.getWaterIntakeEntryOwnerId(id);
    if (!entryOwnerId) {
      throw new Error('Water intake entry not found.');
    }
    const entry = await measurementRepository.getWaterIntakeEntryById(id);
    return entry;
  } catch (error) {
    log('error', `Error fetching water intake entry ${id} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateWaterIntake(authenticatedUserId, id, userId, updateData) {
  try {
    const updatedEntry = await measurementRepository.updateWaterIntake(id, userId, updateData);
    if (!updatedEntry) {
      throw new Error('Water intake entry not found or not authorized to update.');
    }
    return updatedEntry;
  } catch (error) {
    log('error', `Error updating water intake entry ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteWaterIntake(authenticatedUserId, id, userId) {
  try {
    const success = await measurementRepository.deleteWaterIntake(id, userId);
    if (!success) {
      throw new Error('Water intake entry not found or not authorized to delete.');
    }
    return { message: 'Water intake entry deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting water intake entry ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function upsertCheckInMeasurements(authenticatedUserId, userId, entryDate, measurements) {
  try {
    const result = await measurementRepository.upsertCheckInMeasurements(userId, entryDate, measurements);
    return result;
  } catch (error) {
    log('error', `Error upserting check-in measurements for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCheckInMeasurements(authenticatedUserId, targetUserId, date) {
  try {
    const measurement = await measurementRepository.getCheckInMeasurementsByDate(targetUserId, date);
    return measurement || {};
  } catch (error) {
    log('error', `Error fetching check-in measurements for user ${targetUserId} on ${date} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateCheckInMeasurements(authenticatedUserId, id, userId, entryDate, updateData) {
  try {
    const updatedMeasurement = await measurementRepository.updateCheckInMeasurements(id, userId, entryDate, updateData);
    if (!updatedMeasurement) {
      throw new Error('Check-in measurement not found or not authorized to update.');
    }
    return updatedMeasurement;
  } catch (error) {
    log('error', `Error updating check-in measurements ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteCheckInMeasurements(authenticatedUserId, id, userId) {
  try {
    const success = await measurementRepository.deleteCheckInMeasurements(id, userId);
    if (!success) {
      throw new Error('Check-in measurement not found or not authorized to delete.');
    }
    return { message: 'Check-in measurement deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting check-in measurements ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCustomCategories(authenticatedUserId, targetUserId) {
  try {
    let finalUserId = authenticatedUserId;
    if (targetUserId && targetUserId !== authenticatedUserId) {
      finalUserId = targetUserId;
    }
    const categories = await measurementRepository.getCustomCategories(finalUserId);
    return categories;
  } catch (error) {
    log('error', `Error fetching custom categories for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function createCustomCategory(authenticatedUserId, categoryData) {
  try {
    const newCategory = await measurementRepository.createCustomCategory(categoryData);
    return newCategory;
  } catch (error) {
    log('error', `Error creating custom category for user ${categoryData.user_id} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateCustomCategory(authenticatedUserId, id, userId, updateData) {
  try {
    const updatedCategory = await measurementRepository.updateCustomCategory(id, userId, updateData);
    if (!updatedCategory) {
      throw new Error('Custom category not found or not authorized to update.');
    }
    return updatedCategory;
  } catch (error) {
    log('error', `Error updating custom category ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteCustomCategory(authenticatedUserId, id, userId) {
  try {
    const success = await measurementRepository.deleteCustomCategory(id, userId);
    if (!success) {
      throw new Error('Custom category not found or not authorized to delete.');
    }
    return { message: 'Custom category deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting custom category ${id} for user ${userId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCustomMeasurementEntries(authenticatedUserId, targetUserId, limit, orderBy, filter) {
  try {
    const entries = await measurementRepository.getCustomMeasurementEntries(targetUserId, limit, orderBy, filter);
    return entries;
  } catch (error) {
    log('error', `Error fetching custom measurement entries for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCustomMeasurementEntriesByDate(authenticatedUserId, targetUserId, date) {
  try {
    const entries = await measurementRepository.getCustomMeasurementEntriesByDate(targetUserId, date);
    return entries;
  } catch (error) {
    log('error', `Error fetching custom measurement entries for user ${targetUserId} on ${date} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCheckInMeasurementsByDateRange(authenticatedUserId, userId, startDate, endDate) {
  try {
    const measurements = await measurementRepository.getCheckInMeasurementsByDateRange(userId, startDate, endDate);
    return measurements;
  } catch (error) {
    log('error', `Error fetching check-in measurements for user ${userId} from ${startDate} to ${endDate} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getCustomMeasurementsByDateRange(authenticatedUserId, userId, categoryId, startDate, endDate) {
  try {
    const measurements = await measurementRepository.getCustomMeasurementsByDateRange(userId, categoryId, startDate, endDate);
    return measurements;
  } catch (error) {
    log('error', `Error fetching custom measurements for user ${userId}, category ${categoryId} from ${startDate} to ${endDate} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

module.exports = {
  processHealthData,
  getWaterIntake,
  upsertWaterIntake,
  getWaterIntakeEntryById,
  updateWaterIntake,
  deleteWaterIntake,
  upsertCheckInMeasurements,
  getCheckInMeasurements,
  updateCheckInMeasurements,
  deleteCheckInMeasurements,
  getCustomCategories,
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  getCustomMeasurementEntries,
  getCustomMeasurementEntriesByDate,
  getCheckInMeasurementsByDateRange,
  getCustomMeasurementsByDateRange,
};