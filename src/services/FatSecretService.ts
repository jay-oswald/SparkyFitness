import { toast } from "@/hooks/use-toast";

const PROXY_BASE_URL = import.meta.env.VITE_SPARKY_FITNESS_SERVER_URL || "http://localhost:3010/api/fatsecret"; // URL of your Node.js proxy server

interface FatSecretFoodItem {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type: string;
  food_url: string;
  food_description: string;
  servings?: {
    serving: FatSecretServing[];
  };
}

interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  metric_serving_amount: string;
  metric_serving_unit: string;
  number_of_units: string;
  measurement_description: string;
  is_default: string;
  calories: string;
  carbohydrate: string;
  protein: string;
  fat: string;
  saturated_fat?: string;
  polyunsaturated_fat?: string;
  monounsaturated_fat?: string;
  trans_fat?: string;
  cholesterol?: string;
  sodium?: string;
  potassium?: string;
  fiber?: string;
  sugar?: string;
  added_sugars?: string;
  vitamin_d?: string;
  vitamin_a?: string;
  vitamin_c?: string;
  calcium?: string;
  iron?: string;
}

interface FatSecretSearchResponse {
  foods: {
    max_results: string;
    total_results: string;
    page_number: string;
    food: FatSecretFoodItem[]; // Corrected: 'food' array is directly under 'foods'
  };
}

interface FatSecretFoodGetResponse {
  food: {
    food_id: string;
    food_name: string;
    brand_name?: string;
    food_type: string;
    food_url: string;
    servings: {
      serving: FatSecretServing[];
    };
  };
}

export const searchFatSecretFoods = async (query: string, providerId: string) => {
  try {
    const response = await fetch(
      `${PROXY_BASE_URL}/search?query=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          'x-provider-id': providerId, // Pass providerId in a custom header
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("FatSecret Food Search API error:", errorData);
      toast({
        title: "Error",
        description: `FatSecret search failed: ${errorData.message || response.statusText}`,
        variant: "destructive",
      });
      return [];
    }

    const data: FatSecretSearchResponse = await response.json();
    if (data.foods && data.foods.food) { // Corrected: Check for 'foods' and 'food' directly
      return data.foods.food.map(item => ({
        id: item.food_id,
        name: item.food_name,
        brand: item.brand_name || null,
        food_type: item.food_type,
        description: item.food_description,
        source: "FatSecret",
        // Basic nutrient info from search results (if available, otherwise will fetch detailed later)
        calories: item.servings?.serving[0]?.calories ? parseFloat(item.servings.serving[0].calories) : 0,
        protein: item.servings?.serving[0]?.protein ? parseFloat(item.servings.serving[0].protein) : 0,
        carbs: item.servings?.serving[0]?.carbohydrate ? parseFloat(item.servings.serving[0].carbohydrate) : 0,
        fat: item.servings?.serving[0]?.fat ? parseFloat(item.servings.serving[0].fat) : 0,
        serving_size: item.servings?.serving[0]?.metric_serving_amount ? parseFloat(item.servings.serving[0].metric_serving_amount) : 0,
        serving_unit: item.servings?.serving[0]?.metric_serving_unit || 'g',
      }));
    }
    return [];
  } catch (error) {
    console.error("Network error during FatSecret food search:", error);
    toast({
      title: "Error",
      description: "Network error during FatSecret search. Please try again.",
      variant: "destructive",
    });
    return [];
  }
};

export const getFatSecretNutrients = async (foodId: string, providerId: string) => {
  try {
    const response = await fetch(
      `${PROXY_BASE_URL}/nutrients?foodId=${encodeURIComponent(foodId)}`,
      {
        method: "GET",
        headers: {
          'x-provider-id': providerId, // Pass providerId in a custom header
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("FatSecret Food Get API error from proxy:", errorData);
      toast({
        title: "Error",
        description: `FatSecret nutrient lookup failed: ${errorData.error || response.statusText}`,
        variant: "destructive",
      });
      return null;
    }

    const data = await response.json();
    // The proxy returns the raw FatSecret response, so we parse it here
    if (data.food && data.food.servings && data.food.servings.serving) {
      // Find the default serving or the first serving if no default is flagged
      const defaultServing = data.food.servings.serving.find(s => s.is_default === "1") || data.food.servings.serving[0];

      if (defaultServing) {
        return {
          name: data.food.food_name,
          brand: data.food.brand_name || null,
          calories: parseFloat(defaultServing.calories || '0'),
          protein: parseFloat(defaultServing.protein || '0'),
          carbohydrates: parseFloat(defaultServing.carbohydrate || '0'),
          fat: parseFloat(defaultServing.fat || '0'),
          saturated_fat: parseFloat(defaultServing.saturated_fat || '0'),
          polyunsaturated_fat: parseFloat(defaultServing.polyunsaturated_fat || '0'),
          monounsaturated_fat: parseFloat(defaultServing.monounsaturated_fat || '0'),
          trans_fat: parseFloat(defaultServing.trans_fat || '0'),
          cholesterol: parseFloat(defaultServing.cholesterol || '0'),
          sodium: parseFloat(defaultServing.sodium || '0'),
          potassium: parseFloat(defaultServing.potassium || '0'),
          dietary_fiber: parseFloat(defaultServing.fiber || '0'),
          sugars: parseFloat(defaultServing.sugar || '0'),
          vitamin_a: parseFloat(defaultServing.vitamin_a || '0'),
          vitamin_c: parseFloat(defaultServing.vitamin_c || '0'),
          calcium: parseFloat(defaultServing.calcium || '0'),
          iron: parseFloat(defaultServing.iron || '0'),
          serving_qty: parseFloat(defaultServing.metric_serving_amount || '0'),
          serving_unit: defaultServing.metric_serving_unit || 'g',
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Network error during FatSecret nutrient lookup via proxy:", error);
    toast({
      title: "Error",
      description: "Network error during FatSecret nutrient lookup. Please ensure your SparkyFitnessServer is running.",
      variant: "destructive",
    });
    return null;
  }
};