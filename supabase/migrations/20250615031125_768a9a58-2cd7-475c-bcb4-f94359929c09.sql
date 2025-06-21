
-- Let's debug exactly what user3 can see and why
-- First, let's check if there are any family access records for user3
SELECT 
  fa.family_user_id,
  fa.owner_user_id, 
  fa.access_permissions,
  fa.is_active,
  p1.email as family_email,
  p2.email as owner_email
FROM public.family_access fa
LEFT JOIN public.profiles p1 ON p1.id = fa.family_user_id
LEFT JOIN public.profiles p2 ON p2.id = fa.owner_user_id
WHERE fa.family_user_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%user3%'
) OR fa.owner_user_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%user3%'
);

-- Let's also check what the can_access_user_data function would return
-- We need to test this for user3 trying to access user1 and user2's data
SELECT 
  p1.email as user3_email,
  p2.email as target_user_email,
  public.can_access_user_data(p2.id, 'calorie') as can_access_calorie
FROM public.profiles p1
CROSS JOIN public.profiles p2
WHERE p1.email LIKE '%user3%' 
  AND p2.email IN (SELECT email FROM public.profiles WHERE email LIKE '%user1%' OR email LIKE '%user2%');
