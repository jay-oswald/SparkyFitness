-- Migration to move nutrient and serving details from 'foods' table to 'food_variants' table

-- Add default_variant_id to foods table
ALTER TABLE foods
ADD COLUMN default_variant_id UUID;

-- Make default_variant_id NOT NULL and add a foreign key constraint
-- This will be set by the application logic when a new food is created
-- or when existing foods are migrated (if any data existed).
-- For new foods, a default variant will be created and its ID will be set here.
ALTER TABLE foods
ALTER COLUMN default_variant_id SET NOT NULL;

-- Ensure food_variants.id is a primary key before adding foreign key constraint
ALTER TABLE food_variants
ADD PRIMARY KEY (id);

ALTER TABLE foods
ADD CONSTRAINT fk_default_variant
FOREIGN KEY (default_variant_id) REFERENCES food_variants(id)
ON DELETE RESTRICT;

-- Remove nutrient and serving columns from foods table
ALTER TABLE foods
DROP COLUMN calories,
DROP COLUMN protein,
DROP COLUMN carbs,
DROP COLUMN fat,
DROP COLUMN serving_size,
DROP COLUMN serving_unit,
DROP COLUMN saturated_fat,
DROP COLUMN polyunsaturated_fat,
DROP COLUMN monounsaturated_fat,
DROP COLUMN trans_fat,
DROP COLUMN cholesterol,
DROP COLUMN sodium,
DROP COLUMN potassium,
DROP COLUMN dietary_fiber,
DROP COLUMN sugars,
DROP COLUMN vitamin_a,
DROP COLUMN vitamin_c,
DROP COLUMN calcium,
DROP COLUMN iron;