import { apiCall } from './api';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
}

export const searchExercises = async (query: string): Promise<Exercise[]> => {
  const params = new URLSearchParams({ query });
  return apiCall(`/api/exercises/search/${encodeURIComponent(query)}`, {
    method: 'GET',
  });
};