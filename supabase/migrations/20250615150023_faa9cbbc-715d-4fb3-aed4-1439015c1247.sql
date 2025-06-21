
-- Check if system_prompt column exists in ai_service_settings and add it if missing
ALTER TABLE public.ai_service_settings 
ADD COLUMN IF NOT EXISTS system_prompt text DEFAULT '';

-- Check if auto_clear_history column exists in user_preferences and add it if missing
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS auto_clear_history text DEFAULT 'never';

-- Update existing records to have default values
UPDATE public.ai_service_settings 
SET system_prompt = '' 
WHERE system_prompt IS NULL;

UPDATE public.user_preferences 
SET auto_clear_history = 'never' 
WHERE auto_clear_history IS NULL;
