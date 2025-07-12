-- Migration to create tables for the new meal planning feature

-- 1. Create meal_day_presets table
-- This table stores a collection of meals for a full day, which can be reused.
CREATE TABLE public.meal_day_presets (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    preset_name VARCHAR(255) NOT NULL,
    breakfast_meal_id UUID NULL,
    lunch_meal_id UUID NULL,
    dinner_meal_id UUID NULL,
    snacks_meal_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT meal_day_presets_pkey PRIMARY KEY (id),
    CONSTRAINT meal_day_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT meal_day_presets_breakfast_fkey FOREIGN KEY (breakfast_meal_id) REFERENCES public.meals (id) ON DELETE SET NULL,
    CONSTRAINT meal_day_presets_lunch_fkey FOREIGN KEY (lunch_meal_id) REFERENCES public.meals (id) ON DELETE SET NULL,
    CONSTRAINT meal_day_presets_dinner_fkey FOREIGN KEY (dinner_meal_id) REFERENCES public.meals (id) ON DELETE SET NULL,
    CONSTRAINT meal_day_presets_snacks_fkey FOREIGN KEY (snacks_meal_id) REFERENCES public.meals (id) ON DELETE SET NULL,
    CONSTRAINT meal_day_presets_unique_name_per_user UNIQUE (user_id, preset_name)
);

-- 2. Create meal_plan_templates table
-- This table stores the weekly plan, assigning a meal_day_preset to each day of the week.
CREATE TABLE public.meal_plan_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    plan_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    monday_preset_id UUID NULL,
    tuesday_preset_id UUID NULL,
    wednesday_preset_id UUID NULL,
    thursday_preset_id UUID NULL,
    friday_preset_id UUID NULL,
    saturday_preset_id UUID NULL,
    sunday_preset_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT meal_plan_templates_pkey PRIMARY KEY (id),
    CONSTRAINT meal_plan_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT meal_plan_templates_monday_fkey FOREIGN KEY (monday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_tuesday_fkey FOREIGN KEY (tuesday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_wednesday_fkey FOREIGN KEY (wednesday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_thursday_fkey FOREIGN KEY (thursday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_friday_fkey FOREIGN KEY (friday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_saturday_fkey FOREIGN KEY (saturday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL,
    CONSTRAINT meal_plan_templates_sunday_fkey FOREIGN KEY (sunday_preset_id) REFERENCES public.meal_day_presets (id) ON DELETE SET NULL
);

-- Add a unique constraint to ensure only one plan is active for a user at any given time.
-- This is a deferred constraint, checked at the end of a transaction.
CREATE UNIQUE INDEX one_active_plan_per_user
ON public.meal_plan_templates (user_id)
WHERE is_active = TRUE;
