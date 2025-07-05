import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import { apiCall } from '@/services/api';

// Helper function to convert File to Base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Function to save a message to the database
export const saveMessageToHistory = async (userId: string, content: string, messageType: 'user' | 'assistant', metadata?: any) => {
  try {
    debug(null, 'Attempting to save message to history:', { userId, content, messageType, metadata }); // Added logging
    await apiCall('/api/chat/save-history', {
      method: 'POST',
      body: { userId, content, messageType, metadata },
    });
    info(null, '✅ Message saved to history.'); // Added logging
  } catch (err) {
    error(null, '❌ [Nutrition Coach] Unexpected error saving message to history:', err);
  }
};

// Function to clear chat history based on preference
export const clearHistory = async (userId: string, autoClearPreference: string) => {
  try {
    info(null, `Attempting to clear history for user: ${userId} with preference: ${autoClearPreference}`);
    if (autoClearPreference === 'session' || autoClearPreference === 'all' || autoClearPreference === 'manual') {
      info(null, `Clearing all chat history for user: ${userId}`);
      try {
        await apiCall('/api/chat/clear-all-history', {
          method: 'POST',
          body: { userId },
        });
        info(null, '✅ All chat history cleared via backend.');
      } catch (fetchError) {
        error(null, '❌ [Nutrition Coach] Network error calling clear_all_chat_history backend:', fetchError);
      }
    } else if (autoClearPreference === '7days') {
      info(null, `Calling backend to clear old chat history for user: ${userId}`);
      try {
        await apiCall('/api/chat/clear-old-history', {
          method: 'POST',
          // No body needed for this endpoint based on current backend implementation
        });
        info(null, '✅ Old chat history cleared via backend.');
      } catch (fetchError) {
        error(null, '❌ [Nutrition Coach] Network error calling clear_old_chat_history backend:', fetchError);
      }
    } else {
      info(null, 'ℹ️ Chat history not cleared based on preference:', autoClearPreference);
    }
  } catch (err) {
    error(null, '❌ [Nutrition Coach] Unexpected error clearing chat history:', err);
  }
};

// Note: Extraction functions and generateFoodOptions will be moved to specific handlers or refactored.