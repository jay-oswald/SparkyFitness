
-- Drop the existing conflicting unique constraints
ALTER TABLE public.custom_measurements 
DROP CONSTRAINT IF EXISTS custom_measurements_user_category_date_unique;

ALTER TABLE public.custom_measurements 
DROP CONSTRAINT IF EXISTS custom_measurements_user_category_date_hour_unique;

-- Add a single unique constraint that covers both Daily and Hourly scenarios
-- This allows one record per user+category+date+hour combination
-- For Daily: entry_hour will be NULL, so only one record per user+category+date
-- For Hourly: entry_hour will have a value, so one record per user+category+date+hour
-- For All: entry_hour will be NULL and we don't use upsert, so multiple records allowed
ALTER TABLE public.custom_measurements 
ADD CONSTRAINT custom_measurements_unique_entry 
UNIQUE (user_id, category_id, entry_date, entry_hour);
