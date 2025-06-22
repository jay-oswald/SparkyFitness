-- Remove the email column from the profiles table
ALTER TABLE public.profiles
DROP COLUMN email;

-- Update the handle_new_user function to no longer insert email into profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_goals (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Update the find_user_by_email function to query auth.users table
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
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
    
    RETURN user_id;
END;
$$;

-- Update the get_accessible_users function to get email from auth.users
CREATE OR REPLACE FUNCTION public.get_accessible_users(p_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, email text, permissions jsonb, access_end_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.owner_user_id,
    p.full_name,
    au.email, -- Get email from auth.users
    fa.access_permissions,
    fa.access_end_date
  FROM public.family_access fa
  JOIN public.profiles p ON p.id = fa.owner_user_id
  JOIN auth.users au ON au.id = fa.owner_user_id -- Join with auth.users
  WHERE fa.family_user_id = p_user_id
    AND fa.is_active = true
    AND (fa.access_end_date IS NULL OR fa.access_end_date > now());
END;
$$;