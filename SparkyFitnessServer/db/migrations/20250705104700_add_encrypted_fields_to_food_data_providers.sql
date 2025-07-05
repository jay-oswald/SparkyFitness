ALTER TABLE food_data_providers
ADD COLUMN encrypted_app_id TEXT,
ADD COLUMN app_id_iv TEXT,
ADD COLUMN app_id_tag TEXT,
ADD COLUMN encrypted_app_key TEXT,
ADD COLUMN app_key_iv TEXT,
ADD COLUMN app_key_tag TEXT;