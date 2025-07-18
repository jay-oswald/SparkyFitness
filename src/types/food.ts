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