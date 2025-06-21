
-- Create table for custom categories
CREATE TABLE public.custom_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(50) NOT NULL,
  measurement_type VARCHAR(50) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('All', 'Daily', 'Hourly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for custom measurements
CREATE TABLE public.custom_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  category_id UUID REFERENCES public.custom_categories(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC NOT NULL,
  entry_date DATE NOT NULL,
  entry_hour INTEGER, -- 0-23 for hourly tracking
  entry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) to ensure users can only see their own data
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_measurements ENABLE ROW LEVEL SECURITY;

-- Create policies for custom_categories
CREATE POLICY "Users can view their own custom categories" 
  ON public.custom_categories 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom categories" 
  ON public.custom_categories 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom categories" 
  ON public.custom_categories 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom categories" 
  ON public.custom_categories 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create policies for custom_measurements
CREATE POLICY "Users can view their own custom measurements" 
  ON public.custom_measurements 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom measurements" 
  ON public.custom_measurements 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom measurements" 
  ON public.custom_measurements 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom measurements" 
  ON public.custom_measurements 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_custom_categories_user_id ON public.custom_categories(user_id);
CREATE INDEX idx_custom_measurements_user_id ON public.custom_measurements(user_id);
CREATE INDEX idx_custom_measurements_category_id ON public.custom_measurements(category_id);
CREATE INDEX idx_custom_measurements_date ON public.custom_measurements(entry_date);
