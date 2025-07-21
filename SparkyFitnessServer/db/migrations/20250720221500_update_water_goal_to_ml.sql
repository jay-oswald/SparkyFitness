BEGIN;

-- Add water_goal_ml to user_goals table
ALTER TABLE user_goals
ADD COLUMN water_goal_ml INTEGER;

-- Migrate existing water_goal (in glasses) to water_goal_ml (in ml)
-- Use the default conversion of 1 glass = 240 ml
UPDATE user_goals
SET water_goal_ml = water_goal * 240
WHERE water_goal IS NOT NULL;

-- Drop the old water_goal column
ALTER TABLE user_goals
DROP COLUMN water_goal;

COMMIT;