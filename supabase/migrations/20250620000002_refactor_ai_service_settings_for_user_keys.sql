-- Drop the old columns
ALTER TABLE public.ai_service_settings
DROP COLUMN IF EXISTS api_key_env_var_name,
DROP COLUMN IF EXISTS api_key_secret_id;

-- Add new columns for encrypted API key and IV
ALTER TABLE public.ai_service_settings
ADD COLUMN encrypted_api_key TEXT,
ADD COLUMN api_key_iv TEXT;

-- Optional: Add a check constraint to ensure either encrypted_api_key or custom_url is present
-- This depends on whether all services require an API key or if some are purely custom URL based
-- ALTER TABLE public.ai_service_settings
-- ADD CONSTRAINT chk_api_key_or_custom_url
-- CHECK (
--     (service_type IN ('openai', 'anthropic', 'google', 'mistral', 'groq', 'grok', 'together', 'openrouter', 'perplexity', 'cohere', 'huggingface', 'replicate', 'vertex', 'azure_openai') AND encrypted_api_key IS NOT NULL) OR
--     (service_type IN ('ollama', 'custom') AND custom_url IS NOT NULL)
-- );