import { parseISO } from 'date-fns'; // Import parseISO
import { CoachResponse } from './Chatbot_types'; // Import types
import { debug, info, warn, error, UserLoggingLevel } from '@/utils/logging'; // Import logging utility
import { apiCall } from '../api'; // Import apiCall

// Function to fetch water intake from the backend
const fetchWaterIntake = async (date: string) => {
  try {
    const data = await apiCall(`/water-intake/${date}`, {
      method: 'GET',
    });
    return data;
  } catch (err) {
    console.error("Error fetching water intake:", err);
    throw err;
  }
};

// Function to upsert water intake to the backend
const upsertWaterIntake = async (payload: { entry_date: string; glasses_consumed: number }) => {
  try {
    const data = await apiCall('/water-intake', {
      method: 'POST',
      body: payload,
    });
    return data;
  } catch (err) {
    console.error("Error upserting water intake:", err);
    throw err;
  }
};

// Function to process water intake input
export const processWaterInput = async (data: { glasses_consumed: number | null }, entryDate: string | undefined, formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string, userLoggingLevel: UserLoggingLevel): Promise<CoachResponse> => {
  try {
    // Always log the received userLoggingLevel to diagnose why debug messages are not showing
    debug(userLoggingLevel, 'Processing water input with data:', data, 'and entryDate:', entryDate);

    const { glasses_consumed } = data;
    const glasses = glasses_consumed || 1; // Default to 1 glass if not provided by AI
    // Parse the entryDate string into a Date object in the user's timezone, then format it back to YYYY-MM-DD for DB insertion
    // If entryDate is not provided by AI, use today's date in user's timezone
    const dateToUse = formatDateInUserTimezone(entryDate ? parseISO(entryDate) : new Date(), 'yyyy-MM-dd');

    // Get current water intake
    let currentWater = null;
    try {
      currentWater = await fetchWaterIntake(dateToUse);
    } catch (fetchError: any) {
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
      entry_date: dateToUse,
      glasses_consumed: newTotal
    });

    let upsertError = null;
    try {
      await upsertWaterIntake({
        entry_date: dateToUse,
        glasses_consumed: newTotal as number
      });
    } catch (err: any) {
      upsertError = err;
    }

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