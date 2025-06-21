-- Drop existing RLS policy for check_in_measurements
DROP POLICY IF EXISTS "Users can access measurements with checkin permission" ON public.check_in_measurements;

-- Create new RLS policy for check_in_measurements
CREATE POLICY "Users can access their own or shared measurements" ON public.check_in_measurements
FOR ALL USING (
  -- Allow owner to access their own data regardless of date
  user_id = auth.uid()
  OR
  -- Allow access based on family permissions
  public.can_access_user_data(user_id, 'checkin')
);