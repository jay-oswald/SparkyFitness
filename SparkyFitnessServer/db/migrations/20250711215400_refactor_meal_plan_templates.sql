-- Drop the old meal planning tables
DROP TABLE IF EXISTS public.meal_plan_template_assignments CASCADE;
DROP TABLE IF EXISTS public.meal_day_presets CASCADE;
DROP TABLE IF EXISTS public.meal_plan_templates CASCADE;

-- Create a new, cleaner meal_plan_templates table
CREATE TABLE public.meal_plan_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT meal_plan_templates_pkey PRIMARY KEY (id),
    CONSTRAINT meal_plan_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create the meal_plan_template_assignments table
CREATE TABLE public.meal_plan_template_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0 for Sunday, 1 for Monday, etc.
    meal_type VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snacks'
    meal_id UUID NOT NULL,
    CONSTRAINT meal_plan_template_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT meal_plan_template_assignments_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.meal_plan_templates (id) ON DELETE CASCADE,
    CONSTRAINT meal_plan_template_assignments_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals (id) ON DELETE CASCADE
);

-- Add a unique constraint to ensure only one plan is active for a user at any given time.
CREATE UNIQUE INDEX one_active_meal_plan_per_user
ON public.meal_plan_templates (user_id)
WHERE is_active = TRUE;