
-- Add unique constraints for custom measurements to support upsert operations

-- For Daily frequency: unique constraint on user_id, category_id, and entry_date
ALTER TABLE public.custom_measurements 
ADD CONSTRAINT custom_measurements_user_category_date_unique 
UNIQUE (user_id, category_id, entry_date);

-- For Hourly frequency: unique constraint on user_id, category_id, entry_date, and entry_hour
ALTER TABLE public.custom_measurements 
ADD CONSTRAINT custom_measurements_user_category_date_hour_unique 
UNIQUE (user_id, category_id, entry_date, entry_hour);
