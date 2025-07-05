import { apiCall } from './api';

export interface FoodVariant {
  id: string;
  serving_size: number;
  serving_unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
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
  foods: {
    id: string;
    name: string;
    brand?: string;
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
    serving_size: number;
    serving_unit: string;
  };
}

export const loadFoodVariants = async (foodId: string): Promise<FoodVariant[]> => {
  return apiCall(`/api/food-variants?food_id=${foodId}`, {
    method: 'GET',
  });
};

export const updateFoodEntry = async (entryId: string, payload: { quantity: number; unit: string; variant_id?: string | null }): Promise<void> => {
  await apiCall(`/api/food-entries/${entryId}`, {
    method: 'PUT',
    body: payload,
  });
};