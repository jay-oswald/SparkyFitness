

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."can_access_user_data"("target_user_id" "uuid", "permission_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- If accessing own data, always allow
  IF target_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  
  -- Check if current user has family access with the required permission
  RETURN EXISTS (
    SELECT 1
    FROM public.family_access fa
    WHERE fa.family_user_id = auth.uid()
      AND fa.owner_user_id = target_user_id
      AND fa.is_active = true
      AND (fa.access_end_date IS NULL OR fa.access_end_date > now())
      AND (
        -- Direct permission check
        (fa.access_permissions->permission_type)::boolean = true
        OR
        -- Inheritance: reports permission grants read access to calorie and checkin
        (permission_type IN ('calorie', 'checkin') AND (fa.access_permissions->>'reports')::boolean = true)
        OR
        -- Inheritance: food_list permission grants read access to calorie data (foods table)
        (permission_type = 'calorie' AND (fa.access_permissions->>'food_list')::boolean = true)
      )
  );
END;
$$;


ALTER FUNCTION "public"."can_access_user_data"("target_user_id" "uuid", "permission_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_family_access"("p_family_user_id" "uuid", "p_owner_user_id" "uuid", "p_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.family_access
    WHERE family_user_id = p_family_user_id
      AND owner_user_id = p_owner_user_id
      AND is_active = true
      AND (access_end_date IS NULL OR access_end_date > now())
      AND (access_permissions->p_permission)::boolean = true
  );
END;
$$;


ALTER FUNCTION "public"."check_family_access"("p_family_user_id" "uuid", "p_owner_user_id" "uuid", "p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_old_chat_history"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."clear_old_chat_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_user_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_id uuid;
BEGIN
    -- This function runs with elevated privileges to find users by email
    SELECT id INTO user_id
    FROM public.profiles
    WHERE email = p_email
    LIMIT 1;
    
    RETURN user_id;
END;
$$;


ALTER FUNCTION "public"."find_user_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "permissions" "jsonb", "access_end_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.owner_user_id,
    p.full_name,
    p.email,
    fa.access_permissions,
    fa.access_end_date
  FROM public.family_access fa
  JOIN public.profiles p ON p.id = fa.owner_user_id
  WHERE fa.family_user_id = p_user_id
    AND fa.is_active = true
    AND (fa.access_end_date IS NULL OR fa.access_end_date > now());
END;
$$;


ALTER FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_goals_for_date"("p_user_id" "uuid", "p_date" "date") RETURNS TABLE("calories" numeric, "protein" numeric, "carbs" numeric, "fat" numeric, "water_goal" integer, "saturated_fat" numeric, "polyunsaturated_fat" numeric, "monounsaturated_fat" numeric, "trans_fat" numeric, "cholesterol" numeric, "sodium" numeric, "potassium" numeric, "dietary_fiber" numeric, "sugars" numeric, "vitamin_a" numeric, "vitamin_c" numeric, "calcium" numeric, "iron" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_goals_for_date"("p_user_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_goals (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_goal_timeline"("p_user_id" "uuid", "p_start_date" "date", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_water_goal" integer, "p_saturated_fat" numeric DEFAULT 20, "p_polyunsaturated_fat" numeric DEFAULT 10, "p_monounsaturated_fat" numeric DEFAULT 25, "p_trans_fat" numeric DEFAULT 0, "p_cholesterol" numeric DEFAULT 300, "p_sodium" numeric DEFAULT 2300, "p_potassium" numeric DEFAULT 3500, "p_dietary_fiber" numeric DEFAULT 25, "p_sugars" numeric DEFAULT 50, "p_vitamin_a" numeric DEFAULT 900, "p_vitamin_c" numeric DEFAULT 90, "p_calcium" numeric DEFAULT 1000, "p_iron" numeric DEFAULT 18) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."manage_goal_timeline"("p_user_id" "uuid", "p_start_date" "date", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_water_goal" integer, "p_saturated_fat" numeric, "p_polyunsaturated_fat" numeric, "p_monounsaturated_fat" numeric, "p_trans_fat" numeric, "p_cholesterol" numeric, "p_sodium" numeric, "p_potassium" numeric, "p_dietary_fiber" numeric, "p_sugars" numeric, "p_vitamin_a" numeric, "p_vitamin_c" numeric, "p_calcium" numeric, "p_iron" numeric) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_service_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "custom_url" "text",
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "system_prompt" "text" DEFAULT ''::"text",
    "model_name" "text",
    "encrypted_api_key" "text",
    "api_key_iv" "text"
);


ALTER TABLE "public"."ai_service_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_in_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "weight" numeric,
    "neck" numeric,
    "waist" numeric,
    "hips" numeric,
    "steps" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."check_in_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(50) NOT NULL,
    "measurement_type" character varying(50) NOT NULL,
    "frequency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_categories_frequency_check" CHECK (("frequency" = ANY (ARRAY['All'::"text", 'Daily'::"text", 'Hourly'::"text"])))
);


ALTER TABLE "public"."custom_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "entry_date" "date" NOT NULL,
    "entry_hour" integer,
    "entry_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."custom_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exercise_id" "uuid" NOT NULL,
    "duration_minutes" numeric NOT NULL,
    "calories_burned" numeric NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exercise_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "calories_per_hour" numeric DEFAULT 300,
    "description" "text",
    "user_id" "uuid",
    "is_custom" boolean DEFAULT false,
    "shared_with_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "family_user_id" "uuid" NOT NULL,
    "family_email" "text" NOT NULL,
    "access_permissions" "jsonb" DEFAULT '{"calorie": false, "checkin": false, "reports": false}'::"jsonb" NOT NULL,
    "access_start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_end_date" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "family_access_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."family_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "food_id" "uuid" NOT NULL,
    "meal_type" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'g'::"text",
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "variant_id" "uuid",
    CONSTRAINT "food_entries_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'snacks'::"text"])))
);


ALTER TABLE "public"."food_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "food_id" "uuid" NOT NULL,
    "serving_size" numeric DEFAULT 1 NOT NULL,
    "serving_unit" "text" DEFAULT 'g'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calories" numeric DEFAULT 0,
    "protein" numeric DEFAULT 0,
    "carbs" numeric DEFAULT 0,
    "fat" numeric DEFAULT 0,
    "saturated_fat" numeric DEFAULT 0,
    "polyunsaturated_fat" numeric DEFAULT 0,
    "monounsaturated_fat" numeric DEFAULT 0,
    "trans_fat" numeric DEFAULT 0,
    "cholesterol" numeric DEFAULT 0,
    "sodium" numeric DEFAULT 0,
    "potassium" numeric DEFAULT 0,
    "dietary_fiber" numeric DEFAULT 0,
    "sugars" numeric DEFAULT 0,
    "vitamin_a" numeric DEFAULT 0,
    "vitamin_c" numeric DEFAULT 0,
    "calcium" numeric DEFAULT 0,
    "iron" numeric DEFAULT 0
);


