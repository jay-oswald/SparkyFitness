
-- Remove custom nutrition columns from food_entries table
ALTER TABLE public.food_entries 
DROP COLUMN IF EXISTS custom_calories,
DROP COLUMN IF EXISTS custom_protein,
DROP COLUMN IF EXISTS custom_carbs,
DROP COLUMN IF EXISTS custom_fat;
