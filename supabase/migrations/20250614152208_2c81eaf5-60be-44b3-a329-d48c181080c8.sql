
-- Drop existing user_goals table
DROP TABLE IF EXISTS public.user_goals CASCADE;

-- Recreate user_goals table with proper constraints
CREATE TABLE public.user_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_date DATE NULL, -- NULL means default/current goals
  calories NUMERIC DEFAULT 2000,
  protein NUMERIC DEFAULT 150,
  carbs NUMERIC DEFAULT 250,
  fat NUMERIC DEFAULT 67,
  water_goal INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to ensure only one goal per user per date
-- This includes NULL goal_date (default goals)
CREATE UNIQUE INDEX idx_user_goals_unique_user_date 
ON public.user_goals(user_id, COALESCE(goal_date, '1900-01-01'::date));

-- Create index for better performance on queries
CREATE INDEX idx_user_goals_user_date ON public.user_goals(user_id, goal_date);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own goals" 
  ON public.user_goals 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals" 
  ON public.user_goals 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" 
  ON public.user_goals 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" 
  ON public.user_goals 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Insert default goals for existing users (if any)
INSERT INTO public.user_goals (user_id, goal_date, calories, protein, carbs, fat, water_goal)
SELECT DISTINCT id, NULL::date, 2000, 150, 250, 67, 8
FROM auth.users
ON CONFLICT DO NOTHING;