ALTER TABLE "public"."food_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."foods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "brand" "text",
    "barcode" "text",
    "openfoodfacts_id" "text",
    "serving_size" numeric DEFAULT 100,
    "serving_unit" "text" DEFAULT 'g'::"text",
    "calories" numeric DEFAULT 0,
    "protein" numeric DEFAULT 0,
    "carbs" numeric DEFAULT 0,
    "fat" numeric DEFAULT 0,
    "saturated_fat" numeric,
    "polyunsaturated_fat" numeric,
    "monounsaturated_fat" numeric,
    "trans_fat" numeric,
    "cholesterol" numeric,
    "sodium" numeric,
    "potassium" numeric,
    "dietary_fiber" numeric,
    "sugars" numeric,
    "vitamin_a" numeric,
    "vitamin_c" numeric,
    "calcium" numeric,
    "iron" numeric,
    "is_custom" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shared_with_public" boolean DEFAULT false
);


ALTER TABLE "public"."foods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date_of_birth" "date",
    "phone" "text",
    "bio" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sparky_chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "image_url" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message" "text",
    "response" "text",
    CONSTRAINT "sparky_chat_history_message_type_check" CHECK (("message_type" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."sparky_chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_date" "date",
    "calories" numeric DEFAULT 2000,
    "protein" numeric DEFAULT 150,
    "carbs" numeric DEFAULT 250,
    "fat" numeric DEFAULT 67,
    "water_goal" integer DEFAULT 8,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "saturated_fat" numeric DEFAULT 20,
    "polyunsaturated_fat" numeric DEFAULT 10,
    "monounsaturated_fat" numeric DEFAULT 25,
    "trans_fat" numeric DEFAULT 0,
    "cholesterol" numeric DEFAULT 300,
    "sodium" numeric DEFAULT 2300,
    "potassium" numeric DEFAULT 3500,
    "dietary_fiber" numeric DEFAULT 25,
    "sugars" numeric DEFAULT 50,
    "vitamin_a" numeric DEFAULT 900,
    "vitamin_c" numeric DEFAULT 90,
    "calcium" numeric DEFAULT 1000,
    "iron" numeric DEFAULT 18
);


ALTER TABLE "public"."user_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date_format" "text" DEFAULT 'MM/DD/YYYY'::"text" NOT NULL,
    "default_weight_unit" "text" DEFAULT 'kg'::"text" NOT NULL,
    "default_measurement_unit" "text" DEFAULT 'cm'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "system_prompt" "text" DEFAULT 'You are Sparky, a helpful AI assistant for health and fitness tracking. Be friendly, encouraging, and provide accurate information about nutrition, exercise, and wellness.'::"text",
    "auto_clear_history" "text" DEFAULT 'never'::"text",
    "logging_level" "text" DEFAULT 'ERROR'::"text",
    CONSTRAINT "logging_level_check" CHECK (("logging_level" = ANY (ARRAY['DEBUG'::"text", 'INFO'::"text", 'WARN'::"text", 'ERROR'::"text", 'SILENT'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."water_intake" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "glasses_consumed" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."water_intake" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_service_settings"
    ADD CONSTRAINT "ai_service_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_in_measurements"
    ADD CONSTRAINT "check_in_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_in_measurements"
    ADD CONSTRAINT "check_in_measurements_user_date_unique" UNIQUE ("user_id", "entry_date");



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_measurements"
    ADD CONSTRAINT "custom_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_measurements"
    ADD CONSTRAINT "custom_measurements_unique_entry" UNIQUE ("user_id", "category_id", "entry_date", "entry_hour");



ALTER TABLE ONLY "public"."exercise_entries"
    ADD CONSTRAINT "exercise_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_owner_user_id_family_user_id_key" UNIQUE ("owner_user_id", "family_user_id");



ALTER TABLE ONLY "public"."family_access"
    ADD CONSTRAINT "family_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_entries"
    ADD CONSTRAINT "food_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_variants"
    ADD CONSTRAINT "food_variants_food_id_serving_unit_key" UNIQUE ("food_id", "serving_unit");



ALTER TABLE ONLY "public"."food_variants"
    ADD CONSTRAINT "food_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."foods"
    ADD CONSTRAINT "foods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sparky_chat_history"
    ADD CONSTRAINT "sparky_chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_goals"
    ADD CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."water_intake"
    ADD CONSTRAINT "water_intake_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_ai_service_settings_active" ON "public"."ai_service_settings" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_ai_service_settings_user_id" ON "public"."ai_service_settings" USING "btree" ("user_id");



CREATE INDEX "idx_custom_categories_user_id" ON "public"."custom_categories" USING "btree" ("user_id");



CREATE INDEX "idx_custom_measurements_category_id" ON "public"."custom_measurements" USING "btree" ("category_id");



CREATE INDEX "idx_custom_measurements_date" ON "public"."custom_measurements" USING "btree" ("entry_date");



CREATE INDEX "idx_custom_measurements_user_id" ON "public"."custom_measurements" USING "btree" ("user_id");



CREATE INDEX "idx_sparky_chat_history_created_at" ON "public"."sparky_chat_history" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_sparky_chat_history_session" ON "public"."sparky_chat_history" USING "btree" ("user_id", "session_id");



CREATE INDEX "idx_sparky_chat_history_user_id" ON "public"."sparky_chat_history" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_user_goals_unique_user_date" ON "public"."user_goals" USING "btree" ("user_id", COALESCE("goal_date", '1900-01-01'::"date"));



CREATE INDEX "idx_user_goals_user_date" ON "public"."user_goals" USING "btree" ("user_id", "goal_date");



CREATE INDEX "idx_user_goals_user_date_asc" ON "public"."user_goals" USING "btree" ("user_id", "goal_date");



CREATE OR REPLACE TRIGGER "on_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_user_preferences"();



ALTER TABLE ONLY "public"."ai_service_settings"
    ADD CONSTRAINT "ai_service_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_categories"
    ADD CONSTRAINT "custom_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."custom_measurements"
    ADD CONSTRAINT "custom_measurements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."custom_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_measurements"
    ADD CONSTRAINT "custom_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exercise_entries"
    ADD CONSTRAINT "exercise_entries_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."food_entries"
    ADD CONSTRAINT "food_entries_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id");



ALTER TABLE ONLY "public"."food_entries"
    ADD CONSTRAINT "food_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."food_entries"
    ADD CONSTRAINT "food_entries_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."food_variants"("id");



ALTER TABLE ONLY "public"."food_variants"
    ADD CONSTRAINT "food_variants_food_id_fkey" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foods"
    ADD CONSTRAINT "foods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sparky_chat_history"
    ADD CONSTRAINT "sparky_chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Users can access custom categories with checkin permission" ON "public"."custom_categories" USING ("public"."can_access_user_data"("user_id", 'checkin'::"text"));



CREATE POLICY "Users can access custom measurements with checkin permission" ON "public"."custom_measurements" USING ("public"."can_access_user_data"("user_id", 'checkin'::"text"));



CREATE POLICY "Users can access food entries with calorie permission" ON "public"."food_entries" USING ("public"."can_access_user_data"("user_id", 'calorie'::"text"));



CREATE POLICY "Users can access foods with permissions" ON "public"."foods" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("user_id" IS NOT NULL) AND ("public"."can_access_user_data"("user_id", 'calorie'::"text") OR "public"."can_access_user_data"("user_id", 'food_list'::"text"))) OR ("shared_with_public" = true) OR ("user_id" IS NULL)));



CREATE POLICY "Users can access their own or shared measurements" ON "public"."check_in_measurements" USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_user_data"("user_id", 'checkin'::"text")));



CREATE POLICY "Users can access water intake with checkin permission" ON "public"."water_intake" USING ("public"."can_access_user_data"("user_id", 'checkin'::"text"));



CREATE POLICY "Users can create family access for themselves" ON "public"."family_access" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can create foods" ON "public"."foods" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can create own food entries" ON "public"."food_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own AI settings" ON "public"."ai_service_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own chat history" ON "public"."sparky_chat_history" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own check-in measurements" ON "public"."check_in_measurements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own custom categories" ON "public"."custom_categories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own custom measurements" ON "public"."custom_measurements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own food entries" ON "public"."food_entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own foods" ON "public"."foods" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own goals" ON "public"."user_goals" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own measurements" ON "public"."check_in_measurements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own water intake" ON "public"."water_intake" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create variants for their own foods" ON "public"."food_variants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."foods"
  WHERE (("foods"."id" = "food_variants"."food_id") AND ("foods"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete foods with calorie permission" ON "public"."foods" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (("user_id" IS NOT NULL) AND "public"."can_access_user_data"("user_id", 'calorie'::"text"))));



CREATE POLICY "Users can delete own custom foods" ON "public"."foods" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_custom" = true)));



CREATE POLICY "Users can delete own exercise entries" ON "public"."exercise_entries" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_user_data"("user_id", 'calorie'::"text")));



CREATE POLICY "Users can delete own exercises" ON "public"."exercises" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own food entries" ON "public"."food_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own AI settings" ON "public"."ai_service_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own chat history" ON "public"."sparky_chat_history" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own check-in measurements" ON "public"."check_in_measurements" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own custom categories or categories they" ON "public"."custom_categories" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can delete their own custom measurements or measurements " ON "public"."custom_measurements" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can delete their own family access records" ON "public"."family_access" FOR DELETE USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can delete their own food entries or entries they have fa" ON "public"."food_entries" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can delete their own goals or goals they have family acce" ON "public"."user_goals" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can delete their own measurements or measurements they ha" ON "public"."check_in_measurements" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can delete their own water intake or intake they have fam" ON "public"."water_intake" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can delete variants for their own foods" ON "public"."food_variants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."foods"
  WHERE (("foods"."id" = "food_variants"."food_id") AND ("foods"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert custom categories for themselves or family mem" ON "public"."custom_categories" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can insert custom measurements for themselves or family m" ON "public"."custom_measurements" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can insert food entries for themselves or family members " ON "public"."food_entries" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can insert foods with calorie permission" ON "public"."foods" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR (("user_id" IS NOT NULL) AND "public"."can_access_user_data"("user_id", 'calorie'::"text")) OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert goals for themselves or family members they ha" ON "public"."user_goals" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can insert measurements for themselves or family members " ON "public"."check_in_measurements" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can insert own exercise entries" ON "public"."exercise_entries" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."can_access_user_data"("user_id", 'calorie'::"text")));



CREATE POLICY "Users can insert own exercises" ON "public"."exercises" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert water intake for themselves or family members " ON "public"."water_intake" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can update foods with calorie permission" ON "public"."foods" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("user_id" IS NOT NULL) AND "public"."can_access_user_data"("user_id", 'calorie'::"text"))));



CREATE POLICY "Users can update own custom foods" ON "public"."foods" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("is_custom" = true)));



