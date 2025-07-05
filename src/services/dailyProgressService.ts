import { apiCall } from './api';

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodEntry {
  id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  foods: {
    id: string;
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: number;
    serving_unit: string;
  };
  food_variants?: {
    id: string;
    serving_size: number;
    serving_unit: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export interface ExerciseEntry {
  id: string;
  exercise_id: string;
  duration_minutes: number;
  calories_burned: number;
  entry_date: string;
  notes?: string;
  exercises: {
    id: string;
    name: string;
    user_id?: string;
    category: string;
    calories_per_hour: number;
  } | null;
}

export interface CheckInMeasurement {
  entry_date: string;
  steps?: number;
}

export const getGoalsForDate = async (userId: string, date: string): Promise<Goals> => {
  const params = new URLSearchParams({ userId, date });
  const data = await apiCall(`/api/goals/for-date?${params.toString()}`, {
    method: 'GET',
  });
  return data;
};

export const getFoodEntriesForDate = async (userId: string, date: string): Promise<FoodEntry[]> => {
  return apiCall(`/api/food-entries/${userId}/${date}`, {
    method: 'GET',
  });
};

export const getExerciseEntriesForDate = async (userId: string, date: string): Promise<ExerciseEntry[]> => {
  return apiCall(`/api/exercise-entries/${userId}/${date}`, {
    method: 'GET',
  });
};

export const getCheckInMeasurementsForDate = async (userId: string, date: string): Promise<CheckInMeasurement | null> => {
  try {
    const measurement = await apiCall(`/api/measurements/check-in/${userId}/${date}`, {
      method: 'GET',
      suppress404Toast: true, // Suppress toast for 404
    });
    return measurement; // Will be null if 404
  } catch (error) {
    // If it's a 404 and we suppressed the toast, it means no measurement was found.
    // Return null as expected by the component.
    if (error.message.includes('not found')) { // Check for specific message from backend
      return null;
    }
    throw error; // Re-throw other errors
  }
};