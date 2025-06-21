import { supabase } from '@/integrations/supabase/client';
import { CoachResponse, FoodOption } from './Chatbot_types'; // Import types
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

import SparkyAIService from '@/components/SparkyAIService'; // Import SparkyAIService

const sparkyAIService = new SparkyAIService(); // Create an instance of SparkyAIService
// Function to process food input
export const processFoodInput = async (userId: string, data: {
  food_name: string;
  quantity: number;
  unit: string;
  meal_type: string;
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
  foodOptions?: FoodOption[]; // Add foodOptions here
}, entryDate?: string): Promise<CoachResponse> => {
  try {
    debug('Processing food input with data:', data, 'and entryDate:', entryDate);

    const { food_name, quantity, unit, meal_type: raw_meal_type, foodOptions, ...nutritionData } = data; // Destructure, also check for foodOptions array
    // Standardize meal type: convert 'snack' to 'snacks' to match potential database constraint
    const meal_type = raw_meal_type?.toLowerCase() === 'snack' ? 'snacks' : raw_meal_type;
    const dateToUse = entryDate || new Date().toISOString().split('T')[0]; // Use provided date or today's date

    // Check if the data already contains food options from the AI
    if (foodOptions && Array.isArray(foodOptions) && foodOptions.length > 0) {
      info('Received food options from AI:', foodOptions);
      // Return food options to the user
      const optionsResponse = foodOptions.map((option: FoodOption, index: number) =>
        `${index + 1}. ${option.name} (~${Math.round(option.calories || 0)} calories per ${option.serving_size}${option.serving_unit})`
      ).join('\n');

      return {
        action: 'food_options',
        response: `I couldn't find "${food_name}" in the database. Here are a few options. Please select one by number:\n\n${optionsResponse}`,
        metadata: {
          foodOptions: foodOptions,
          mealType: meal_type,
          quantity: quantity,
          unit: unit, // Pass the original unit from user input
          entryDate: dateToUse // Pass the determined date
        }
      };
    }

    // If no food options array, proceed with database search
    debug('No food options array received, searching database for:', food_name);

    // Search for exact match first (case-insensitive)
    debug('Searching for exact food match:', food_name);
    const { data: exactFoods, error: exactError } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', food_name) // Case-insensitive match for user's custom foods
      .eq('user_id', userId) // Limit to user's custom foods first
      .limit(1);

    if (exactError) {
      error('❌ [Nutrition Coach] Error searching for exact food match:', exactError);
    }
    debug('Exact search results:', exactFoods);

    let existingFoods = exactFoods;
    let broadError = null;

    // If no exact match found, try a broader case-insensitive search
    if (!existingFoods || existingFoods.length === 0) {
      debug('No exact match found, searching broadly for:', food_name);
      const { data: broadFoods, error: currentBroadError } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${food_name}%`) // Contains the food name
        .or(`user_id.eq.${userId},is_custom.eq.false`) // Include user's custom or public foods
        .limit(3);

      if (currentBroadError) {
        error('❌ [Nutrition Coach] Error searching for broad food match:', currentBroadError);
        broadError = currentBroadError;
      }
      debug('Broad search results:', broadFoods);
      existingFoods = broadFoods;
    }

    if (exactError || broadError) {
      error('❌ [Nutrition Coach] Error during food search:', exactError || broadError);
      return {
        action: 'none',
        response: 'Sorry, I had trouble accessing the food database. Please try again.'
      };
    }

    debug('Final search results:', existingFoods);

    if (existingFoods && existingFoods.length > 0) {
      info('Food found in database.');
      // Food exists, add it directly
      // Prioritize exact match if found, otherwise use the first broad match
      const food = exactFoods?.length > 0 ? exactFoods[0] : existingFoods[0];
      debug('Using food:', food);

      info('Inserting food entry...');
      const { error: insertError } = await supabase
        .from('food_entries')
        .insert({
          user_id: userId,
          food_id: food.id,
          meal_type: meal_type,
          quantity: quantity,
          unit: unit,
          entry_date: dateToUse // Use the determined date
        });

      if (insertError) {
        error('❌ [Nutrition Coach] Error adding food entry:', insertError);
        return {
          action: 'none',
          response: 'Sorry, I couldn\'t add that to your diary. Please try again.'
        };
      }

      info('Food entry inserted successfully.');

      const calories = Math.round((food.calories || 0) * (quantity / (food.serving_size || 100)));

      return {
        action: 'food_added',
        response: `✅ **Added to your ${meal_type} on ${dateToUse}!**\n\n🍽️ ${food.name} (${quantity}${unit})\n📊 ~${calories} calories\n\n💡 Great choice! This adds ${Math.round(food.protein || 0)}g protein to your day.`
      };
    } else {
      info('Food not found in database. Returning fallback data.');
      // Food not found, return a response indicating this,
      // and include the original data for the coach to request AI options.
      return {
        action: 'none', // Indicate that no food was added
        response: `Food "${food_name}" not found in database.`, // Provide feedback
        metadata: {
          is_fallback: true, // Flag to indicate fallback
          foodName: food_name, // Pass the food name
          unit: unit, // Pass the original unit
          mealType: meal_type, // Pass the meal type
          quantity: quantity, // Pass the quantity
          entryDate: dateToUse // Pass the determined date
        }
      };
    }
 } catch (err) {
    error('❌ [Nutrition Coach] Error processing food input:', err);
    error('Full error details:', err);
    return {
      action: 'none',
      response: 'Sorry, I had trouble processing that. Could you try rephrasing what you ate?'
    };
  }
};

// Function to add a selected food option to the diary
export const addFoodOption = async (userId: string, optionIndex: number, originalMetadata: any): Promise<CoachResponse> => {
  try {
    const { foodOptions, mealType, quantity, unit, entryDate } = originalMetadata; // Include unit and entryDate
    const selectedOption = foodOptions[optionIndex];

    if (!selectedOption) {
      error('❌ [Nutrition Coach] Invalid option index:', optionIndex);
      return {
        action: 'none',
        response: 'Invalid option selected. Please try again.'
      };
    }

    // Use the entryDate from original metadata if available, otherwise use today
    const dateToUse = entryDate || new Date().toISOString().split('T')[0];


    // First, create the food in the database
    const { data: newFood, error: foodCreateError } = await supabase
      .from('foods')
      .insert({
        name: selectedOption.name,
        calories: selectedOption.calories,
        protein: selectedOption.protein,
        carbs: selectedOption.carbs,
        fat: selectedOption.fat,
        serving_size: selectedOption.serving_size,
        serving_unit: selectedOption.serving_unit,
        saturated_fat: selectedOption.saturated_fat,
        polyunsaturated_fat: selectedOption.polyunsaturated_fat,
        monounsaturated_fat: selectedOption.monounsaturated_fat,
        trans_fat: selectedOption.trans_fat,
        cholesterol: selectedOption.cholesterol,
        sodium: selectedOption.sodium,
        potassium: selectedOption.potassium,
        dietary_fiber: selectedOption.dietary_fiber,
        sugars: selectedOption.sugars,
        vitamin_a: selectedOption.vitamin_a,
        vitamin_c: selectedOption.vitamin_c,
        calcium: selectedOption.calcium,
        iron: selectedOption.iron,
        is_custom: true,
        user_id: userId
      })
      .select()
      .single();

    if (foodCreateError) {
      error('❌ [Nutrition Coach] Error creating food:', foodCreateError);
      return {
        action: 'none',
        response: 'Sorry, I couldn\'t create that food. Please try again.'
      };
    }

    // Then, add it to the diary
    const { error: entryError } = await supabase
      .from('food_entries')
      .insert({
        user_id: userId,
        food_id: newFood.id,
        meal_type: mealType,
        quantity: quantity,
        unit: unit, // Use the unit from original metadata
        entry_date: dateToUse // Use the determined date
      });

    if (entryError) {
      error('❌ [Nutrition Coach] Error creating food entry:', entryError);
      return {
        action: 'none',
        response: 'I created the food but couldn\'t add it to your diary. Please try again.'
      };
    }

    const calories = Math.round((selectedOption.calories || 0) * (quantity / (selectedOption.serving_size || 100)));

    return {
      action: 'food_added',
      response: `✅ **Added to your ${mealType} on ${dateToUse}!**\n\n🍽️ ${selectedOption.name} (${quantity}${unit})\n📊 ~${calories} calories\n\n💡 Great choice! This adds ${Math.round(selectedOption.protein || 0)}g protein to your day.`
    };

  } catch (err) {
    error('❌ [Nutrition Coach] Error in addFoodOption:', err);
    return {
      action: 'none',
      response: 'Sorry, I encountered an error adding that food. Please try again.'
    };
  }
};

