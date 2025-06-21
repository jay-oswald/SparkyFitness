
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

// Fix: Add proper nutrition calculation function
export const calculateEntryNutrition = (foodData: any, quantity: number) => {
  if (!foodData) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const servingSize = foodData.serving_size || 100;
  const ratio = quantity / servingSize;

  return {
    calories: (foodData.calories || 0) * ratio,
    protein: (foodData.protein || 0) * ratio,
    carbs: (foodData.carbs || 0) * ratio,
    fat: (foodData.fat || 0) * ratio,
  };
};
