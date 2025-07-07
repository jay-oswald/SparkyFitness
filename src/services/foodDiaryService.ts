import { apiCall } from './api';

import { Food, FoodVariant, FoodEntry } from '@/types/food';

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
  const data = await apiCall(`/foods/food-entries?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || []; // Return empty array if 404 (no food entries found)
};

export const loadGoals = async (userId: string, selectedDate: string): Promise<Goal> => {
  const params = new URLSearchParams({
    date: selectedDate,
  });
  const data = await apiCall(`/goals/for-date?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data || { calories: 2000, protein: 150, carbs: 250, fat: 67 }; // Return default if no goals found
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
  return apiCall('/foods/food-entries', {
    method: 'POST',
    body: payload,
  });
};

export const removeFoodEntry = async (entryId: string): Promise<void> => {
  return apiCall(`/foods/food-entries/${entryId}`, {
    method: 'DELETE',
  });
};