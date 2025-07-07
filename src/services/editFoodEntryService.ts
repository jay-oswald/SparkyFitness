import { apiCall } from './api';

import { FoodVariant, FoodEntry } from '@/types/food';

export const loadFoodVariants = async (foodId: string): Promise<FoodVariant[]> => {
  return apiCall(`/api/foods/food-variants?food_id=${foodId}`, {
    method: 'GET',
  });
};

export const updateFoodEntry = async (entryId: string, payload: { quantity: number; unit: string; variant_id?: string | null }): Promise<void> => {
  await apiCall(`/api/food-entries/${entryId}`, {
    method: 'PUT',
    body: payload,
  });
};