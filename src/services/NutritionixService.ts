import { toast } from "@/hooks/use-toast";

// Define the base URL for your backend API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3010";

// Function to fetch food data provider details from your backend
const fetchFoodDataProvider = async (providerId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/food-data-providers/${providerId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch food data provider details.");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching food data provider:", error);
    toast({
      title: "Error",
      description: `Failed to retrieve food data provider details: ${error.message}`,
      variant: "destructive",
    });
    return null;
  }
};

interface NutritionixFoodItem {
  food_name: string;
  brand_name?: string;
  serving_qty: number;
  serving_unit: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_saturated_fat: number;
  nf_cholesterol: number;
  nf_sodium: number;
  nf_total_carbohydrate: number;
  nf_dietary_fiber: number;
  nf_sugars: number;
  nf_protein: number;
  nf_potassium: number;
  nf_p: number; // Phosphorus
}

interface NutritionixInstantSearchResponse {
  common: { food_name: string; photo: { thumb: string } }[];
  branded: {
    food_name: string;
    brand_name: string;
    nf_calories: number;
    nf_protein?: number;
    nf_total_carbohydrate?: number;
    nf_total_fat?: number;
    photo: { thumb: string };
    serving_qty: number;
    serving_unit: string;
    nix_item_id: string;
    full_nutrients?: { attr_id: number; value: number }[]; // Add this for detailed branded item lookup
  }[];
}

interface NutritionixNutrientsResponse {
  foods: NutritionixFoodItem[];
}

const NUTRITIONIX_API_BASE_URL = "https://trackapi.nutritionix.com/v2";

