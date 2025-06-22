ALTER TABLE public.user_preferences
ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';