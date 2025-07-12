ALTER TABLE meal_plan_template_assignments
ALTER COLUMN meal_id DROP NOT NULL;

-- Drop the existing check constraint
ALTER TABLE meal_plan_template_assignments
DROP CONSTRAINT IF EXISTS chk_item_type_and_id;

-- Add the check constraint again with the updated logic
ALTER TABLE meal_plan_template_assignments
ADD CONSTRAINT chk_item_type_and_id
CHECK (
    (item_type = 'meal' AND meal_id IS NOT NULL AND food_id IS NULL) OR
    (item_type = 'food' AND food_id IS NOT NULL AND meal_id IS NULL)
);