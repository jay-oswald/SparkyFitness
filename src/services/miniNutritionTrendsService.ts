import { apiCall } from './api';

export interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const loadMiniNutritionTrendData = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<DayData[]> => {
  const params = new URLSearchParams({
    userId,
    startDate,
    endDate,
  });
  const data = await apiCall(`/api/mini-nutrition-trends?${params.toString()}`, {
    method: 'GET',
  });
  return data;
};