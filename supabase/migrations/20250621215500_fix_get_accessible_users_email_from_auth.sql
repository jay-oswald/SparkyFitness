CREATE OR REPLACE FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "permissions" "jsonb", "access_end_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.owner_user_id,
    p.full_name,
    au.email::text, -- Get email from auth.users and explicitly cast to text
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