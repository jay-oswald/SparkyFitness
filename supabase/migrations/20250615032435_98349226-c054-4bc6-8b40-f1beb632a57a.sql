
-- Let's create a test to see exactly what's happening with the can_access_user_data function
-- First, let's check what the function is currently returning for specific test cases

-- Test the can_access_user_data function directly with known user IDs
DO $$
DECLARE
    user3_id uuid;
    other_user_id uuid;
    test_result boolean;
BEGIN
    -- Get user3's ID
    SELECT id INTO user3_id FROM public.profiles WHERE email LIKE '%user3%' LIMIT 1;
    
    -- Get another user's ID (the one whose foods user3 is seeing)
    SELECT id INTO other_user_id FROM public.profiles WHERE id = '22636367-050d-4842-ac1f-b401bf2018ec' LIMIT 1;
    
    IF user3_id IS NOT NULL AND other_user_id IS NOT NULL THEN
        -- Test what can_access_user_data returns
        -- This simulates: can user3 access other_user's data?
        SELECT public.can_access_user_data(other_user_id, 'calorie') INTO test_result;
        
        RAISE NOTICE 'User3 ID: %', user3_id;
        RAISE NOTICE 'Other User ID: %', other_user_id;
        RAISE NOTICE 'can_access_user_data result: %', test_result;
        
        -- Also check family access records
        RAISE NOTICE 'Family access records for user3: %', (
            SELECT COUNT(*) FROM public.family_access 
            WHERE family_user_id = user3_id OR owner_user_id = user3_id
        );
    ELSE
        RAISE NOTICE 'Could not find required users for testing';
    END IF;
END $$;

-- Also, let's temporarily disable RLS on foods table to see what's really there
ALTER TABLE public.foods DISABLE ROW LEVEL SECURITY;

-- Check all foods to see their ownership
SELECT 
    name,
    user_id,
    shared_with_public,
    CASE 
        WHEN user_id IS NULL THEN 'Global'
        WHEN shared_with_public = true THEN 'Public'
        ELSE 'Private'
    END as food_type
FROM public.foods
ORDER BY user_id, name;

-- Re-enable RLS
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
