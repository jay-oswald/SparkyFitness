import { apiCall } from './api';

export interface ExpandedGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water_goal: number;
  saturated_fat: number;
  polyunsaturated_fat: number;
  monounsaturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  potassium: number;
  dietary_fiber: number;
  sugars: number;
  vitamin_a: number;
  vitamin_c: number;
  calcium: number;
  iron: number;
}

export const loadGoals = async (userId: string, selectedDate: string): Promise<ExpandedGoals> => {
  const params = new URLSearchParams({ userId, selectedDate });
  const data = await apiCall(`/api/goals?${params.toString()}`, {
    method: 'GET',
  });
  return data[0] || {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 67,
    water_goal: 8,
    saturated_fat: 20,
    polyunsaturated_fat: 10,
    monounsaturated_fat: 25,
    trans_fat: 0,
    cholesterol: 300,
    sodium: 2300,
    potassium: 3500,
    dietary_fiber: 25,
    sugars: 50,
    vitamin_a: 900,
    vitamin_c: 90,
    calcium: 1000,
    iron: 18
  };
};

export const saveGoals = async (userId: string, selectedDate: string, goals: ExpandedGoals): Promise<void> => {
  await apiCall('/api/goals', {
    method: 'POST',
    body: {
      p_user_id: userId,
      p_start_date: selectedDate,
      p_calories: goals.calories,
      p_protein: goals.protein,
      p_carbs: goals.carbs,
      p_fat: goals.fat,
      p_water_goal: goals.water_goal,
      p_saturated_fat: goals.saturated_fat,
      p_polyunsaturated_fat: goals.polyunsaturated_fat,
      p_monounsaturated_fat: goals.monounsaturated_fat,
      p_trans_fat: goals.trans_fat,
      p_cholesterol: goals.cholesterol,
      p_sodium: goals.sodium,
      p_potassium: goals.potassium,
      p_dietary_fiber: goals.dietary_fiber,
      p_sugars: goals.sugars,
      p_vitamin_a: goals.vitamin_a,
      p_vitamin_c: goals.vitamin_c,
      p_calcium: goals.calcium,
      p_iron: goals.iron
    },
  });
};