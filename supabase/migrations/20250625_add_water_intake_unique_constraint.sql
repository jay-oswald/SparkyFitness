ALTER TABLE public.water_intake
ADD CONSTRAINT water_intake_user_id_entry_date_key UNIQUE (user_id, entry_date);