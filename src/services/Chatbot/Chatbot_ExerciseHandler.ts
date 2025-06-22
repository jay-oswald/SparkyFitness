import { supabase } from '@/integrations/supabase/client';
import { CoachResponse } from './Chatbot_types'; // Import types
import { debug, info, warn, error, UserLoggingLevel } from '@/utils/logging'; // Import logging utility

// Function to process exercise input
export const processExerciseInput = async (userId: string, data: { exercise_name: string; duration_minutes: number | null; distance: number | null; distance_unit: string | null }, entryDate: string | undefined, formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string, userLoggingLevel: UserLoggingLevel): Promise<CoachResponse> => {
  try {
    debug(userLoggingLevel, 'Processing exercise input with data:', data, 'and entryDate:', entryDate);

    const { exercise_name, duration_minutes, distance, distance_unit } = data;
    const dateToUse = entryDate || new Date().toISOString().split('T')[0]; // Use provided date or today's date
    const duration = duration_minutes || 30; // Default to 30 minutes if not provided by AI


    // First, try to find or create the exercise in the database
    let exerciseId: string;
    let caloriesPerHour = 300; // Default

    // Search for existing exercise
    const { data: existingExercises, error: searchError } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${exercise_name}%`)
      .limit(1);

    if (searchError) {
      error(userLoggingLevel, '❌ [Nutrition Coach] Error searching exercises:', searchError);
    }

    if (existingExercises && existingExercises.length > 0) {
      // Use existing exercise
      const exercise = existingExercises[0];
      exerciseId = exercise.id;
      caloriesPerHour = exercise.calories_per_hour || 300;
    } else {
      // Create new exercise

      // Estimate calories per hour based on exercise type
      const estimatedCaloriesPerHour = estimateCaloriesPerHour(exercise_name);

      const { data: newExercise, error: createError } = await supabase
        .from('exercises')
        .insert({
          name: exercise_name,
          category: 'cardio',
          calories_per_hour: estimatedCaloriesPerHour,
          is_custom: true,
          user_id: userId
        })
        .select()
        .single();

      if (createError) {
        error(userLoggingLevel, '❌ [Nutrition Coach] Error creating exercise:', createError);
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
        entry_date: dateToUse, // Use the determined date
        notes: distance ? `Distance: ${distance} ${distance_unit || 'miles'}` : undefined
      })
      .select()
      .single();

    if (entryError) {
      error(userLoggingLevel, '❌ [Nutrition Coach] Error adding exercise entry:', entryError);
      return {
        action: 'none',
        response: 'Sorry, I couldn\'t add that exercise. Please try again.'
      };
    }


    let response = `🏃‍♂️ **Great workout! Logged for ${formatDateInUserTimezone(dateToUse, 'PPP')}!**\n\n💪 ${exercise_name} - ${duration} minutes\n`;
    if (distance) {
      response += `📏 Distance: ${distance} ${distance_unit || 'miles'}\n`;
    }
    response += `🔥 ~${caloriesBurned} calories burned\n\n🎉 Awesome job staying active! This really helps with your fitness goals.`;

    return {
      action: 'exercise_added',
      response
    };

  } catch (err) {
    error(userLoggingLevel, '❌ [Nutrition Coach] Error processing exercise input:', err);
    return {
      action: 'none',
      response: 'Sorry, I had trouble processing that exercise. Could you try rephrasing what you did?'
    };
  }
};

// Helper function to estimate calories burned per hour based on exercise name
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