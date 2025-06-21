-- Rename api_key to api_key_env_var_name
ALTER TABLE public.ai_service_settings
RENAME COLUMN api_key TO api_key_env_var_name;

-- Add api_key_secret_id column
ALTER TABLE public.ai_service_settings
ADD COLUMN api_key_secret_id UUID;

-- Optional: Add a foreign key constraint if api_key_secret_id references another table
-- For now, assuming it will store a UUID referencing a Supabase secret,
-- which might not be a direct foreign key in the database schema.