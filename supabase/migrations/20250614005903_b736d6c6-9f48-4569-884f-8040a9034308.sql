
-- Add nutrition columns to food_variants table so each unit can have its own nutrition values
ALTER TABLE public.food_variants ADD COLUMN calories NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN protein NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN carbs NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN fat NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN saturated_fat NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN polyunsaturated_fat NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN monounsaturated_fat NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN trans_fat NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN cholesterol NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN sodium NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN potassium NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN dietary_fiber NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN sugars NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN vitamin_a NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN vitamin_c NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN calcium NUMERIC DEFAULT 0;
ALTER TABLE public.food_variants ADD COLUMN iron NUMERIC DEFAULT 0;
