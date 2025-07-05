import { apiCall } from './api';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description: string | null;
  user_id: string | null;
  is_custom: boolean;
  shared_with_public: boolean;
  created_at: string;
  updated_at: string;
}

interface ExercisePayload {
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string | null;
  user_id?: string | null;
  is_custom?: boolean;
  shared_with_public?: boolean;
}

export const loadExercises = async (): Promise<Exercise[]> => {
  return apiCall('/api/exercises', {
    method: 'GET',
  });
};

export const createExercise = async (payload: ExercisePayload): Promise<Exercise> => {
  return apiCall('/api/exercises', {
    method: 'POST',
    body: payload,
  });
};

export const updateExercise = async (id: string, payload: Partial<ExercisePayload>): Promise<Exercise> => {
  return apiCall(`/api/exercises/${id}`, {
    method: 'PUT',
    body: payload,
  });
};

export const deleteExercise = async (id: string): Promise<void> => {
  return apiCall(`/api/exercises/${id}`, {
    method: 'DELETE',
  });
};

export const updateExerciseShareStatus = async (id: string, sharedWithPublic: boolean): Promise<Exercise> => {
  return apiCall(`/api/exercises/${id}/share`, {
    method: 'PUT',
    body: { shared_with_public: sharedWithPublic },
  });
};