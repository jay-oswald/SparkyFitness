import { Food } from './Food';

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  foods: MealFood[];
}

export interface MealFood extends Food {
    quantity: number;
    unit: string;
    food_name: string;
}
  id?: string;
  user_id: string;
  meal_id?: string;
  food_id?: string;
  variant_id?: string;
  quantity?: number;
  unit?: string;
  plan_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  is_template?: boolean;
  template_name?: string;
  day_of_week?: number;
  meal_name?: string;
  food_name?: string;
}

export interface MealDayPreset {
    id: string;
    user_id: string;
    preset_name: string;
    breakfast_meal_id?: string;
    lunch_meal_id?: string;
    dinner_meal_id?: string;
    snacks_meal_id?: string;
}

export interface MealPlanTemplateAssignment {
    id?: string;
    day_of_week: number;
    meal_type: string;
    meal_id: string;
    meal_name?: string;
}

export interface MealPlanTemplate {
    id?: string;
    user_id: string;
    plan_name: string;
    description?: string;
    start_date: string;
    end_date?: string;
    is_active: boolean;
    assignments: MealPlanTemplateAssignment[];
}