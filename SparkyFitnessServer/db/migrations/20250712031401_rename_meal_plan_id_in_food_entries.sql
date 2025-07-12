-- Rename the meal_plan_id column to meal_plan_template_id in the food_entries table
ALTER TABLE public.food_entries
RENAME COLUMN meal_plan_id TO meal_plan_template_id;