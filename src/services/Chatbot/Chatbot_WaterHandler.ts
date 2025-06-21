import { supabase } from '@/integrations/supabase/client';
import { CoachResponse } from './Chatbot_types'; // Import types

// Function to process water intake input
export const processWaterInput = async (userId: string, data: { glasses_consumed: number | null }, entryDate?: string): Promise<CoachResponse> => {
  try {
    console.log('Processing water input with data:', data, 'and entryDate:', entryDate);

    const { glasses_consumed } = data;
    const glasses = glasses_consumed || 1; // Default to 1 glass if not provided by AI
    const dateToUse = entryDate || new Date().toISOString().split('T')[0]; // Use provided date or today's date


    // Get current water intake
    const { data: currentWater, error: fetchError } = await supabase
      .from('water_intake')
      .select('glasses_consumed')
      .eq('user_id', userId)
      .eq('entry_date', dateToUse) // Use the determined date
      .single();

    const currentGlasses = currentWater?.glasses_consumed || 0;
    const newTotal = currentGlasses + glasses;


    const { error } = await supabase
      .from('water_intake')
      .upsert({
        user_id: userId,
        entry_date: dateToUse, // Use the determined date
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
      action: 'measurement_added', // Water intake is also a form of measurement tracking
      response: `💧 **Water logged for ${dateToUse}!**\n\n🥤 Added ${glasses} glass${glasses > 1 ? 'es' : ''}\n📊 Total today: ${newTotal}/8 glasses\n\n${newTotal >= 8 ? '🎉 Great job staying hydrated!' : '💡 Keep drinking water throughout the day!'}`
    };
  } catch (error) {
    console.error('❌ [Nutrition Coach] Error processing water input:', error);
    return {
      action: 'none',
      response: 'Sorry, I had trouble logging your water intake. Could you try again?'
    };
  }
};