-- Drop the incorrect foreign key constraint
ALTER TABLE public.food_entries
DROP CONSTRAINT IF EXISTS food_entries_meal_plan_id_fkey;

-- Add the correct foreign key constraint to meal_plan_templates
ALTER TABLE public.food_entries
ADD CONSTRAINT food_entries_meal_plan_template_id_fkey
FOREIGN KEY (meal_plan_template_id) REFERENCES public.meal_plan_templates (id) ON DELETE SET NULL;