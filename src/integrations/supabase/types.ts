export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      diet_tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      meal_diet_tags: {
        Row: {
          diet_tag_id: string
          meal_id: string
        }
        Insert: {
          diet_tag_id: string
          meal_id: string
        }
        Update: {
          diet_tag_id?: string
          meal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_diet_tags_diet_tag_id_fkey"
            columns: ["diet_tag_id"]
            isOneToOne: false
            referencedRelation: "diet_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_diet_tags_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_schedules: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean | null
          meal_id: string
          meal_type: string
          scheduled_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          meal_id: string
          meal_type: string
          scheduled_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean | null
          meal_id?: string
          meal_type?: string
          scheduled_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_schedules_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          description: string | null
          fat_g: number
          fiber_g: number | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          order_count: number | null
          prep_time_minutes: number | null
          price: number
          protein_g: number
          rating: number | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          calories: number
          carbs_g: number
          created_at?: string
          description?: string | null
          fat_g: number
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          order_count?: number | null
          prep_time_minutes?: number | null
          price: number
          protein_g: number
          rating?: number | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          description?: string | null
          fat_g?: number
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          order_count?: number | null
          prep_time_minutes?: number | null
          price?: number
          protein_g?: number
          rating?: number | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          meal_id: string | null
          order_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          meal_id?: string | null
          order_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          meal_id?: string | null
          order_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_date: string
          id: string
          meal_type: string | null
          notes: string | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_date: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_date?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          age: number | null
          avatar_url: string | null
          carbs_target_g: number | null
          created_at: string
          current_weight_kg: number | null
          daily_calorie_target: number | null
          fat_target_g: number | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          health_goal: Database["public"]["Enums"]["health_goal"] | null
          height_cm: number | null
          id: string
          onboarding_completed: boolean | null
          protein_target_g: number | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          age?: number | null
          avatar_url?: string | null
          carbs_target_g?: number | null
          created_at?: string
          current_weight_kg?: number | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          health_goal?: Database["public"]["Enums"]["health_goal"] | null
          height_cm?: number | null
          id?: string
          onboarding_completed?: boolean | null
          protein_target_g?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          age?: number | null
          avatar_url?: string | null
          carbs_target_g?: number | null
          created_at?: string
          current_weight_kg?: number | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          health_goal?: Database["public"]["Enums"]["health_goal"] | null
          height_cm?: number | null
          id?: string
          onboarding_completed?: boolean | null
          protein_target_g?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          calories_consumed: number | null
          carbs_consumed_g: number | null
          created_at: string
          fat_consumed_g: number | null
          id: string
          log_date: string
          notes: string | null
          protein_consumed_g: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          calories_consumed?: number | null
          carbs_consumed_g?: number | null
          created_at?: string
          fat_consumed_g?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          protein_consumed_g?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          calories_consumed?: number | null
          carbs_consumed_g?: number | null
          created_at?: string
          fat_consumed_g?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          protein_consumed_g?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          rating: number | null
          total_orders: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string
          end_date: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string
          end_date: string
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string
          end_date?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "very_active"
      app_role: "user" | "partner" | "admin"
      approval_status: "pending" | "approved" | "rejected"
      gender_type: "male" | "female"
      health_goal: "lose" | "gain" | "maintain"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "delivered"
        | "cancelled"
      subscription_plan: "weekly" | "monthly"
      subscription_status: "active" | "cancelled" | "expired" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_level: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ],
      app_role: ["user", "partner", "admin"],
      approval_status: ["pending", "approved", "rejected"],
      gender_type: ["male", "female"],
      health_goal: ["lose", "gain", "maintain"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "delivered",
        "cancelled",
      ],
      subscription_plan: ["weekly", "monthly"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
    },
  },
} as const
