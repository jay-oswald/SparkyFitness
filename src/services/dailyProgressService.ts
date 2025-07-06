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

export const getGoalsForDate = async (date: string): Promise<Goals | null> => {
  const params = new URLSearchParams({ date });
  const data = await apiCall(`/api/goals/for-date?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || null; // Return null if 404 (no goals found)
};

export const getFoodEntriesForDate = async (date: string): Promise<FoodEntry[]> => {
  const data = await apiCall(`/api/foods/food-entries/${date}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || []; // Return empty array if 404 (no food entries found)
};

export const getExerciseEntriesForDate = async (date: string): Promise<ExerciseEntry[]> => {
  const params = new URLSearchParams({ selectedDate: date });
  const data = await apiCall(`/api/exercise-entries/by-date?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || []; // Return empty array if 404 (no exercise entries found)
};

export const getCheckInMeasurementsForDate = async (date: string): Promise<CheckInMeasurement | null> => {
  try {
    const measurement = await apiCall(`/api/measurements/check-in/${date}`, {
      method: 'GET',
      suppress404Toast: true, // Suppress toast for 404
    });
    return measurement; // Will be null if 404
  } catch (error: any) { // Explicitly type error as any
    // If it's a 404 and we suppressed the toast, it means no measurement was found.
    // Return null as expected by the component.
    if (error.message && error.message.includes('not found')) { // Check for specific message from backend
      return null;
    }
    throw error; // Re-throw other errors
  }
};