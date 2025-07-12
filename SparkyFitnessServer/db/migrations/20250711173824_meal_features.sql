SET search_path = public, auth;

-- Add PRIMARY KEY constraint to the foods table
ALTER TABLE public.foods
ADD CONSTRAINT foods_pkey PRIMARY KEY (id);





-- Create meals table
CREATE TABLE public.meals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meals_pkey PRIMARY KEY (id)
);

CREATE TABLE public.meal_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL,
  food_id uuid NOT NULL,
  variant_id uuid,
  quantity NUMERIC NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meal_foods_pkey PRIMARY KEY (id)
);

CREATE TABLE public.meal_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meal_id uuid,
  food_id uuid,
  variant_id uuid,
  quantity NUMERIC,
  unit VARCHAR(50),
  plan_date DATE NOT NULL,
  meal_type VARCHAR(50) NOT NULL,
  is_template BOOLEAN DEFAULT FALSE,
  template_name VARCHAR(255),
  day_of_week INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meal_plans_pkey PRIMARY KEY (id),
  CONSTRAINT chk_meal_or_food CHECK (
    (meal_id IS NOT NULL AND food_id IS NULL AND variant_id IS NULL AND quantity IS NULL AND unit IS NULL) OR
    (meal_id IS NULL AND food_id IS NOT NULL AND variant_id IS NOT NULL AND quantity IS NOT NULL AND unit IS NOT NULL)
  )
);

-- Add meal_plan_id to food_entries table
ALTER TABLE public.food_entries
ADD COLUMN IF NOT EXISTS meal_plan_id uuid;

-- Add foreign key constraints after all tables are created
ALTER TABLE public.meals
ADD CONSTRAINT meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.meals VALIDATE CONSTRAINT meals_user_id_fkey;

ALTER TABLE public.meal_foods
ADD CONSTRAINT meal_foods_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals (id) ON DELETE CASCADE NOT VALID,
ADD CONSTRAINT meal_foods_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods (id) ON DELETE CASCADE NOT VALID,
ADD CONSTRAINT meal_foods_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.food_variants (id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.meal_foods VALIDATE CONSTRAINT meal_foods_meal_id_fkey;
ALTER TABLE public.meal_foods VALIDATE CONSTRAINT meal_foods_food_id_fkey;
ALTER TABLE public.meal_foods VALIDATE CONSTRAINT meal_foods_variant_id_fkey;

ALTER TABLE public.meal_plans
ADD CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT VALID,
ADD CONSTRAINT meal_plans_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals (id) ON DELETE CASCADE NOT VALID,
ADD CONSTRAINT meal_plans_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods (id) ON DELETE CASCADE NOT VALID,
ADD CONSTRAINT meal_plans_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.food_variants (id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.meal_plans VALIDATE CONSTRAINT meal_plans_user_id_fkey;
ALTER TABLE public.meal_plans VALIDATE CONSTRAINT meal_plans_meal_id_fkey;
ALTER TABLE public.meal_plans VALIDATE CONSTRAINT meal_plans_food_id_fkey;
ALTER TABLE public.meal_plans VALIDATE CONSTRAINT meal_plans_variant_id_fkey;

ALTER TABLE public.food_entries
ADD CONSTRAINT food_entries_meal_plan_id_fkey FOREIGN KEY (meal_plan_id) REFERENCES public.meal_plans (id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.food_entries VALIDATE CONSTRAINT food_entries_meal_plan_id_fkey;
