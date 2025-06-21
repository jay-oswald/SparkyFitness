
-- Fix the foods table RLS policies - they're completely broken
-- The issue is the logic is backwards in the can_access_user_data calls

-- Drop ALL existing food policies
DROP POLICY IF EXISTS "foods_select_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_insert_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_update_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_delete_policy" ON public.foods;

-- Create CORRECT RLS policies for foods table
CREATE POLICY "foods_select_policy" ON public.foods
FOR SELECT USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL OR
  -- Family member foods - check if current user can access this food owner's data
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

CREATE POLICY "foods_insert_policy" ON public.foods
FOR INSERT WITH CHECK (
  -- Can insert as themselves
  user_id = auth.uid() OR 
  -- Can insert global foods (admin feature)
  user_id IS NULL OR
  -- Can insert for family members - check if current user can access this user's data
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

CREATE POLICY "foods_update_policy" ON public.foods
FOR UPDATE USING (
  -- Can update own foods
  user_id = auth.uid() OR 
  -- Can update family member foods - check if current user can access this food owner's data
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

CREATE POLICY "foods_delete_policy" ON public.foods
FOR DELETE USING (
  -- Can delete own foods
  user_id = auth.uid() OR 
  -- Can delete family member foods - check if current user can access this food owner's data
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);
