
-- Add the missing model_name column to ai_service_settings table
ALTER TABLE public.ai_service_settings 
ADD COLUMN model_name TEXT;
