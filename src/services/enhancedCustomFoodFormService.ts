import { apiCall } from './api';

export interface Food {
  id?: string;
  name: string;
  brand?: string;
  user_id?: string;
  is_custom?: boolean;
  // These fields are now part of the default FoodVariant
  // calories?: number;
  // protein?: number;
  // carbs?: number;
  // fat?: number;
  // serving_size?: number;
  // serving_unit?: string;
  // saturated_fat?: number;
  // polyunsaturated_fat?: number;
  // monounsaturated_fat?: number;
  // trans_fat?: number;
  // cholesterol?: number;
  // sodium?: number;
  // potassium?: number;
  // dietary_fiber?: number;
  // sugars?: number;
  // vitamin_a?: number;
  // vitamin_c?: number;
  // calcium?: number;
  // iron?: number;
}

export interface FoodVariant {
  id?: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

export const loadFoodVariants = async (foodId: string): Promise<FoodVariant[]> => {
  return apiCall(`/api/food-variants?food_id=${foodId}`, {
    method: 'GET',
  });
};

export const saveFood = async (foodData: Food, variants: FoodVariant[], userId: string, foodId?: string): Promise<Food> => {
  let savedFood: Food;

  if (foodId) {
    // Update existing food
    savedFood = await apiCall(`/api/foods/${foodId}`, {
      method: 'PUT',
      body: foodData,
    });

    // Fetch existing variants to determine what to update/delete/insert
    const existingVariants = await loadFoodVariants(foodId);

    const variantsToCreate = variants.filter(v => !v.id);
    const variantsToUpdate = variants.filter(v => v.id);
    const variantsToDelete = existingVariants.filter(ev => !variants.some(v => v.id === ev.id));

    // Update existing variants
    for (const variant of variantsToUpdate) {
      await apiCall(`/api/food-variants/${variant.id}`, {
        method: 'PUT',
        body: {
          food_id: foodId, // Ensure food_id is passed for authorization/validation
          serving_size: variant.serving_size,
          serving_unit: variant.serving_unit,
          calories: variant.calories,
          protein: variant.protein,
          carbs: variant.carbs,
          fat: variant.fat,
          saturated_fat: variant.saturated_fat,
          polyunsaturated_fat: variant.polyunsaturated_fat,
          monounsaturated_fat: variant.monounsaturated_fat,
          trans_fat: variant.trans_fat,
          cholesterol: variant.cholesterol,
          sodium: variant.sodium,
          potassium: variant.potassium,
          dietary_fiber: variant.dietary_fiber,
          sugars: variant.sugars,
          vitamin_a: variant.vitamin_a,
          vitamin_c: variant.vitamin_c,
          calcium: variant.calcium,
          iron: variant.iron,
        },
      });
    }

    // Create new variants
    if (variantsToCreate.length > 0) {
      const newVariantsData = variantsToCreate.map(variant => ({
        food_id: foodId,
        serving_size: variant.serving_size,
        serving_unit: variant.serving_unit,
        calories: variant.calories,
        protein: variant.protein,
        carbs: variant.carbs,
        fat: variant.fat,
        saturated_fat: variant.saturated_fat,
        polyunsaturated_fat: variant.polyunsaturated_fat,
        monounsaturated_fat: variant.monounsaturated_fat,
        trans_fat: variant.trans_fat,
        cholesterol: variant.cholesterol,
        sodium: variant.sodium,
        potassium: variant.potassium,
        dietary_fiber: variant.dietary_fiber,
        sugars: variant.sugars,
        vitamin_a: variant.vitamin_a,
        vitamin_c: variant.vitamin_c,
        calcium: variant.calcium,
        iron: variant.iron,
      }));
      await apiCall('/api/food-variants/bulk', {
        method: 'POST',
        body: newVariantsData,
      });
    }

    // Delete removed variants
    for (const variantToDelete of variantsToDelete) {
      await apiCall(`/api/food-variants/${variantToDelete.id}`, {
        method: 'DELETE',
      });
    }
  } else {
    // Create new food
    // The first variant in the array is always the primary unit for the food
    const primaryVariant = variants[0];
    const foodToCreate = {
      name: foodData.name,
      brand: foodData.brand,
      user_id: userId,
      is_custom: true,
      // Pass primary variant details to createFood, which will create the default variant
      serving_size: primaryVariant.serving_size,
      serving_unit: primaryVariant.serving_unit,
      calories: primaryVariant.calories,
      protein: primaryVariant.protein,
      carbs: primaryVariant.carbs,
      fat: primaryVariant.fat,
      saturated_fat: primaryVariant.saturated_fat,
      polyunsaturated_fat: primaryVariant.polyunsaturated_fat,
      monounsaturated_fat: primaryVariant.monounsaturated_fat,
      trans_fat: primaryVariant.trans_fat,
      cholesterol: primaryVariant.cholesterol,
      sodium: primaryVariant.sodium,
      potassium: primaryVariant.potassium,
      dietary_fiber: primaryVariant.dietary_fiber,
      sugars: primaryVariant.sugars,
      vitamin_a: primaryVariant.vitamin_a,
      vitamin_c: primaryVariant.vitamin_c,
      calcium: primaryVariant.calcium,
      iron: primaryVariant.iron,
    };

    savedFood = await apiCall('/api/foods', {
      method: 'POST',
      body: foodToCreate,
    });

    // Insert additional variants (starting from the second variant)
    const additionalVariantsToInsert = variants.slice(1).map(variant => ({
      food_id: savedFood.id,
      serving_size: variant.serving_size,
      serving_unit: variant.serving_unit,
      calories: variant.calories,
      protein: variant.protein,
      carbs: variant.carbs,
      fat: variant.fat,
      saturated_fat: variant.saturated_fat,
      polyunsaturated_fat: variant.polyunsaturated_fat,
      monounsaturated_fat: variant.monounsaturated_fat,
      trans_fat: variant.trans_fat,
      cholesterol: variant.cholesterol,
      sodium: variant.sodium,
      potassium: variant.potassium,
      dietary_fiber: variant.dietary_fiber,
      sugars: variant.sugars,
      vitamin_a: variant.vitamin_a,
      vitamin_c: variant.vitamin_c,
      calcium: variant.calcium,
      iron: variant.iron,
    }));

    if (additionalVariantsToInsert.length > 0) {
      await apiCall('/api/food-variants/bulk', {
        method: 'POST',
        body: additionalVariantsToInsert,
      });
    }
  }
  return savedFood;
};

export const isUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};