CREATE POLICY "Users can update own exercise entries" ON "public"."exercise_entries" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_user_data"("user_id", 'calorie'::"text")));



CREATE POLICY "Users can update own exercises" ON "public"."exercises" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own food entries" ON "public"."food_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own AI settings" ON "public"."ai_service_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own check-in measurements" ON "public"."check_in_measurements" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own custom categories or categories they" ON "public"."custom_categories" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can update their own custom measurements or measurements " ON "public"."custom_measurements" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can update their own family access records" ON "public"."family_access" FOR UPDATE USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "Users can update their own food entries or entries they have fa" ON "public"."food_entries" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can update their own goals or goals they have family acce" ON "public"."user_goals" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can update their own measurements or measurements they ha" ON "public"."check_in_measurements" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own water intake or intake they have fam" ON "public"."water_intake" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can update variants for their own foods" ON "public"."food_variants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."foods"
  WHERE (("foods"."id" = "food_variants"."food_id") AND ("foods"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view all foods (public and their own)" ON "public"."foods" FOR SELECT USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view food variants for their foods and public foods" ON "public"."food_variants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."foods"
  WHERE (("foods"."id" = "food_variants"."food_id") AND (("foods"."user_id" = "auth"."uid"()) OR ("foods"."user_id" IS NULL))))));



