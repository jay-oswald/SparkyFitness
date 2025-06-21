-- Add logging_level column to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN logging_level TEXT DEFAULT 'ERROR';

-- Optional: Add a check constraint to ensure valid logging levels
ALTER TABLE user_preferences
ADD CONSTRAINT logging_level_check CHECK (logging_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'));