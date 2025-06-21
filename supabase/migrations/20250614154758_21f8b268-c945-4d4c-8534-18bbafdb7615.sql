
-- Fix the manage_goal_timeline function to properly handle today and future dates
CREATE OR REPLACE FUNCTION public.manage_goal_timeline(
  p_user_id UUID,
  p_start_date DATE,
  p_calories NUMERIC,
  p_protein NUMERIC,
  p_carbs NUMERIC,
  p_fat NUMERIC,
  p_water_goal INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_end_date DATE;
  v_next_goal_date DATE;
  v_current_date DATE;
BEGIN
  -- If editing a past date (before today), only update that specific date
  IF p_start_date < CURRENT_DATE THEN
    INSERT INTO public.user_goals (user_id, goal_date, calories, protein, carbs, fat, water_goal)
    VALUES (p_user_id, p_start_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal)
    ON CONFLICT (user_id, COALESCE(goal_date, '1900-01-01'::date))
    DO UPDATE SET
      calories = EXCLUDED.calories,
      protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs,
      fat = EXCLUDED.fat,
      water_goal = EXCLUDED.water_goal,
      updated_at = now();
    RETURN;
  END IF;

  -- For current/future dates (today onwards), cascade the changes
  -- Find the next future goal to determine end boundary
  SELECT goal_date INTO v_next_goal_date
  FROM public.user_goals
  WHERE user_id = p_user_id 
    AND goal_date > p_start_date
    AND goal_date IS NOT NULL
  ORDER BY goal_date ASC
  LIMIT 1;

  -- Calculate end date: 6 months from start date or next goal date, whichever is earlier
  v_end_date := LEAST(
    p_start_date + INTERVAL '6 months',
    COALESCE(v_next_goal_date, p_start_date + INTERVAL '6 months')
  )::DATE;

  -- Delete existing goals in the range (excluding the end boundary if it's a future goal)
  DELETE FROM public.user_goals
  WHERE user_id = p_user_id
    AND goal_date >= p_start_date
    AND goal_date < v_end_date
    AND goal_date IS NOT NULL;

  -- Insert new goals for each day in the range
  v_current_date := p_start_date;
  WHILE v_current_date < v_end_date LOOP
    INSERT INTO public.user_goals (user_id, goal_date, calories, protein, carbs, fat, water_goal)
    VALUES (p_user_id, v_current_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal);
    
    v_current_date := v_current_date + 1;
  END LOOP;

  -- Remove the default goal (NULL goal_date) to avoid conflicts
  DELETE FROM public.user_goals
  WHERE user_id = p_user_id AND goal_date IS NULL;
END;
$$;
