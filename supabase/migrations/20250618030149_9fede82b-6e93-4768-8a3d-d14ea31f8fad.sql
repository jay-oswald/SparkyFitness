
-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_goals_for_date(uuid, date);

-- Drop the existing manage_goal_timeline function as well to avoid conflicts
DROP FUNCTION IF EXISTS public.manage_goal_timeline(uuid, date, numeric, numeric, numeric, numeric, integer);

-- Add new nutrition goal columns to user_goals table
ALTER TABLE public.user_goals 
ADD COLUMN IF NOT EXISTS saturated_fat NUMERIC DEFAULT 20,
ADD COLUMN IF NOT EXISTS polyunsaturated_fat NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS monounsaturated_fat NUMERIC DEFAULT 25,
ADD COLUMN IF NOT EXISTS trans_fat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cholesterol NUMERIC DEFAULT 300,
ADD COLUMN IF NOT EXISTS sodium NUMERIC DEFAULT 2300,
ADD COLUMN IF NOT EXISTS potassium NUMERIC DEFAULT 3500,
ADD COLUMN IF NOT EXISTS dietary_fiber NUMERIC DEFAULT 25,
ADD COLUMN IF NOT EXISTS sugars NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS vitamin_a NUMERIC DEFAULT 900,
ADD COLUMN IF NOT EXISTS vitamin_c NUMERIC DEFAULT 90,
ADD COLUMN IF NOT EXISTS calcium NUMERIC DEFAULT 1000,
ADD COLUMN IF NOT EXISTS iron NUMERIC DEFAULT 18;

