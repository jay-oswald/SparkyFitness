import { apiCall } from './api';

export interface Food {
  id: string;
  name: string;
  brand?: string;
  user_id?: string;
  is_custom?: boolean;
  shared_with_public?: boolean;
}

export interface FoodVariant {
  id: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  trans_fat?: number;
  cholesterol?: number;
  sodium?: number;
  potassium?: number;
  dietary_fiber?: number;
  sugars?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  calcium?: number;
  iron?: number;
}

export interface FoodEntry {
  id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  foods: Food;
  food_variants?: FoodVariant;
  entry_date: string; // Add entry_date to FoodEntry interface
}

export interface Goal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const loadFoodEntries = async (userId: string, selectedDate: string): Promise<FoodEntry[]> => {
  const params = new URLSearchParams({
    userId,
    selectedDate,
  });
  const data = await apiCall(`/api/foods/food-entries?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || []; // Return empty array if 404 (no food entries found)
};

export const loadGoals = async (userId: string, selectedDate: string): Promise<Goal> => {
  const params = new URLSearchParams({
    userId,
    selectedDate,
  });
  const data = await apiCall(`/api/goals?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data[0] || { calories: 2000, protein: 150, carbs: 250, fat: 67 }; // Return default if no goals found
};

export const addFoodEntry = async (payload: {
  user_id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  entry_date: string;
}): Promise<FoodEntry> => {
  return apiCall('/api/foods/food-entries', {
    method: 'POST',
    body: payload,
  });
};

export const removeFoodEntry = async (entryId: string): Promise<void> => {
  return apiCall(`/api/foods/food-entries/${entryId}`, {
    method: 'DELETE',
  });
};