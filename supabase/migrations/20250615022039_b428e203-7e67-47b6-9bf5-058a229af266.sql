
-- Enable RLS on tables if not already enabled
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_intake ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check family access permissions
CREATE OR REPLACE FUNCTION public.can_access_user_data(target_user_id uuid, permission_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
      )
  );
END;
$$;

-- RLS policies for food_entries (calorie permission)
DROP POLICY IF EXISTS "Users can manage their own food entries" ON public.food_entries;
CREATE POLICY "Users can access food entries with calorie permission" ON public.food_entries
FOR ALL USING (public.can_access_user_data(user_id, 'calorie'));

-- RLS policies for check_in_measurements (checkin permission)
DROP POLICY IF EXISTS "Users can manage their own measurements" ON public.check_in_measurements;
CREATE POLICY "Users can access measurements with checkin permission" ON public.check_in_measurements
FOR ALL USING (public.can_access_user_data(user_id, 'checkin'));

-- RLS policies for custom_categories (checkin permission)
DROP POLICY IF EXISTS "Users can manage their own custom categories" ON public.custom_categories;
CREATE POLICY "Users can access custom categories with checkin permission" ON public.custom_categories
FOR ALL USING (public.can_access_user_data(user_id, 'checkin'));

-- RLS policies for custom_measurements (checkin permission)
DROP POLICY IF EXISTS "Users can manage their own custom measurements" ON public.custom_measurements;
CREATE POLICY "Users can access custom measurements with checkin permission" ON public.custom_measurements
FOR ALL USING (public.can_access_user_data(user_id, 'checkin'));

-- RLS policies for water_intake (checkin permission)
DROP POLICY IF EXISTS "Users can manage their own water intake" ON public.water_intake;
CREATE POLICY "Users can access water intake with checkin permission" ON public.water_intake
FOR ALL USING (public.can_access_user_data(user_id, 'checkin'));
