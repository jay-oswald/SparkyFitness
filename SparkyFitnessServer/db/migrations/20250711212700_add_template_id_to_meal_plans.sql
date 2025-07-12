-- Add the meal_plan_template_id column to the meal_plans table
ALTER TABLE public.meal_plans
ADD COLUMN meal_plan_template_id UUID NULL;

-- Add a foreign key constraint to link to the meal_plan_templates table
ALTER TABLE public.meal_plans
ADD CONSTRAINT meal_plans_template_id_fkey
FOREIGN KEY (meal_plan_template_id) REFERENCES public.meal_plan_templates (id) ON DELETE CASCADE;