-- Recreate the get_goals_for_date function with new nutrition fields
CREATE OR REPLACE FUNCTION public.get_goals_for_date(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  water_goal INTEGER,
  saturated_fat NUMERIC,
  polyunsaturated_fat NUMERIC,
  monounsaturated_fat NUMERIC,
  trans_fat NUMERIC,
  cholesterol NUMERIC,
  sodium NUMERIC,
  potassium NUMERIC,
  dietary_fiber NUMERIC,
  sugars NUMERIC,
  vitamin_a NUMERIC,
  vitamin_c NUMERIC,
  calcium NUMERIC,
  iron NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First try to get goal for the exact date
  RETURN QUERY
  SELECT g.calories, g.protein, g.carbs, g.fat, g.water_goal,
         g.saturated_fat, g.polyunsaturated_fat, g.monounsaturated_fat, g.trans_fat,
         g.cholesterol, g.sodium, g.potassium, g.dietary_fiber, g.sugars,
         g.vitamin_a, g.vitamin_c, g.calcium, g.iron
  FROM public.user_goals g
  WHERE g.user_id = p_user_id AND g.goal_date = p_date
  LIMIT 1;

  -- If no exact date goal found, get the most recent goal before this date
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT g.calories, g.protein, g.carbs, g.fat, g.water_goal,
           g.saturated_fat, g.polyunsaturated_fat, g.monounsaturated_fat, g.trans_fat,
           g.cholesterol, g.sodium, g.potassium, g.dietary_fiber, g.sugars,
           g.vitamin_a, g.vitamin_c, g.calcium, g.iron
    FROM public.user_goals g
    WHERE g.user_id = p_user_id 
      AND (g.goal_date < p_date OR g.goal_date IS NULL)
    ORDER BY g.goal_date DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- If still no goal found, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 2000::NUMERIC, 150::NUMERIC, 250::NUMERIC, 67::NUMERIC, 8::INTEGER,
           20::NUMERIC, 10::NUMERIC, 25::NUMERIC, 0::NUMERIC,
           300::NUMERIC, 2300::NUMERIC, 3500::NUMERIC, 25::NUMERIC, 50::NUMERIC,
           900::NUMERIC, 90::NUMERIC, 1000::NUMERIC, 18::NUMERIC;
  END IF;
END;
$$;

-- Recreate the manage_goal_timeline function to handle new nutrition fields
CREATE OR REPLACE FUNCTION public.manage_goal_timeline(
  p_user_id UUID,
  p_start_date DATE,
  p_calories NUMERIC,
  p_protein NUMERIC,
  p_carbs NUMERIC,
  p_fat NUMERIC,
  p_water_goal INTEGER,
  p_saturated_fat NUMERIC DEFAULT 20,
  p_polyunsaturated_fat NUMERIC DEFAULT 10,
  p_monounsaturated_fat NUMERIC DEFAULT 25,
  p_trans_fat NUMERIC DEFAULT 0,
  p_cholesterol NUMERIC DEFAULT 300,
  p_sodium NUMERIC DEFAULT 2300,
  p_potassium NUMERIC DEFAULT 3500,
  p_dietary_fiber NUMERIC DEFAULT 25,
  p_sugars NUMERIC DEFAULT 50,
  p_vitamin_a NUMERIC DEFAULT 900,
  p_vitamin_c NUMERIC DEFAULT 90,
  p_calcium NUMERIC DEFAULT 1000,
  p_iron NUMERIC DEFAULT 18
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_end_date DATE;
  v_current_date DATE;
BEGIN
  -- If editing a past date (before today), only update that specific date
  IF p_start_date < CURRENT_DATE THEN
    INSERT INTO public.user_goals (
      user_id, goal_date, calories, protein, carbs, fat, water_goal,
      saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
      cholesterol, sodium, potassium, dietary_fiber, sugars,
      vitamin_a, vitamin_c, calcium, iron
    )
    VALUES (
      p_user_id, p_start_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal,
      p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
      p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
      p_vitamin_a, p_vitamin_c, p_calcium, p_iron
    )
    ON CONFLICT (user_id, COALESCE(goal_date, '1900-01-01'::date))
    DO UPDATE SET
      calories = EXCLUDED.calories,
      protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs,
      fat = EXCLUDED.fat,
      water_goal = EXCLUDED.water_goal,
      saturated_fat = EXCLUDED.saturated_fat,
      polyunsaturated_fat = EXCLUDED.polyunsaturated_fat,
      monounsaturated_fat = EXCLUDED.monounsaturated_fat,
      trans_fat = EXCLUDED.trans_fat,
      cholesterol = EXCLUDED.cholesterol,
      sodium = EXCLUDED.sodium,
      potassium = EXCLUDED.potassium,
      dietary_fiber = EXCLUDED.dietary_fiber,
      sugars = EXCLUDED.sugars,
      vitamin_a = EXCLUDED.vitamin_a,
      vitamin_c = EXCLUDED.vitamin_c,
      calcium = EXCLUDED.calcium,
      iron = EXCLUDED.iron,
      updated_at = now();
    RETURN;
  END IF;

  -- For today or future dates: delete 6 months and insert new goals
  v_end_date := p_start_date + INTERVAL '6 months';

  -- Delete all existing goals from start date for 6 months
  DELETE FROM public.user_goals
  WHERE user_id = p_user_id
    AND goal_date >= p_start_date
    AND goal_date < v_end_date
    AND goal_date IS NOT NULL;

  -- Insert new goals for each day in the 6-month range
  v_current_date := p_start_date;
  WHILE v_current_date < v_end_date LOOP
    INSERT INTO public.user_goals (
      user_id, goal_date, calories, protein, carbs, fat, water_goal,
      saturated_fat, polyunsaturated_fat, monounsaturated_fat, trans_fat,
      cholesterol, sodium, potassium, dietary_fiber, sugars,
      vitamin_a, vitamin_c, calcium, iron
    )
    VALUES (
      p_user_id, v_current_date, p_calories, p_protein, p_carbs, p_fat, p_water_goal,
      p_saturated_fat, p_polyunsaturated_fat, p_monounsaturated_fat, p_trans_fat,
      p_cholesterol, p_sodium, p_potassium, p_dietary_fiber, p_sugars,
      p_vitamin_a, p_vitamin_c, p_calcium, p_iron
    );
    
    v_current_date := v_current_date + 1;
  END LOOP;

  -- Remove the default goal (NULL goal_date) to avoid conflicts
  DELETE FROM public.user_goals
  WHERE user_id = p_user_id AND goal_date IS NULL;
END;
$$;
