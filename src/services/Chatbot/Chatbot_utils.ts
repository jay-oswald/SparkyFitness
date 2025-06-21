import { supabase } from '@/integrations/supabase/client';
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
    const { error: supabaseError } = await supabase
      .from('sparky_chat_history')
      .insert({
        user_id: userId,
        content: content,
        message_type: messageType,
        metadata: metadata
      });

    if (supabaseError) {
      error(null, '❌ [Nutrition Coach] Error saving message to history:', supabaseError);
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
      const { error: supabaseError } = await supabase
        .from('sparky_chat_history')
        .delete()
        .eq('user_id', userId);

      if (supabaseError) {
        error(null, '❌ [Nutrition Coach] Error clearing chat history:', supabaseError);
      } else {
        info(null, '✅ Chat history cleared from database.');
      }
    } else if (autoClearPreference === '7days') {
      info(null, `Calling RPC to clear old chat history for user: ${userId}`);
      const { error: supabaseError } = await supabase.rpc('clear_old_chat_history');

      if (supabaseError) {
        error(null, '❌ [Nutrition Coach] Error calling clear_old_chat_history RPC:', supabaseError);
      } else {
        info(null, '✅ Old chat history cleared via RPC.');
      }
    } else {
      info(null, 'ℹ️ Chat history not cleared based on preference:', autoClearPreference);
    }
  } catch (err) {
    error(null, '❌ [Nutrition Coach] Unexpected error clearing chat history:', err);
  }
};

// Note: Extraction functions and generateFoodOptions will be moved to specific handlers or refactored.