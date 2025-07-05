import { apiCall } from './api';

export interface Food {
  id?: string;
  name: string;
  brand?: string;
  user_id?: string;
  is_custom?: boolean;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  serving_size?: number;
  serving_unit?: string;
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

    const existingVariantMap = new Map(existingVariants?.map(v => [v.serving_unit, v.id]) || []);
    const currentVariantUnits = new Set<string>();

    // Process each variant from the form (skip the primary unit as it's handled in the foods table)
    for (let i = 1; i < variants.length; i++) {
      const variant = variants[i];
      currentVariantUnits.add(variant.serving_unit);

      const variantData = {
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
      };

      if (existingVariantMap.has(variant.serving_unit)) {
        // Update existing variant
        const variantIdToUpdate = existingVariantMap.get(variant.serving_unit);
        await apiCall(`/api/food-variants/${variantIdToUpdate}`, {
          method: 'PUT',
          body: variantData,
        });
      } else {
        // Insert new variant
        await apiCall('/api/food-variants', {
          method: 'POST',
          body: variantData,
        });
      }
    }

    // Remove any variants that were deleted (existed before but not in current variants)
    const variantsToDelete = existingVariants.filter(ev => !currentVariantUnits.has(ev.serving_unit));
    for (const variantToDelete of variantsToDelete) {
      await apiCall(`/api/food-variants/${variantToDelete.id}`, {
        method: 'DELETE',
      });
    }
  } else {
    // Create new food
    savedFood = await apiCall('/api/foods', {
      method: 'POST',
      body: { ...foodData, user_id: userId, is_custom: true },
    });

    // Insert new variants (only if there are any, and they are not the primary unit)
    const variantsToInsert = variants.filter(variant =>
      !(variant.serving_size === foodData.serving_size && variant.serving_unit === foodData.serving_unit)
    ).map(variant => ({
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

    if (variantsToInsert.length > 0) {
      await apiCall('/api/food-variants/bulk', {
        method: 'POST',
        body: variantsToInsert,
      });
    }
  }
  return savedFood;
};

export const isUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};