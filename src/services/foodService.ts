import { apiCall } from './api';

import { Food } from '@/types/food';

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
  const response = await apiCall(`/api/foods/foods-paginated?${params.toString()}`, {
    method: 'GET',
  });
  return response;
};

export const togglePublicSharing = async (foodId: string, currentState: boolean): Promise<void> => {
  return apiCall(`/api/foods/${foodId}`, {
    method: 'PUT',
    body: { shared_with_public: !currentState },
  });
};

export const deleteFood = async (foodId: string, userId: string): Promise<void> => {
  return apiCall(`/api/foods/${foodId}?userId=${userId}`, {
    method: 'DELETE',
  });
};

export const createFood = async (payload: FoodPayload): Promise<Food> => {
  return apiCall('/api/foods', {
    method: 'POST',
    body: payload,
  });
};

export const updateFood = async (id: string, payload: Partial<FoodPayload>): Promise<Food> => {
  return apiCall(`/api/foods/${id}`, {
    method: 'PUT',
    body: payload,
  });
};