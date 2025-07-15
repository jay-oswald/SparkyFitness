import { parseISO } from 'date-fns';
import { CoachResponse } from './Chatbot_types';
import { debug, info, error, UserLoggingLevel } from '@/utils/logging';
import { apiCall } from '../api';

export const processWaterInput = async (data: {
  quantity: number;
  entryDate?: string;
}, formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string, userLoggingLevel: UserLoggingLevel, transactionId: string): Promise<CoachResponse> => {
  try {
    debug(userLoggingLevel, `[${transactionId}] Processing water input with data:`, data, 'and entryDate:', data.entryDate);

    const { quantity, entryDate: rawEntryDate } = data;

    // If entryDate is not provided by AI, use today's date in user's timezone
    const dateToUse = formatDateInUserTimezone(rawEntryDate ? parseISO(rawEntryDate) : new Date(), 'yyyy-MM-dd');

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
    error(userLoggingLevel, `Full error details:`, err);
    return {
      action: 'none',
      response: 'Sorry, I had trouble logging your water intake. Please try again.'
    };
  }
};