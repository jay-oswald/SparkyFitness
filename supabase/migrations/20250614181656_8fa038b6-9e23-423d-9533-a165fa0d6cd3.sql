
-- Add a unique constraint on user_id and entry_date to prevent duplicate entries per user per date
ALTER TABLE public.check_in_measurements 
ADD CONSTRAINT check_in_measurements_user_date_unique 
UNIQUE (user_id, entry_date);

-- Enable Row Level Security on the check_in_measurements table
ALTER TABLE public.check_in_measurements ENABLE ROW LEVEL SECURITY;

-- Create policy that allows users to view their own check-in measurements
CREATE POLICY "Users can view their own check-in measurements" 
  ON public.check_in_measurements 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy that allows users to insert their own check-in measurements
CREATE POLICY "Users can create their own check-in measurements" 
  ON public.check_in_measurements 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy that allows users to update their own check-in measurements
CREATE POLICY "Users can update their own check-in measurements" 
  ON public.check_in_measurements 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy that allows users to delete their own check-in measurements
CREATE POLICY "Users can delete their own check-in measurements" 
  ON public.check_in_measurements 
  FOR DELETE 
  USING (auth.uid() = user_id);
