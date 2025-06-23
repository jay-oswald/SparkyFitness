import { supabase } from '@/integrations/supabase/client';
import { CoachResponse } from './Chatbot_types'; // Import types
import { debug, info, warn, error, UserLoggingLevel } from '@/utils/logging'; // Import logging utility

// Function to process measurement input
export const processMeasurementInput = async (userId: string, data: { measurements: Array<{ type: string; value: number; unit?: string | null; name?: string | null }> }, entryDate: string | undefined, formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string, userLoggingLevel: UserLoggingLevel): Promise<CoachResponse> => {
  try {
    debug(userLoggingLevel, 'Processing measurement input with data:', data, 'and entryDate:', entryDate);

    const { measurements } = data;
    const dateToUse = entryDate || formatDateInUserTimezone(new Date(), 'yyyy-MM-dd'); // Use provided date or today's date in user's timezone
    let response = `📏 **Measurements updated for ${formatDateInUserTimezone(dateToUse, 'PPP')}!**\n\n`; // Include date here
    let measurementsLogged = false;

    for (const measurement of measurements) {
      if (measurement.type === 'weight' || measurement.type === 'neck' || measurement.type === 'waist' || measurement.type === 'hips' || measurement.type === 'steps') {
        // Handle standard check-in measurements
        const updateData: any = {
          user_id: userId,
          entry_date: dateToUse, // Use the determined date
        };
        updateData[measurement.type] = measurement.value;

        const { error: upsertError } = await supabase
          .from('check_in_measurements')
          .upsert(updateData, {
            onConflict: 'user_id,entry_date'
          });

        if (upsertError) {
          error(userLoggingLevel, `❌ [Nutrition Coach] Error saving ${measurement.type} measurement:`, upsertError.message);
          response += `⚠️ Failed to save ${measurement.type}: ${upsertError.message}\n`;
        } else {
          response += `✅ ${measurement.type.charAt(0).toUpperCase() + measurement.type.slice(1)}: ${measurement.value}${measurement.unit || ''}\n`;
          measurementsLogged = true;
        }
      } else if (measurement.type === 'custom' && measurement.name && measurement.value !== undefined) {
        // Handle custom measurements
        // First, find or create the custom category
        let categoryId: string;
        const { data: existingCategory, error: categorySearchError } = await supabase
          .from('custom_categories')
          .select('id')
          .eq('user_id', userId)
          .eq('name', measurement.name)
          .single();

        if (categorySearchError && categorySearchError.code !== 'PGRST116') { // PGRST116 means no rows found
          error(userLoggingLevel, '❌ [Nutrition Coach] Error searching custom category:', categorySearchError.message);
          response += `⚠️ Failed to save custom measurement "${measurement.name}": Could not search for category.\n`;
          continue; // Skip to the next measurement
        }

        if (existingCategory) {
          categoryId = existingCategory.id;
        } else if (categorySearchError && categorySearchError.code === 'PGRST116') { // Category not found, create it
          info(userLoggingLevel, `Custom category "${measurement.name}" not found, creating...`);
          const { data: newCategory, error: categoryCreateError } = await supabase
            .from('custom_categories')
            .insert({
              user_id: userId,
              name: measurement.name,
              frequency: 'Daily', // Corrected default frequency
              measurement_type: 'numeric' // Default type
            })
            .select('id')
            .single();

          if (categoryCreateError) {
            error(userLoggingLevel, '❌ [Nutrition Coach] Error creating custom category:', categoryCreateError.message);
            response += `⚠️ Failed to save custom measurement "${measurement.name}": Could not create category.\n`;
            continue; // Skip to the next measurement
          }
          categoryId = newCategory.id;
        } else {
             // This case should ideally not be reached if PGRST116 is the only expected error for no rows
             error(userLoggingLevel, '❌ [Nutrition Coach] Unexpected state after custom category search.', categorySearchError.message);
             response += `⚠️ Failed to save custom measurement "${measurement.name}": Unexpected error during category handling.\n`;
             continue; // Skip to the next measurement
        }


        // Now insert the custom measurement entry
        const { error: customEntryError } = await supabase
          .from('custom_measurements')
          .insert({
            user_id: userId,
            category_id: categoryId,
            entry_date: dateToUse, // Use the determined date
            value: measurement.value,
            entry_timestamp: new Date().toISOString() // Use current timestamp
          });

        if (customEntryError) {
          error(userLoggingLevel, `❌ [Nutrition Coach] Error saving custom measurement "${measurement.name}":`, customEntryError.message);
          response += `⚠️ Failed to save custom measurement "${measurement.name}": ${customEntryError.message}\n`;
        } else {
          response += `✅ Custom Measurement "${measurement.name}": ${measurement.value}${measurement.unit || ''}\n`;
          measurementsLogged = true;
        }
      } else {
         warn(userLoggingLevel, '⚠️ [Nutrition Coach] Skipping invalid measurement data:', measurement);
         response += `⚠️ Skipping invalid measurement data provided by AI.\n`;
      }
    }

    if (measurementsLogged) {
      response += '\n💪 Great job tracking your progress! Consistency is key to reaching your goals.';
      return {
        action: 'measurement_added',
        response
      };
    } else {
      return {
        action: 'none',
        response: response || 'I couldn\'t identify any valid measurements in your message.'
      };
    }

  } catch (err) {
    error(userLoggingLevel, '❌ [Nutrition Coach] Error processing measurement input:', err);
    return {
      action: 'none',
      response: 'Sorry, I had trouble processing those measurements. Could you try again?'
    };
  }
};