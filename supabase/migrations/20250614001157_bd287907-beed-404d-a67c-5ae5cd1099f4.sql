
-- Add a food_variants table to store different unit measurements for the same food
CREATE TABLE public.food_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  serving_size NUMERIC NOT NULL DEFAULT 1,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(food_id, serving_unit)
);

-- Enable RLS for food_variants
ALTER TABLE public.food_variants ENABLE ROW LEVEL SECURITY;

-- Create policies for food_variants
CREATE POLICY "Users can view food variants for their foods and public foods" 
  ON public.food_variants 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.foods 
      WHERE foods.id = food_variants.food_id 
      AND (foods.user_id = auth.uid() OR foods.user_id IS NULL)
    )
  );

CREATE POLICY "Users can create variants for their own foods" 
  ON public.food_variants 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.foods 
      WHERE foods.id = food_variants.food_id 
      AND foods.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update variants for their own foods" 
  ON public.food_variants 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.foods 
      WHERE foods.id = food_variants.food_id 
      AND foods.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete variants for their own foods" 
  ON public.food_variants 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.foods 
      WHERE foods.id = food_variants.food_id 
      AND foods.user_id = auth.uid()
    )
  );

-- Add variant_id to food_entries to track which specific unit variant was used
ALTER TABLE public.food_entries ADD COLUMN variant_id UUID REFERENCES public.food_variants(id);

-- Enable Row Level Security for all existing tables that don't have it
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for foods table
CREATE POLICY "Users can view all foods (public and their own)" 
  ON public.foods 
  FOR SELECT 
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can create their own foods" 
  ON public.foods 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own foods" 
  ON public.foods 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own foods" 
  ON public.foods 
  FOR DELETE 
  USING (user_id = auth.uid());

-- Create RLS policies for food_entries table
CREATE POLICY "Users can view their own food entries" 
  ON public.food_entries 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own food entries" 
  ON public.food_entries 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own food entries" 
  ON public.food_entries 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own food entries" 
  ON public.food_entries 
  FOR DELETE 
  USING (user_id = auth.uid());

-- Create RLS policies for user_goals table
CREATE POLICY "Users can view their own goals" 
  ON public.user_goals 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own goals" 
  ON public.user_goals 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own goals" 
  ON public.user_goals 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own goals" 
  ON public.user_goals 
  FOR DELETE 
  USING (user_id = auth.uid());
