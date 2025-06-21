
-- Update RLS policies to support family access

-- First, let's update the food_entries table to allow family access
DROP POLICY IF EXISTS "Users can view their own food entries" ON public.food_entries;
DROP POLICY IF EXISTS "Users can insert their own food entries" ON public.food_entries;
DROP POLICY IF EXISTS "Users can update their own food entries" ON public.food_entries;
DROP POLICY IF EXISTS "Users can delete their own food entries" ON public.food_entries;

-- Enable RLS on food_entries if not already enabled
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;

-- New policies for food_entries that support family access
CREATE POLICY "Users can view their own food entries or entries they have family access to" 
ON public.food_entries FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can insert food entries for themselves or family members they have access to" 
ON public.food_entries FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can update their own food entries or entries they have family access to" 
ON public.food_entries FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can delete their own food entries or entries they have family access to" 
ON public.food_entries FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

-- Update custom_categories table for family access
DROP POLICY IF EXISTS "Users can view their own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can insert their own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can update their own custom categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can delete their own custom categories" ON public.custom_categories;

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom categories or categories they have family access to" 
ON public.custom_categories FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can insert custom categories for themselves or family members they have access to" 
ON public.custom_categories FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can update their own custom categories or categories they have family access to" 
ON public.custom_categories FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can delete their own custom categories or categories they have family access to" 
ON public.custom_categories FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

-- Update custom_measurements table for family access
DROP POLICY IF EXISTS "Users can view their own custom measurements" ON public.custom_measurements;
DROP POLICY IF EXISTS "Users can insert their own custom measurements" ON public.custom_measurements;
DROP POLICY IF EXISTS "Users can update their own custom measurements" ON public.custom_measurements;
DROP POLICY IF EXISTS "Users can delete their own custom measurements" ON public.custom_measurements;

ALTER TABLE public.custom_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own custom measurements or measurements they have family access to" 
ON public.custom_measurements FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can insert custom measurements for themselves or family members they have access to" 
ON public.custom_measurements FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can update their own custom measurements or measurements they have family access to" 
ON public.custom_measurements FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can delete their own custom measurements or measurements they have family access to" 
ON public.custom_measurements FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

-- Update check_in_measurements table for family access
DROP POLICY IF EXISTS "Users can view their own measurements" ON public.check_in_measurements;
DROP POLICY IF EXISTS "Users can insert their own measurements" ON public.check_in_measurements;
DROP POLICY IF EXISTS "Users can update their own measurements" ON public.check_in_measurements;
DROP POLICY IF EXISTS "Users can delete their own measurements" ON public.check_in_measurements;

ALTER TABLE public.check_in_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own measurements or measurements they have family access to" 
ON public.check_in_measurements FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can insert measurements for themselves or family members they have access to" 
ON public.check_in_measurements FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can update their own measurements or measurements they have family access to" 
ON public.check_in_measurements FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

CREATE POLICY "Users can delete their own measurements or measurements they have family access to" 
ON public.check_in_measurements FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'checkin')
);

-- Update water_intake table for family access
DROP POLICY IF EXISTS "Users can view their own water intake" ON public.water_intake;
DROP POLICY IF EXISTS "Users can insert their own water intake" ON public.water_intake;
DROP POLICY IF EXISTS "Users can update their own water intake" ON public.water_intake;
DROP POLICY IF EXISTS "Users can delete their own water intake" ON public.water_intake;

ALTER TABLE public.water_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own water intake or intake they have family access to" 
ON public.water_intake FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can insert water intake for themselves or family members they have access to" 
ON public.water_intake FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can update their own water intake or intake they have family access to" 
ON public.water_intake FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can delete their own water intake or intake they have family access to" 
ON public.water_intake FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

-- Update user_goals table for family access
DROP POLICY IF EXISTS "Users can view their own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON public.user_goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON public.user_goals;

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals or goals they have family access to" 
ON public.user_goals FOR SELECT 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can insert goals for themselves or family members they have access to" 
ON public.user_goals FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can update their own goals or goals they have family access to" 
ON public.user_goals FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

CREATE POLICY "Users can delete their own goals or goals they have family access to" 
ON public.user_goals FOR DELETE 
USING (
  user_id = auth.uid() OR 
  public.check_family_access(auth.uid(), user_id, 'calorie')
);

-- Update foods table for the two-tier sharing system
DROP POLICY IF EXISTS "Users can view their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can view shared foods" ON public.foods;
DROP POLICY IF EXISTS "Users can insert their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can update their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can delete their own foods" ON public.foods;

-- Add a shared_with_public column to foods table if it doesn't exist
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS shared_with_public boolean DEFAULT false;

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

-- Foods visibility: own foods + family member foods + publicly shared foods
CREATE POLICY "Users can view accessible foods" 
ON public.foods FOR SELECT 
USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Family member foods (regardless of shared_with_public flag)
  (user_id IS NOT NULL AND public.check_family_access(auth.uid(), user_id, 'calorie')) OR
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL
);

-- Only owners can modify their foods
CREATE POLICY "Users can insert their own foods" 
ON public.foods FOR INSERT 
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own foods" 
ON public.foods FOR UPDATE 
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete their own foods" 
ON public.foods FOR DELETE 
USING (user_id = auth.uid() OR user_id IS NULL);
