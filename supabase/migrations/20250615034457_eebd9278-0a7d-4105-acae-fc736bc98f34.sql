
-- Remove the problematic policy that allows everyone to see all foods
DROP POLICY IF EXISTS "Users can view all foods" ON public.foods;

-- Verify our correct policies are in place
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'foods' 
AND schemaname = 'public'
ORDER BY policyname;
