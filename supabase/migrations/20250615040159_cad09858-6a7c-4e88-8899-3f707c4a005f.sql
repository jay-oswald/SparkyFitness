
-- Update the foods policies to remove the user_id IS NULL condition
-- since all foods will have a user_id (either creator or importer)

DROP POLICY IF EXISTS "foods_update_policy" ON public.foods;
DROP POLICY IF EXISTS "foods_delete_policy" ON public.foods;

-- Recreate update policy - only food owners can update their foods
CREATE POLICY "foods_update_policy" ON public.foods
FOR UPDATE USING (
  -- Only the food owner can update their foods
  user_id = auth.uid()
);

-- Recreate delete policy - only food owners can delete their foods  
CREATE POLICY "foods_delete_policy" ON public.foods
FOR DELETE USING (
  -- Only the food owner can delete their foods
  user_id = auth.uid()
);

-- Verify the updated policies
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'foods' 
AND schemaname = 'public'
AND policyname IN ('foods_update_policy', 'foods_delete_policy')
ORDER BY policyname;
