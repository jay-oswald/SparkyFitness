
-- Create exercises table (similar to foods table)
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text DEFAULT 'general',
  calories_per_hour numeric DEFAULT 300,
  description text,
  user_id uuid NULL, -- NULL for public exercises, user_id for custom exercises
  is_custom boolean DEFAULT false,
  shared_with_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create exercise_entries table (similar to food_entries)
CREATE TABLE public.exercise_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  duration_minutes numeric NOT NULL,
  calories_burned numeric NOT NULL,
  entry_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for exercises (similar to foods)
CREATE POLICY "Users can view public and own exercises"
  ON public.exercises FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid() OR shared_with_public = true);

CREATE POLICY "Users can insert own exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own exercises"
  ON public.exercises FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own exercises"
  ON public.exercises FOR DELETE
  USING (user_id = auth.uid());

-- RLS policies for exercise_entries
CREATE POLICY "Users can view own exercise entries"
  ON public.exercise_entries FOR SELECT
  USING (user_id = auth.uid() OR can_access_user_data(user_id, 'calorie'));

CREATE POLICY "Users can insert own exercise entries"
  ON public.exercise_entries FOR INSERT
  WITH CHECK (user_id = auth.uid() OR can_access_user_data(user_id, 'calorie'));

CREATE POLICY "Users can update own exercise entries"
  ON public.exercise_entries FOR UPDATE
  USING (user_id = auth.uid() OR can_access_user_data(user_id, 'calorie'));

CREATE POLICY "Users can delete own exercise entries"
  ON public.exercise_entries FOR DELETE
  USING (user_id = auth.uid() OR can_access_user_data(user_id, 'calorie'));
