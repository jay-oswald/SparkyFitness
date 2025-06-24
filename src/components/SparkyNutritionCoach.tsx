import { forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { NutritionData, CoachResponse, FoodOption } from '@/services/Chatbot/Chatbot_types';
import { fileToBase64, saveMessageToHistory, clearHistory } from '@/services/Chatbot/Chatbot_utils';
import { processFoodInput, addFoodOption } from '@/services/Chatbot/Chatbot_FoodHandler';
import { processChatInput as processChatInputFromAI } from '@/services/Chatbot/Chatbot_ChatHandler'; // Renaming to avoid conflict
import { processExerciseInput } from '@/services/Chatbot/Chatbot_ExerciseHandler';
import { processMeasurementInput } from '@/services/Chatbot/Chatbot_MeasurementHandler';
import { processWaterInput } from '@/services/Chatbot/Chatbot_WaterHandler';
import { processChatInput } from '@/services/Chatbot/Chatbot_ChatHandler';
import { info, error, warn, debug, UserLoggingLevel } from '@/utils/logging';

const SparkyNutritionCoach = forwardRef<any, { userId: string; userLoggingLevel: UserLoggingLevel; timezone: string; formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string }>(({ userId, userLoggingLevel, timezone, formatDateInUserTimezone }, ref) => {

  useImperativeHandle(ref, () => ({
    getTodaysNutrition,
    processUserInput: (input, imageFile, transactionId) => handleUserInput(input, imageFile, transactionId),
    addFoodOption: (optionIndex, originalMetadata, transactionId) => addFoodOption(userId, optionIndex, originalMetadata, formatDateInUserTimezone, userLoggingLevel, transactionId),
    saveMessageToHistory: (content: string, messageType: 'user' | 'assistant', metadata?: any) => saveMessageToHistory(userId, content, messageType, metadata), // Expose and bind userId
    clearHistory: (autoClearPreference: string) => clearHistory(userId, autoClearPreference) // Expose and bind userId
  }));


  const getTodaysNutrition = async (date: string): Promise<NutritionData | null> => {
    try {

      // Get user's goals
      const { data: goalsData, error: goalsError } = await supabase.rpc('get_goals_for_date', {
        p_user_id: userId,
        p_date: date
      });

      if (goalsError) {
        error(userLoggingLevel, '❌ [Nutrition Coach] Error loading goals:', goalsError);
      }

      const goals = goalsData?.[0] || { calories: 2000, protein: 150, carbs: 250, fat: 67 };

      // Get today's food entries
      const { data: foodEntries, error: foodError } = await supabase
        .from('food_entries')
        .select(`
          *,
          foods (*)
        `)
        .eq('user_id', userId)
        .eq('entry_date', date);

      if (foodError) {
        error(userLoggingLevel, '❌ [Nutrition Coach] Error loading food entries:', foodError);
        return null;
      }


      // Calculate nutrition totals
      const totals = (foodEntries || []).reduce((acc, entry) => {
        const food = entry.foods;
        if (!food) return acc;

        const servingSize = food.serving_size || 100;
        const ratio = entry.quantity / servingSize;

        acc.calories += (food.calories || 0) * ratio;
        acc.protein += (food.protein || 0) * ratio;
        acc.carbs += (food.carbs || 0) * ratio;
        acc.fat += (food.fat || 0) * ratio;

        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });


      // Get exercise entries
      const { data: exerciseEntries } = await supabase
        .from('exercise_entries')
        .select('calories_burned')
        .eq('user_id', userId)
        .eq('entry_date', date);

      const exerciseCalories = (exerciseEntries || []).reduce((sum, entry) => sum + (entry.calories_burned || 0), 0);

      // Generate analysis
      const netCalories = totals.calories - exerciseCalories;
      const calorieProgress = Math.round((totals.calories / goals.calories) * 100);
      const proteinProgress = Math.round((totals.protein / goals.protein) * 100);

      let analysis = `📊 **Today's Progress (${date}):**\n`;
      analysis += `• Calories: ${Math.round(totals.calories)}/${goals.calories} (${calorieProgress}%)\n`;
      analysis += `• Protein: ${Math.round(totals.protein)}g/${goals.protein}g (${proteinProgress}%)\n`;
      analysis += `• Carbs: ${Math.round(totals.carbs)}g/${goals.carbs}g\n`;
      analysis += `• Fat: ${Math.round(totals.fat)}g/${goals.fat}g\n`;
      if (exerciseCalories > 0) {
        analysis += `• Exercise: -${exerciseCalories} calories burned\n`;
        analysis += `• Net Calories: ${Math.round(netCalories)}\n`;
      }

      // Generate tips
      let tips = '';
      if (calorieProgress < 70) {
        tips += '• You\'re under your calorie goal - consider adding a healthy snack\n';
      } else if (calorieProgress > 110) {
        tips += '• You\'re over your calorie goal - maybe add some exercise or lighter dinner\n';
      }

      if (proteinProgress < 70) {
        tips += '• Your protein intake is low - try adding lean meats, eggs, or protein shakes\n';
      }

      if ((foodEntries || []).length === 0) {
        analysis = `📝 **Ready to start your day!**\nNo entries yet for ${date}. Let's get tracking!`;
        tips = '• Tell me what you had for breakfast to get started\n• I can help you log food, exercise, and measurements\n• Just describe what you ate naturally - like "I had 2 eggs and toast"';
      }

      return {
        analysis,
        tips: tips || '• You\'re doing great! Keep up the good work\n• Remember to stay hydrated\n• Consider adding more vegetables to your meals',
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        goals
      };
    } catch (err) {
      error(userLoggingLevel, '❌ [Nutrition Coach] Error getting nutrition data:', err);
      return null;
    }
  };

  const handleUserInput = async (input: string, imageFile: File | null = null, transactionId: string): Promise<CoachResponse> => {
    try {
      let imageData = null;
      if (imageFile) {
        imageData = await fileToBase64(imageFile);
      }

      const aiResponse = await getAIResponse(input, imageData, transactionId);

     let parsedResponse: { intent: string; data: any; response?: string; entryDate?: string };
     try {
       // Extract JSON string from markdown code block if present
       const jsonMatch = aiResponse.response.match(/```json\n([\s\S]*?)\n```/);
       const jsonString = jsonMatch ? jsonMatch[1] : aiResponse.response;

       parsedResponse = JSON.parse(jsonString);
       info(userLoggingLevel, 'Parsed AI response:', parsedResponse);
     } catch (jsonError) {
       error(userLoggingLevel, '❌ [Nutrition Coach] Failed to parse AI response as JSON:', jsonError);
       // If JSON parsing fails, treat the entire response as a chat/advice response
       // Construct a CoachResponse with action 'advice'
       return {
         action: 'advice',
         response: aiResponse.response || 'Sorry, I had trouble understanding that.'
       };
     }

     // Resolve the date: prioritize AI's extracted date, fallback to manual extraction
     const determinedEntryDate = parsedResponse.entryDate ? extractDateFromInput(parsedResponse.entryDate) : extractDateFromInput(input);
     info(userLoggingLevel, 'Determined entry date:', determinedEntryDate);

     // Map AI intent to CoachResponse action and call appropriate handlers
     switch (parsedResponse.intent) {
       case 'log_food':
         const foodResponse = await processFoodInput(userId, parsedResponse.data, determinedEntryDate, formatDateInUserTimezone, userLoggingLevel, transactionId); // Get response from food handler, pass formatter

         // Check if the food was not found in the database (fallback)
         if (foodResponse.action === 'none' && foodResponse.metadata?.is_fallback) {
           info(userLoggingLevel, 'Food not found in DB, requesting AI options...');
           const { foodName, unit, mealType, quantity, entryDate } = foodResponse.metadata;

           // Request food options from AI via Edge Function
           const foodOptions = await callAIForFoodOptions(foodName, unit);

           if (foodOptions.length > 0) {
             info(userLoggingLevel, 'Received AI food options:', foodOptions);
             // Format the options for the user
             const optionsResponse = foodOptions.map((option: FoodOption, index: number) =>
               `${index + 1}. ${option.name} (~${Math.round(option.calories || 0)} calories per ${option.serving_size}${option.serving_unit})`
             ).join('\n');

             // Return a CoachResponse with action 'food_options'
             return {
               action: 'food_options',
               response: `I couldn't find "${foodName}" in the database. Here are a few options. Please select one by number:\n\n${optionsResponse}`,
               metadata: {
                 foodOptions: foodOptions, // Include the generated options
                 mealType: mealType,
                 quantity: quantity,
                 unit: unit,
                 entryDate: entryDate
               }
             };
           } else {
             error(userLoggingLevel, 'Failed to generate food options via AI.');
             // Fallback if AI options couldn't be generated
             return {
               action: 'none',
               response: `Sorry, I couldn't find "${foodName}" in the database and had trouble generating suitable options using the AI service. Please check your AI service configuration in settings or try a different food.`
             };
           }
         } else {
           // If food was found and logged, or another issue occurred, return the original response
           return foodResponse;
         }

       case 'log_exercise':
         return await processExerciseInput(userId, parsedResponse.data, determinedEntryDate, formatDateInUserTimezone, userLoggingLevel); // Pass determinedEntryDate, pass formatter
       case 'log_measurement':
         return await processMeasurementInput(userId, parsedResponse.data, determinedEntryDate, formatDateInUserTimezone, userLoggingLevel); // Pass determinedEntryDate, pass formatter
       case 'log_water':
         return await processWaterInput(userId, parsedResponse.data, determinedEntryDate, formatDateInUserTimezone, userLoggingLevel); // Pass determinedEntryDate, pass formatter
       case 'ask_question':
       case 'chat':
         // For chat/ask_question, the response is already in parsedResponse.response
         // We should ensure data is an empty object if not provided by AI
         // processChatInput returns a CoachResponse with action 'advice' or 'chat'
         return await processChatInput(parsedResponse.data || {}, parsedResponse.response); // Chat doesn't need entryDate
       default:
         warn(userLoggingLevel, '⚠️ [Nutrition Coach] Unrecognized AI intent:', parsedResponse.intent);
         // For unrecognized intent, return a CoachResponse with action 'none'
         return {
           action: 'none',
           response: parsedResponse.response || 'I\'m not sure how to handle that request. Can you please rephrase?'
         };
     }

   } catch (err) {
     error(userLoggingLevel, '❌ [Nutrition Coach] Error in processUserInput:', err);
     return {
       action: 'none',
       response: 'An unexpected error occurred while processing your request.'
     };
   }
 };

 const callAIForFoodOptions = async (foodName: string, unit: string): Promise<FoodOption[]> => {
   try {
     // Fetch AI service configuration from the database
     const { data: serviceConfigData, error: configError } = await supabase
       .from('ai_service_settings')
       .select('*')
       .eq('user_id', userId)
       .single();

     if (configError || !serviceConfigData) {
       error(userLoggingLevel, '❌ [Nutrition Coach] Error fetching AI service config for food options:', configError);
       return []; // Return empty array on error
     }

     // Construct the specific message for food option generation
     const messages: any[] = [
       { role: 'system', content: `You are Sparky, an AI nutrition and wellness coach. Your task is to generate minimum 3 realistic food options in JSON format when requested. Respond ONLY with a JSON array of FoodOption objects, including detailed nutritional information (calories, protein, carbs, fat, saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat, cholesterol, sodium, potassium, dietary_fiber, sugars, vitamin_a, vitamin_c, calcium, iron) if available. Do NOT include any other text.
**CRITICAL: When a unit is specified in the request (e.g., 'GENERATE_FOOD_OPTIONS:apple in piece'), ensure the \`serving_unit\` in the generated \`FoodOption\` objects matches the requested unit exactly, if it's a common and logical unit for that food. If not, provide a common and realistic serving unit.**` },
       { role: 'user', content: `GENERATE_FOOD_OPTIONS:${foodName} in ${unit}` },
     ];

     // Call the Supabase Edge Function
     const { data, error: edgeFunctionError } = await supabase.functions.invoke('chat', {
       body: {
         messages: messages,
         service_config: serviceConfigData
       },
     });

     if (edgeFunctionError) {
       error(userLoggingLevel, '❌ [Nutrition Coach] Error calling Edge Function for food options:', edgeFunctionError);
       return []; // Return empty array on error
     }

     // Assuming the Edge Function returns { content: "JSON string of FoodOption array" }
     const aiResponseContent = data?.content;

     if (!aiResponseContent) {
       error(userLoggingLevel, '❌ [Nutrition Coach] No content received from AI for food options.');
       return [];
     }

     let foodOptionsJsonString = aiResponseContent;
     // Extract JSON string from markdown code block if present
     const jsonMatch = aiResponseContent.match(/```json\n([\s\S]*?)\n```/);
     if (jsonMatch && jsonMatch[1]) {
       foodOptionsJsonString = jsonMatch[1];
     }

     try {
       // Attempt to parse the JSON response
       const rawFoodOptions = JSON.parse(foodOptionsJsonString);

       // Map the raw AI response to the FoodOption interface
       const foodOptions: FoodOption[] = (Array.isArray(rawFoodOptions) ? rawFoodOptions : []).map((rawOption: any) => {
         debug(userLoggingLevel, 'Raw AI food option received:', rawOption); // Changed to debug for more detailed info
         const mappedOption: FoodOption = {
           name: rawOption.food_name || rawOption.name || 'Unknown Food', // Map food_name or name to name
           calories: rawOption.calories || 0,
           protein: rawOption.macros?.protein || rawOption.protein || 0,
           carbs: rawOption.macros?.carbs || rawOption.carbs || 0,
           fat: rawOption.macros?.fat || rawOption.fat || 0,
           serving_size: parseFloat(rawOption.serving_size) || 1,
           serving_unit: rawOption.serving_unit || 'serving',
           saturated_fat: rawOption.macros?.saturated_fat || rawOption.saturated_fat,
           polyunsaturated_fat: rawOption.macros?.polyunsaturated_fat || rawOption.polyunsaturated_fat,
           monounsaturated_fat: rawOption.macros?.monounsaturated_fat || rawOption.monounsaturated_fat,
           trans_fat: rawOption.macros?.trans_fat || rawOption.trans_fat,
           cholesterol: rawOption.cholesterol,
           sodium: rawOption.sodium,
           potassium: rawOption.potassium,
           dietary_fiber: rawOption.dietary_fiber,
           sugars: rawOption.sugars,
           vitamin_a: rawOption.vitamin_a,
           vitamin_c: rawOption.vitamin_c,
           calcium: rawOption.calcium,
           iron: rawOption.iron,
          };
          debug(userLoggingLevel, 'Mapped food option:', mappedOption); // Changed to debug
          return mappedOption;
        });

       // Basic validation to ensure the mapped objects have expected properties
       if (foodOptions.every(option =>
         typeof option.name === 'string' &&
         typeof option.calories === 'number' &&
         typeof option.protein === 'number' &&
         typeof option.carbs === 'number' &&
         typeof option.fat === 'number' &&
         typeof option.serving_size === 'number' &&
         typeof option.serving_unit === 'string' &&
         (option.saturated_fat === undefined || typeof option.saturated_fat === 'number') &&
         (option.polyunsaturated_fat === undefined || typeof option.polyunsaturated_fat === 'number') &&
         (option.monounsaturated_fat === undefined || typeof option.monounsaturated_fat === 'number') &&
         (option.trans_fat === undefined || typeof option.trans_fat === 'number') &&
         (option.cholesterol === undefined || typeof option.cholesterol === 'number') &&
         (option.sodium === undefined || typeof option.sodium === 'number') &&
         (option.potassium === undefined || typeof option.potassium === 'number') &&
         (option.dietary_fiber === undefined || typeof option.dietary_fiber === 'number') &&
         (option.sugars === undefined || typeof option.sugars === 'number') &&
         (option.vitamin_a === undefined || typeof option.vitamin_a === 'number') &&
         (option.vitamin_c === undefined || typeof option.vitamin_c === 'number') &&
         (option.calcium === undefined || typeof option.calcium === 'number') &&
         (option.iron === undefined || typeof option.iron === 'number')
       )) {
         return foodOptions;
       } else {
         error(userLoggingLevel, '❌ [Nutrition Coach] Mapped food options failed validation:', foodOptions);
         return [];
       }
     } catch (jsonParseError) {
       error(userLoggingLevel, '❌ [Nutrition Coach] Failed to parse or map JSON response for food options:', jsonParseError, foodOptionsJsonString);
       return []; // Return empty array if JSON parsing or mapping fails
     }

   } catch (err) {
     error(userLoggingLevel, '❌ [Nutrition Coach] Error in callAIForFoodOptions:', err);
     return []; // Return empty array on any other error
   }
 };

  const getAIResponse = async (input: string, imageData: string | null = null, transactionId: string): Promise<CoachResponse> => {
    try {
      debug(userLoggingLevel, `[${transactionId}] Calling getAIResponse with input:`, input);
      const today = new Date().toISOString().split('T')[0]; // Get today's date

      // Fetch user's custom categories to provide context to the AI
      const { data: customCategories, error: customCategoriesError } = await supabase
        .from('custom_categories')
        .select('name, frequency, measurement_type')
        .eq('user_id', userId);

      if (customCategoriesError) {
        error(userLoggingLevel, '❌ [Nutrition Coach] Error fetching custom categories:', customCategoriesError);
        // Continue without custom categories if there's an error
      }

      const customCategoriesList = customCategories ? customCategories.map(cat => `- ${cat.name} (${cat.measurement_type}, ${cat.frequency})`).join('\n') : 'None';


      // Define the system prompt
      const systemPrompt = `You are Sparky, an AI nutrition and wellness coach. Your primary goal is to help users track their food, exercise, and measurements, and provide helpful advice and motivation based on their data and general health knowledge.

The current date is ${today}.

You will receive user input, which can include text and/or images. Your task is to identify the user's intent and extract relevant data. Respond with a JSON object containing the 'intent' and 'data'.

For image inputs:
- Analyze the image to identify food items, estimate quantities, and infer nutritional information.
- If the image clearly shows food, prioritize the 'log_food' intent.
- Extract food_name, quantity, unit, and meal_type from the image content.
- If possible, infer and include nutritional details (calories, protein, carbs, fat, etc.) based on the identified food and estimated quantity, populating the corresponding fields in the 'log_food' intent's data.
- If the image is not food-related or unclear, treat the text input as primary.

**IMPORTANT:** If the user specifies a date or time (e.g., "yesterday", "last Monday", "at 7 PM"), extract this information and include it as a 'entryDate' field in the top level of the JSON object. **Provide relative terms like "today", "yesterday", "tomorrow", or a specific date in 'MM-DD' or 'YYYY-MM-DD' format. Do NOT try to resolve relative terms to a full date yourself.** If no date is specified, omit the 'entryDate' field.

When the user mentions logging food, exercise, or measurements, prioritize extracting the exact name of the item (food name, exercise name, measurement name) as accurately as possible from the user's input. This is crucial for looking up existing items in the database.

Here are the user's existing custom measurement categories:
${customCategoriesList}

When the user mentions a custom measurement, compare it to the list above. If you find a match or a very similar variation (considering synonyms and capitalization), use the **exact name** from the list in the 'name' field of the measurement data. If no clear match is found in the list, use the name as provided by the user.

**For 'log_food' intent, pay close attention to the unit specified by the user and match it in the 'unit' field of the food data.**
- If the user says "gram" or "g", use "g".
- If the user says "cup" or "cups", use "cup".
- If the user refers to individual items by count (e.g., "two apples", "3 eggs"), use "piece".
- If the unit is not explicitly mentioned, infer the most appropriate unit based on the food item and context (e.g., "apple" is likely "piece", "rice" is likely "g" or "cup"). Refer to common food units used in the application (like 'g', 'cup', 'oz', 'ml', 'serving', 'piece').

Possible intents and their required data:
- 'log_food': User wants to log food.
  - If you can confidently identify a single food item and its details, data should include:
    - food_name: string (e.g., "apple", "chicken breast", "Dosa") - Extract the most likely exact name.
    - quantity: number (e.g., 1, 100) - Infer if possible, default to 1 if a specific quantity isn't clear but a food is mentioned.
    - unit: string (e.g., "piece", "g", "oz", "ml", "cup", "serving") - **CRITICAL: Match the user's specified unit exactly.** If the user refers to individual items by count (e.g., "two apples", "3 eggs"), use "piece". If no unit is explicitly mentioned, infer the most appropriate unit based on the food item and context (e.g., "apple" is likely "piece", "rice" is likely "g" or "cup"). Refer to common food units used in the application (like 'g', 'cup', 'oz', 'ml', 'serving', 'piece').
    - meal_type: string ("breakfast", "lunch", "dinner", "snacks") - Infer based on time of day or context, default to "snacks".
    - **Include as many of the following nutritional fields as you can extract from the user's input or your knowledge about the food:**
      - calories: number
      - protein: number
      - carbs: number
      - fat: number
      - saturated_fat: number
      - polyunsaturated_fat: number
      - monounsaturated_fat: number
      - trans_fat: number
      - cholesterol: number
      - sodium: number
      - potassium: number
      - dietary_fiber: number
      - sugars: number
      - vitamin_a: number
      - vitamin_c: number
      - calcium: number
      - iron: number
      - FoodOption: array of realistic food options (if applicable)
      - serving_size: number
      - serving_unit: string
  

- 'log_exercise': User wants to log exercise. Data should include:
 - exercise_name: string (e.g., "running", "yoga") - Extract the most likely exact name.
 - duration_minutes: number | null (e.g., 30, 60) - Infer if possible.
 - distance: number | null (e.g., 5, 3.1) - Infer if mentioned.
 - distance_unit: string | null ("miles", "km") - Infer if mentioned.
- 'log_measurement': User wants to log a body measurement or steps. Data should include an array of measurements:
 - measurements: Array of objects, each with:
   - type: string ("weight", "neck", "waist", "hips", "steps", "custom") - Use "custom" for any measurement not in the standard list.
   - value: number
   - unit: string | null (e.g., "kg", "lbs", "cm", "inches", "steps") - Infer if possible, default to null for steps.
   - name: string | null (required if type is "custom") - **Crucially, if the user mentions a custom category from the list provided, use its exact name here.**
- 'log_water': User wants to log water intake. Data should include:
 - glasses_consumed: number (e.g., 1, 2) - Infer if possible, default to 1.
- 'ask_question': User is asking a general question or seeking advice. Data is an empty object {}.
- 'chat': User is engaging in casual conversation. Data is an empty object {}.

If the intent is 'ask_question' or 'chat', also provide a 'response' field with a friendly and helpful text response. For logging intents, the 'response' field is optional and can be a simple confirmation or encouraging remark.

If you cannot determine the intent or extract data with high confidence, default to 'ask_question' or 'chat' and provide a suitable response asking for clarification.

Output format MUST be a JSON object with 'intent' (string) and 'data' (object) fields, and optionally 'entryDate' (string with relative term or date format). Do NOT include any other text outside the JSON object.

Example JSON output for logging weight for yesterday:
{"intent": "log_measurement", "data": {"measurements": [{"type": "weight", "value": 70, "unit": "kg"}]}, "entryDate": "yesterday"}

Example JSON output for asking a question:
{"intent": "ask_question", "data": {}, "response": "I can help with that! What's your question?"}

Example JSON output for logging steps:
{"intent": "log_measurement", "data": {"measurements": [{"type": "steps", "value": 10000, "unit": "steps"}]}}

Example JSON output for logging food for today with detailed nutrition:
{"intent": "log_food", "data": {"food_name": "apple", "quantity": 1, "unit": "piece", "meal_type": "snack", "calories": 95, "carbs": 25, "sugars": 19, "dietary_fiber": 4, "vitamin_c": 9}, "entryDate": "today"}

Example JSON output for logging exercise:
{"intent": "log_exercise", "data": {"exercise_name": "running", "duration_minutes": 30, "distance": 3, "distance_unit": "miles"}, "entryDate": "06-18"}

Example JSON output for logging a custom measurement (e.g., Blood Sugar), using the exact name from the provided list:
{"intent": "log_measurement", "data": {"measurements": [{"type": "custom", "name": "Blood Sugar", "value": 140, "unit": "mg/dL"}]}, "entryDate": "today"}


Be precise with data extraction and follow the JSON structure exactly.

**Special Instruction: Food Option Generation**
If you receive a request in the format "GENERATE_FOOD_OPTIONS:[food name] in [unit]", respond with a JSON array of 2-3 realistic \`FoodOption\` objects for the specified food name.
**Prioritize providing a \`serving_unit\` that matches the requested unit if it's a common and logical unit for that food.** If the requested unit is not common or logical for the food, provide a common and realistic serving unit (e.g., "g", "piece", "serving"). Each \`FoodOption\` should include:
- name: string (e.g., "\`Apple (medium)\`", "\`Cooked Rice (per cup)\`")
- calories: number (estimated)
- protein: number (estimated)
- carbs: number (estimated)
- fat: number (estimated)
- serving_size: number (e.g., 1, 100, 0.5) - This MUST be a numeric value representing the quantity.
- serving_unit: string (e.g., "\`piece\`", "\`g\`", "\`cup\`", "\`oz\`") - This MUST be the unit string only, without any numeric quantity.

Example JSON output for "GENERATE_FOOD_OPTIONS:apple":
[
  {"\`name\`": "\`Apple (medium)\`", "\`calories\`": 95, "\`protein\`": 0.5, "\`carbs\`": 25, "\`fat\`": 0.3, "\`serving_size\`": 1, "\`serving_unit\`": "\`piece\`"},
  {"\`name\`": "\`Apple (100g)\`", "\`calories\`": 52, "\`protein\`": 0.3, "\`carbs\`": 14, "\`fat\`": 0.2, "\`serving_size\`": 100, "\`serving_unit\`": "\`g\`"}
]
`;

      // Fetch recent chat history for context (e.g., last 5 messages)
      const { data: history, error: historyError } = await supabase
        .from('sparky_chat_history')
        .select('content, message_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(5);

      if (historyError) {
        error(userLoggingLevel, `[${transactionId}] ❌ [Nutrition Coach] Error fetching chat history:`, historyError);
        // Continue without history if there's an error
      }

      // Construct the messages array for the AI (including system prompt, history, and user input)
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(msg => ({
          role: msg.message_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
      ];

      // Add user input parts (text and optional image)
      const userMessageContent: any[] = [];
      if (input.trim()) {
        userMessageContent.push({ type: 'text', text: input.trim() });
      }
      if (imageData) {
        // Assuming imageData is a Base64 string like "data:image/png;base64,..."
        // Pass the full data URL directly. The Edge Function will parse it.
        userMessageContent.push({ type: 'image_url', image_url: { url: imageData } });
      }

      if (userMessageContent.length > 0) {
         messages.push({ role: 'user', content: userMessageContent });
      } else {
        // If no text and no image, return an error or default response
         return {
           action: 'none',
           response: 'Please provide text or an image.'
         };
      }

      // Fetch AI service configuration from the database
      const { data: serviceConfigData, error: configError } = await supabase
        .from('ai_service_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (configError || !serviceConfigData) {
        error(userLoggingLevel, `[${transactionId}] ❌ [Nutrition Coach] Error fetching AI service config or config not found:`, configError);
        return {
          action: 'none',
          response: 'Sorry, I can\'t connect to the AI service. Please check your AI settings.'
        };
      }


      // Call the Supabase Edge Function
      const { data, error: edgeFunctionError } = await supabase.functions.invoke('chat', {
        body: {
          messages: messages,
          service_config: serviceConfigData
        },
      });

      if (edgeFunctionError) {
        let errorMessage = 'Sorry, I had trouble getting a response from the AI. Please try again later.';
        if (edgeFunctionError.message) {
          try {
            const parsedError = JSON.parse(edgeFunctionError.message);
            if (parsedError.error) {
              errorMessage = parsedError.error;
            } else {
              errorMessage = edgeFunctionError.message;
            }
          } catch (e) {
            errorMessage = edgeFunctionError.message;
          }
        }
        error(userLoggingLevel, `[${transactionId}] ❌ [Nutrition Coach] Error calling Edge Function:`, edgeFunctionError);
        return {
          action: 'none',
          response: errorMessage
        };
      }


      // Assuming the Edge Function returns { content: "AI response text" }
      const aiResponseContent = data?.content || 'No response from AI.';

      return {
        action: 'advice', // Indicate this is general advice
        response: aiResponseContent
      };

    } catch (err) {
      error(userLoggingLevel, `[${transactionId}] ❌ [Nutrition Coach] Error in getAIResponse:`, err);
      return {
        action: 'none',
        response: 'An unexpected error occurred while trying to get an AI response.'
      };
    }
  };

  // Helper function to extract and resolve date from input string
  const extractDateFromInput = (input: string): string | undefined => {
    const lowerInput = input.toLowerCase();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (lowerInput.includes('today')) {
      return today.toISOString().split('T')[0];
    } else if (lowerInput.includes('yesterday')) {
      return yesterday.toISOString().split('T')[0];
    } else if (lowerInput.includes('tomorrow')) {
      return tomorrow.toISOString().split('T')[0];
    }

    // Basic handling for MM-DD or YYYY-MM-DD format
    const dateMatch = lowerInput.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1], 10);
      const day = parseInt(dateMatch[2], 10);
      let year = today.getFullYear(); // Default to current year

      if (dateMatch[3]) {
        year = parseInt(dateMatch[3], 10);
        if (year < 100) { // Handle 2-digit year
          year += 2000; // Assume 21st century
        }
      }

      // Basic validation
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        // Check if the year was inferred and the date is in the future,
        // if so, assume the user meant a past year.
        if (!dateMatch[3] && date > today) {
             date.setFullYear(year - 1);
        }
         return date.toISOString().split('T')[0];
      }
    }


    return undefined; // Return undefined if no recognizable date is found
  };


  return null; // This component doesn't render anything
});

SparkyNutritionCoach.displayName = 'SparkyNutritionCoach';

export default SparkyNutritionCoach;
