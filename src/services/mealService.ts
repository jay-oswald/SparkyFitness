import { api } from './api';
import { Meal, MealPlanEntry } from '@/types/meal';

export const createMeal = async (userId: string, mealData: Meal): Promise<Meal> => {
  return await api.post(`/meals`, { body: mealData });
};

export const getMeals = async (userId: string, isPublic: boolean = false): Promise<Meal[]> => {
  return await api.get(`/meals`, { params: { is_public: isPublic } });
};

export const getMealById = async (userId: string, mealId: string): Promise<Meal> => {
  return await api.get(`/meals/${mealId}`);
};

export const updateMeal = async (userId: string, mealId: string, mealData: Meal): Promise<Meal> => {
  return await api.put(`/meals/${mealId}`, { body: mealData });
};

export const deleteMeal = async (userId: string, mealId: string): Promise<void> => {
  await api.delete(`/meals/${mealId}`);
};

export const createMealPlanEntry = async (userId: string, planData: MealPlanEntry): Promise<MealPlanEntry> => {
  return await api.post(`/meals/plan`, { body: planData });
};

export const getMealPlanEntries = async (userId: string, startDate: string, endDate: string): Promise<MealPlanEntry[]> => {
  const response = await api.get(`/meals/plan`, { params: { startDate, endDate } });
  return Array.isArray(response) ? response : [];
};

export const updateMealPlanEntry = async (userId: string, planId: string, planData: MealPlanEntry): Promise<MealPlanEntry> => {
  return await api.put(`/meals/plan/${planId}`, { body: planData });
};

export const deleteMealPlanEntry = async (userId: string, planId: string): Promise<void> => {
  await api.delete(`/meals/plan/${planId}`);
};

export const logMealPlanEntryToDiary = async (userId: string, mealPlanId: string, targetDate?: string): Promise<any[]> => {
  return await api.post(`/meals/plan/${mealPlanId}/log-to-diary`, { body: { target_date: targetDate } });
};

export const logDayMealPlanToDiary = async (userId: string, planDate: string, targetDate?: string): Promise<any[]> => {
  return await api.post(`/meals/plan/log-day-to-diary`, { body: { plan_date: planDate, target_date: targetDate } });
};