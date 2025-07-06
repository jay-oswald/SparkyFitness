const exerciseRepository = require('../models/exerciseRepository');
const userRepository = require('../models/userRepository');
const { log } = require('../config/logging');

async function getExercisesWithPagination(authenticatedUserId, targetUserId, searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage) {
  try {

    const limit = parseInt(itemsPerPage, 10) || 10;
    const offset = ((parseInt(currentPage, 10) || 1) - 1) * limit;

    const [exercises, totalCount] = await Promise.all([
      exerciseRepository.getExercisesWithPagination(targetUserId, searchTerm, categoryFilter, ownershipFilter, limit, offset),
      exerciseRepository.countExercises(targetUserId, searchTerm, categoryFilter, ownershipFilter)
    ]);
    return { exercises, totalCount };
  } catch (error) {
    log('error', `Error fetching exercises with pagination for user ${authenticatedUserId} and target ${targetUserId}:`, error);
    throw error;
  }
}

async function searchExercises(authenticatedUserId, name, targetUserId) {
  try {
    if (targetUserId && targetUserId !== authenticatedUserId) {
    }
    const exercises = await exerciseRepository.searchExercises(name);
    return exercises;
  } catch (error) {
    log('error', `Error searching exercises for user ${authenticatedUserId} with name "${name}":`, error);
    throw error;
  }
}

async function createExercise(authenticatedUserId, exerciseData) {
  try {
    const newExercise = await exerciseRepository.createExercise(exerciseData);
    return newExercise;
  } catch (error) {
    log('error', `Error creating exercise for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function createExerciseEntry(authenticatedUserId, entryData) {
  try {
    const newEntry = await exerciseRepository.createExerciseEntry(entryData);
    return newEntry;
  } catch (error) {
    log('error', `Error creating exercise entry for user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getExerciseEntryById(authenticatedUserId, id) {
  try {
    const entryOwnerId = await exerciseRepository.getExerciseEntryOwnerId(id);
    if (!entryOwnerId) {
      throw new Error('Exercise entry not found.');
    }
    const entry = await exerciseRepository.getExerciseEntryById(id);
    return entry;
  } catch (error) {
    log('error', `Error fetching exercise entry ${id} by user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateExerciseEntry(authenticatedUserId, id, targetUserId, updateData) {
  try {
    const updatedEntry = await exerciseRepository.updateExerciseEntry(id, targetUserId, updateData);
    if (!updatedEntry) {
      throw new Error('Exercise entry not found or not authorized to update.');
    }
    return updatedEntry;
  } catch (error) {
    log('error', `Error updating exercise entry ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteExerciseEntry(authenticatedUserId, id, targetUserId) {
  try {
    const success = await exerciseRepository.deleteExerciseEntry(id, targetUserId);
    if (!success) {
      throw new Error('Exercise entry not found or not authorized to delete.');
    }
    return { message: 'Exercise entry deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting exercise entry ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getExerciseById(authenticatedUserId, id) {
  try {
    const exerciseOwnerId = await exerciseRepository.getExerciseOwnerId(id);
    if (!exerciseOwnerId) {
      const publicExercise = await exerciseRepository.getExerciseById(id);
      if (publicExercise && !publicExercise.is_custom) {
        return publicExercise;
      }
      throw new Error('Exercise not found.');
    }
    const exercise = await exerciseRepository.getExerciseById(id);
    return exercise;
  } catch (error) {
    log('error', `Error fetching exercise ${id} by user ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function updateExercise(authenticatedUserId, id, targetUserId, updateData) {
  try {
    const updatedExercise = await exerciseRepository.updateExercise(id, targetUserId, updateData);
    if (!updatedExercise) {
      throw new Error('Exercise not found or not authorized to update.');
    }
    return updatedExercise;
  } catch (error) {
    log('error', `Error updating exercise ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function deleteExercise(authenticatedUserId, id, targetUserId) {
  try {
    const success = await exerciseRepository.deleteExercise(id, targetUserId);
    if (!success) {
      throw new Error('Exercise not found or not authorized to delete.');
    }
    return { message: 'Exercise deleted successfully.' };
  } catch (error) {
    log('error', `Error deleting exercise ${id} for user ${targetUserId} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getExerciseEntriesByDate(authenticatedUserId, targetUserId, selectedDate) {
  try {
    if (!targetUserId) {
      log('error', 'getExerciseEntriesByDate: targetUserId is undefined. Returning empty array.');
      return [];
    }
    const entries = await exerciseRepository.getExerciseEntriesByDate(targetUserId, selectedDate);
    return entries;
  } catch (error) {
    log('error', `Error fetching exercise entries for user ${targetUserId} on ${selectedDate} by ${authenticatedUserId}:`, error);
    throw error;
  }
}

async function getOrCreateActiveCaloriesExercise(userId) {
  try {
    const exerciseId = await exerciseRepository.getOrCreateActiveCaloriesExercise(userId);
    return exerciseId;
  } catch (error) {
    log('error', `Error getting or creating active calories exercise for user ${userId}:`, error);
    throw error;
  }
}

async function upsertExerciseEntryData(userId, exerciseId, caloriesBurned, date) {
  try {
    const entry = await exerciseRepository.upsertExerciseEntryData(userId, exerciseId, caloriesBurned, date);
    return entry;
  } catch (error) {
    log('error', `Error upserting exercise entry data for user ${userId}, exercise ${exerciseId}:`, error);
    throw error;
  }
}

module.exports = {
  getExercisesWithPagination,
  searchExercises,
  createExercise,
  createExerciseEntry,
  getExerciseEntryById,
  updateExerciseEntry,
  deleteExerciseEntry,
  getExerciseById,
  updateExercise,
  deleteExercise,
  getExerciseEntriesByDate,
  getOrCreateActiveCaloriesExercise,
  upsertExerciseEntryData,
};