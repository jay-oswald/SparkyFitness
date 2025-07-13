import { apiCall } from './api';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
  duration_min?: number; // Added duration_min
}

export const searchExercises = async (query: string): Promise<Exercise[]> => {
  return apiCall(`/exercises/search/${encodeURIComponent(query)}`, {
    method: 'GET',
  });
};

export const searchExternalExercises = async (query: string, providerId: string, providerType: string): Promise<Exercise[]> => {
  return apiCall(`/exercises/search-external?query=${encodeURIComponent(query)}&providerId=${encodeURIComponent(providerId)}&providerType=${encodeURIComponent(providerType)}`, {
    method: 'GET',
  });
};

export const addExternalExerciseToUserExercises = async (wgerExerciseId: string): Promise<Exercise> => {
  return apiCall(`/exercises/add-external`, {
    method: 'POST',
    body: JSON.stringify({ wgerExerciseId }),
  });
};

export const addNutritionixExercise = async (nutritionixExerciseData: Exercise): Promise<Exercise> => {
  return apiCall(`/exercises/add-nutritionix-exercise`, {
    method: 'POST',
    body: JSON.stringify(nutritionixExerciseData),
  });
};