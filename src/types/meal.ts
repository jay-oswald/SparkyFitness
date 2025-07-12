export interface Meal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  foods: MealFood[];
}

export interface MealPayload {
  name: string;
  description?: string;
  is_public: boolean;
  foods: MealFood[];
}

export interface MealFood {
  food_id: string;
  food_name: string;
  variant_id?: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
  serving_unit: string;
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