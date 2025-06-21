
-- Fix the user_preferences table to have proper unique constraint
-- Drop the existing constraint if it exists and recreate it properly
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_key;

-- Add the correct unique constraint
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id);

-- Ensure the table has all required columns with proper defaults
ALTER TABLE public.user_preferences 
  ALTER COLUMN date_format SET DEFAULT 'MM/DD/YYYY',
  ALTER COLUMN default_weight_unit SET DEFAULT 'kg',
  ALTER COLUMN default_measurement_unit SET DEFAULT 'cm';