CREATE POLICY "Users can view own exercise entries" ON "public"."exercise_entries" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_user_data"("user_id", 'calorie'::"text")));



CREATE POLICY "Users can view own food entries" ON "public"."food_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view public and own exercises" ON "public"."exercises" FOR SELECT USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"()) OR ("shared_with_public" = true)));



CREATE POLICY "Users can view relevant family access records" ON "public"."family_access" FOR SELECT USING ((("auth"."uid"() = "owner_user_id") OR ("auth"."uid"() = "family_user_id")));



CREATE POLICY "Users can view their own AI settings" ON "public"."ai_service_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own chat history" ON "public"."sparky_chat_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own check-in measurements" ON "public"."check_in_measurements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own custom categories or categories they h" ON "public"."custom_categories" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can view their own custom measurements or measurements th" ON "public"."custom_measurements" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can view their own food entries or entries they have fami" ON "public"."food_entries" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can view their own goals or goals they have family access" ON "public"."user_goals" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



CREATE POLICY "Users can view their own measurements or measurements they have" ON "public"."check_in_measurements" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'checkin'::"text")));



CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own water intake or intake they have famil" ON "public"."water_intake" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."check_family_access"("auth"."uid"(), "user_id", 'calorie'::"text")));



ALTER TABLE "public"."ai_service_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."check_in_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."foods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "foods_delete_policy" ON "public"."foods" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "foods_insert_policy" ON "public"."foods" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL) OR (("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."family_access" "fa"
  WHERE (("fa"."family_user_id" = "auth"."uid"()) AND ("fa"."owner_user_id" = "foods"."user_id") AND ("fa"."is_active" = true) AND (("fa"."access_end_date" IS NULL) OR ("fa"."access_end_date" > "now"())) AND ((("fa"."access_permissions" ->> 'calorie'::"text"))::boolean = true)))))));