export const searchNutritionixFoods = async (query: string, defaultFoodDataProviderId: string | null) => {
  if (!defaultFoodDataProviderId) {
    toast({
      title: "Error",
      description: "No default Nutritionix provider configured.",
      variant: "destructive",
    });
    return [];
  }

  const providerData = await fetchFoodDataProvider(defaultFoodDataProviderId);

  if (!providerData?.app_id || !providerData?.app_key) {
    return [];
  }

  const headers = {
    "Content-Type": "application/json",
    "x-app-id": providerData.app_id,
    "x-app-key": providerData.app_key,
  };

  try {
    const response = await fetch(`${NUTRITIONIX_API_BASE_URL}/search/instant?query=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Nutritionix Instant Search API error:", errorData);
      toast({
        title: "Error",
        description: `Nutritionix search failed: ${errorData.message || response.statusText}`,
        variant: "destructive",
      });
      return [];
    }

    const data: NutritionixInstantSearchResponse = await response.json();
    const commonFoodsPromises = (data.common || []).map(async (item) => {
      const nutrientData = await getNutritionixNutrients(item.food_name, defaultFoodDataProviderId);
      return {
        id: item.food_name, // Use food_name as a temporary ID for common foods
        name: item.food_name,
        brand: null,
        image: item.photo?.thumb,
        source: "Nutritionix",
        calories: nutrientData?.calories || 0,
        protein: nutrientData?.protein || 0,
        carbs: nutrientData?.carbohydrates || 0,
        fat: nutrientData?.fat || 0,
        serving_size: nutrientData?.serving_qty || 0,
        serving_unit: nutrientData?.serving_unit || 'g',
      };
    });

    const brandedFoods = (data.branded || []).map((item) => ({
      id: item.nix_item_id,
      name: item.food_name,
      brand: item.brand_name,
      image: item.photo?.thumb,
      source: "Nutritionix",
      calories: item.nf_calories,
      protein: item.nf_protein || 0,
      carbs: item.nf_total_carbohydrate || 0,
      fat: item.nf_total_fat || 0,
      serving_size: item.serving_qty,
      serving_unit: item.serving_unit,
    }));

    const commonFoods = await Promise.all(commonFoodsPromises);
    const results = [...commonFoods, ...brandedFoods];
    return results;
  } catch (error) {
    console.error("Network error during Nutritionix instant search:", error);
    toast({
      title: "Error",
      description: "Network error during Nutritionix search. Please try again.",
      variant: "destructive",
    });
    return [];
  }
};

export const getNutritionixNutrients = async (query: string, defaultFoodDataProviderId: string | null) => {
  if (!defaultFoodDataProviderId) {
    toast({
      title: "Error",
      description: "No default Nutritionix provider configured.",
      variant: "destructive",
    });
    return null;
  }

  const providerData = await fetchFoodDataProvider(defaultFoodDataProviderId);

  if (!providerData?.app_id || !providerData?.app_key) {
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
    "x-app-id": providerData.app_id,
    "x-app-key": providerData.app_key,
  };

  try {
    const response = await fetch(`${NUTRITIONIX_API_BASE_URL}/natural/nutrients`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ query: query }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Nutritionix Natural Nutrients API error:", errorData);
      toast({
        title: "Error",
        description: `Nutritionix nutrient lookup failed: ${errorData.message || response.statusText}`,
        variant: "destructive",
      });
      return null;
    }

    const data: NutritionixNutrientsResponse = await response.json();
    if (data.foods && data.foods.length > 0) {
      const food = data.foods[0]; // Assuming the first food is the most relevant
      return {
        name: food.food_name,
        brand: food.brand_name || null,
        calories: food.nf_calories,
        protein: food.nf_protein,
        carbohydrates: food.nf_total_carbohydrate,
        fat: food.nf_total_fat,
        saturated_fat: food.nf_saturated_fat, // Add saturated_fat
        sugar: food.nf_sugars,
        fiber: food.nf_dietary_fiber,
        sodium: food.nf_sodium,
        serving_size_g: null, // Nutritionix natural language doesn't always provide this
        serving_unit: food.serving_unit,
        serving_qty: food.serving_qty,
        // Map other nutrients as needed
      };
    }
    return null;
  } catch (error) {
    console.error("Network error during Nutritionix nutrient lookup:", error);
    toast({
      title: "Error",
      description: "Network error during Nutritionix nutrient lookup. Please try again.",
      variant: "destructive",
    });
    return null;
  }
};

export const getNutritionixBrandedNutrients = async (nixItemId: string, defaultFoodDataProviderId: string | null) => {
  if (!defaultFoodDataProviderId) {
    toast({
      title: "Error",
      description: "No default Nutritionix provider configured.",
      variant: "destructive",
    });
    return null;
  }

  const providerData = await fetchFoodDataProvider(defaultFoodDataProviderId);

  if (!providerData?.app_id || !providerData?.app_key) {
    return null;
  }

  const headers = {
    "Content-Type": "application/json",
    "x-app-id": providerData.app_id,
    "x-app-key": providerData.app_key,
  };

  try {
    const response = await fetch(`${NUTRITIONIX_API_BASE_URL}/search/item`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ nix_item_id: nixItemId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Nutritionix Branded Item API error:", errorData);
      toast({
        title: "Error",
        description: `Nutritionix branded item lookup failed: ${errorData.message || response.statusText}`,
        variant: "destructive",
      });
      return null;
    }

    const data = await response.json();
    if (data.foods && data.foods.length > 0) {
      const food = data.foods[0];
      const getNutrientValue = (attr_id: number) => food.full_nutrients?.find(n => n.attr_id === attr_id)?.value || 0;

      return {
        name: food.food_name,
        brand: food.brand_name || null,
        calories: getNutrientValue(208), // Calories
        protein: getNutrientValue(203), // Protein
        carbohydrates: getNutrientValue(205), // Carbohydrates
        fat: getNutrientValue(204), // Total Fat
        saturated_fat: getNutrientValue(606), // Saturated Fat
        sodium: getNutrientValue(307), // Sodium
        sugars: getNutrientValue(269), // Sugars
        dietary_fiber: getNutrientValue(291), // Dietary Fiber
        cholesterol: getNutrientValue(601), // Cholesterol
        potassium: getNutrientValue(306), // Potassium
        serving_qty: food.serving_qty,
        serving_unit: food.serving_unit,
      };
    }
    return null;
  } catch (error) {
    console.error("Network error during Nutritionix branded item lookup:", error);
    toast({
      title: "Error",
      description: "Network error during Nutritionix branded item lookup. Please try again.",
      variant: "destructive",
    });
    return null;
  }
};