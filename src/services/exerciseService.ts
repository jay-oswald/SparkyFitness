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

export interface ExerciseDeletionImpact {
    exerciseEntriesCount: number;
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

export const loadExercises = async (
  userId: string,
  searchTerm: string = '',
  categoryFilter: string = 'all',
  ownershipFilter: string = 'all',
  currentPage: number = 1,
  itemsPerPage: number = 10
): Promise<{ exercises: Exercise[]; totalCount: number }> => {
  const queryParams = new URLSearchParams({
    userId,
    searchTerm,
    categoryFilter,
    ownershipFilter,
    currentPage: currentPage.toString(),
    itemsPerPage: itemsPerPage.toString(),
  }).toString();

  return apiCall(`/exercises?${queryParams}`, {
    method: 'GET',
  });
};

export const createExercise = async (payload: ExercisePayload): Promise<Exercise> => {
  return apiCall('/exercises', {
    method: 'POST',
    body: payload,
  });
};

export const updateExercise = async (id: string, payload: Partial<ExercisePayload>): Promise<Exercise> => {
  return apiCall(`/exercises/${id}`, {
    method: 'PUT',
    body: payload,
  });
};

export const deleteExercise = async (id: string, userId: string): Promise<void> => {
  return apiCall(`/exercises/${id}?userId=${userId}`, {
    method: 'DELETE',
  });
};

export const updateExerciseShareStatus = async (id: string, sharedWithPublic: boolean): Promise<Exercise> => {
  return apiCall(`/exercises/${id}`, {
    method: 'PUT',
    body: { shared_with_public: sharedWithPublic },
  });
};

export const getExerciseDeletionImpact = async (exerciseId: string): Promise<ExerciseDeletionImpact> => {
    const response = await apiCall(`/exercises/${exerciseId}/deletion-impact`, {
        method: 'GET',
    });
    return response;
};