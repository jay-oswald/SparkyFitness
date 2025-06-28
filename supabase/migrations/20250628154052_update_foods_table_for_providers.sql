-- Alter the foods table to rename openfoodfacts_id to provider_external_id and add provider_type
ALTER TABLE foods
RENAME COLUMN openfoodfacts_id TO provider_external_id;

ALTER TABLE foods
ADD COLUMN provider_type TEXT;

-- Update existing rows to set provider_type for 'openfoodfacts'
UPDATE foods
SET provider_type = 'openfoodfacts'
WHERE provider_external_id IS NOT NULL;

-- Create an index on provider_external_id and provider_type for faster lookups
CREATE INDEX idx_foods_provider_external_id_provider_type ON foods (provider_external_id, provider_type);

-- Optional: Add a NOT NULL constraint and default value if all future foods will have a provider
-- ALTER TABLE foods
-- ALTER COLUMN provider_type SET NOT NULL;
-- ALTER TABLE foods
-- ALTER COLUMN provider_type SET DEFAULT 'manual'; -- or some other default

-- Optional: Add a unique constraint if the combination of provider_external_id and provider_type should be unique
-- ALTER TABLE foods
-- ADD CONSTRAINT uq_foods_provider_external_id_provider_type UNIQUE (provider_external_id, provider_type);