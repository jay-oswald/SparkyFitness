
-- Fix the foods table RLS policies - the can_access_user_data call was backwards
-- The issue is we need to check if current user can access the food owner's data

-- Drop ALL existing food policies
DROP POLICY IF EXISTS "foods_select_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_insert_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_update_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_delete_policy" ON public.foods;

-- Create CORRECT RLS policies for foods table
-- The key fix: check if auth.uid() (current user) can access user_id (food owner) data
CREATE POLICY "foods_select_policy" ON public.foods
FOR SELECT USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL OR
  -- Family member foods - check if current user can access this food owner's data
  -- This was the bug: we need to check if auth.uid() can access user_id's data
  (user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (fa.access_permissions->>'calorie')::boolean = true
  ))
);

CREATE POLICY "foods_insert_policy" ON public.foods
FOR INSERT WITH CHECK (
  -- Can insert as themselves
  user_id = auth.uid() OR 
  -- Can insert global foods (admin feature)
  user_id IS NULL OR
  -- Can insert for family members - check if current user can access this user's data
  (user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (fa.access_permissions->>'calorie')::boolean = true
  ))
);

CREATE POLICY "foods_update_policy" ON public.foods
FOR UPDATE USING (
  -- Can update own foods
  user_id = auth.uid() OR 
  -- Can update family member foods - check if current user can access this food owner's data
  (user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (fa.access_permissions->>'calorie')::boolean = true
  ))
);

CREATE POLICY "foods_delete_policy" ON public.foods
FOR DELETE USING (
  -- Can delete own foods
  user_id = auth.uid() OR 
  -- Can delete family member foods - check if current user can access this food owner's data
  (user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (fa.access_permissions->>'calorie')::boolean = true
  ))
);
