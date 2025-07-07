import { apiCall } from './api';
import { getExerciseEntriesForDate as getDailyExerciseEntries } from './dailyProgressService';

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
  };
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
  user_id?: string;
}

export const fetchExerciseEntries = async (selectedDate: string): Promise<ExerciseEntry[]> => {
  return getDailyExerciseEntries(selectedDate);
};

export const addExerciseEntry = async (payload: {
  exercise_id: string;
  duration_minutes: number;
  calories_burned: number;
  entry_date: string;
  notes?: string;
}): Promise<ExerciseEntry> => {
  return apiCall('/exercise-entries', {
    method: 'POST',
    body: payload,
  });
};

export const deleteExerciseEntry = async (entryId: string): Promise<void> => {
  return apiCall(`/exercise-entries/${entryId}`, {
    method: 'DELETE',
  });
};

export const searchExercises = async (query: string, filterType: string): Promise<Exercise[]> => {
  if (!query.trim()) {
    return [];
  }
  const params = new URLSearchParams({ searchTerm: query, ownershipFilter: filterType });
  const data = await apiCall(`/exercises?${params.toString()}`, {
    method: 'GET',
    suppress404Toast: true, // Suppress toast for 404
  });
  return data.exercises || []; // Return empty array if 404 or no exercises found
};