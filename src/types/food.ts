export interface FoodVariant {
  id?: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  trans_fat?: number;
  cholesterol?: number;
  sodium?: number;
  potassium?: number;
  dietary_fiber?: number;
  sugars?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  calcium?: number;
  iron?: number;
  is_default?: boolean;
  is_locked?: boolean;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  is_custom: boolean;
  user_id?: string;
  shared_with_public?: boolean;
  provider_external_id?: string;
  provider_type?: string;
  default_variant?: FoodVariant;
  variants?: FoodVariant[];
  is_quick_food?: boolean;
}

export interface FoodDeletionImpact {
    foodEntriesCount: number;
    mealFoodsCount: number;
    mealPlansCount: number;
    mealPlanTemplateAssignmentsCount: number;
}

export interface FoodSearchResult {
  recentFoods?: Food[];
  topFoods?: Food[];
  searchResults?: Food[];
}
export interface FoodEntry {
  id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  foods: Food;
  food_variants?: FoodVariant;
  entry_date: string;
  meal_plan_template_id?: string;
  // Add water_ml to FoodEntry if it's a water entry
  water_ml?: number;
}