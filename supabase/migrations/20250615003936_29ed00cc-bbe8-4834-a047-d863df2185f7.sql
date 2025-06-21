
-- Create table for family access permissions
CREATE TABLE public.family_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL, -- The person granting access
  family_user_id UUID NOT NULL, -- The family member getting access
  family_email TEXT NOT NULL, -- Email of family member
  access_permissions JSONB NOT NULL DEFAULT '{"calorie": false, "checkin": false, "reports": false}', -- What they can access
  access_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_end_date TIMESTAMP WITH TIME ZONE, -- When access expires
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, family_user_id)
);

-- Add Row Level Security
ALTER TABLE public.family_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view family access records where they are either the owner or the family member
CREATE POLICY "Users can view relevant family access records" 
  ON public.family_access 
  FOR SELECT 
  USING (auth.uid() = owner_user_id OR auth.uid() = family_user_id);

-- Policy: Users can create family access records where they are the owner
CREATE POLICY "Users can create family access for themselves" 
  ON public.family_access 
  FOR INSERT 
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Users can update family access records where they are the owner
CREATE POLICY "Users can update their own family access records" 
  ON public.family_access 
  FOR UPDATE 
  USING (auth.uid() = owner_user_id);

-- Policy: Users can delete family access records where they are the owner
CREATE POLICY "Users can delete their own family access records" 
  ON public.family_access 
  FOR DELETE 
  USING (auth.uid() = owner_user_id);

-- Create function to check if a user has access to act on behalf of another user
CREATE OR REPLACE FUNCTION public.check_family_access(
  p_family_user_id UUID,
  p_owner_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.family_access
    WHERE family_user_id = p_family_user_id
      AND owner_user_id = p_owner_user_id
      AND is_active = true
      AND (access_end_date IS NULL OR access_end_date > now())
      AND (access_permissions->p_permission)::boolean = true
  );
END;
$$;

-- Create function to get users that the current user can act on behalf of
CREATE OR REPLACE FUNCTION public.get_accessible_users(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  permissions JSONB,
  access_end_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.owner_user_id,
    p.full_name,
    p.email,
    fa.access_permissions,
    fa.access_end_date
  FROM public.family_access fa
  JOIN public.profiles p ON p.id = fa.owner_user_id
  WHERE fa.family_user_id = p_user_id
    AND fa.is_active = true
    AND (fa.access_end_date IS NULL OR fa.access_end_date > now());
END;
$$;
