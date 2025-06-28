
// Utility functions for nutrition calculations

export const convertStepsToCalories = (steps: number, weightKg: number = 70): number => {
  // More accurate calculation based on weight
  // Formula: steps * 0.04 * (weight in kg / 70)
  const baseCaloriesPerStep = 0.04;
  const weightAdjustment = weightKg / 70;
  return Math.round(steps * baseCaloriesPerStep * weightAdjustment);
};

export const estimateStepsFromWalkingExercise = (durationMinutes: number, intensity: 'light' | 'moderate' | 'brisk' = 'moderate'): number => {
  // Estimate steps based on walking duration and intensity
  const stepsPerMinute = {
    light: 80,     // slow walk
    moderate: 100, // normal pace
    brisk: 120     // fast walk
  };
  
  return Math.round(durationMinutes * stepsPerMinute[intensity]);
};

export const calculateNutritionProgress = (actual: number, goal: number): number => {
  return goal > 0 ? Math.round((actual / goal) * 100) : 0;
};

export const formatNutritionValue = (value: number, unit: string): string => {
  if (value < 1 && value > 0) {
    return `${value.toFixed(1)}${unit}`;
  }
  return `${Math.round(value)}${unit}`;
};

export const formatCalories = (calories: number): number => {
  return Math.round(calories);
};

export const roundNutritionValue = (value: number): number => {
  return Math.round(value);
};

interface Food {
  id: string;
  name: string;
  brand?: string;
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
  serving_size: number;
  serving_unit: string;
  user_id?: string;
}

interface FoodVariant {
  id: string;
  serving_size: number;
  serving_unit: string;
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
}

interface FoodEntry {
  id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  foods: Food;
  food_variants?: FoodVariant;
}

