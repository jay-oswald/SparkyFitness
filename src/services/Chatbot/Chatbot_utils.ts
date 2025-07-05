import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

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
    const response = await fetch('http://localhost:3010/api/chat/save-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, content, messageType, metadata }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      error(null, '❌ [Nutrition Coach] Error saving message to history:', errorData.error);
    } else {
      info(null, '✅ Message saved to history.'); // Added logging
    }
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
        const response = await fetch('http://localhost:3010/api/chat/clear-all-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          error(null, '❌ [Nutrition Coach] Error clearing all chat history backend:', errorData.error);
        } else {
          info(null, '✅ All chat history cleared via backend.');
        }
      } catch (fetchError) {
        error(null, '❌ [Nutrition Coach] Network error calling clear_all_chat_history backend:', fetchError);
      }
    } else if (autoClearPreference === '7days') {
      info(null, `Calling backend to clear old chat history for user: ${userId}`);
      try {
        const response = await fetch('http://localhost:3010/api/chat/clear-old-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // No body needed for this endpoint based on current backend implementation
        });

        if (!response.ok) {
          const errorData = await response.json();
          error(null, '❌ [Nutrition Coach] Error calling clear_old_chat_history backend:', errorData.error);
        } else {
          info(null, '✅ Old chat history cleared via backend.');
        }
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