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
    item_type: 'meal' | 'food'; // 'meal' or 'food'
    meal_id?: string; // Optional if item_type is 'food'
    meal_name?: string; // Optional if item_type is 'food'
    food_id?: string; // Optional if item_type is 'meal'
    food_name?: string; // Optional if item_type is 'meal'
    variant_id?: string; // Optional, for specific food variants
    quantity?: number; // Required if item_type is 'food'
    unit?: string; // Required if item_type is 'food'
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