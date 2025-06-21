
-- First, let's see all current policies on the foods table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'foods' 
AND schemaname = 'public';

-- Also check what the can_access_user_data function actually does
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'can_access_user_data' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Let's also check if there are any family_access records that might be giving unexpected access
SELECT 
    fa.id,
    fa.owner_user_id,
    fa.family_user_id,
    fa.family_email,
    fa.access_permissions,
    fa.is_active,
    fa.access_end_date,
    p1.email as owner_email,
    p2.email as family_email
FROM public.family_access fa
LEFT JOIN public.profiles p1 ON p1.id = fa.owner_user_id  
LEFT JOIN public.profiles p2 ON p2.id = fa.family_user_id
WHERE fa.is_active = true;

-- Clean up ALL food policies and recreate them properly
DROP POLICY IF EXISTS "Users can view accessible foods" ON public.foods;
DROP POLICY IF EXISTS "Users can insert their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can update their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can delete their own foods" ON public.foods;
DROP POLICY IF EXISTS "Users can access foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can insert foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can update foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "Users can delete foods with calorie permission" ON public.foods;
DROP POLICY IF EXISTS "foods_select_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_insert_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_update_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_delete_policy" ON public.foods;

-- Recreate the correct policies with explicit family access checks
CREATE POLICY "foods_select_policy" ON public.foods
FOR SELECT USING (
  -- Own foods
  user_id = auth.uid() OR 
  -- Foods shared with public
  shared_with_public = true OR
  -- Global foods (no specific user)
  user_id IS NULL OR
  -- Family member foods - EXPLICIT check without using can_access_user_data function
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
  -- Can insert for family members with explicit permission
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
  -- Can update family member foods with explicit permission
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
  -- Can delete family member foods with explicit permission
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
