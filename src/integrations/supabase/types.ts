export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_service_settings: {
        Row: {
          api_key_iv: string | null
          created_at: string
          custom_url: string | null
          encrypted_api_key: string | null
          id: string
          is_active: boolean
          model_name: string | null
          service_name: string
          service_type: string
          system_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_iv?: string | null
          created_at?: string
          custom_url?: string | null
          encrypted_api_key?: string | null
          id?: string
          is_active?: boolean
          model_name?: string | null
          service_name: string
          service_type: string
          system_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_iv?: string | null
          created_at?: string
          custom_url?: string | null
          encrypted_api_key?: string | null
          id?: string
          is_active?: boolean
          model_name?: string | null
          service_name?: string
          service_type?: string
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_in_measurements: {
        Row: {
          created_at: string
          entry_date: string
          hips: number | null
          id: string
          neck: number | null
          steps: number | null
          updated_at: string
          user_id: string
          waist: number | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          entry_date?: string
          hips?: number | null
          id?: string
          neck?: number | null
          steps?: number | null
          updated_at?: string
          user_id: string
          waist?: number | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          entry_date?: string
          hips?: number | null
          id?: string
          neck?: number | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          waist?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      custom_categories: {
        Row: {
          created_at: string
          frequency: string
          id: string
          measurement_type: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency: string
          id?: string
          measurement_type: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          measurement_type?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_measurements: {
        Row: {
          category_id: string
          created_at: string
          entry_date: string
          entry_hour: number | null
          entry_timestamp: string
          id: string
          user_id: string
          value: number
        }
        Insert: {
          category_id: string
          created_at?: string
          entry_date: string
          entry_hour?: number | null
          entry_timestamp?: string
          id?: string
          user_id: string
          value: number
        }
        Update: {
          category_id?: string
          created_at?: string
          entry_date?: string
          entry_hour?: number | null
          entry_timestamp?: string
          id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_measurements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "custom_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_entries: {
        Row: {
          calories_burned: number
          created_at: string | null
          duration_minutes: number
          entry_date: string | null
          exercise_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          calories_burned: number
          created_at?: string | null
          duration_minutes: number
          entry_date?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          calories_burned?: number
          created_at?: string | null
          duration_minutes?: number
          entry_date?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_entries_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          calories_per_hour: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_custom: boolean | null
          name: string
          shared_with_public: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          calories_per_hour?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean | null
          name: string
          shared_with_public?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          calories_per_hour?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean | null
          name?: string
          shared_with_public?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      family_access: {
        Row: {
          access_end_date: string | null
          access_permissions: Json
          access_start_date: string
          created_at: string
          family_email: string
          family_user_id: string
          id: string
          is_active: boolean
          owner_user_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          access_end_date?: string | null
          access_permissions?: Json
          access_start_date?: string
          created_at?: string
          family_email: string
          family_user_id: string
          id?: string
          is_active?: boolean
          owner_user_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          access_end_date?: string | null
          access_permissions?: Json
          access_start_date?: string
          created_at?: string
          family_email?: string
          family_user_id?: string
          id?: string
          is_active?: boolean
          owner_user_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          created_at: string | null
          entry_date: string
          food_id: string
          id: string
          meal_type: string
          quantity: number
          unit: string | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          entry_date?: string
          food_id: string
          id?: string
          meal_type: string
          quantity?: number
          unit?: string | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          entry_date?: string
          food_id?: string
          id?: string
          meal_type?: string
          quantity?: number
          unit?: string | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "food_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      food_variants: {
        Row: {
          calcium: number | null
          calories: number | null
          carbs: number | null
          cholesterol: number | null
          created_at: string
          dietary_fiber: number | null
          fat: number | null
          food_id: string
          id: string
          iron: number | null
          monounsaturated_fat: number | null
          polyunsaturated_fat: number | null
          potassium: number | null
          protein: number | null
          saturated_fat: number | null
          serving_size: number
          serving_unit: string
          sodium: number | null
          sugars: number | null
          trans_fat: number | null
          updated_at: string
          vitamin_a: number | null
          vitamin_c: number | null
        }
        Insert: {
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string
          dietary_fiber?: number | null
          fat?: number | null
          food_id: string
          id?: string
          iron?: number | null
          monounsaturated_fat?: number | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          serving_size?: number
          serving_unit?: string
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string
          vitamin_a?: number | null
          vitamin_c?: number | null
        }
        Update: {
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string
          dietary_fiber?: number | null
          fat?: number | null
          food_id?: string
          id?: string
          iron?: number | null
          monounsaturated_fat?: number | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          serving_size?: number
          serving_unit?: string
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string
          vitamin_a?: number | null
          vitamin_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "food_variants_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          calcium: number | null
          calories: number | null
          carbs: number | null
          cholesterol: number | null
          created_at: string | null
          dietary_fiber: number | null
          fat: number | null
          id: string
          iron: number | null
          is_custom: boolean | null
          monounsaturated_fat: number | null
          name: string
          openfoodfacts_id: string | null
          polyunsaturated_fat: number | null
          potassium: number | null
          protein: number | null
          saturated_fat: number | null
          serving_size: number | null
          serving_unit: string | null
          shared_with_public: boolean | null
          sodium: number | null
          sugars: number | null
          trans_fat: number | null
          updated_at: string | null
          user_id: string | null
          vitamin_a: number | null
          vitamin_c: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string | null
          dietary_fiber?: number | null
          fat?: number | null
          id?: string
          iron?: number | null
          is_custom?: boolean | null
          monounsaturated_fat?: number | null
          name: string
          openfoodfacts_id?: string | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          shared_with_public?: boolean | null
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string | null
          user_id?: string | null
          vitamin_a?: number | null
          vitamin_c?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string | null
          dietary_fiber?: number | null
          fat?: number | null
          id?: string
          iron?: number | null
          is_custom?: boolean | null
          monounsaturated_fat?: number | null
          name?: string
          openfoodfacts_id?: string | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          serving_size?: number | null
          serving_unit?: string | null
          shared_with_public?: boolean | null
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string | null
          user_id?: string | null
          vitamin_a?: number | null
          vitamin_c?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sparky_chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          message: string | null
          message_type: string
          metadata: Json | null
          response: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string | null
          message_type: string
          metadata?: Json | null
          response?: string | null
          session_id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string | null
          message_type?: string
          metadata?: Json | null
          response?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          calcium: number | null
          calories: number | null
          carbs: number | null
          cholesterol: number | null
          created_at: string | null
          dietary_fiber: number | null
          fat: number | null
          goal_date: string | null
          id: string
          iron: number | null
          monounsaturated_fat: number | null
          polyunsaturated_fat: number | null
          potassium: number | null
          protein: number | null
          saturated_fat: number | null
          sodium: number | null
          sugars: number | null
          trans_fat: number | null
          updated_at: string | null
          user_id: string
          vitamin_a: number | null
          vitamin_c: number | null
          water_goal: number | null
        }
        Insert: {
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string | null
          dietary_fiber?: number | null
          fat?: number | null
          goal_date?: string | null
          id?: string
          iron?: number | null
          monounsaturated_fat?: number | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string | null
          user_id: string
          vitamin_a?: number | null
          vitamin_c?: number | null
          water_goal?: number | null
        }
        Update: {
          calcium?: number | null
          calories?: number | null
          carbs?: number | null
          cholesterol?: number | null
          created_at?: string | null
          dietary_fiber?: number | null
          fat?: number | null
          goal_date?: string | null
          id?: string
          iron?: number | null
          monounsaturated_fat?: number | null
          polyunsaturated_fat?: number | null
          potassium?: number | null
          protein?: number | null
          saturated_fat?: number | null
          sodium?: number | null
          sugars?: number | null
          trans_fat?: number | null
          updated_at?: string | null
          user_id?: string
          vitamin_a?: number | null
          vitamin_c?: number | null
          water_goal?: number | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_clear_history: string | null
          created_at: string
          date_format: string
          default_measurement_unit: string
          default_weight_unit: string
          id: string
          logging_level: string | null
          system_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_clear_history?: string | null
          created_at?: string
          date_format?: string
          default_measurement_unit?: string
          default_weight_unit?: string
          id?: string
          logging_level?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_clear_history?: string | null
          created_at?: string
          date_format?: string
          default_measurement_unit?: string
          default_weight_unit?: string
          id?: string
          logging_level?: string | null
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_intake: {
        Row: {
          created_at: string
          entry_date: string
          glasses_consumed: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          glasses_consumed?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          glasses_consumed?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_user_data: {
        Args: { target_user_id: string; permission_type: string }
        Returns: boolean
      }
      check_family_access: {
        Args: {
          p_family_user_id: string
          p_owner_user_id: string
          p_permission: string
        }
        Returns: boolean
      }
      clear_old_chat_history: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      get_accessible_users: {
        Args: { p_user_id: string }
        Returns: {
          user_id: string
          full_name: string
          email: string
          permissions: Json
          access_end_date: string
        }[]
      }
      get_goals_for_date: {
        Args: { p_user_id: string; p_date: string }
        Returns: {
          calories: number
          protein: number
          carbs: number
          fat: number
          water_goal: number
          saturated_fat: number
          polyunsaturated_fat: number
          monounsaturated_fat: number
          trans_fat: number
          cholesterol: number
          sodium: number
          potassium: number
          dietary_fiber: number
          sugars: number
          vitamin_a: number
          vitamin_c: number
          calcium: number
          iron: number
        }[]
      }
      manage_goal_timeline: {
        Args: {
          p_user_id: string
          p_start_date: string
          p_calories: number
          p_protein: number
          p_carbs: number
          p_fat: number
          p_water_goal: number
          p_saturated_fat?: number
          p_polyunsaturated_fat?: number
          p_monounsaturated_fat?: number
          p_trans_fat?: number
          p_cholesterol?: number
          p_sodium?: number
          p_potassium?: number
          p_dietary_fiber?: number
          p_sugars?: number
          p_vitamin_a?: number
          p_vitamin_c?: number
          p_calcium?: number
          p_iron?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
