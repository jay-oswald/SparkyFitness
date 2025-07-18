import { apiCall } from './api';

import { Food, FoodDeletionImpact, FoodSearchResult, FoodVariant } from '@/types/food';

export type FoodFilter = 'all' | 'mine' | 'family' | 'public';

interface FoodPayload {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
  serving_unit: string;
  is_custom?: boolean;
  user_id?: string;
  shared_with_public?: boolean;
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

export const searchFoods = async (
  userId: string,
  name: string = '', // Make name optional with a default empty string
  targetUserId: string,
  exactMatch: boolean,
  broadMatch: boolean,
  checkCustom: boolean,
  limit?: number // Make limit optional
): Promise<FoodSearchResult> => {
  const params = new URLSearchParams();
  if (name) {
    params.append('name', name);
    params.append('targetUserId', targetUserId);
    params.append('exactMatch', exactMatch.toString());
    params.append('broadMatch', broadMatch.toString());
    params.append('checkCustom', checkCustom.toString());
  }
  if (limit !== undefined) {
    params.append('limit', limit.toString());
  }

  const response = await apiCall(`/foods?${params.toString()}`, {
    method: 'GET',
  });
  return response as FoodSearchResult; // Cast the response to FoodSearchResult
};

export const getFoodVariantsByFoodId = async (userId: string, foodId: string): Promise<FoodVariant[]> => {
  const response = await apiCall(`/foods/food-variants?food_id=${foodId}`, {
    method: 'GET',
  });
  return response;
};

export const loadFoods = async (
  searchTerm: string,
  foodFilter: FoodFilter,
  currentPage: number,
  itemsPerPage: number,
  userId: string,
  sortBy: string = 'name:asc' // Default sort by name ascending
): Promise<{ foods: Food[]; totalCount: number }> => {
  const params = new URLSearchParams();
  if (searchTerm) { // Only add searchTerm if it's not empty
    params.append('searchTerm', searchTerm);
  }
  params.append('foodFilter', foodFilter);
  params.append('currentPage', currentPage.toString());
  params.append('itemsPerPage', itemsPerPage.toString());
  params.append('userId', userId);
  params.append('sortBy', sortBy); // Add sortBy parameter
  const response = await apiCall(`/foods/foods-paginated?${params.toString()}`, {
    method: 'GET',
  });
  return response;
};

export const togglePublicSharing = async (foodId: string, currentState: boolean): Promise<void> => {
  return apiCall(`/foods/${foodId}`, {
    method: 'PUT',
    body: { shared_with_public: !currentState },
  });
};

export const deleteFood = async (foodId: string, userId: string): Promise<void> => {
  return apiCall(`/foods/${foodId}?userId=${userId}`, {
    method: 'DELETE',
  });
};

export const createFood = async (payload: FoodPayload): Promise<Food> => {
  return apiCall('/foods', {
    method: 'POST',
    body: payload,
  });
};

export const getFoodDeletionImpact = async (foodId: string): Promise<FoodDeletionImpact> => {
  const response = await apiCall(`/foods/${foodId}/deletion-impact`, {
    method: 'GET',
  });
  return response;
};

export const updateFood = async (id: string, payload: Partial<FoodPayload>): Promise<Food> => {
  return apiCall(`/foods/${id}`, {
    method: 'PUT',
    body: payload,
  });
};