export const calculateFoodEntryNutrition = (entry: FoodEntry) => {
  const food = entry.foods;
  const variant = entry.food_variants;

  if (!food) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const caloriesPerServing = food.calories || 0;
  const proteinPerServing = food.protein || 0;
  const carbsPerServing = food.carbs || 0;
  const fatPerServing = food.fat || 0;
  const saturatedFatPerServing = food.saturated_fat || 0;
  const polyunsaturatedFatPerServing = food.polyunsaturated_fat || 0;
  const monounsaturatedFatPerServing = food.monounsaturated_fat || 0;
  const transFatPerServing = food.trans_fat || 0;
  const cholesterolPerServing = food.cholesterol || 0;
  const sodiumPerServing = food.sodium || 0;
  const potassiumPerServing = food.potassium || 0;
  const dietaryFiberPerServing = food.dietary_fiber || 0;
  const sugarsPerServing = food.sugars || 0;
  const vitaminAPerServing = food.vitamin_a || 0;
  const vitaminCPerServing = food.vitamin_c || 0;
  const calciumPerServing = food.calcium || 0;
  const ironPerServing = food.iron || 0;

  let nutrientValuesPerReferenceSize = {
    calories: food.calories || 0,
    protein: food.protein || 0,
    carbs: food.carbs || 0,
    fat: food.fat || 0,
    saturated_fat: food.saturated_fat || 0,
    polyunsaturated_fat: food.polyunsaturated_fat || 0,
    monounsaturated_fat: food.monounsaturated_fat || 0,
    trans_fat: food.trans_fat || 0,
    cholesterol: food.cholesterol || 0,
    sodium: food.sodium || 0,
    potassium: food.potassium || 0,
    dietary_fiber: food.dietary_fiber || 0,
    sugars: food.sugars || 0,
    vitamin_a: food.vitamin_a || 0,
    vitamin_c: food.vitamin_c || 0,
    calcium: food.calcium || 0,
    iron: food.iron || 0,
  };
  let effectiveReferenceSize = food.serving_size || 100;

  if (variant) {
    if (variant.calories !== null && variant.calories !== undefined &&
        variant.protein !== null && variant.protein !== undefined &&
        variant.carbs !== null && variant.carbs !== undefined &&
        variant.fat !== null && variant.fat !== undefined) {
      // Use variant's explicit nutrient values per its serving_size
      nutrientValuesPerReferenceSize = {
        calories: variant.calories,
        protein: variant.protein,
        carbs: variant.carbs,
        fat: variant.fat,
        saturated_fat: variant.saturated_fat || 0,
        polyunsaturated_fat: variant.polyunsaturated_fat || 0,
        monounsaturated_fat: variant.monounsaturated_fat || 0,
        trans_fat: variant.trans_fat || 0,
        cholesterol: variant.cholesterol || 0,
        sodium: variant.sodium || 0,
        potassium: variant.potassium || 0,
        dietary_fiber: variant.dietary_fiber || 0,
        sugars: variant.sugars || 0,
        vitamin_a: variant.vitamin_a || 0,
        vitamin_c: variant.vitamin_c || 0,
        calcium: variant.calcium || 0,
        iron: variant.iron || 0,
      };
      effectiveReferenceSize = variant.serving_size;
    } else {
      // If variant doesn't have explicit nutrients, scale base food nutrients to the variant's serving size
      const variantServingSize = variant.serving_size;
      const baseFoodServingSize = food.serving_size || 100;
      const ratio = variantServingSize / baseFoodServingSize;

      nutrientValuesPerReferenceSize = {
        calories: (food.calories || 0) * ratio,
        protein: (food.protein || 0) * ratio,
        carbs: (food.carbs || 0) * ratio,
        fat: (food.fat || 0) * ratio,
        saturated_fat: (food.saturated_fat || 0) * ratio,
        polyunsaturated_fat: (food.polyunsaturated_fat || 0) * ratio,
        monounsaturated_fat: (food.monounsaturated_fat || 0) * ratio,
        trans_fat: (food.trans_fat || 0) * ratio,
        cholesterol: (food.cholesterol || 0) * ratio,
        sodium: (food.sodium || 0) * ratio,
        potassium: (food.potassium || 0) * ratio,
        dietary_fiber: (food.dietary_fiber || 0) * ratio,
        sugars: (food.sugars || 0) * ratio,
        vitamin_a: (food.vitamin_a || 0) * ratio,
        vitamin_c: (food.vitamin_c || 0) * ratio,
        calcium: (food.calcium || 0) * ratio,
        iron: (food.iron || 0) * ratio,
      };
      effectiveReferenceSize = variantServingSize;
    }
  }

  // Calculate total nutrition: (nutrient_value_per_reference_size / effective_reference_size) * quantity_consumed
  return {
    calories: (nutrientValuesPerReferenceSize.calories / effectiveReferenceSize) * entry.quantity,
    protein: (nutrientValuesPerReferenceSize.protein / effectiveReferenceSize) * entry.quantity,
    carbs: (nutrientValuesPerReferenceSize.carbs / effectiveReferenceSize) * entry.quantity,
    fat: (nutrientValuesPerReferenceSize.fat / effectiveReferenceSize) * entry.quantity,
    saturated_fat: (nutrientValuesPerReferenceSize.saturated_fat / effectiveReferenceSize) * entry.quantity,
    polyunsaturated_fat: (nutrientValuesPerReferenceSize.polyunsaturated_fat / effectiveReferenceSize) * entry.quantity,
    monounsaturated_fat: (nutrientValuesPerReferenceSize.monounsaturated_fat / effectiveReferenceSize) * entry.quantity,
    trans_fat: (nutrientValuesPerReferenceSize.trans_fat / effectiveReferenceSize) * entry.quantity,
    cholesterol: (nutrientValuesPerReferenceSize.cholesterol / effectiveReferenceSize) * entry.quantity,
    sodium: (nutrientValuesPerReferenceSize.sodium / effectiveReferenceSize) * entry.quantity,
    potassium: (nutrientValuesPerReferenceSize.potassium / effectiveReferenceSize) * entry.quantity,
    dietary_fiber: (nutrientValuesPerReferenceSize.dietary_fiber / effectiveReferenceSize) * entry.quantity,
    sugars: (nutrientValuesPerReferenceSize.sugars / effectiveReferenceSize) * entry.quantity,
    vitamin_a: (nutrientValuesPerReferenceSize.vitamin_a / effectiveReferenceSize) * entry.quantity,
    vitamin_c: (nutrientValuesPerReferenceSize.vitamin_c / effectiveReferenceSize) * entry.quantity,
    calcium: (nutrientValuesPerReferenceSize.calcium / effectiveReferenceSize) * entry.quantity,
    iron: (nutrientValuesPerReferenceSize.iron / effectiveReferenceSize) * entry.quantity,
  };
};
