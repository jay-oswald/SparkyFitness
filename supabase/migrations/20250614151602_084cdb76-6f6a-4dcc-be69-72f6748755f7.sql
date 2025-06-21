
-- Add goal_date column to user_goals table to support date-specific goals
ALTER TABLE public.user_goals 
ADD COLUMN goal_date DATE DEFAULT NULL;

-- Create index for better performance on goal_date queries
CREATE INDEX idx_user_goals_user_date ON public.user_goals(user_id, goal_date);

-- Update existing records to have NULL goal_date (representing default goals)
-- This ensures existing goals remain as default goals
UPDATE public.user_goals SET goal_date = NULL WHERE goal_date IS NULL;
