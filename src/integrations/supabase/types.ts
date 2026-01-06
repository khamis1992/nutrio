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
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          message: string
          starts_at: string
          target_audience: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          starts_at?: string
          target_audience?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          starts_at?: string
          target_audience?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      featured_listings: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          package_type: string
          payment_reference: string | null
          price_paid: number
          restaurant_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          package_type: string
          payment_reference?: string | null
          price_paid: number
          restaurant_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          package_type?: string
          payment_reference?: string | null
          price_paid?: number
          restaurant_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_listings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_addons: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          meal_id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          meal_id: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          meal_id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_addons_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
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
          addons_total: number | null
          created_at: string
          delivery_fee: number | null
          delivery_type: string | null
          id: string
          is_completed: boolean | null
          meal_id: string
          meal_type: string
          order_status: string
          scheduled_date: string
          user_id: string
        }
        Insert: {
          addons_total?: number | null
          created_at?: string
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id: string
          meal_type: string
          order_status?: string
          scheduled_date: string
          user_id: string
        }
        Update: {
          addons_total?: number | null
          created_at?: string
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id?: string
          meal_type?: string
          order_status?: string
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
      notification_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          meal_reminders: boolean | null
          order_updates: boolean | null
          promotional_emails: boolean | null
          push_notifications: boolean | null
          reminder_time: string | null
          updated_at: string
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          order_updates?: boolean | null
          promotional_emails?: boolean | null
          push_notifications?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          order_updates?: boolean | null
          promotional_emails?: boolean | null
          push_notifications?: boolean | null
          reminder_time?: string | null
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          delivery_date: string
          id: string
          meal_type: string | null
          notes: string | null
          partner_earnings: number | null
          restaurant_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivery_date: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          partner_earnings?: number | null
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivery_date?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          partner_earnings?: number | null
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
      payouts: {
        Row: {
          amount: number
          commission_deducted: number | null
          commission_rate: number | null
          created_at: string
          id: string
          order_count: number
          partner_id: string
          payout_method: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          restaurant_id: string
          status: string
          total_order_value: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          commission_deducted?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          order_count?: number
          partner_id: string
          payout_method?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          restaurant_id: string
          status?: string
          total_order_value?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_deducted?: number | null
          commission_rate?: number | null
          created_at?: string
          id?: string
          order_count?: number
          partner_id?: string
          payout_method?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          restaurant_id?: string
          status?: string
          total_order_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      premium_analytics_purchases: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          package_type: string
          partner_id: string
          payment_reference: string | null
          price_paid: number
          restaurant_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          package_type: string
          partner_id: string
          payment_reference?: string | null
          price_paid: number
          restaurant_id: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          package_type?: string
          partner_id?: string
          payment_reference?: string | null
          price_paid?: number
          restaurant_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_analytics_purchases_restaurant_id_fkey"
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
          referral_code: string | null
          referral_rewards_earned: number | null
          referred_by: string | null
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
          referral_code?: string | null
          referral_rewards_earned?: number | null
          referred_by?: string | null
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
          referral_code?: string | null
          referral_rewards_earned?: number | null
          referred_by?: string | null
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
      promotion_usage: {
        Row: {
          discount_applied: number
          id: string
          order_id: string | null
          promotion_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          discount_applied: number
          id?: string
          order_id?: string | null
          promotion_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          discount_applied?: number
          id?: string
          order_id?: string | null
          promotion_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_order_amount: number | null
          name: string
          updated_at: string
          uses_count: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          name: string
          updated_at?: string
          uses_count?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          name?: string
          updated_at?: string
          uses_count?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string | null
          referrer_id: string
          reward_earned: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id?: string | null
          referrer_id: string
          reward_earned?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string | null
          referrer_id?: string
          reward_earned?: number | null
          status?: string
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
          owner_id: string | null
          phone: string | null
          premium_analytics_until: string | null
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
          owner_id?: string | null
          phone?: string | null
          premium_analytics_until?: string | null
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
          owner_id?: string | null
          phone?: string | null
          premium_analytics_until?: string | null
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          meal_id: string | null
          partner_response: string | null
          rating: number
          responded_at: string | null
          restaurant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          meal_id?: string | null
          partner_response?: string | null
          rating: number
          responded_at?: string | null
          restaurant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          meal_id?: string | null
          partner_response?: string | null
          rating?: number
          responded_at?: string | null
          restaurant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          quantity: number
          schedule_id: string
          unit_price: number
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          quantity?: number
          schedule_id: string
          unit_price: number
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          quantity?: number
          schedule_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "meal_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_addons_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string
          end_date: string
          id: string
          meals_per_week: number | null
          meals_used_this_week: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string
          user_id: string
          week_start_date: string | null
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string
          end_date: string
          id?: string
          meals_per_week?: number | null
          meals_used_this_week?: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          price: number
          start_date: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
          week_start_date?: string | null
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string
          end_date?: string
          id?: string
          meals_per_week?: number | null
          meals_used_this_week?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          price?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
          week_start_date?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_admin_reply: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          delivery_instructions: string | null
          id: string
          is_default: boolean | null
          label: string
          phone: string | null
          postal_code: string
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string
          created_at?: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          phone?: string | null
          postal_code: string
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          phone?: string | null
          postal_code?: string
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_dietary_preferences: {
        Row: {
          created_at: string
          diet_tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diet_tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          diet_tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dietary_preferences_diet_tag_id_fkey"
            columns: ["diet_tag_id"]
            isOneToOne: false
            referencedRelation: "diet_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorite_restaurants: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      generate_partner_payout: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_restaurant_id: string
        }
        Returns: string
      }
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
      increment_meal_usage: {
        Args: { subscription_id: string }
        Returns: boolean
      }
      reset_weekly_meal_quotas: { Args: never; Returns: undefined }
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
      discount_type: "percentage" | "fixed"
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
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      discount_type: ["percentage", "fixed"],
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
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
