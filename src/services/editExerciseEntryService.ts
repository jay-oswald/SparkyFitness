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
    calories_per_hour: number; // Added calories_per_hour
  } | null;
}

export const fetchExerciseDetails = async (exerciseId: string): Promise<{ calories_per_hour: number }> => {
  return apiCall(`/api/exercises/${exerciseId}`, {
    method: 'GET',
  });
};

export const updateExerciseEntry = async (entryId: string, payload: {
  duration_minutes: number;
  calories_burned: number;
  notes?: string;
}): Promise<void> => {
  await apiCall(`/api/exercise-entries/${entryId}`, {
    method: 'PUT',
    body: payload,
  });
};