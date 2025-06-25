import { supabase } from '@/integrations/supabase/client';
import { CoachResponse } from './Chatbot_types'; // Import types
import { debug, info, warn, error, UserLoggingLevel } from '@/utils/logging'; // Import logging utility

// Function to process water intake input
export const processWaterInput = async (userId: string, data: { glasses_consumed: number | null }, entryDate: string | undefined, formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string, userLoggingLevel: UserLoggingLevel): Promise<CoachResponse> => {
  try {
    // Always log the received userLoggingLevel to diagnose why debug messages are not showing
    debug(userLoggingLevel, 'Processing water input with data:', data, 'and entryDate:', entryDate);

    const { glasses_consumed } = data;
    const glasses = glasses_consumed || 1; // Default to 1 glass if not provided by AI
    const dateToUse = entryDate || formatDateInUserTimezone(new Date(), 'yyyy-MM-dd'); // Use provided date or today's date in user's timezone

    // Get current water intake
    const { data: currentWater, error: fetchError } = await supabase
      .from('water_intake')
      .select('glasses_consumed')
      .eq('user_id', userId)
      .eq('entry_date', dateToUse) // Use the determined date
      .single();

    if (fetchError) {
      error(userLoggingLevel, '❌ [Nutrition Coach] Error fetching current water intake:', fetchError.message);
      return {
        action: 'none',
        response: 'Sorry, I couldn\'t retrieve your current water intake. Please try again.'
      };
    }

    const currentGlasses = currentWater?.glasses_consumed || 0;
    let newTotal = currentGlasses + glasses;

    // Ensure newTotal is an integer and non-negative
    if (typeof newTotal !== 'number' || !Number.isInteger(newTotal) || newTotal < 0) {
      warn(userLoggingLevel, 'Invalid newTotal calculated for water intake. Clamping to 0.', newTotal);
      newTotal = 0; // Default to 0 or handle as an error
    }

    debug(userLoggingLevel, 'Attempting to upsert water intake with payload:', {
      user_id: userId,
      entry_date: dateToUse,
      glasses_consumed: newTotal
    });

    const { error: upsertError } = await supabase
      .from('water_intake')
      .upsert({
        user_id: userId,
        entry_date: dateToUse, // Use the determined date
        glasses_consumed: newTotal as number // Explicitly cast to number
      }, {
        onConflict: 'user_id,entry_date'
      });

    debug(userLoggingLevel, 'Upserting water intake for date:', dateToUse);

    if (upsertError) {
      error(userLoggingLevel, '❌ [Nutrition Coach] Error updating water intake:', upsertError.message);
      return {
        action: 'none',
        response: 'Sorry, I couldn\'t update your water intake. Please try again.'
      };
    }

    return {
      action: 'measurement_added', // Water intake is also a form of measurement tracking
      response: `💧 **Water logged for ${formatDateInUserTimezone(dateToUse, 'PPP')}!**\n\n🥤 Added ${glasses} glass${glasses > 1 ? 'es' : ''}\n📊 Total today: ${newTotal}/8 glasses\n\n${newTotal >= 8 ? '🎉 Great job staying hydrated!' : '💡 Keep drinking water throughout the day!'}`
    };
  } catch (err) {
    error(userLoggingLevel, '❌ [Nutrition Coach] Error processing water input:', err);
    return {
      action: 'none',
      response: 'Sorry, I had trouble logging your water intake. Could you try again?'
    };
  }
};