
-- Update the can_access_user_data function to support the new food_list permission
CREATE OR REPLACE FUNCTION public.can_access_user_data(target_user_id uuid, permission_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $$
BEGIN
  -- If accessing own data, always allow
  IF target_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Check if current user has family access with the required permission
  RETURN EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = target_user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (
        -- Direct permission check
        (fa.access_permissions->permission_type)::boolean = true
        OR
        -- Inheritance: reports permission grants read access to calorie and checkin
        (permission_type IN ('calorie', 'checkin') AND (fa.access_permissions->>'reports')::boolean = true)
        OR
        -- Inheritance: food_list permission grants read access to calorie data (foods table)
        (permission_type = 'calorie' AND (fa.access_permissions->>'food_list')::boolean = true)
      )
  );
END;
$$;
