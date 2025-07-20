export interface Food {
  id: string; // Made required
  name: string;
  brand?: string;
  is_custom?: boolean;
  user_id?: string;
  shared_with_public?: boolean;
  provider_external_id?: string; // Add this line
  provider_type?: 'openfoodfacts' | 'nutritionix' | 'fatsecret'; // Add this line
  default_variant?: FoodVariant; // Add this line
  // These fields are now part of the default FoodVariant, but are also passed directly to createFood
  serving_size?: number;
  serving_unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
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
  variants?: FoodVariant[]; // Add this line
}

export interface FoodVariant {
  id: string; // Made required
  serving_size: number;
  serving_unit: string;
  is_default?: boolean; // New field
  is_locked?: boolean; // New field for locking nutrient details
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
}
