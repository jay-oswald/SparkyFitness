
-- Remove the overly permissive policy we just created
DROP POLICY IF EXISTS "Users can view profiles for family access" ON public.profiles;

-- Keep the existing restrictive policies for profiles table
-- Users can only see their own profiles

-- Modify the family_access table to be more flexible
-- Add a status field to track whether the family member has been found/verified
ALTER TABLE public.family_access 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive'));

-- Update the existing family_access policies to handle the new workflow
-- Family members should be able to see access grants where they are the family_user_id
-- even if their profile wasn't found initially
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id uuid;
BEGIN
    -- This function runs with elevated privileges to find users by email
    SELECT id INTO user_id
    FROM public.profiles
    WHERE email = p_email
    LIMIT 1;
    
    RETURN user_id;
END;
$$;
