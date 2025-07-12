ALTER TABLE meal_plan_template_assignments
ADD COLUMN item_type VARCHAR(50) NOT NULL DEFAULT 'meal',
ADD COLUMN food_id UUID,
ADD COLUMN variant_id UUID,
ADD COLUMN quantity NUMERIC(10, 2),
ADD COLUMN unit VARCHAR(50);

ALTER TABLE meal_plan_template_assignments
ADD CONSTRAINT fk_food
FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE;

ALTER TABLE meal_plan_template_assignments
ADD CONSTRAINT fk_food_variant
FOREIGN KEY (variant_id) REFERENCES food_variants(id) ON DELETE CASCADE;

ALTER TABLE meal_plan_template_assignments
ADD CONSTRAINT chk_item_type_and_id
CHECK (
    (item_type = 'meal' AND meal_id IS NOT NULL AND food_id IS NULL AND variant_id IS NULL AND quantity IS NULL AND unit IS NULL) OR
    (item_type = 'food' AND food_id IS NOT NULL AND meal_id IS NULL)
);