CREATE POLICY "foods_select_policy" ON "public"."foods" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("shared_with_public" = true) OR ("user_id" IS NULL) OR (("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."family_access" "fa"
  WHERE (("fa"."family_user_id" = "auth"."uid"()) AND ("fa"."owner_user_id" = "foods"."user_id") AND ("fa"."is_active" = true) AND (("fa"."access_end_date" IS NULL) OR ("fa"."access_end_date" > "now"())) AND ((("fa"."access_permissions" ->> 'calorie'::"text"))::boolean = true)))))));



CREATE POLICY "foods_update_policy" ON "public"."foods" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sparky_chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."water_intake" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."can_access_user_data"("target_user_id" "uuid", "permission_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_user_data"("target_user_id" "uuid", "permission_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_user_data"("target_user_id" "uuid", "permission_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_family_access"("p_family_user_id" "uuid", "p_owner_user_id" "uuid", "p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_family_access"("p_family_user_id" "uuid", "p_owner_user_id" "uuid", "p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_family_access"("p_family_user_id" "uuid", "p_owner_user_id" "uuid", "p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_old_chat_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_old_chat_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_old_chat_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_user_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_user_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_user_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_users"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_goals_for_date"("p_user_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_goals_for_date"("p_user_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_goals_for_date"("p_user_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_goal_timeline"("p_user_id" "uuid", "p_start_date" "date", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_water_goal" integer, "p_saturated_fat" numeric, "p_polyunsaturated_fat" numeric, "p_monounsaturated_fat" numeric, "p_trans_fat" numeric, "p_cholesterol" numeric, "p_sodium" numeric, "p_potassium" numeric, "p_dietary_fiber" numeric, "p_sugars" numeric, "p_vitamin_a" numeric, "p_vitamin_c" numeric, "p_calcium" numeric, "p_iron" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."manage_goal_timeline"("p_user_id" "uuid", "p_start_date" "date", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_water_goal" integer, "p_saturated_fat" numeric, "p_polyunsaturated_fat" numeric, "p_monounsaturated_fat" numeric, "p_trans_fat" numeric, "p_cholesterol" numeric, "p_sodium" numeric, "p_potassium" numeric, "p_dietary_fiber" numeric, "p_sugars" numeric, "p_vitamin_a" numeric, "p_vitamin_c" numeric, "p_calcium" numeric, "p_iron" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_goal_timeline"("p_user_id" "uuid", "p_start_date" "date", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_water_goal" integer, "p_saturated_fat" numeric, "p_polyunsaturated_fat" numeric, "p_monounsaturated_fat" numeric, "p_trans_fat" numeric, "p_cholesterol" numeric, "p_sodium" numeric, "p_potassium" numeric, "p_dietary_fiber" numeric, "p_sugars" numeric, "p_vitamin_a" numeric, "p_vitamin_c" numeric, "p_calcium" numeric, "p_iron" numeric) TO "service_role";


















GRANT ALL ON TABLE "public"."ai_service_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_service_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_service_settings" TO "service_role";



GRANT ALL ON TABLE "public"."check_in_measurements" TO "anon";
GRANT ALL ON TABLE "public"."check_in_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."check_in_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."custom_categories" TO "anon";
GRANT ALL ON TABLE "public"."custom_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_categories" TO "service_role";



GRANT ALL ON TABLE "public"."custom_measurements" TO "anon";
GRANT ALL ON TABLE "public"."custom_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_entries" TO "anon";
GRANT ALL ON TABLE "public"."exercise_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_entries" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."family_access" TO "anon";
GRANT ALL ON TABLE "public"."family_access" TO "authenticated";
GRANT ALL ON TABLE "public"."family_access" TO "service_role";



GRANT ALL ON TABLE "public"."food_entries" TO "anon";
GRANT ALL ON TABLE "public"."food_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."food_entries" TO "service_role";



GRANT ALL ON TABLE "public"."food_variants" TO "anon";
GRANT ALL ON TABLE "public"."food_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."food_variants" TO "service_role";



GRANT ALL ON TABLE "public"."foods" TO "anon";
GRANT ALL ON TABLE "public"."foods" TO "authenticated";
GRANT ALL ON TABLE "public"."foods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sparky_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."sparky_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sparky_chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."user_goals" TO "anon";
GRANT ALL ON TABLE "public"."user_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_goals" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."water_intake" TO "anon";
GRANT ALL ON TABLE "public"."water_intake" TO "authenticated";
GRANT ALL ON TABLE "public"."water_intake" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
