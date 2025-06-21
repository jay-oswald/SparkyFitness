
-- First, let's clean up any duplicate or conflicting policies
DROP POLICY IF EXISTS "Users can view accessible foods" ON public.foods;
DROP POLICY IF EXISTS "Users can insert their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can update their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can delete their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can access foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can insert foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can update foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can delete foods with calorie permission" ON public.foods;

-- Now create the correct policies with clear names
CREATE POLICY "foods_select_policy" ON public.foods
FOR SELECT USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Family member foods (with proper permission check)
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie')) OR
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL
);

CREATE POLICY "foods_insert_policy" ON public.foods
FOR INSERT WITH CHECK (
  -- Can insert as themselves
  user_id = auth.uid() OR 
  -- Can insert for family members with permission
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie')) OR
  -- Can insert global foods (admin feature)
  user_id IS NULL
);

CREATE POLICY "foods_update_policy" ON public.foods
FOR UPDATE USING (
  -- Can update own foods
  user_id = auth.uid() OR 
  -- Can update family member foods with permission
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

CREATE POLICY "foods_delete_policy" ON public.foods
FOR DELETE USING (
  -- Can delete own foods
  user_id = auth.uid() OR 
  -- Can delete family member foods with permission
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

-- Let's also verify RLS is enabled on the foods table
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
