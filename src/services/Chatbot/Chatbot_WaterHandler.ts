import { parseISO } from 'date-fns';
import { CoachResponse } from './Chatbot_types';
import { debug, info, error, UserLoggingLevel } from '@/utils/logging';
import { apiCall } from '../api';

export const processWaterInput = async (
  data: { quantity: number },
  entryDate: string | undefined,
  formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string,
  userLoggingLevel: UserLoggingLevel,
  transactionId: string
): Promise<CoachResponse> => {
  try {
    debug(userLoggingLevel, `[${transactionId}] Processing water input with data:`, data, 'and entryDate:', entryDate);

    const { quantity } = data;
    const rawEntryDate = entryDate;
    debug(userLoggingLevel, `[${transactionId}] Extracted quantity:`, quantity, 'and rawEntryDate:', rawEntryDate);

    if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) { // Added quantity <= 0 check
      error(userLoggingLevel, `❌ [Water Coach] Invalid or non-positive quantity received:`, quantity);
      return {
        action: 'none',
        response: 'Sorry, I could not understand the quantity of water or it was not a positive number. Please specify a valid number (e.g., "3 glasses").'
      };
    }

    // If entryDate is not provided by AI, use today's date in user's timezone
    const dateToUse = formatDateInUserTimezone(rawEntryDate ? parseISO(rawEntryDate) : new Date(), 'yyyy-MM-dd');
    debug(userLoggingLevel, `[${transactionId}] Date to use for logging:`, dateToUse);

    info(userLoggingLevel, `[${transactionId}] Saving water intake: ${quantity} glasses on ${dateToUse}`);

    await apiCall('/measurements/water-intake', {
      method: 'POST',
      body: {
        entry_date: dateToUse,
        glasses_consumed: quantity,
      },
    });

    info(userLoggingLevel, `[${transactionId}] Water intake saved successfully.`);

    return {
      action: 'water_added',
      response: `✅ **Added ${quantity} glasses of water to your intake on ${formatDateInUserTimezone(dateToUse, 'PPP')}!**\n\nKeep up the great work!`
    };

  } catch (err) {
    error(userLoggingLevel, `❌ [Water Coach] Error processing water input:`, err);
    console.error(`❌ [Water Coach] Full error details:`, err); // Added console.error for direct visibility
    return {
      action: 'none',
      response: 'Sorry, I had trouble logging your water intake. Please try again.'
    };
  }
};