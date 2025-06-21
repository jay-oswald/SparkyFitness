
-- Update the foods table RLS policies to properly support food_list permission

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can access foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can insert foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can update foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can delete foods with calorie permission" ON public.foods;

-- Create proper RLS policies for foods table that check for both calorie and food_list permissions
CREATE POLICY "Users can access foods with permissions" ON public.foods
FOR SELECT USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Family member foods (with calorie OR food_list permission)
  (user_id IS NOT NULL AND (
    public.can_access_user_data(user_id, 'calorie') OR 
    public.can_access_user_data(user_id, 'food_list')
  )) OR
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL
);

CREATE POLICY "Users can insert foods with calorie permission" ON public.foods
FOR INSERT WITH CHECK (
  -- Can insert as themselves
  user_id = auth.uid() OR 
  -- Can insert for family members with calorie permission (not food_list, as that's read-only)
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie')) OR
  -- Can insert global foods (admin feature)
  user_id IS NULL
);

CREATE POLICY "Users can update foods with calorie permission" ON public.foods
FOR UPDATE USING (
  -- Can update own foods
  user_id = auth.uid() OR 
  -- Can update family member foods with calorie permission (not food_list, as that's read-only)
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);

CREATE POLICY "Users can delete foods with calorie permission" ON public.foods
FOR DELETE USING (
  -- Can delete own foods
  user_id = auth.uid() OR 
  -- Can delete family member foods with calorie permission (not food_list, as that's read-only)
  (user_id IS NOT NULL AND public.can_access_user_data(user_id, 'calorie'))
);
