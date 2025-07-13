import { apiCall } from './api';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
}

export const searchExercises = async (query: string): Promise<Exercise[]> => {
  return apiCall(`/exercises/search/${encodeURIComponent(query)}`, {
    method: 'GET',
  });
};

export const searchExternalExercises = async (query: string, provider: string): Promise<Exercise[]> => {
  return apiCall(`/exercises/search-external?query=${encodeURIComponent(query)}&provider=${encodeURIComponent(provider)}`, {
    method: 'GET',
  });
};

export const addExternalExerciseToUserExercises = async (wgerExerciseId: string): Promise<Exercise> => {
  return apiCall(`/exercises/add-external`, {
    method: 'POST',
    body: JSON.stringify({ wgerExerciseId }),
  });
};