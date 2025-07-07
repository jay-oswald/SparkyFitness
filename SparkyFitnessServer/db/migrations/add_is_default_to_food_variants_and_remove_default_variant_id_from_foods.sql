-- Migration to add is_default column to food_variants and remove default_variant_id from foods table.

-- Add is_default column to food_variants table
ALTER TABLE food_variants ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Remove default_variant_id from foods table
ALTER TABLE foods DROP COLUMN default_variant_id;

-- Optional: If you had existing data and wanted to set a default variant for existing foods,
-- you would need to write a separate script or manually update.
-- For example, to set the first variant created for each food as default:
-- UPDATE food_variants fv
-- SET is_default = TRUE
-- FROM (
--     SELECT food_id, MIN(id) as first_variant_id
--     FROM food_variants
--     GROUP BY food_id
-- ) AS sub
-- WHERE fv.id = sub.first_variant_id;