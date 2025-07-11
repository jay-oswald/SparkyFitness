
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

import { Food, FoodVariant, FoodEntry } from '@/types/food'; // Import from central types file

export const calculateFoodEntryNutrition = (entry: FoodEntry) => {
  const variant = entry.food_variants;

  if (!variant) {
    // This should ideally not happen if food_variants is always populated
    // but as a fallback, return zero nutrition.
    return {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      saturated_fat: 0, polyunsaturated_fat: 0, monounsaturated_fat: 0, trans_fat: 0,
      cholesterol: 0, sodium: 0, potassium: 0, dietary_fiber: 0, sugars: 0,
      vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0,
    };
  }

  // All nutrient values are now sourced directly from the food_variants object
  const nutrientValuesPerReferenceSize = {
    calories: isNaN(variant.calories) ? 0 : variant.calories || 0,
    protein: isNaN(variant.protein) ? 0 : variant.protein || 0,
    carbs: isNaN(variant.carbs) ? 0 : variant.carbs || 0,
    fat: isNaN(variant.fat) ? 0 : variant.fat || 0,
    saturated_fat: isNaN(variant.saturated_fat) ? 0 : variant.saturated_fat || 0,
    polyunsaturated_fat: isNaN(variant.polyunsaturated_fat) ? 0 : variant.polyunsaturated_fat || 0,
    monounsaturated_fat: isNaN(variant.monounsaturated_fat) ? 0 : variant.monounsaturated_fat || 0,
    trans_fat: isNaN(variant.trans_fat) ? 0 : variant.trans_fat || 0,
    cholesterol: isNaN(variant.cholesterol) ? 0 : variant.cholesterol || 0,
    sodium: isNaN(variant.sodium) ? 0 : variant.sodium || 0,
    potassium: isNaN(variant.potassium) ? 0 : variant.potassium || 0,
    dietary_fiber: isNaN(variant.dietary_fiber) ? 0 : variant.dietary_fiber || 0,
    sugars: isNaN(variant.sugars) ? 0 : variant.sugars || 0,
    vitamin_a: isNaN(variant.vitamin_a) ? 0 : variant.vitamin_a || 0,
    vitamin_c: isNaN(variant.vitamin_c) ? 0 : variant.vitamin_c || 0,
    calcium: isNaN(variant.calcium) ? 0 : variant.calcium || 0,
    iron: isNaN(variant.iron) ? 0 : variant.iron || 0,
  };
  const effectiveReferenceSize = variant.serving_size || 100;

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
