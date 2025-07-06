import { apiCall } from './api';

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

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
  user_id?: string;
}

export const fetchExerciseEntries = async (userId: string, selectedDate: string): Promise<ExerciseEntry[]> => {
  const params = new URLSearchParams({ userId, selectedDate });
  return apiCall(`/api/exercise-entries?${params.toString()}`, {
    method: 'GET',
  });
};

export const addExerciseEntry = async (payload: {
  user_id: string;
  exercise_id: string;
  duration_minutes: number;
  calories_burned: number;
  entry_date: string;
  notes?: string;
}): Promise<ExerciseEntry> => {
  return apiCall('/api/exercise-entries', {
    method: 'POST',
    body: payload,
  });
};

export const deleteExerciseEntry = async (entryId: string): Promise<void> => {
  return apiCall(`/api/exercise-entries/${entryId}`, {
    method: 'DELETE',
  });
};

export const searchExercises = async (query: string, filterType: string, userId: string): Promise<Exercise[]> => {
  const params = new URLSearchParams({ query, filterType, userId });
  return apiCall(`/api/exercises/search/${encodeURIComponent(query)}?filterType=${filterType}&userId=${userId}`, {
    method: 'GET',
  });
};