-- Create a function to clear chat history older than 7 days for users with the '7days' auto_clear_history preference.
CREATE OR REPLACE FUNCTION public.clear_old_chat_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Consider SECURITY INVOKER if the function should run with the privileges of the calling user
AS $$
BEGIN
  -- Delete chat history entries older than 7 days for users who have set auto_clear_history to '7days'
  DELETE FROM public.sparky_chat_history
  WHERE user_id IN (
    SELECT user_id
    FROM public.user_preferences
    WHERE auto_clear_history = '7days'
  )
  AND created_at < now() - interval '7 days';
END;
$$;