import { forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NutritionData {
  analysis: string;
  tips: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface CoachResponse {
  action: 'food_added' | 'exercise_added' | 'measurement_added' | 'food_options' | 'exercise_options' | 'advice' | 'none';
  response: string;
  metadata?: any;
}

interface FoodOption {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
  serving_unit: string;
}

const SparkyNutritionCoach = forwardRef<any, { userId: string }>(({ userId }, ref) => {
  
  useImperativeHandle(ref, () => ({
    getTodaysNutrition,
    processUserInput,
    addFoodOption,
    saveMessageToHistory, // Expose the saveMessageToHistory function
    clearHistory // Expose the clearHistory function
  }));

  // Helper functions to detect mention types
  const containsFoodMention = (input: string): boolean => {
    const foodKeywords = [
      'ate', 'had', 'eating', 'consumed', 'food', 'meal', 'breakfast', 'lunch', 'dinner', 'snack',
      'apple', 'banana', 'rice', 'chicken', 'fish', 'bread', 'egg', 'milk', 'cheese', 'pizza',
      'burger', 'sandwich', 'salad', 'soup', 'pasta', 'noodles', 'vegetable', 'fruit', 'meat',
      'drink', 'juice', 'coffee', 'tea', 'idly', 'dosa', 'roti', 'dal', 'curry', 'sambar'
    ];
    
    return foodKeywords.some(keyword => input.toLowerCase().includes(keyword.toLowerCase()));
  };

  const containsExerciseMention = (input: string): boolean => {
    const exerciseKeywords = [
      'exercise', 'workout', 'gym', 'running', 'walking', 'cycling', 'swimming', 'yoga',
      'cardio', 'weights', 'lifting', 'jogging', 'dancing', 'sports', 'training', 'fitness',
      'pushups', 'situps', 'squats', 'plank', 'stretching', 'pilates', 'aerobics', 'walked',
      'ran', 'cycled', 'swam', 'hiked', 'jog', 'mile', 'miles', 'covered', 'distance'
    ];
    
    return exerciseKeywords.some(keyword => input.toLowerCase().includes(keyword.toLowerCase()));
  };

  const containsMeasurementMention = (input: string): boolean => {
    const measurementKeywords = [
      'weight', 'weigh', 'kg', 'lbs', 'pounds', 'waist', 'hips', 'measurement', 'measure',
      'cm', 'inches', 'inch', 'height', 'body fat', 'muscle', 'neck', 'chest', 'arm', 'thigh', 'scale'
    ];
    
    // Check for daily steps mention vs exercise steps
    const dailyStepsPattern = /daily\s+steps|step\s+count|(\d+)\s+steps\s+(today|yesterday)/i;
    if (dailyStepsPattern.test(input)) {
      return true;
    }
    
    return measurementKeywords.some(keyword => input.toLowerCase().includes(keyword.toLowerCase()));
  };

  const getTodaysNutrition = async (date: string): Promise<NutritionData | null> => {
    try {
      
      // Get user's goals
      const { data: goalsData, error: goalsError } = await supabase.rpc('get_goals_for_date', {
        p_user_id: userId,
        p_date: date
      });

      if (goalsError) {
        console.error('❌ [Nutrition Coach] Error loading goals:', goalsError);
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
        console.error('❌ [Nutrition Coach] Error loading food entries:', foodError);
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
    } catch (error) {
      console.error('❌ [Nutrition Coach] Error getting nutrition data:', error);
      return null;
    }
  };

  const processUserInput = async (input: string, imageFile: File | null = null): Promise<CoachResponse> => {
    const lowercaseInput = input.toLowerCase();

    // Check for general questions or conversational phrases first
    const conversationalKeywords = ['what', 'how', 'can you', 'tell me', 'advice', 'tip', 'suggest', 'why', 'explain', 'define']; // Added more keywords
    const isConversational = conversationalKeywords.some(keyword => lowercaseInput.startsWith(keyword)) || lowercaseInput.includes('?');

    // If there's an image, always send to AI for multimodal analysis, regardless of text content
    if (imageFile) {
       let imageData = null;
       // Convert image file to Base64
       imageData = await fileToBase64(imageFile);
       return await getAIResponse(input, imageData);
    }

    // If it's a conversational query (and no image), send to AI for general response
    if (isConversational) {
      return await getAIResponse(input);
    }

    // If no image and not conversational, check for specific logging commands

    // Check for food mentions (but not if it contains exercise keywords)
    if (containsFoodMention(lowercaseInput) && !containsExerciseMention(lowercaseInput)) {
      return await processFoodInput(input);
    }

    // Check for exercise mentions
    if (containsExerciseMention(lowercaseInput)) {
      return await processExerciseInput(input);
    }

    // Check for measurement mentions (excluding exercise-related distance/steps)
    if (containsMeasurementMention(lowercaseInput) && !containsExerciseMention(lowercaseInput)) {
      return await processMeasurementInput(input);
    }

    // Check for water intake mentions
    if (lowercaseInput.includes('water') || lowercaseInput.includes('glass') || lowercaseInput.includes('drink')) {
      return await processWaterInput(input);
    }

    // Default to advice/conversation via AI if no specific action is detected and no image
    return await getAIResponse(input);
  };

  // Helper function to convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Function to save a message to the database
  const saveMessageToHistory = async (userId: string, content: string, messageType: 'user' | 'assistant', metadata?: any) => {
    try {
      const { error } = await supabase
        .from('sparky_chat_history')
        .insert({
          user_id: userId,
          content: content,
          message_type: messageType,
          metadata: metadata
        });

      if (error) {
        console.error('❌ [Nutrition Coach] Error saving message to history:', error);
      } else {
      }
    } catch (error) {
      console.error('❌ [Nutrition Coach] Unexpected error saving message to history:', error);
    }
  };

  // Function to clear chat history based on preference
  const clearHistory = async (userId: string, autoClearPreference: string) => {
    try {
      if (autoClearPreference === 'session' || autoClearPreference === 'all') {
        const { error } = await supabase
          .from('sparky_chat_history')
          .delete()
          .eq('user_id', userId);

        if (error) {
          console.error('❌ [Nutrition Coach] Error clearing chat history:', error);
        } else {
        }
      } else if (autoClearPreference === '7days') {
        const { error } = await supabase.rpc('clear_old_chat_history');

        if (error) {
          console.error('❌ [Nutrition Coach] Error calling clear_old_chat_history RPC:', error);
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('❌ [Nutrition Coach] Unexpected error clearing chat history:', error);
    }
  };


  const getAIResponse = async (input: string, imageData: string | null = null): Promise<CoachResponse> => {
    try {

      // Define the system prompt
      const systemPrompt = `You are Sparky, an AI nutrition and wellness coach. Your primary goal is to help users track their food, exercise, and measurements, and provide helpful advice and motivation based on their data and general health knowledge.

You can:
- Log food entries (e.g., "I ate an apple", "Had chicken for lunch")
- Log exercise (e.g., "I went for a run", "Did 30 minutes of yoga")
- Log measurements (e.g., "I weigh 70kg", "My waist is 85cm")
- Log water intake (e.g., "I drank 2 glasses of water")
- Provide general nutrition and wellness advice (e.g., "How to sleep better?", "Benefits of exercise")
- Answer questions about healthy habits and lifestyle

Be encouraging and supportive. If the user asks something outside your scope (e.g., complex medical advice, unrelated topics), politely steer them back to health and wellness.

When providing advice, keep it concise and actionable. Use markdown for formatting (bold, lists).`;

      // Construct the messages array for the AI (including system prompt and user input)
      // Note: This simplified version only sends the system prompt and the current user input.
      // A more advanced version would include recent conversation history.
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add user input parts (text and optional image)
      const userMessageContent: any[] = [];
      if (input.trim()) {
        userMessageContent.push({ type: 'text', text: input.trim() });
      }
      if (imageData) {
        // Assuming imageData is a Base64 string like "data:image/png;base64,..."
        const [mimeType, base64Data] = imageData.split(';base64,');
        userMessageContent.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
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
        console.error('❌ [Nutrition Coach] Error fetching AI service config or config not found:', configError);
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
        console.error('❌ [Nutrition Coach] Error calling Edge Function:', edgeFunctionError);
        return {
          action: 'none',
          response: 'Sorry, I had trouble getting a response from the AI. Please try again later.'
        };
      }


      // Assuming the Edge Function returns { content: "AI response text" }
      const aiResponseContent = data?.content || 'No response from AI.';

      return {
        action: 'advice', // Indicate this is general advice
        response: aiResponseContent
      };

    } catch (error) {
      console.error('❌ [Nutrition Coach] Error in getAIResponse:', error);
      return {
        action: 'none',
        response: 'An unexpected error occurred while trying to get an AI response.'
      };
    }
  };

  const addFoodOption = async (optionIndex: number, originalMetadata: any): Promise<CoachResponse> => {
    
    try {
      const { foodOptions, mealType, quantity } = originalMetadata;
      const selectedOption = foodOptions[optionIndex];
      
      if (!selectedOption) {
        console.error('❌ [Nutrition Coach] Invalid option index:', optionIndex);
        return {
          action: 'none',
          response: 'Invalid option selected. Please try again.'
        };
      }

      
      const today = new Date().toISOString().split('T')[0];
      
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
          is_custom: true,
          user_id: userId
        })
        .select()
        .single();

      if (foodCreateError) {
        console.error('❌ [Nutrition Coach] Error creating food:', foodCreateError);
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
          unit: 'g',
          entry_date: today
        });

      if (entryError) {
        console.error('❌ [Nutrition Coach] Error creating food entry:', entryError);
        return {
          action: 'none',
          response: 'I created the food but couldn\'t add it to your diary. Please try again.'
        };
      }


      const calories = Math.round((selectedOption.calories || 0) * (quantity / (selectedOption.serving_size || 100)));
      
      return {
        action: 'food_added',
        response: `✅ **Added to your ${mealType}!**\n\n🍽️ ${selectedOption.name} (${quantity}g)\n📊 ~${calories} calories\n\n💡 Great choice! This adds ${Math.round(selectedOption.protein || 0)}g protein to your day.`
      };

    } catch (error) {
      console.error('❌ [Nutrition Coach] Error in addFoodOption:', error);
      return {
        action: 'none',
        response: 'Sorry, I encountered an error adding that food. Please try again.'
      };
    }
  };

  const processFoodInput = async (input: string): Promise<CoachResponse> => {
    try {
      console.log('Processing food input:', input);
      
      // Extract food name from input (simplified approach)
      const foodName = extractFoodName(input);
      const today = new Date().toISOString().split('T')[0];
      const mealType = extractMealType(input);
      const quantity = extractQuantity(input) || 100;

      console.log('Extracted food details:', { foodName, mealType, quantity });

      // Search for exact match first (case-insensitive)
      console.log('Searching for exact food match:', foodName);
      const { data: exactFoods, error: exactError } = await supabase
        .from('foods')
        .select('*')
        .eq('name', foodName) // Exact match
        .eq('user_id', userId) // Limit to user's custom foods first
        .limit(1);

      if (exactError) {
        console.error('❌ [Nutrition Coach] Error searching for exact food match:', exactError);
      }
      console.log('Exact search results:', exactFoods);

      let existingFoods = exactFoods;
      let broadError = null; // Declare broadError here

      // If no exact match found, try a broader case-insensitive search
      if (!existingFoods || existingFoods.length === 0) {
        console.log('No exact match found, searching broadly for:', foodName);
        const { data: broadFoods, error: currentBroadError } = await supabase // Use a temporary variable name here
          .from('foods')
          .select('*')
          .ilike('name', `%${foodName}%`) // Contains the food name
          .or(`user_id.eq.${userId},is_custom.eq.false`) // Include user's custom or public foods
          .limit(3);

        if (currentBroadError) {
          console.error('❌ [Nutrition Coach] Error searching for broad food match:', currentBroadError);
          broadError = currentBroadError; // Assign the error to the outer scoped variable
        }
        console.log('Broad search results:', broadFoods);
        existingFoods = broadFoods;
      }

      if (exactError || broadError) {
        console.error('❌ [Nutrition Coach] Error during food search:', exactError || broadError);
        return {
          action: 'none',
          response: 'Sorry, I had trouble accessing the food database. Please try again.'
        };
      }

      console.log('Final search results:', existingFoods);

      if (existingFoods && existingFoods.length > 0) {
        console.log('Food found in database.');
        // Food exists, add it directly
        // Prioritize exact match if found, otherwise use the first broad match
        const food = exactFoods?.length > 0 ? exactFoods[0] : existingFoods[0];
        console.log('Using food:', food);

        console.log('Inserting food entry...');
        const { error: insertError } = await supabase
          .from('food_entries')
          .insert({
            user_id: userId,
            food_id: food.id,
            meal_type: mealType,
            quantity: quantity,
            unit: 'g', // Assuming 'g' as default unit for now, need to refine unit handling
            entry_date: today
          });

        if (insertError) {
          console.error('❌ [Nutrition Coach] Error adding food entry:', insertError);
          return {
            action: 'none',
            response: 'Sorry, I couldn\'t add that to your diary. Please try again.'
          };
        }

        console.log('Food entry inserted successfully.');

        const calories = Math.round((food.calories || 0) * (quantity / (food.serving_size || 100)));
        
        return {
          action: 'food_added',
          response: `✅ **Added to your ${mealType}!**\n\n🍽️ ${food.name} (${quantity}g)\n📊 ~${calories} calories\n\n💡 Great choice! This adds ${Math.round(food.protein || 0)}g protein to your day.`
        };
      } else {
        console.log('Food not found in database, offering options.');
        // Food doesn't exist, offer options
        const foodOptions = generateFoodOptions(foodName);
        const optionsText = foodOptions.map((option, index) =>
          `${index + 1}. **${option.name}** - ${option.calories} cal, ${option.protein}g protein`
        ).join('\n');

        console.log('Generated food options:', foodOptions);

        return {
          action: 'food_options',
          response: `🤔 I don't have "${foodName}" in the database yet. Here are some similar options:\n\n${optionsText}\n\n💬 Reply with the number you want, or tell me the exact nutrition if you know it!`,
          metadata: { foodOptions, originalInput: input, mealType, quantity }
        };
      }
    } catch (error) {
      console.error('❌ [Nutrition Coach] Error processing food input:', error);
      // Log the full error object for better debugging
      console.error('Full error details:', error);
      return {
        action: 'none',
        response: 'Sorry, I had trouble processing that. Could you try rephrasing what you ate?'
      };
    }
  };

  const processExerciseInput = async (input: string): Promise<CoachResponse> => {
    try {
      
      const exerciseName = extractExerciseName(input);
      const duration = extractDuration(input) || 30; // Default to 30 minutes
      const distance = extractDistance(input);
      const today = new Date().toISOString().split('T')[0];


      // First, try to find or create the exercise in the database
      let exerciseId: string;
      let caloriesPerHour = 300; // Default

      // Search for existing exercise
      const { data: existingExercises, error: searchError } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', `%${exerciseName}%`)
        .limit(1);

      if (searchError) {
        console.error('❌ [Nutrition Coach] Error searching exercises:', searchError);
      }

      if (existingExercises && existingExercises.length > 0) {
        // Use existing exercise
        const exercise = existingExercises[0];
        exerciseId = exercise.id;
        caloriesPerHour = exercise.calories_per_hour || 300;
      } else {
        // Create new exercise
        
        // Estimate calories per hour based on exercise type
        const estimatedCaloriesPerHour = estimateCaloriesPerHour(exerciseName);
        
        const { data: newExercise, error: createError } = await supabase
          .from('exercises')
          .insert({
            name: exerciseName,
            category: 'cardio',
            calories_per_hour: estimatedCaloriesPerHour,
            is_custom: true,
            user_id: userId
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ [Nutrition Coach] Error creating exercise:', createError);
          return {
            action: 'none',
            response: 'Sorry, I couldn\'t create that exercise. Please try again.'
          };
        }

        exerciseId = newExercise.id;
        caloriesPerHour = newExercise.calories_per_hour;
      }

      // Calculate calories burned
      const caloriesBurned = Math.round((caloriesPerHour / 60) * duration);

      // Add exercise entry
      const { data: exerciseEntry, error: entryError } = await supabase
        .from('exercise_entries')
        .insert({
          user_id: userId,
          exercise_id: exerciseId,
          duration_minutes: duration,
          calories_burned: caloriesBurned,
          entry_date: today,
          notes: distance ? `Distance: ${distance} miles` : undefined
        })
        .select()
        .single();

      if (entryError) {
        console.error('❌ [Nutrition Coach] Error adding exercise entry:', entryError);
        return {
          action: 'none',
          response: 'Sorry, I couldn\'t add that exercise. Please try again.'
        };
      }


      let response = `🏃‍♂️ **Great workout!**\n\n💪 ${exerciseName} - ${duration} minutes\n`;
      if (distance) {
        response += `📏 Distance: ${distance} miles\n`;
      }
      response += `🔥 ~${caloriesBurned} calories burned\n\n🎉 Awesome job staying active! This really helps with your fitness goals.`;

      return {
        action: 'exercise_added',
        response
      };

    } catch (error) {
      console.error('❌ [Nutrition Coach] Error processing exercise input:', error);
      return {
        action: 'none',
        response: 'Sorry, I had trouble processing that exercise. Could you try rephrasing what you did?'
      };
    }
  };

  const processMeasurementInput = async (input: string): Promise<CoachResponse> => {
    try {
      
      const today = new Date().toISOString().split('T')[0];
      
      // Extract measurements with improved parsing
      const weight = extractWeight(input);
      const waist = extractWaistMeasurement(input);
      const hips = extractMeasurement(input, ['hips']);
      const dailySteps = extractDailySteps(input); // Separate from exercise steps


      if (weight || waist || hips || dailySteps) {
        const { error } = await supabase
          .from('check_in_measurements')
          .upsert({
            user_id: userId,
            entry_date: today,
            weight: weight,
            waist: waist,
            hips: hips,
            steps: dailySteps
          }, {
            onConflict: 'user_id,entry_date'
          });

        if (error) {
          console.error('❌ [Nutrition Coach] Error saving measurements:', error);
          return {
            action: 'none',
            response: 'Sorry, I couldn\'t save those measurements. Please try again.'
          };
        }


        let response = '📏 **Measurements updated!**\n\n';
        if (weight) response += `⚖️ Weight: ${weight}kg\n`;
        if (waist) response += `📐 Waist: ${waist}cm\n`;
        if (hips) response += `📐 Hips: ${hips}cm\n`;
        if (dailySteps) response += `👟 Daily Steps: ${dailySteps.toLocaleString()}\n`;
        
        response += '\n💪 Great job tracking your progress! Consistency is key to reaching your goals.';

        return {
          action: 'measurement_added',
          response
        };
      }

      return {
        action: 'none',
        response: 'I couldn\'t identify specific measurements in your message. Try saying something like "I weigh 70kg" or "My waist is 85cm".'
      };
    } catch (error) {
      console.error('❌ [Nutrition Coach] Error processing measurement input:', error);
      return {
        action: 'none',
        response: 'Sorry, I had trouble processing those measurements. Could you try again?'
      };
    }
  };

  const processWaterInput = async (input: string): Promise<CoachResponse> => {
    try {
      
      const glasses = extractGlasses(input) || 1;
      const today = new Date().toISOString().split('T')[0];


      // Get current water intake
      const { data: currentWater, error: fetchError } = await supabase
        .from('water_intake')
        .select('glasses_consumed')
        .eq('user_id', userId)
        .eq('entry_date', today)
        .single();

      const currentGlasses = currentWater?.glasses_consumed || 0;
      const newTotal = currentGlasses + glasses;


      const { error } = await supabase
        .from('water_intake')
        .upsert({
          user_id: userId,
          entry_date: today,
          glasses_consumed: newTotal
        }, {
          onConflict: 'user_id,entry_date'
        });

      if (error) {
        console.error('❌ [Nutrition Coach] Error updating water intake:', error);
        return {
          action: 'none',
          response: 'Sorry, I couldn\'t update your water intake. Please try again.'
        };
      }


      return {
        action: 'measurement_added',
        response: `💧 **Water logged!**\n\n🥤 Added ${glasses} glass${glasses > 1 ? 'es' : ''}\n📊 Total today: ${newTotal}/8 glasses\n\n${newTotal >= 8 ? '🎉 Great job staying hydrated!' : '💡 Keep drinking water throughout the day!'}`
      };
    } catch (error) {
      console.error('❌ [Nutrition Coach] Error processing water input:', error);
      return {
        action: 'none',
        response: 'Sorry, I had trouble logging your water intake. Could you try again?'
      };
    }
  };

  // Helper functions for extraction
  const extractFoodName = (input: string): string => {
    // Improved food name extraction: look for common patterns and remove meal times/phrases
    let foodName = input.toLowerCase();

    // Remove common meal time phrases
    foodName = foodName.replace(/\s+for\s+(breakfast|lunch|dinner|a snack|snack)\b/g, '');
    foodName = foodName.replace(/\s+as\s+(breakfast|lunch|dinner|a snack|snack)\b/g, '');

    // Look for patterns like "ate X", "had X", etc.
    const patterns = [
      /ate\s+([^,\.!?]+)/,
      /had\s+([^,\.!?]+)/,
      /eating\s+([^,\.!?]+)/,
      /consumed\s+([^,\.!?]+)/,
      /logged\s+([^,\.!?]+)/, // Added 'logged'
      /^([^,\.!?]+)\s+(for|as)\s+(breakfast|lunch|dinner|snack)/ // Pattern like "X for meal"
    ];

    for (const pattern of patterns) {
      const match = foodName.match(pattern);
      if (match && match[1]) {
        foodName = match[1].trim();
        break; // Use the first matching pattern
      }
    }

    // Remove numbers and extra whitespace
    foodName = foodName.replace(/\d+/g, '').trim();
    foodName = foodName.replace(/\s+/g, ' ').trim();

    // Fallback: return the cleaned input if no specific pattern matched
    return foodName || 'food';
  };

  const extractMealType = (input: string): string => {
    if (input.includes('breakfast')) return 'breakfast';
    if (input.includes('lunch')) return 'lunch';
    if (input.includes('dinner')) return 'dinner';
    if (input.includes('snack')) return 'snacks';
    
    // Default based on time of day
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 19) return 'dinner';
    return 'snacks';
  };

  const extractQuantity = (input: string): number | null => {
    const quantityMatch = input.match(/(\d+)\s*(g|grams|kg|kilograms|oz|ounces)/i);
    if (quantityMatch) {
      const value = parseInt(quantityMatch[1]);
      const unit = quantityMatch[2].toLowerCase();
      if (unit.startsWith('kg')) return value * 1000;
      if (unit.startsWith('oz')) return value * 28.35;
      return value;
    }
    return null;
  };

  const extractExerciseName = (input: string): string => {
    // Improved exercise name extraction
    const exercisePatterns = [
      /i\s+(walked|ran|cycled|swam|hiked|jogged)/i,
      /did\s+([^,\.!?]+)/i,
      /went\s+([^,\.!?]+)/i,
      /played\s+([^,\.!?]+)/i,
      /(walking|running|cycling|swimming|yoga|hiking|jogging)/i
    ];

    for (const pattern of exercisePatterns) {
      const match = input.match(pattern);
      if (match) {
        let exerciseName = match[1].trim();
        // Clean up common additions
        exerciseName = exerciseName.replace(/\s+(for|an|hour|hours|minutes|today|yesterday).*$/i, '');
        return exerciseName;
      }
    }

    return 'general exercise';
  };

  const extractDuration = (input: string): number | null => {
    // Improved duration extraction
    const durationPatterns = [
      /(\d+)\s*(hour|hours)/i,
      /(\d+)\s*(min|minutes)/i,
      /an\s+hour/i,
      /for\s+(\d+)\s*(hour|hours|min|minutes)/i
    ];

    for (const pattern of durationPatterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[0].includes('an hour')) return 60;
        
        const value = parseInt(match[1]);
        const unit = match[2]?.toLowerCase() || 'minutes';
        if (unit.startsWith('hour')) return value * 60;
        return value;
      }
    }
    return null;
  };

  const extractDistance = (input: string): number | null => {
    // Look for distance patterns like "3 miles", "5 km", "covered 2 miles", etc.
    const distancePatterns = [
      /(\d+(?:\.\d+)?)\s*miles?/i,
      /(\d+(?:\.\d+)?)\s*km/i,
      /covered\s+(\d+(?:\.\d+)?)\s*miles?/i,
      /walked\s+(\d+(?:\.\d+)?)\s*miles?/i,
      /ran\s+(\d+(?:\.\d+)?)\s*miles?/i
    ];

    for (const pattern of distancePatterns) {
      const match = input.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        return value;
      }
    }
    return null;
  };

  const extractWeight = (input: string): number | null => {
    const weightMatch = input.match(/weigh\s+(\d+(?:\.\d+)?)\s*(kg|lbs|pounds)?|(\d+(?:\.\d+)?)\s*(kg|lbs|pounds)/i);
    if (weightMatch) {
      const value = parseFloat(weightMatch[1] || weightMatch[3]);
      const unit = (weightMatch[2] || weightMatch[4] || 'kg').toLowerCase();
      if (unit.includes('lb')) return value * 0.453592; // Convert to kg
      return value;
    }
    return null;
  };

  const extractWaistMeasurement = (input: string): number | null => {
    // Improved waist measurement extraction
    const waistPatterns = [
      /waist\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(inch|inches|in|cm)?/i,
      /my\s+waist\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(inch|inches|in|cm)?/i,
      /(\d+(?:\.\d+)?)\s*(inch|inches|in|cm)?\s+waist/i,
      /(\d+(?:\.\d+)?)\s*inch\s*waist/i
    ];

    for (const pattern of waistPatterns) {
      const match = input.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = (match[2] || 'cm').toLowerCase();
        
        if (unit.includes('in')) {
          const cmValue = value * 2.54; // Convert inches to cm
          return cmValue;
        }
        return value;
      }
    }
    return null;
  };

  const extractMeasurement = (input: string, bodyParts: string[]): number | null => {
    for (const part of bodyParts) {
      const pattern = new RegExp(`${part}\\s+(?:is\\s+)?(\\d+(?:\\.\\d+)?)\\s*(cm|inches|in)?`, 'i');
      const match = input.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = (match[2] || 'cm').toLowerCase();
        if (unit.includes('in')) return value * 2.54; // Convert to cm
        return value;
      }
    }
    return null;
  };

  const extractDailySteps = (input: string): number | null => {
    // Look for daily steps specifically, not exercise steps
    const dailyStepsPatterns = [
      /daily\s+steps\s+(\d+)/i,
      /step\s+count\s+(\d+)/i,
      /(\d+)\s+steps\s+(today|yesterday)/i,
      /my\s+steps\s+(\d+)/i
    ];

    for (const pattern of dailyStepsPatterns) {
      const match = input.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return null;
  };

  const extractGlasses = (input: string): number | null => {
    const glassMatch = input.match(/(\d+)\s*(?:glass|glasses|cup|cups)/i);
    return glassMatch ? parseInt(glassMatch[1]) : null;
  };

  const estimateCaloriesPerHour = (exerciseName: string): number => {
    const lowercaseName = exerciseName.toLowerCase();
    
    if (lowercaseName.includes('walk')) return 250;
    if (lowercaseName.includes('run') || lowercaseName.includes('jog')) return 600;
    if (lowercaseName.includes('cycle') || lowercaseName.includes('bike')) return 500;
    if (lowercaseName.includes('swim')) return 400;
    if (lowercaseName.includes('yoga')) return 200;
    if (lowercaseName.includes('hike')) return 350;
    
    return 300; // Default
  };

  const generateFoodOptions = (foodName: string): FoodOption[] => {
    // Generate realistic food options based on the food name
    const baseCalories = Math.floor(Math.random() * 200) + 100;
    
    return [
      {
        name: `${foodName} (homemade)`,
        calories: baseCalories,
        protein: Math.floor(baseCalories * 0.15 / 4),
        carbs: Math.floor(baseCalories * 0.5 / 4),
        fat: Math.floor(baseCalories * 0.35 / 9),
        serving_size: 100,
        serving_unit: 'g'
      },
      {
        name: `${foodName} (restaurant style)`,
        calories: Math.floor(baseCalories * 1.5),
        protein: Math.floor(baseCalories * 1.5 * 0.2 / 4),
        carbs: Math.floor(baseCalories * 1.5 * 0.45 / 4),
        fat: Math.floor(baseCalories * 1.5 * 0.35 / 9),
        serving_size: 100,
        serving_unit: 'g'
      },
      {
        name: `${foodName} (healthy version)`,
        calories: Math.floor(baseCalories * 0.7),
        protein: Math.floor(baseCalories * 0.7 * 0.3 / 4),
        carbs: Math.floor(baseCalories * 0.7 * 0.5 / 4),
        fat: Math.floor(baseCalories * 0.7 * 0.2 / 9),
        serving_size: 100,
        serving_unit: 'g'
      }
    ];
  };

  return null; // This component doesn't render anything
});

SparkyNutritionCoach.displayName = 'SparkyNutritionCoach';

export default SparkyNutritionCoach;
