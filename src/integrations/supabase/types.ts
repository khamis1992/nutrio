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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          badge_id: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ar: string | null
          reward_xp: number | null
          sort_order: number | null
          threshold_value: number
          type: string
        }
        Insert: {
          badge_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          reward_xp?: number | null
          sort_order?: number | null
          threshold_value?: number
          type?: string
        }
        Update: {
          badge_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          reward_xp?: number | null
          sort_order?: number | null
          threshold_value?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_definitions_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "user_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          badge_color: string | null
          category: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          requirement_type: string | null
          requirement_value: number | null
        }
        Insert: {
          badge_color?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Update: {
          badge_color?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Relationships: []
      }
      adaptive_goal_settings: {
        Row: {
          adjustment_frequency: string | null
          auto_adjust_enabled: boolean | null
          created_at: string | null
          id: string
          max_calorie_ceiling: number | null
          min_calorie_floor: number | null
          updated_at: string | null
          user_id: string
          weight_change_threshold_kg: number | null
        }
        Insert: {
          adjustment_frequency?: string | null
          auto_adjust_enabled?: boolean | null
          created_at?: string | null
          id?: string
          max_calorie_ceiling?: number | null
          min_calorie_floor?: number | null
          updated_at?: string | null
          user_id: string
          weight_change_threshold_kg?: number | null
        }
        Update: {
          adjustment_frequency?: string | null
          auto_adjust_enabled?: boolean | null
          created_at?: string | null
          id?: string
          max_calorie_ceiling?: number | null
          min_calorie_floor?: number | null
          updated_at?: string | null
          user_id?: string
          weight_change_threshold_kg?: number | null
        }
        Relationships: []
      }
      addon_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      addons: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ar: string | null
          price: number
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          price?: number
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          price?: number
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "addon_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      affiliate_applications: {
        Row: {
          application_note: string | null
          applied_at: string
          created_at: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          application_note?: string | null
          applied_at?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          application_note?: string | null
          applied_at?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          order_amount: number
          order_id: string | null
          paid_at: string | null
          source_user_id: string
          status: string
          tier: number
          user_id: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          created_at?: string
          id?: string
          order_amount?: number
          order_id?: string | null
          paid_at?: string | null
          source_user_id: string
          status?: string
          tier: number
          user_id: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_amount?: number
          order_id?: string | null
          paid_at?: string | null
          source_user_id?: string
          status?: string
          tier?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          amount: number
          id: string
          notes: string | null
          payout_details: Json | null
          payout_method: string | null
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      allergen_tags: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          name_ar: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          name_ar?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          severity?: string | null
        }
        Relationships: []
      }
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
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          starts_at?: string
          target_audience: string
          title: string
          type: string
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
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          partner_id: string | null
          request_body: Json | null
          response_body: Json | null
          response_time_ms: number | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          partner_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_time_ms?: number | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          partner_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_time_ms?: number | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string | null
          description: string
          icon: string
          id: string
          name: string
          rarity: string
          requirement_type: string
          requirement_value: number
          xp_reward: number
        }
        Insert: {
          created_at?: string | null
          description: string
          icon: string
          id: string
          name: string
          rarity?: string
          requirement_type: string
          requirement_value?: number
          xp_reward?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          name?: string
          rarity?: string
          requirement_type?: string
          requirement_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      behavior_predictions: {
        Row: {
          action_metadata: Json | null
          boredom_risk_score: number
          churn_risk_score: number
          created_at: string | null
          engagement_score: number
          expires_at: string | null
          id: string
          recommended_action: string
          user_id: string
        }
        Insert: {
          action_metadata?: Json | null
          boredom_risk_score: number
          churn_risk_score: number
          created_at?: string | null
          engagement_score: number
          expires_at?: string | null
          id?: string
          recommended_action: string
          user_id: string
        }
        Update: {
          action_metadata?: Json | null
          boredom_risk_score?: number
          churn_risk_score?: number
          created_at?: string | null
          engagement_score?: number
          expires_at?: string | null
          id?: string
          recommended_action?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_by: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          ip_address: unknown
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      blood_marker_definitions: {
        Row: {
          category: string
          description: string | null
          description_ar: string | null
          id: string
          marker_name: string
          marker_name_ar: string | null
          normal_max: number | null
          normal_min: number | null
          unit: string
        }
        Insert: {
          category: string
          description?: string | null
          description_ar?: string | null
          id?: string
          marker_name: string
          marker_name_ar?: string | null
          normal_max?: number | null
          normal_min?: number | null
          unit: string
        }
        Update: {
          category?: string
          description?: string | null
          description_ar?: string | null
          id?: string
          marker_name?: string
          marker_name_ar?: string | null
          normal_max?: number | null
          normal_min?: number | null
          unit?: string
        }
        Relationships: []
      }
      blood_markers: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          marker_name: string
          marker_name_ar: string | null
          normal_max: number | null
          normal_min: number | null
          notes: string | null
          record_id: string
          status: string | null
          unit: string
          value: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          marker_name: string
          marker_name_ar?: string | null
          normal_max?: number | null
          normal_min?: number | null
          notes?: string | null
          record_id: string
          status?: string | null
          unit: string
          value: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          marker_name?: string
          marker_name_ar?: string | null
          normal_max?: number | null
          normal_min?: number | null
          notes?: string | null
          record_id?: string
          status?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "blood_markers_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "blood_work_records"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_work_records: {
        Row: {
          ai_analysis: string | null
          created_at: string | null
          fasting: boolean | null
          id: string
          lab_name: string | null
          report_url: string | null
          status: string | null
          test_date: string
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string | null
          fasting?: boolean | null
          id?: string
          lab_name?: string | null
          report_url?: string | null
          status?: string | null
          test_date: string
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string | null
          fasting?: boolean | null
          id?: string
          lab_name?: string | null
          report_url?: string | null
          status?: string | null
          test_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_work_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          body_fat_percent: number | null
          chest_cm: number | null
          created_at: string | null
          hip_cm: number | null
          id: string
          log_date: string
          muscle_mass_percent: number | null
          notes: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          chest_cm?: number | null
          created_at?: string | null
          hip_cm?: number | null
          id?: string
          log_date: string
          muscle_mass_percent?: number | null
          notes?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          chest_cm?: number | null
          created_at?: string | null
          hip_cm?: number | null
          id?: string
          log_date?: string
          muscle_mass_percent?: number | null
          notes?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      cancellation_attempts: {
        Row: {
          cancellation_reason: string | null
          created_at: string | null
          final_action: string | null
          id: string
          offer_accepted: boolean | null
          offer_shown: string | null
          reason_details: string | null
          resolved_at: string | null
          retained_until: string | null
          step_reached: number
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string | null
          final_action?: string | null
          id?: string
          offer_accepted?: boolean | null
          offer_shown?: string | null
          reason_details?: string | null
          resolved_at?: string | null
          retained_until?: string | null
          step_reached: number
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string | null
          final_action?: string | null
          id?: string
          offer_accepted?: boolean | null
          offer_shown?: string | null
          reason_details?: string | null
          resolved_at?: string | null
          retained_until?: string | null
          step_reached?: number
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_attempts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          description_ar: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          max_participants: number | null
          name: string
          name_ar: string | null
          reward_badge_id: string | null
          reward_description: string | null
          reward_xp: number | null
          start_date: string
          target_unit: string | null
          target_value: number
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          name: string
          name_ar?: string | null
          reward_badge_id?: string | null
          reward_description?: string | null
          reward_xp?: number | null
          start_date: string
          target_unit?: string | null
          target_value?: number
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          name?: string
          name_ar?: string | null
          reward_badge_id?: string | null
          reward_description?: string | null
          reward_xp?: number | null
          start_date?: string
          target_unit?: string | null
          target_value?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string | null
          completed_at: string | null
          current_progress: number | null
          id: string
          joined_at: string
          user_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          joined_at?: string
          user_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          completed_at?: string | null
          current_progress?: number | null
          id?: string
          joined_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "community_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          message_type: string
          metadata: Json | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message?: string
          message_type?: string
          metadata?: Json | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country: string
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          name_ar: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          name_ar?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          name_ar?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      community_challenges: {
        Row: {
          badge_icon: string | null
          category: string | null
          challenge_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          end_date: string
          id: string
          is_active: boolean | null
          leaderboard_id: string | null
          participant_count: number | null
          reward_points: number | null
          start_date: string
          target_value: number
          title: string
          xp_reward: number | null
        }
        Insert: {
          badge_icon?: string | null
          category?: string | null
          challenge_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          leaderboard_id?: string | null
          participant_count?: number | null
          reward_points?: number | null
          start_date: string
          target_value: number
          title: string
          xp_reward?: number | null
        }
        Update: {
          badge_icon?: string | null
          category?: string | null
          challenge_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          leaderboard_id?: string | null
          participant_count?: number | null
          reward_points?: number | null
          start_date?: string
          target_value?: number
          title?: string
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_challenges_leaderboard_id_fkey"
            columns: ["leaderboard_id"]
            isOneToOne: false
            referencedRelation: "leaderboards"
            referencedColumns: ["id"]
          },
        ]
      }
      cuisine_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ar: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      customer_wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          total_credits: number | null
          total_debits: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          total_credits?: number | null
          total_debits?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          total_credits?: number | null
          total_debits?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          calories_consumed: number | null
          calories_target: number | null
          carbs_consumed: number | null
          created_at: string | null
          date: string
          exercise_minutes: number | null
          fat_consumed: number | null
          id: string
          mood: string | null
          notes: string | null
          protein_consumed: number | null
          sleep_hours: number | null
          steps: number | null
          updated_at: string | null
          user_id: string
          water_glasses: number | null
        }
        Insert: {
          calories_consumed?: number | null
          calories_target?: number | null
          carbs_consumed?: number | null
          created_at?: string | null
          date?: string
          exercise_minutes?: number | null
          fat_consumed?: number | null
          id?: string
          mood?: string | null
          notes?: string | null
          protein_consumed?: number | null
          sleep_hours?: number | null
          steps?: number | null
          updated_at?: string | null
          user_id: string
          water_glasses?: number | null
        }
        Update: {
          calories_consumed?: number | null
          calories_target?: number | null
          carbs_consumed?: number | null
          created_at?: string | null
          date?: string
          exercise_minutes?: number | null
          fat_consumed?: number | null
          id?: string
          mood?: string | null
          notes?: string | null
          protein_consumed?: number | null
          sleep_hours?: number | null
          steps?: number | null
          updated_at?: string | null
          user_id?: string
          water_glasses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_margin_reports: {
        Row: {
          active_subscriptions: number | null
          created_at: string | null
          gross_margin: number | null
          gross_margin_percentage: number | null
          id: string
          new_subscriptions_revenue: number | null
          recurring_subscriptions_revenue: number | null
          report_date: string
          total_delivery_costs: number | null
          total_meals_served: number | null
          total_operational_costs: number | null
          total_restaurant_payouts: number | null
          total_subscription_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          active_subscriptions?: number | null
          created_at?: string | null
          gross_margin?: number | null
          gross_margin_percentage?: number | null
          id?: string
          new_subscriptions_revenue?: number | null
          recurring_subscriptions_revenue?: number | null
          report_date: string
          total_delivery_costs?: number | null
          total_meals_served?: number | null
          total_operational_costs?: number | null
          total_restaurant_payouts?: number | null
          total_subscription_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          active_subscriptions?: number | null
          created_at?: string | null
          gross_margin?: number | null
          gross_margin_percentage?: number | null
          id?: string
          new_subscriptions_revenue?: number | null
          recurring_subscriptions_revenue?: number | null
          report_date?: string
          total_delivery_costs?: number | null
          total_meals_served?: number | null
          total_operational_costs?: number | null
          total_restaurant_payouts?: number | null
          total_subscription_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          driver_id: string | null
          estimated_distance_km: number | null
          id: string
          picked_up_at: string | null
          pickup_address: string
          qr_generated_at: string | null
          qr_verification_hash: string | null
          restaurant_id: string
          schedule_id: string
          status: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          id?: string
          picked_up_at?: string | null
          pickup_address: string
          qr_generated_at?: string | null
          qr_verification_hash?: string | null
          restaurant_id: string
          schedule_id: string
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          id?: string
          picked_up_at?: string | null
          pickup_address?: string
          qr_generated_at?: string | null
          qr_verification_hash?: string | null
          restaurant_id?: string
          schedule_id?: string
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey1"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey1"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey1"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey1"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "deliveries_schedule_id_fkey1"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_schedule_id_fkey1"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries_legacy: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          driver_id: string | null
          estimated_distance_km: number | null
          id: string
          order_id: string | null
          picked_up_at: string | null
          pickup_address: string | null
          restaurant_id: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          id?: string
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          restaurant_id?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          id?: string
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          restaurant_id?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          tip_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "deliveries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_groups: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_time_slot: string | null
          estimated_delivery_minutes: number | null
          estimated_distance_km: number | null
          group_code: string | null
          id: string
          route_sequence: number[] | null
          scheduled_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_time_slot?: string | null
          estimated_delivery_minutes?: number | null
          estimated_distance_km?: number | null
          group_code?: string | null
          id?: string
          route_sequence?: number[] | null
          scheduled_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_time_slot?: string | null
          estimated_delivery_minutes?: number | null
          estimated_distance_km?: number | null
          group_code?: string | null
          id?: string
          route_sequence?: number[] | null
          scheduled_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_jobs: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          assignment_attempted_at: string | null
          assignment_locked_until: string | null
          created_at: string | null
          customer_otp: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          driver_earnings: number | null
          driver_id: string | null
          estimated_distance_km: number | null
          failed_at: string | null
          failure_reason: string | null
          handover_method: string | null
          id: string
          is_verification_locked: boolean | null
          picked_up_at: string | null
          pickup_address: string | null
          pickup_photo_url: string | null
          pickup_verification_code: string | null
          qr_generated_at: string | null
          qr_scanned_at: string | null
          qr_verification_hash: string | null
          restaurant_id: string | null
          schedule_id: string
          status: string | null
          tip_amount: number | null
          updated_at: string | null
          verification_attempts: number | null
          verification_code_hash: string | null
          verification_expires_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          assignment_attempted_at?: string | null
          assignment_locked_until?: string | null
          created_at?: string | null
          customer_otp?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          failed_at?: string | null
          failure_reason?: string | null
          handover_method?: string | null
          id?: string
          is_verification_locked?: boolean | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_photo_url?: string | null
          pickup_verification_code?: string | null
          qr_generated_at?: string | null
          qr_scanned_at?: string | null
          qr_verification_hash?: string | null
          restaurant_id?: string | null
          schedule_id: string
          status?: string | null
          tip_amount?: number | null
          updated_at?: string | null
          verification_attempts?: number | null
          verification_code_hash?: string | null
          verification_expires_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          assignment_attempted_at?: string | null
          assignment_locked_until?: string | null
          created_at?: string | null
          customer_otp?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          failed_at?: string | null
          failure_reason?: string | null
          handover_method?: string | null
          id?: string
          is_verification_locked?: boolean | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_photo_url?: string | null
          pickup_verification_code?: string | null
          qr_generated_at?: string | null
          qr_scanned_at?: string | null
          qr_verification_hash?: string | null
          restaurant_id?: string | null
          schedule_id?: string
          status?: string | null
          tip_amount?: number | null
          updated_at?: string | null
          verification_attempts?: number | null
          verification_code_hash?: string | null
          verification_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_jobs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "delivery_jobs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_queue: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          assigned_driver_id: string | null
          assignment_attempts: number | null
          completed_at: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          escalated_at: string | null
          escalated_by: string | null
          escalation_reason: string | null
          estimated_delivery_time: string | null
          expires_at: string | null
          id: string
          manual_assignment_notes: string | null
          metadata: Json | null
          order_id: string
          previous_driver_ids: string[] | null
          priority_reason: string | null
          priority_score: number | null
          queued_at: string | null
          restaurant_id: string | null
          status: string
          tip_amount: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          assignment_attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_reason?: string | null
          estimated_delivery_time?: string | null
          expires_at?: string | null
          id?: string
          manual_assignment_notes?: string | null
          metadata?: Json | null
          order_id: string
          previous_driver_ids?: string[] | null
          priority_reason?: string | null
          priority_score?: number | null
          queued_at?: string | null
          restaurant_id?: string | null
          status?: string
          tip_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_driver_id?: string | null
          assignment_attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalation_reason?: string | null
          estimated_delivery_time?: string | null
          expires_at?: string | null
          id?: string
          manual_assignment_notes?: string | null
          metadata?: Json | null
          order_id?: string
          previous_driver_ids?: string[] | null
          priority_reason?: string | null
          priority_score?: number | null
          queued_at?: string | null
          restaurant_id?: string | null
          status?: string
          tip_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_queue_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      delivery_status_history: {
        Row: {
          changed_by: string | null
          changed_by_role: string | null
          created_at: string | null
          delivery_id: string
          id: string
          new_status: string
          previous_status: string | null
          verification_data: Json | null
          verification_method: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string | null
          delivery_id: string
          id?: string
          new_status: string
          previous_status?: string | null
          verification_data?: Json | null
          verification_method?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string | null
          delivery_id?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          verification_data?: Json | null
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          area: unknown
          created_at: string | null
          delivery_fee: number
          estimated_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          area?: unknown
          created_at?: string | null
          delivery_fee?: number
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          area?: unknown
          created_at?: string | null
          delivery_fee?: number
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          sort_order?: number | null
          updated_at?: string | null
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
      driver_activity_log: {
        Row: {
          activity_type: string
          created_at: string | null
          details: Json | null
          driver_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          details?: Json | null
          driver_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          details?: Json | null
          driver_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      driver_assignment_history: {
        Row: {
          action: string
          driver_id: string | null
          id: string
          job_id: string | null
          performed_at: string | null
          performed_by: string | null
          reason: string | null
        }
        Insert: {
          action: string
          driver_id?: string | null
          id?: string
          job_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          driver_id?: string | null
          id?: string
          job_id?: string | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignment_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignment_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string | null
          document_type: string
          document_url: string
          driver_id: string
          expiry_date: string | null
          id: string
          rejection_reason: string | null
          updated_at: string | null
          uploaded_at: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          document_url: string
          driver_id: string
          expiry_date?: string | null
          id?: string
          rejection_reason?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          document_url?: string
          driver_id?: string
          expiry_date?: string | null
          id?: string
          rejection_reason?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "fleet_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earning_rules: {
        Row: {
          base_amount: number
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          max_earning: number | null
          min_earning: number | null
          name: string
          percentage_of_delivery_fee: number
          priority: number
          rule_type: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          base_amount?: number
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_earning?: number | null
          min_earning?: number | null
          name: string
          percentage_of_delivery_fee?: number
          priority?: number
          rule_type: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          base_amount?: number
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_earning?: number | null
          min_earning?: number | null
          name?: string
          percentage_of_delivery_fee?: number
          priority?: number
          rule_type?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          driver_id: string
          earning_type: string
          id: string
          order_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          driver_id: string
          earning_type?: string
          id?: string
          order_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          driver_id?: string
          earning_type?: string
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy_meters: number | null
          driver_id: string
          heading: number | null
          id: string
          location: unknown
          speed_kmh: number | null
          timestamp: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          location: unknown
          speed_kmh?: number | null
          timestamp?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          location?: unknown
          speed_kmh?: number | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_orders: {
        Row: {
          assigned_at: string | null
          delivered_at: string | null
          driver_id: string
          failed_at: string | null
          id: string
          notes: string | null
          order_id: string
          picked_up_at: string | null
          status: string
        }
        Insert: {
          assigned_at?: string | null
          delivered_at?: string | null
          driver_id: string
          failed_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          status?: string
        }
        Update: {
          assigned_at?: string | null
          delivered_at?: string | null
          driver_id?: string
          failed_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          country: string | null
          created_at: string | null
          driver_id: string
          id: string
          payout_details: Json | null
          payout_method: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          country?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          country?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string | null
          current_heading: number | null
          current_location: unknown
          current_speed: number | null
          id: string
          is_available: boolean | null
          license_expiry: string | null
          license_number: string | null
          location_updated_at: string | null
          rating: number | null
          status: string
          total_deliveries: number | null
          total_earnings: number | null
          total_ratings: number | null
          updated_at: string | null
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_heading?: number | null
          current_location?: unknown
          current_speed?: number | null
          id?: string
          is_available?: boolean | null
          license_expiry?: string | null
          license_number?: string | null
          location_updated_at?: string | null
          rating?: number | null
          status?: string
          total_deliveries?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_heading?: number | null
          current_location?: unknown
          current_speed?: number | null
          id?: string
          is_available?: boolean | null
          license_expiry?: string | null
          license_number?: string | null
          location_updated_at?: string | null
          rating?: number | null
          status?: string
          total_deliveries?: number | null
          total_earnings?: number | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          delivery_id: string
          driver_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          delivery_id: string
          driver_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          delivery_id?: string
          driver_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_reviews_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "deliveries_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          created_at: string | null
          driver_id: string
          end_time: string | null
          id: string
          notes: string | null
          start_time: string
          status: string
          total_deliveries: number | null
          total_earnings: number | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          total_deliveries?: number | null
          total_earnings?: number | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          total_deliveries?: number | null
          total_earnings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          driver_id: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          driver_id: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          driver_id?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_withdrawals: {
        Row: {
          account_holder_name: string | null
          amount: number
          bank_account_number: string | null
          bank_name: string | null
          created_at: string | null
          driver_id: string
          id: string
          payment_method: string | null
          processed_at: string | null
          rejection_reason: string | null
          status: string | null
          transaction_reference: string | null
          updated_at: string | null
        }
        Insert: {
          account_holder_name?: string | null
          amount: number
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          driver_id: string
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          account_holder_name?: string | null
          amount?: number
          bank_account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          driver_id?: string
          id?: string
          payment_method?: string | null
          processed_at?: string | null
          rejection_reason?: string | null
          status?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_withdrawals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          assigned_zone_ids: string[] | null
          cancellation_rate: number | null
          city_id: string | null
          country: string | null
          created_at: string | null
          current_job_id: string | null
          current_lat: number | null
          current_lng: number | null
          current_location: unknown
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_location_at: string | null
          last_location_update: string | null
          license_number: string | null
          license_plate: string | null
          phone_number: string | null
          rating: number | null
          status: string | null
          total_deliveries: number | null
          total_earnings: number | null
          updated_at: string | null
          user_id: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance: number | null
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          assigned_zone_ids?: string[] | null
          cancellation_rate?: number | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          current_job_id?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: unknown
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_at?: string | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          phone_number?: string | null
          rating?: number | null
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance?: number | null
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          assigned_zone_ids?: string[] | null
          cancellation_rate?: number | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          current_job_id?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: unknown
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_at?: string | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          phone_number?: string | null
          rating?: number | null
          status?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_schedule: {
        Row: {
          created_at: string | null
          function_name: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          run_interval_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          function_name: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          run_interval_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          function_name?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          run_interval_minutes?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          invoice_id: string | null
          recipient_email: string
          recipient_name: string | null
          resend_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_logs: {
        Row: {
          calories_burned: number | null
          created_at: string | null
          date: string
          duration_minutes: number | null
          exercise_type: string
          id: string
          intensity: string | null
          notes: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          exercise_type: string
          id?: string
          intensity?: string | null
          notes?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          calories_burned?: number | null
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          exercise_type?: string
          id?: string
          intensity?: string | null
          notes?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq: {
        Row: {
          answer: string
          answer_ar: string | null
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          question: string
          question_ar: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          answer: string
          answer_ar?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          question_ar?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          answer?: string
          answer_ar?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          question_ar?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          meal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_listings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_listings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_response: string | null
          created_at: string | null
          feedback_type: string
          id: string
          message: string
          metadata: Json | null
          rating: number | null
          resolved_at: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          message: string
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_programs: {
        Row: {
          category: string | null
          created_at: string
          current_participants: number | null
          days_per_week: number | null
          description: string | null
          difficulty_level: string | null
          duration_minutes: number | null
          gym_id: string
          id: string
          is_active: boolean | null
          max_participants: number | null
          price: number | null
          recurring_schedule: Json | null
          time_slot: string | null
          title: string
          trainer_name: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_participants?: number | null
          days_per_week?: number | null
          description?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          gym_id: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          price?: number | null
          recurring_schedule?: Json | null
          time_slot?: string | null
          title: string
          trainer_name?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_participants?: number | null
          days_per_week?: number | null
          description?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          gym_id?: string
          id?: string
          is_active?: boolean | null
          max_participants?: number | null
          price?: number | null
          recurring_schedule?: Json | null
          time_slot?: string | null
          title?: string
          trainer_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fleet_activity_log: {
        Row: {
          action: string
          city_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          manager_id: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          city_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          manager_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          city_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          manager_id?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_activity_log_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_activity_log_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "fleet_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_managers: {
        Row: {
          assigned_city_ids: string[] | null
          auth_user_id: string | null
          country: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          assigned_city_ids?: string[] | null
          auth_user_id?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          assigned_city_ids?: string[] | null
          auth_user_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gamification_log: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_export_logs: {
        Row: {
          created_at: string | null
          data_size_bytes: number | null
          exported_by: string
          id: string
          ip_address: unknown
          is_admin_export: boolean | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_size_bytes?: number | null
          exported_by: string
          id?: string
          ip_address?: unknown
          is_admin_export?: boolean | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_size_bytes?: number | null
          exported_by?: string
          id?: string
          ip_address?: unknown
          is_admin_export?: boolean | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goal_adjustment_history: {
        Row: {
          adherence_rate: number | null
          adjustment_date: string
          ai_confidence: number | null
          applied: boolean | null
          created_at: string | null
          id: string
          new_calories: number
          new_macros: Json
          plateau_detected: boolean | null
          previous_calories: number
          previous_macros: Json
          reason: string
          user_id: string
          weight_change_kg: number | null
        }
        Insert: {
          adherence_rate?: number | null
          adjustment_date: string
          ai_confidence?: number | null
          applied?: boolean | null
          created_at?: string | null
          id?: string
          new_calories: number
          new_macros: Json
          plateau_detected?: boolean | null
          previous_calories: number
          previous_macros: Json
          reason: string
          user_id: string
          weight_change_kg?: number | null
        }
        Update: {
          adherence_rate?: number | null
          adjustment_date?: string
          ai_confidence?: number | null
          applied?: boolean | null
          created_at?: string | null
          id?: string
          new_calories?: number
          new_macros?: Json
          plateau_detected?: boolean | null
          previous_calories?: number
          previous_macros?: Json
          reason?: string
          user_id?: string
          weight_change_kg?: number | null
        }
        Relationships: []
      }
      gym_access: {
        Row: {
          from_date: string | null
          gym_id: string | null
          id: string
          to_date: string | null
          user_id: string | null
        }
        Insert: {
          from_date?: string | null
          gym_id?: string | null
          id?: string
          to_date?: string | null
          user_id?: string | null
        }
        Update: {
          from_date?: string | null
          gym_id?: string | null
          id?: string
          to_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_access_log: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          gym_id: string
          id: string
          user_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          gym_id: string
          id?: string
          user_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gym_partner_analytics: {
        Row: {
          active_programs: number | null
          created_at: string | null
          date: string
          gym_id: string
          id: string
          member_retention_rate: number | null
          new_members: number | null
          peak_hours: Json | null
          popular_programs: Json | null
          revenue: number | null
          total_visits: number | null
        }
        Insert: {
          active_programs?: number | null
          created_at?: string | null
          date: string
          gym_id: string
          id?: string
          member_retention_rate?: number | null
          new_members?: number | null
          peak_hours?: Json | null
          popular_programs?: Json | null
          revenue?: number | null
          total_visits?: number | null
        }
        Update: {
          active_programs?: number | null
          created_at?: string | null
          date?: string
          gym_id?: string
          id?: string
          member_retention_rate?: number | null
          new_members?: number | null
          peak_hours?: Json | null
          popular_programs?: Json | null
          revenue?: number | null
          total_visits?: number | null
        }
        Relationships: []
      }
      gym_partner_profiles: {
        Row: {
          address: string | null
          amenities: string[] | null
          business_name: string
          contact_person: string
          created_at: string | null
          description: string | null
          email: string | null
          gym_id: string
          id: string
          is_active: boolean | null
          operating_hours: Json | null
          phone: string | null
          social_media_links: Json | null
          specializations: string[] | null
          updated_at: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          business_name: string
          contact_person: string
          created_at?: string | null
          description?: string | null
          email?: string | null
          gym_id: string
          id?: string
          is_active?: boolean | null
          operating_hours?: Json | null
          phone?: string | null
          social_media_links?: Json | null
          specializations?: string[] | null
          updated_at?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          business_name?: string
          contact_person?: string
          created_at?: string | null
          description?: string | null
          email?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean | null
          operating_hours?: Json | null
          phone?: string | null
          social_media_links?: Json | null
          specializations?: string[] | null
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      health_tips: {
        Row: {
          category: string | null
          content: string
          content_ar: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          language: string | null
          title: string
          title_ar: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          content_ar?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          content_ar?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          current_stock: number
          description: string | null
          expiry_date: string | null
          id: string
          is_active: boolean | null
          last_restocked_at: string | null
          maximum_stock: number | null
          minimum_stock: number
          name: string
          restaurant_id: string | null
          supplier_id: string | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          last_restocked_at?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          name: string
          restaurant_id?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean | null
          last_restocked_at?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          name?: string
          restaurant_id?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          cost_per_unit: number | null
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          quantity: number
          reference_id: string | null
          total_cost: number | null
          transaction_type: string
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          quantity: number
          reference_id?: string | null
          total_cost?: number | null
          transaction_type: string
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          total_cost?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          driver_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: string
          metadata: Json | null
          paid_at: string | null
          pdf_url: string | null
          restaurant_id: string | null
          sent_at: string | null
          status: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type: string
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      kitchen_queue: {
        Row: {
          actual_prep_time: number | null
          assigned_staff_id: string | null
          completed_at: string | null
          created_at: string
          estimated_prep_time: number | null
          id: string
          notes: string | null
          order_id: string | null
          priority_level: number | null
          started_at: string | null
          station: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          actual_prep_time?: number | null
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_prep_time?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          priority_level?: number | null
          started_at?: string | null
          station?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          actual_prep_time?: number | null
          assigned_staff_id?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_prep_time?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          priority_level?: number | null
          started_at?: string | null
          station?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_queue_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          created_at: string
          id: string
          leaderboard_id: string | null
          rank: number | null
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leaderboard_id?: string | null
          rank?: number | null
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leaderboard_id?: string | null
          rank?: number | null
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_leaderboard_id_fkey"
            columns: ["leaderboard_id"]
            isOneToOne: false
            referencedRelation: "leaderboards"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          leaderboard_type: string
          metric_type: string
          name: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          leaderboard_type: string
          metric_type: string
          name: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          leaderboard_type?: string
          metric_type?: string
          name?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
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
          restaurant_addon_id: string | null
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
          restaurant_addon_id?: string | null
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
          restaurant_addon_id?: string | null
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
          {
            foreignKeyName: "meal_addons_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "meal_addons_restaurant_addon_id_fkey"
            columns: ["restaurant_addon_id"]
            isOneToOne: false
            referencedRelation: "restaurant_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_categories: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      meal_completion_audit: {
        Row: {
          action: string
          id: string
          nutrition_data: Json | null
          performed_at: string | null
          schedule_id: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          nutrition_data?: Json | null
          performed_at?: string | null
          schedule_id?: string | null
          success: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          nutrition_data?: Json | null
          performed_at?: string | null
          schedule_id?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_completion_audit_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_completion_audit_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
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
          {
            foreignKeyName: "meal_diet_tags_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      meal_history: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string | null
          fat_g: number
          id: string
          logged_at: string | null
          name: string
          protein_g: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string | null
          fat_g?: number
          id?: string
          logged_at?: string | null
          name: string
          protein_g?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string | null
          fat_g?: number
          id?: string
          logged_at?: string | null
          name?: string
          protein_g?: number
          user_id?: string
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          created_at: string | null
          id: string
          is_allergen: boolean | null
          is_default: boolean | null
          is_removable: boolean | null
          meal_id: string
          name: string
          name_ar: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_allergen?: boolean | null
          is_default?: boolean | null
          is_removable?: boolean | null
          meal_id: string
          name: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_allergen?: boolean | null
          is_default?: boolean | null
          is_removable?: boolean | null
          meal_id?: string
          name?: string
          name_ar?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      meal_option_values: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          meal_option_id: string
          name: string
          name_ar: string | null
          price_modifier: number
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          meal_option_id: string
          name: string
          name_ar?: string | null
          price_modifier?: number
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          meal_option_id?: string
          name?: string
          name_ar?: string | null
          price_modifier?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_option_values_meal_option_id_fkey"
            columns: ["meal_option_id"]
            isOneToOne: false
            referencedRelation: "meal_options"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_options: {
        Row: {
          created_at: string | null
          id: string
          meal_id: string
          name: string
          name_ar: string | null
          option_type: string
          required: boolean | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_id: string
          name: string
          name_ar?: string | null
          option_type?: string
          required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_id?: string
          name?: string
          name_ar?: string | null
          option_type?: string
          required?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_options_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_options_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      meal_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          is_public: boolean | null
          likes_count: number | null
          meal_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          is_public?: boolean | null
          likes_count?: number | null
          meal_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          is_public?: boolean | null
          likes_count?: number | null
          meal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_photos_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_photos_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "meal_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          id: string
          meal_id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_id: string
          notes?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      meal_quality_logs: {
        Row: {
          added_sugars: boolean | null
          created_at: string | null
          id: string
          log_date: string
          meal_quality_score: number | null
          notes: string | null
          overall_grade: string | null
          protein_present: boolean | null
          user_id: string
          vegetables_count: number | null
          whole_grains: boolean | null
        }
        Insert: {
          added_sugars?: boolean | null
          created_at?: string | null
          id?: string
          log_date: string
          meal_quality_score?: number | null
          notes?: string | null
          overall_grade?: string | null
          protein_present?: boolean | null
          user_id: string
          vegetables_count?: number | null
          whole_grains?: boolean | null
        }
        Update: {
          added_sugars?: boolean | null
          created_at?: string | null
          id?: string
          log_date?: string
          meal_quality_score?: number | null
          notes?: string | null
          overall_grade?: string | null
          protein_present?: boolean | null
          user_id?: string
          vegetables_count?: number | null
          whole_grains?: boolean | null
        }
        Relationships: []
      }
      meal_reviews: {
        Row: {
          created_at: string | null
          helpful_count: number | null
          id: string
          is_approved: boolean | null
          is_flagged: boolean | null
          is_verified_purchase: boolean | null
          meal_id: string
          moderation_notes: string | null
          order_id: string | null
          photo_urls: string[] | null
          rating: number
          restaurant_id: string | null
          review_text: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          is_verified_purchase?: boolean | null
          meal_id: string
          moderation_notes?: string | null
          order_id?: string | null
          photo_urls?: string[] | null
          rating: number
          restaurant_id?: string | null
          review_text?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_flagged?: boolean | null
          is_verified_purchase?: boolean | null
          meal_id?: string
          moderation_notes?: string | null
          order_id?: string | null
          photo_urls?: string[] | null
          rating?: number
          restaurant_id?: string | null
          review_text?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_reviews_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_reviews_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "meal_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      meal_schedules: {
        Row: {
          addons_total: number | null
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string | null
          delivery_address_id: string | null
          delivery_fee: number | null
          delivery_group_id: string | null
          delivery_time_slot: string | null
          delivery_type: string | null
          id: string
          is_completed: boolean | null
          meal_id: string
          meal_type: string
          order_status: string | null
          restaurant_branch_id: string | null
          restaurant_id: string | null
          scheduled_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          addons_total?: number | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number | null
          delivery_group_id?: string | null
          delivery_time_slot?: string | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id: string
          meal_type?: string
          order_status?: string | null
          restaurant_branch_id?: string | null
          restaurant_id?: string | null
          scheduled_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          addons_total?: number | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          delivery_address_id?: string | null
          delivery_fee?: number | null
          delivery_group_id?: string | null
          delivery_time_slot?: string | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id?: string
          meal_type?: string
          order_status?: string | null
          restaurant_branch_id?: string | null
          restaurant_id?: string | null
          scheduled_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_schedules_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_delivery_group_id_fkey"
            columns: ["delivery_group_id"]
            isOneToOne: false
            referencedRelation: "delivery_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "meal_schedules_restaurant_branch_id_fkey"
            columns: ["restaurant_branch_id"]
            isOneToOne: false
            referencedRelation: "restaurant_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_schedules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      meal_skip_reasons: {
        Row: {
          ai_confidence_score: number | null
          created_at: string | null
          details: string | null
          id: string
          meal_id: string | null
          meal_type: string | null
          reason_type: string
          schedule_id: string | null
          scheduled_date: string | null
          user_id: string
        }
        Insert: {
          ai_confidence_score?: number | null
          created_at?: string | null
          details?: string | null
          id?: string
          meal_id?: string | null
          meal_type?: string | null
          reason_type: string
          schedule_id?: string | null
          scheduled_date?: string | null
          user_id: string
        }
        Update: {
          ai_confidence_score?: number | null
          created_at?: string | null
          details?: string | null
          id?: string
          meal_id?: string | null
          meal_type?: string | null
          reason_type?: string
          schedule_id?: string | null
          scheduled_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_skip_reasons_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_skip_reasons_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "meal_skip_reasons_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_skip_reasons_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_translations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_auto_translated: boolean | null
          language_code: Database["public"]["Enums"]["language_code"]
          meal_id: string
          name: string
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_text_hash: string | null
          translation_api: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_auto_translated?: boolean | null
          language_code: Database["public"]["Enums"]["language_code"]
          meal_id: string
          name: string
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_text_hash?: string | null
          translation_api?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_auto_translated?: boolean | null
          language_code?: Database["public"]["Enums"]["language_code"]
          meal_id?: string
          name?: string
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_text_hash?: string | null
          translation_api?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_translations_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_translations_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      meals: {
        Row: {
          approval_status: string | null
          avg_rating: number | null
          calories: number | null
          carbs: number | null
          carbs_g: number | null
          category: string
          category_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          estimated_cost: number | null
          fat_g: number | null
          fats: number | null
          fiber_g: number | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_available: boolean | null
          is_vip_exclusive: boolean | null
          meal_type: string | null
          name: string
          order_count: number | null
          prep_time_minutes: number | null
          price: number | null
          primary_language: Database["public"]["Enums"]["language_code"] | null
          protein: number | null
          protein_g: number | null
          rating: number | null
          restaurant_id: string | null
          review_count: number | null
          vendor: string | null
        }
        Insert: {
          approval_status?: string | null
          avg_rating?: number | null
          calories?: number | null
          carbs?: number | null
          carbs_g?: number | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          fat_g?: number | null
          fats?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean | null
          is_vip_exclusive?: boolean | null
          meal_type?: string | null
          name: string
          order_count?: number | null
          prep_time_minutes?: number | null
          price?: number | null
          primary_language?: Database["public"]["Enums"]["language_code"] | null
          protein?: number | null
          protein_g?: number | null
          rating?: number | null
          restaurant_id?: string | null
          review_count?: number | null
          vendor?: string | null
        }
        Update: {
          approval_status?: string | null
          avg_rating?: number | null
          calories?: number | null
          carbs?: number | null
          carbs_g?: number | null
          category?: string
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_cost?: number | null
          fat_g?: number | null
          fats?: number | null
          fiber_g?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean | null
          is_vip_exclusive?: boolean | null
          meal_type?: string | null
          name?: string
          order_count?: number | null
          prep_time_minutes?: number | null
          price?: number | null
          primary_language?: Database["public"]["Enums"]["language_code"] | null
          protein?: number | null
          protein_g?: number | null
          rating?: number | null
          restaurant_id?: string | null
          review_count?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "meal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      member_recovery_credits: {
        Row: {
          id: string
          period_end: string
          period_start: string
          total_credits: number | null
          used_credits: number | null
          user_id: string
        }
        Insert: {
          id?: string
          period_end: string
          period_start: string
          total_credits?: number | null
          used_credits?: number | null
          user_id: string
        }
        Update: {
          id?: string
          period_end?: string
          period_start?: string
          total_credits?: number | null
          used_credits?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_recovery_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          achievements: boolean | null
          created_at: string | null
          delivery_updates: boolean | null
          email_notifications: boolean | null
          health_insights: boolean | null
          id: string
          meal_reminders: boolean | null
          order_updates: boolean | null
          plan_updates: boolean | null
          promotional_emails: boolean | null
          push_notifications: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminder_time: string | null
          subscription_updates: boolean | null
          system_alerts: boolean | null
          updated_at: string | null
          user_id: string | null
          weekly_summary: boolean | null
        }
        Insert: {
          achievements?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          email_notifications?: boolean | null
          health_insights?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          order_updates?: boolean | null
          plan_updates?: boolean | null
          promotional_emails?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_time?: string | null
          subscription_updates?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          weekly_summary?: boolean | null
        }
        Update: {
          achievements?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          email_notifications?: boolean | null
          health_insights?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          order_updates?: boolean | null
          plan_updates?: boolean | null
          promotional_emails?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_time?: string | null
          subscription_updates?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
          weekly_summary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          phone: string
          sent_at: string | null
          status: string | null
          template: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone: string
          sent_at?: string | null
          status?: string | null
          template?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          sent_at?: string | null
          status?: string | null
          template?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          admin_notes: string | null
          category: string | null
          created_at: string | null
          featured_at: string | null
          feedback_text: string | null
          follow_up_response: string | null
          follow_up_sent: boolean | null
          follow_up_sent_at: string | null
          id: string
          is_featured: boolean | null
          meal_schedule_id: string | null
          metadata: Json | null
          order_id: string | null
          responded_at: string | null
          score: number
          survey_trigger: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string | null
          featured_at?: string | null
          feedback_text?: string | null
          follow_up_response?: string | null
          follow_up_sent?: boolean | null
          follow_up_sent_at?: string | null
          id?: string
          is_featured?: boolean | null
          meal_schedule_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          responded_at?: string | null
          score: number
          survey_trigger?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          created_at?: string | null
          featured_at?: string | null
          feedback_text?: string | null
          follow_up_response?: string | null
          follow_up_sent?: boolean | null
          follow_up_sent_at?: string | null
          id?: string
          is_featured?: boolean | null
          meal_schedule_id?: string | null
          metadata?: Json | null
          order_id?: string | null
          responded_at?: string | null
          score?: number
          survey_trigger?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_meal_schedule_id_fkey"
            columns: ["meal_schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_meal_schedule_id_fkey"
            columns: ["meal_schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_goals: {
        Row: {
          carbs_target_g: number | null
          created_at: string | null
          daily_calorie_target: number | null
          fat_target_g: number | null
          fiber_target_g: number | null
          goal_type: string
          id: string
          is_active: boolean | null
          protein_target_g: number | null
          target_date: string | null
          target_weight_kg: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          carbs_target_g?: number | null
          created_at?: string | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          fiber_target_g?: number | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          protein_target_g?: number | null
          target_date?: string | null
          target_weight_kg?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          carbs_target_g?: number | null
          created_at?: string | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          fiber_target_g?: number | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          protein_target_g?: number | null
          target_date?: string | null
          target_weight_kg?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number | null
          carbs: number | null
          consumed: boolean | null
          created_at: string | null
          date: string
          fat: number | null
          fiber: number | null
          id: string
          meal_id: string | null
          meal_type: string
          protein: number | null
          skip_reason: string | null
          skipped: boolean | null
          sodium: number | null
          sugar: number | null
          user_id: string
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          consumed?: boolean | null
          created_at?: string | null
          date?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_id?: string | null
          meal_type: string
          protein?: number | null
          skip_reason?: string | null
          skipped?: boolean | null
          sodium?: number | null
          sugar?: number | null
          user_id: string
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          consumed?: boolean | null
          created_at?: string | null
          date?: string
          fat?: number | null
          fiber?: number | null
          id?: string
          meal_id?: string | null
          meal_type?: string
          protein?: number | null
          skip_reason?: string | null
          skipped?: boolean | null
          sodium?: number | null
          sugar?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutrition_logs_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "nutrition_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_cancellations: {
        Row: {
          cancellation_fee: number | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          order_id: string
          order_status_at_cancel: string
          reason: string
          reason_category: string | null
          refund_amount: number
          refund_type: string | null
          user_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          cancellation_fee?: number | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          order_id: string
          order_status_at_cancel: string
          reason: string
          reason_category?: string | null
          refund_amount?: number
          refund_type?: string | null
          user_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          cancellation_fee?: number | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          order_id?: string
          order_status_at_cancel?: string
          reason?: string
          reason_category?: string | null
          refund_amount?: number
          refund_type?: string | null
          user_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_cancellations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellations_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          meal_id: string | null
          meal_name: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_id?: string | null
          meal_name: string
          order_id: string
          quantity?: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_id?: string | null
          meal_name?: string
          order_id?: string
          quantity?: number
          subtotal?: number
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
            foreignKeyName: "order_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
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
      order_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_by_role: string | null
          created_at: string
          id: string
          ip_address: unknown
          new_status: string | null
          notes: string | null
          order_id: string | null
          previous_status: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_status?: string | null
          notes?: string | null
          order_id?: string | null
          previous_status?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_by_role?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_status?: string | null
          notes?: string | null
          order_id?: string | null
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          driver_id: string | null
          estimated_delivery_time: string | null
          id: string
          meal_id: string | null
          notes: string | null
          order_type: string | null
          phone_number: string | null
          picked_up_at: string | null
          preparing_at: string | null
          ready_for_pickup_at: string | null
          restaurant_branch_id: string | null
          restaurant_id: string | null
          restaurant_payout: number | null
          special_instructions: string | null
          status: string
          tip_amount: number | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          order_type?: string | null
          phone_number?: string | null
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_for_pickup_at?: string | null
          restaurant_branch_id?: string | null
          restaurant_id?: string | null
          restaurant_payout?: number | null
          special_instructions?: string | null
          status?: string
          tip_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          driver_id?: string | null
          estimated_delivery_time?: string | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          order_type?: string | null
          phone_number?: string | null
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_for_pickup_at?: string | null
          restaurant_branch_id?: string | null
          restaurant_id?: string | null
          restaurant_payout?: number | null
          special_instructions?: string | null
          status?: string
          tip_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_branch_id_fkey"
            columns: ["restaurant_branch_id"]
            isOneToOne: false
            referencedRelation: "restaurant_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_earnings: {
        Row: {
          created_at: string | null
          delivery_fee: number | null
          gross_amount: number
          id: string
          meal_schedule_id: string | null
          net_amount: number
          order_id: string | null
          payout_id: string | null
          platform_fee: number
          restaurant_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_fee?: number | null
          gross_amount: number
          id?: string
          meal_schedule_id?: string | null
          net_amount: number
          order_id?: string | null
          payout_id?: string | null
          platform_fee?: number
          restaurant_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_fee?: number | null
          gross_amount?: number
          id?: string
          meal_schedule_id?: string | null
          net_amount?: number
          order_id?: string | null
          payout_id?: string | null
          platform_fee?: number
          restaurant_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_earnings_meal_schedule_id_fkey"
            columns: ["meal_schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_meal_schedule_id_fkey"
            columns: ["meal_schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_earnings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          invoice_id: string | null
          payout_details: Json | null
          payout_method: string | null
          period_end: string
          period_start: string
          processed_at: string | null
          reference_number: string | null
          restaurant_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          period_end: string
          period_start: string
          processed_at?: string | null
          reference_number?: string | null
          restaurant_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payout_details?: Json | null
          payout_method?: string | null
          period_end?: string
          period_start?: string
          processed_at?: string | null
          reference_number?: string | null
          restaurant_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      partner_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          type: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          api_key: string
          api_key_prefix: string | null
          api_secret: string
          api_secret_hash: string | null
          api_secret_salt: string | null
          created_at: string
          email: string
          id: string
          last_rotated_at: string | null
          last_used_at: string | null
          name: string
          permissions: Json | null
          rate_limit: number | null
          rotation_due_at: string | null
          status: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string
          api_key_prefix?: string | null
          api_secret: string
          api_secret_hash?: string | null
          api_secret_salt?: string | null
          created_at?: string
          email: string
          id?: string
          last_rotated_at?: string | null
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          rate_limit?: number | null
          rotation_due_at?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          api_key_prefix?: string | null
          api_secret?: string
          api_secret_hash?: string | null
          api_secret_salt?: string | null
          created_at?: string
          email?: string
          id?: string
          last_rotated_at?: string | null
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          rate_limit?: number | null
          rotation_due_at?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      payment_processing_errors: {
        Row: {
          attempted_at: string | null
          error_code: string | null
          error_message: string
          id: string
          payment_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          user_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          error_code?: string | null
          error_message: string
          id?: string
          payment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          error_code?: string | null
          error_message?: string
          id?: string
          payment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          gateway: string | null
          gateway_reference: string | null
          gateway_response: Json | null
          id: string
          invoice_id: string | null
          payment_method: string | null
          payment_type: string
          processed_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          wallet_credit_error: string | null
          wallet_credited: boolean | null
          wallet_transaction_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          payment_type: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_credit_error?: string | null
          wallet_credited?: boolean | null
          wallet_transaction_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          payment_type?: string
          processed_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_credit_error?: string | null
          wallet_credited?: boolean | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          delivery_costs: number | null
          id: string
          margin_percentage: number | null
          order_count: number
          partner_id: string
          payout_method: string | null
          period_end: string
          period_start: string
          platform_margin: number | null
          processed_at: string | null
          restaurant_id: string | null
          status: string
          subscription_revenue: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_costs?: number | null
          id?: string
          margin_percentage?: number | null
          order_count?: number
          partner_id: string
          payout_method?: string | null
          period_end: string
          period_start: string
          platform_margin?: number | null
          processed_at?: string | null
          restaurant_id?: string | null
          status?: string
          subscription_revenue?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_costs?: number | null
          id?: string
          margin_percentage?: number | null
          order_count?: number
          partner_id?: string
          payout_method?: string | null
          period_end?: string
          period_start?: string
          platform_margin?: number | null
          processed_at?: string | null
          restaurant_id?: string | null
          status?: string
          subscription_revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      plateau_events: {
        Row: {
          created_at: string | null
          detected_at: string
          id: string
          suggested_action: string
          user_acknowledged: boolean | null
          user_id: string
          weeks_without_change: number
        }
        Insert: {
          created_at?: string | null
          detected_at: string
          id?: string
          suggested_action: string
          user_acknowledged?: boolean | null
          user_id: string
          weeks_without_change: number
        }
        Update: {
          created_at?: string | null
          detected_at?: string
          id?: string
          suggested_action?: string
          user_acknowledged?: boolean | null
          user_id?: string
          weeks_without_change?: number
        }
        Relationships: []
      }
      platform_logs: {
        Row: {
          category: string
          created_at: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
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
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_analytics_purchases: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string
          package_type: string | null
          partner_id: string | null
          payment_reference: string | null
          price_paid: number | null
          restaurant_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          package_type?: string | null
          partner_id?: string | null
          payment_reference?: string | null
          price_paid?: number | null
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          package_type?: string | null
          partner_id?: string | null
          payment_reference?: string | null
          price_paid?: number | null
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_analytics_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_analytics_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_analytics_purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          adherence_rate_last_30_days: number | null
          affiliate_balance: number | null
          affiliate_tier: string | null
          age: number | null
          ai_suggested_calories: number | null
          ai_suggestion_confidence: number | null
          avatar_url: string | null
          badges_count: number | null
          carbs_target_g: number | null
          consecutive_weeks_on_track: number | null
          created_at: string
          current_weight_kg: number | null
          daily_calorie_target: number | null
          email: string | null
          fat_target_g: number | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          has_unviewed_adjustment: boolean | null
          health_goal: Database["public"]["Enums"]["health_goal"] | null
          height_cm: number | null
          id: string
          last_goal_adjustment_date: string | null
          level: number | null
          next_scheduled_adjustment: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          plateau_weeks: number | null
          preferred_language:
            | Database["public"]["Enums"]["language_code"]
            | null
          protein_target_g: number | null
          referral_code: string | null
          referral_rewards_earned: number | null
          referred_by: string | null
          streak_days: number | null
          target_weight_kg: number | null
          taste_profile: Json | null
          tier1_referrer_id: string | null
          tier2_referrer_id: string | null
          tier3_referrer_id: string | null
          total_affiliate_earnings: number | null
          total_meals_logged: number | null
          updated_at: string
          user_id: string
          xp: number | null
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          adherence_rate_last_30_days?: number | null
          affiliate_balance?: number | null
          affiliate_tier?: string | null
          age?: number | null
          ai_suggested_calories?: number | null
          ai_suggestion_confidence?: number | null
          avatar_url?: string | null
          badges_count?: number | null
          carbs_target_g?: number | null
          consecutive_weeks_on_track?: number | null
          created_at?: string
          current_weight_kg?: number | null
          daily_calorie_target?: number | null
          email?: string | null
          fat_target_g?: number | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          has_unviewed_adjustment?: boolean | null
          health_goal?: Database["public"]["Enums"]["health_goal"] | null
          height_cm?: number | null
          id?: string
          last_goal_adjustment_date?: string | null
          level?: number | null
          next_scheduled_adjustment?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          plateau_weeks?: number | null
          preferred_language?:
            | Database["public"]["Enums"]["language_code"]
            | null
          protein_target_g?: number | null
          referral_code?: string | null
          referral_rewards_earned?: number | null
          referred_by?: string | null
          streak_days?: number | null
          target_weight_kg?: number | null
          taste_profile?: Json | null
          tier1_referrer_id?: string | null
          tier2_referrer_id?: string | null
          tier3_referrer_id?: string | null
          total_affiliate_earnings?: number | null
          total_meals_logged?: number | null
          updated_at?: string
          user_id: string
          xp?: number | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          adherence_rate_last_30_days?: number | null
          affiliate_balance?: number | null
          affiliate_tier?: string | null
          age?: number | null
          ai_suggested_calories?: number | null
          ai_suggestion_confidence?: number | null
          avatar_url?: string | null
          badges_count?: number | null
          carbs_target_g?: number | null
          consecutive_weeks_on_track?: number | null
          created_at?: string
          current_weight_kg?: number | null
          daily_calorie_target?: number | null
          email?: string | null
          fat_target_g?: number | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          has_unviewed_adjustment?: boolean | null
          health_goal?: Database["public"]["Enums"]["health_goal"] | null
          height_cm?: number | null
          id?: string
          last_goal_adjustment_date?: string | null
          level?: number | null
          next_scheduled_adjustment?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          plateau_weeks?: number | null
          preferred_language?:
            | Database["public"]["Enums"]["language_code"]
            | null
          protein_target_g?: number | null
          referral_code?: string | null
          referral_rewards_earned?: number | null
          referred_by?: string | null
          streak_days?: number | null
          target_weight_kg?: number | null
          taste_profile?: Json | null
          tier1_referrer_id?: string | null
          tier2_referrer_id?: string | null
          tier3_referrer_id?: string | null
          total_affiliate_earnings?: number | null
          total_meals_logged?: number | null
          updated_at?: string
          user_id?: string
          xp?: number | null
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          calories_consumed: number | null
          carbs_consumed_g: number | null
          created_at: string
          fat_consumed_g: number | null
          fiber_consumed_g: number | null
          id: string
          log_date: string
          notes: string | null
          on_target: boolean | null
          protein_consumed_g: number | null
          updated_at: string
          user_id: string
          variance_from_target: number | null
          weight_kg: number | null
        }
        Insert: {
          calories_consumed?: number | null
          carbs_consumed_g?: number | null
          created_at?: string
          fat_consumed_g?: number | null
          fiber_consumed_g?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          on_target?: boolean | null
          protein_consumed_g?: number | null
          updated_at?: string
          user_id: string
          variance_from_target?: number | null
          weight_kg?: number | null
        }
        Update: {
          calories_consumed?: number | null
          carbs_consumed_g?: number | null
          created_at?: string
          fat_consumed_g?: number | null
          fiber_consumed_g?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          on_target?: boolean | null
          protein_consumed_g?: number | null
          updated_at?: string
          user_id?: string
          variance_from_target?: number | null
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
          discount_applied?: number
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
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_discount_amount: number | null
          max_uses: number | null
          max_uses_per_user: number
          min_order_amount: number
          name: string
          uses_count: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number
          min_order_amount?: number
          name: string
          uses_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number
          min_order_amount?: number
          name?: string
          uses_count?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      push_notification_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          max_attempts: number | null
          message: string
          next_retry_at: string | null
          notification_id: string
          status: string | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message: string
          next_retry_at?: string | null
          notification_id: string
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message?: string
          next_retry_at?: string | null
          notification_id?: string
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_queue_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string | null
          id: string
          identifier: string
          request_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier: string
          request_count?: number
          window_end: string
          window_start?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier?: string
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      recovery_bookings: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string | null
          credits_used: number | null
          id: string
          notes: string | null
          partner_id: string
          qr_code: string | null
          service_name: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string | null
          credits_used?: number | null
          id?: string
          notes?: string | null
          partner_id: string
          qr_code?: string | null
          service_name?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string | null
          credits_used?: number | null
          id?: string
          notes?: string | null
          partner_id?: string
          qr_code?: string | null
          service_name?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_bookings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "recovery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_partners: {
        Row: {
          address: string | null
          city: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          name_ar: string | null
          opening_hours: Json | null
          phone: string | null
          rating: number | null
          review_count: number | null
          services: Json | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          name_ar?: string | null
          opening_hours?: Json | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          services?: Json | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          name_ar?: string | null
          opening_hours?: Json | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          services?: Json | null
          website?: string | null
        }
        Relationships: []
      }
      referral_milestones: {
        Row: {
          bonus_amount: number
          bonus_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          referral_count: number
          updated_at: string
        }
        Insert: {
          bonus_amount: number
          bonus_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          referral_count: number
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          bonus_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          referral_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_addons: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_available: boolean
          name: string
          price: number
          restaurant_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          price?: number
          restaurant_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      restaurant_branches: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          phone_number: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          phone_number?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          phone_number?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      restaurant_details: {
        Row: {
          alternate_phone: string | null
          avg_prep_time_minutes: number | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_account_number_encrypted: string | null
          bank_iban: string | null
          bank_iban_encrypted: string | null
          bank_name: string | null
          bank_name_encrypted: string | null
          bank_swift_encrypted: string | null
          created_at: string | null
          cuisine_type: string[] | null
          dietary_tags: string[] | null
          id: string
          max_meals_per_day: number | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          operating_hours: Json | null
          payout_frequency: string | null
          restaurant_id: string
          swift_code: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          alternate_phone?: string | null
          avg_prep_time_minutes?: number | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_number_encrypted?: string | null
          bank_iban?: string | null
          bank_iban_encrypted?: string | null
          bank_name?: string | null
          bank_name_encrypted?: string | null
          bank_swift_encrypted?: string | null
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
          payout_frequency?: string | null
          restaurant_id: string
          swift_code?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          alternate_phone?: string | null
          avg_prep_time_minutes?: number | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_number_encrypted?: string | null
          bank_iban?: string | null
          bank_iban_encrypted?: string | null
          bank_name?: string | null
          bank_name_encrypted?: string | null
          bank_swift_encrypted?: string | null
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
          payout_frequency?: string | null
          restaurant_id?: string
          swift_code?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      restaurant_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_active: boolean | null
          open_time: string
          restaurant_id: string
          special_note: string | null
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          is_active?: boolean | null
          open_time: string
          restaurant_id: string
          special_note?: string | null
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_active?: boolean | null
          open_time?: string
          restaurant_id?: string
          special_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      restaurant_payouts: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          reference: string | null
          restaurant_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          reference?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          reference?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      restaurant_reviews: {
        Row: {
          ambiance_rating: number | null
          created_at: string
          food_quality_rating: number | null
          helpful_count: number | null
          id: string
          images: string[] | null
          rating: number | null
          restaurant_id: string | null
          review_text: string | null
          service_rating: number | null
          updated_at: string
          user_id: string | null
          visit_date: string | null
          would_recommend: boolean | null
        }
        Insert: {
          ambiance_rating?: number | null
          created_at?: string
          food_quality_rating?: number | null
          helpful_count?: number | null
          id?: string
          images?: string[] | null
          rating?: number | null
          restaurant_id?: string | null
          review_text?: string | null
          service_rating?: number | null
          updated_at?: string
          user_id?: string | null
          visit_date?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          ambiance_rating?: number | null
          created_at?: string
          food_quality_rating?: number | null
          helpful_count?: number | null
          id?: string
          images?: string[] | null
          rating?: number | null
          restaurant_id?: string | null
          review_text?: string | null
          service_rating?: number | null
          updated_at?: string
          user_id?: string | null
          visit_date?: string | null
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      restaurant_staff: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          restaurant_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "restaurant_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          avg_prep_time_minutes: number | null
          avg_rating: number | null
          bank_info: Json | null
          building_number: string | null
          commission_rate: number
          created_at: string | null
          cuisine_type: string | null
          cuisine_types: string[] | null
          current_day_orders: number | null
          daily_reset_at: string | null
          deleted_at: string | null
          description: string | null
          dietary_tags: string[] | null
          email: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_partner: boolean | null
          latitude: number | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          max_meals_per_day: number | null
          name: string
          operating_hours: Json | null
          owner_id: string | null
          payout_rate: number
          payout_rate_set_at: string | null
          payout_rate_set_by: string | null
          phone: string | null
          phone_number: string | null
          rating: number | null
          rejection_reason: string | null
          review_count: number | null
          reviews_count: number | null
          status: Database["public"]["Enums"]["restaurant_status"] | null
          street_number: number | null
          total_orders: number | null
          updated_at: string | null
          website: string | null
          zone_number: number | null
        }
        Insert: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          avg_prep_time_minutes?: number | null
          avg_rating?: number | null
          bank_info?: Json | null
          building_number?: string | null
          commission_rate?: number
          created_at?: string | null
          cuisine_type?: string | null
          cuisine_types?: string[] | null
          current_day_orders?: number | null
          daily_reset_at?: string | null
          deleted_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_partner?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          max_meals_per_day?: number | null
          name: string
          operating_hours?: Json | null
          owner_id?: string | null
          payout_rate?: number
          payout_rate_set_at?: string | null
          payout_rate_set_by?: string | null
          phone?: string | null
          phone_number?: string | null
          rating?: number | null
          rejection_reason?: string | null
          review_count?: number | null
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          street_number?: number | null
          total_orders?: number | null
          updated_at?: string | null
          website?: string | null
          zone_number?: number | null
        }
        Update: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          avg_prep_time_minutes?: number | null
          avg_rating?: number | null
          bank_info?: Json | null
          building_number?: string | null
          commission_rate?: number
          created_at?: string | null
          cuisine_type?: string | null
          cuisine_types?: string[] | null
          current_day_orders?: number | null
          daily_reset_at?: string | null
          deleted_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_partner?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          max_meals_per_day?: number | null
          name?: string
          operating_hours?: Json | null
          owner_id?: string | null
          payout_rate?: number
          payout_rate_set_at?: string | null
          payout_rate_set_by?: string | null
          phone?: string | null
          phone_number?: string | null
          rating?: number | null
          rejection_reason?: string | null
          review_count?: number | null
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          street_number?: number | null
          total_orders?: number | null
          updated_at?: string | null
          website?: string | null
          zone_number?: number | null
        }
        Relationships: []
      }
      review_helpful_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          review_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "restaurant_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string | null
          id: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_helpful: boolean
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_helpful?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "meal_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          meal_id: string
          rating: number
          restaurant_id: string | null
          updated_at: string | null
          user_id: string
          would_order_again: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          meal_id: string
          rating: number
          restaurant_id?: string | null
          updated_at?: string | null
          user_id: string
          would_order_again?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          meal_id?: string
          rating?: number
          restaurant_id?: string | null
          updated_at?: string | null
          user_id?: string
          would_order_again?: boolean | null
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
            foreignKeyName: "reviews_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revoked_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          manager_id: string
          token_jti: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          manager_id: string
          token_jti: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          manager_id?: string
          token_jti?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "schedule_addons_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          achievement_id: string | null
          comments_count: number | null
          content: string
          created_at: string
          id: string
          image_urls: string[] | null
          is_public: boolean | null
          likes_count: number | null
          meal_data: Json | null
          post_type: string | null
          user_id: string | null
          workout_data: Json | null
        }
        Insert: {
          achievement_id?: string | null
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_public?: boolean | null
          likes_count?: number | null
          meal_data?: Json | null
          post_type?: string | null
          user_id?: string | null
          workout_data?: Json | null
        }
        Update: {
          achievement_id?: string | null
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          image_urls?: string[] | null
          is_public?: boolean | null
          likes_count?: number | null
          meal_data?: Json | null
          post_type?: string | null
          user_id?: string | null
          workout_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_id: string | null
          first_name: string
          hire_date: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          last_name: string
          notes: string | null
          phone: string | null
          restaurant_id: string | null
          role_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          first_name: string
          hire_date: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_id?: string | null
          first_name?: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          description: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          permissions: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          permissions?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          permissions?: Json | null
        }
        Relationships: []
      }
      staff_schedules: {
        Row: {
          break_duration: number | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          schedule_date: string
          staff_member_id: string | null
          start_time: string
          status: string | null
          updated_at: string
        }
        Insert: {
          break_duration?: number | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          schedule_date: string
          staff_member_id?: string | null
          start_time: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          break_duration?: number | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          schedule_date?: string
          staff_member_id?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      step_logs: {
        Row: {
          calories_burned: number | null
          created_at: string | null
          date: string
          distance_km: number | null
          id: string
          source: string | null
          steps: number
          user_id: string
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string | null
          date?: string
          distance_km?: number | null
          id?: string
          source?: string | null
          steps?: number
          user_id: string
        }
        Update: {
          calories_burned?: number | null
          created_at?: string | null
          date?: string
          distance_km?: number | null
          id?: string
          source?: string | null
          steps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_rewards: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reward_description: string
          reward_type: string
          reward_value: number
          streak_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reward_description: string
          reward_type: string
          reward_value?: number
          streak_days: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reward_description?: string
          reward_type?: string
          reward_value?: number
          streak_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      streak_rewards_claimed: {
        Row: {
          claimed_at: string | null
          id: string
          reward_id: string
          reward_type: string
          reward_value: number
          streak_days: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          reward_id: string
          reward_type: string
          reward_value?: number
          streak_days: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          reward_id?: string
          reward_type?: string
          reward_value?: number
          streak_days?: number
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_freezes: {
        Row: {
          activated_at: string | null
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          completed_at: string | null
          freeze_days: number
          freeze_end_date: string
          freeze_start_date: string
          id: string
          requested_at: string
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          freeze_days: number
          freeze_end_date: string
          freeze_start_date: string
          id?: string
          requested_at?: string
          status?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          freeze_days?: number
          freeze_end_date?: string
          freeze_start_date?: string
          id?: string
          requested_at?: string
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_freezes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval: string
          created_at: string | null
          daily_meals: number | null
          daily_snacks: number | null
          description: string | null
          description_en: string | null
          discount_percent: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          meals_per_month: number
          meals_per_week: number | null
          name_ar: string | null
          price_per_meal: number | null
          price_per_snack: number | null
          price_qar: number
          short_description: string | null
          short_description_ar: string | null
          snacks_per_month: number | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          billing_interval: string
          created_at?: string | null
          daily_meals?: number | null
          daily_snacks?: number | null
          description?: string | null
          description_en?: string | null
          discount_percent?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          meals_per_month: number
          meals_per_week?: number | null
          name_ar?: string | null
          price_per_meal?: number | null
          price_per_snack?: number | null
          price_qar: number
          short_description?: string | null
          short_description_ar?: string | null
          snacks_per_month?: number | null
          tier: string
          updated_at?: string | null
        }
        Update: {
          billing_interval?: string
          created_at?: string | null
          daily_meals?: number | null
          daily_snacks?: number | null
          description?: string | null
          description_en?: string | null
          discount_percent?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          meals_per_month?: number
          meals_per_week?: number | null
          name_ar?: string | null
          price_per_meal?: number | null
          price_per_snack?: number | null
          price_qar?: number
          short_description?: string | null
          short_description_ar?: string | null
          snacks_per_month?: number | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_renewal_processed: {
        Row: {
          created_by: string | null
          credits_added: number | null
          error_message: string | null
          id: string
          idempotency_key: string
          processed_at: string
          renewal_date: string
          rollover_credits: number | null
          status: string
          subscription_id: string
        }
        Insert: {
          created_by?: string | null
          credits_added?: number | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          processed_at?: string
          renewal_date: string
          rollover_credits?: number | null
          status?: string
          subscription_id: string
        }
        Update: {
          created_by?: string | null
          credits_added?: number | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          processed_at?: string
          renewal_date?: string
          rollover_credits?: number | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_renewal_processed_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_rollovers: {
        Row: {
          created_at: string
          expiry_date: string
          id: string
          rollover_credits: number
          source_cycle_end: string
          source_cycle_start: string
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expiry_date: string
          id?: string
          rollover_credits?: number
          source_cycle_end: string
          source_cycle_start: string
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expiry_date?: string
          id?: string
          rollover_credits?: number
          source_cycle_end?: string
          source_cycle_start?: string
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_rollovers_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean | null
          annual_discount_percent: number | null
          annual_renewal_date: string | null
          auto_renew: boolean | null
          billing_interval: string | null
          cancellation_details: string | null
          cancellation_reason: string | null
          created_at: string | null
          end_date: string | null
          freeze_days_used: number | null
          id: string
          includes_gym: boolean | null
          meals_per_month: number | null
          meals_per_week: number | null
          meals_used_this_month: number | null
          meals_used_this_week: number | null
          month_start_date: string | null
          next_renewal_date: string | null
          plan: string | null
          plan_type: string | null
          price: number | null
          prorated_credit: number | null
          rollover_credits: number | null
          snacks_per_month: number | null
          snacks_used_this_month: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id: string | null
          tier: string | null
          updated_at: string | null
          user_id: string | null
          week_start_date: string | null
        }
        Insert: {
          active?: boolean | null
          annual_discount_percent?: number | null
          annual_renewal_date?: string | null
          auto_renew?: boolean | null
          billing_interval?: string | null
          cancellation_details?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_date?: string | null
          freeze_days_used?: number | null
          id?: string
          includes_gym?: boolean | null
          meals_per_month?: number | null
          meals_per_week?: number | null
          meals_used_this_month?: number | null
          meals_used_this_week?: number | null
          month_start_date?: string | null
          next_renewal_date?: string | null
          plan?: string | null
          plan_type?: string | null
          price?: number | null
          prorated_credit?: number | null
          rollover_credits?: number | null
          snacks_per_month?: number | null
          snacks_used_this_month?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
          week_start_date?: string | null
        }
        Update: {
          active?: boolean | null
          annual_discount_percent?: number | null
          annual_renewal_date?: string | null
          auto_renew?: boolean | null
          billing_interval?: string | null
          cancellation_details?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          end_date?: string | null
          freeze_days_used?: number | null
          id?: string
          includes_gym?: boolean | null
          meals_per_month?: number | null
          meals_per_week?: number | null
          meals_used_this_month?: number | null
          meals_used_this_week?: number | null
          month_start_date?: string | null
          next_renewal_date?: string | null
          plan?: string | null
          plan_type?: string | null
          price?: number | null
          prorated_credit?: number | null
          rollover_credits?: number | null
          snacks_per_month?: number | null
          snacks_used_this_month?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id?: string | null
          tier?: string | null
          updated_at?: string | null
          user_id?: string | null
          week_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
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
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
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
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      test_table: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
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
          is_internal: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean
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
      user_achievements: {
        Row: {
          achievement_id: string | null
          earned_at: string
          id: string
          is_featured: boolean | null
          user_id: string | null
        }
        Insert: {
          achievement_id?: string | null
          earned_at?: string
          id?: string
          is_featured?: boolean | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string | null
          earned_at?: string
          id?: string
          is_featured?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
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
          latitude: number | null
          longitude: number | null
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
          latitude?: number | null
          longitude?: number | null
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
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          postal_code?: string
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          id: string
          joined_at: string | null
          progress: number | null
          status: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          progress?: number | null
          status?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string | null
          progress?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dietary_preferences: {
        Row: {
          created_at: string | null
          diet_tag_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          diet_tag_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          diet_tag_id?: string
          id?: string
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
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorite_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      user_goals: {
        Row: {
          activity_level: string | null
          age: number | null
          created_at: string | null
          current_weight: number | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          goal: Database["public"]["Enums"]["health_goal_type"]
          height: number | null
          id: string
          target_weight: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          created_at?: string | null
          current_weight?: number | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal: Database["public"]["Enums"]["health_goal_type"]
          height?: number | null
          id?: string
          target_weight?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          created_at?: string | null
          current_weight?: number | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal?: Database["public"]["Enums"]["health_goal_type"]
          height?: number | null
          id?: string
          target_weight?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: number
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: number
          id?: string
          provider: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: number
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_ip_logs: {
        Row: {
          action: string
          city: string | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          id?: string
          ip_address: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_milestone_achievements: {
        Row: {
          achieved_at: string
          bonus_credited: boolean
          credited_at: string | null
          id: string
          milestone_id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          bonus_credited?: boolean
          credited_at?: string | null
          id?: string
          milestone_id: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          bonus_credited?: boolean
          credited_at?: string | null
          id?: string
          milestone_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestone_achievements_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "referral_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          achieved_at: string | null
          description: string
          icon_emoji: string | null
          id: string
          is_celebrated: boolean | null
          milestone_type: string
          milestone_value: number | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          description: string
          icon_emoji?: string | null
          id?: string
          is_celebrated?: boolean | null
          milestone_type: string
          milestone_value?: number | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          description?: string
          icon_emoji?: string | null
          id?: string
          is_celebrated?: boolean | null
          milestone_type?: string
          milestone_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_nutrition_log: {
        Row: {
          calories: number
          carbs: number
          created_at: string | null
          date: string
          fats: number
          id: string
          meal_id: string | null
          protein: number
          user_id: string
        }
        Insert: {
          calories: number
          carbs: number
          created_at?: string | null
          date: string
          fats: number
          id?: string
          meal_id?: string | null
          protein: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string | null
          date?: string
          fats?: number
          id?: string
          meal_id?: string | null
          protein?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_nutrition_log_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_nutrition_log_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          fitness_level: string | null
          goals: string[] | null
          id: string
          is_public: boolean | null
          joined_at: string
          location: string | null
          streak_days: number | null
          total_calories_burned: number | null
          total_workouts: number | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          fitness_level?: string | null
          goals?: string[] | null
          id?: string
          is_public?: boolean | null
          joined_at?: string
          location?: string | null
          streak_days?: number | null
          total_calories_burned?: number | null
          total_workouts?: number | null
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          fitness_level?: string | null
          goals?: string[] | null
          id?: string
          is_public?: boolean | null
          joined_at?: string
          location?: string | null
          streak_days?: number | null
          total_calories_burned?: number | null
          total_workouts?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string
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
      user_streaks: {
        Row: {
          best_streak: number | null
          created_at: string | null
          current_streak: number | null
          id: string
          last_log_date: string | null
          streak_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_log_date?: string | null
          streak_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_streak?: number | null
          created_at?: string | null
          current_streak?: number | null
          id?: string
          last_log_date?: string | null
          streak_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_top_meals: {
        Row: {
          added_at: string | null
          id: string
          is_auto_added: boolean | null
          last_ordered_at: string | null
          meal_id: string
          order_count: number | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          is_auto_added?: boolean | null
          last_ordered_at?: string | null
          meal_id: string
          order_count?: number | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          is_auto_added?: boolean | null
          last_ordered_at?: string | null
          meal_id?: string
          order_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_top_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_top_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          city_id: string | null
          color: string | null
          country: string | null
          created_at: string | null
          id: string
          insurance_document_url: string | null
          insurance_expiry: string | null
          insurance_provider: string | null
          make: string | null
          model: string | null
          plate_number: string
          registration_document_url: string | null
          registration_number: string | null
          status: string | null
          type: string
          updated_at: string | null
          vehicle_photo_url: string | null
          year: number | null
        }
        Insert: {
          assigned_driver_id?: string | null
          city_id?: string | null
          color?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          insurance_document_url?: string | null
          insurance_expiry?: string | null
          insurance_provider?: string | null
          make?: string | null
          model?: string | null
          plate_number: string
          registration_document_url?: string | null
          registration_number?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          vehicle_photo_url?: string | null
          year?: number | null
        }
        Update: {
          assigned_driver_id?: string | null
          city_id?: string | null
          color?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          insurance_document_url?: string | null
          insurance_expiry?: string | null
          insurance_provider?: string | null
          make?: string | null
          model?: string | null
          plate_number?: string
          registration_document_url?: string | null
          registration_number?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          vehicle_photo_url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_attempts: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivery_job_id: string | null
          driver_id: string | null
          id: string
          is_locked: boolean | null
          locked_until: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivery_job_id?: string | null
          driver_id?: string | null
          id?: string
          is_locked?: boolean | null
          locked_until?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivery_job_id?: string | null
          driver_id?: string | null
          id?: string
          is_locked?: boolean | null
          locked_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_attempts_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_topup_packages: {
        Row: {
          amount: number
          bonus_amount: number | null
          bonus_percentage: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bonus_amount?: number | null
          bonus_percentage?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bonus_amount?: number | null
          bonus_percentage?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "customer_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      water_entries: {
        Row: {
          amount_ml: number
          created_at: string | null
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string | null
          id?: string
          log_date: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string | null
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: []
      }
      water_intake: {
        Row: {
          created_at: string | null
          glasses: number | null
          id: string
          log_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          glasses?: number | null
          id?: string
          log_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          glasses?: number | null
          id?: string
          log_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          max_attempts: number | null
          next_retry_at: string | null
          partner_id: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          webhook_url: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          max_attempts?: number | null
          next_retry_at?: string | null
          partner_id?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_url: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          max_attempts?: number | null
          next_retry_at?: string | null
          partner_id?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_queue: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivered_at: string | null
          event_type: string
          first_attempt_at: string | null
          headers: Json | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          last_http_status: number | null
          max_attempts: number | null
          next_retry_at: string | null
          payload: Json
          status: string | null
          webhook_url: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          event_type: string
          first_attempt_at?: string | null
          headers?: Json | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_http_status?: number | null
          max_attempts?: number | null
          next_retry_at?: string | null
          payload: Json
          status?: string | null
          webhook_url: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          event_type?: string
          first_attempt_at?: string | null
          headers?: Json | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          last_http_status?: number | null
          max_attempts?: number | null
          next_retry_at?: string | null
          payload?: Json
          status?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      weekly_adherence: {
        Row: {
          adherence_rate: number | null
          avg_calories_consumed: number | null
          created_at: string | null
          days_logged: number | null
          days_on_target: number | null
          id: string
          target_calories: number | null
          user_id: string
          week_end: string
          week_start: string
          weight_change: number | null
          weight_end: number | null
          weight_start: number | null
        }
        Insert: {
          adherence_rate?: number | null
          avg_calories_consumed?: number | null
          created_at?: string | null
          days_logged?: number | null
          days_on_target?: number | null
          id?: string
          target_calories?: number | null
          user_id: string
          week_end: string
          week_start: string
          weight_change?: number | null
          weight_end?: number | null
          weight_start?: number | null
        }
        Update: {
          adherence_rate?: number | null
          avg_calories_consumed?: number | null
          created_at?: string | null
          days_logged?: number | null
          days_on_target?: number | null
          id?: string
          target_calories?: number | null
          user_id?: string
          week_end?: string
          week_start?: string
          weight_change?: number | null
          weight_end?: number | null
          weight_start?: number | null
        }
        Relationships: []
      }
      weekly_nutrition_reports: {
        Row: {
          avg_calories: number | null
          avg_carbs: number | null
          avg_fat: number | null
          avg_fiber: number | null
          avg_protein: number | null
          consistency_score: number | null
          days_logged: number | null
          days_on_target: number | null
          generated_at: string | null
          id: string
          report_data: Json | null
          user_id: string
          week_end_date: string
          week_start_date: string
          weight_change_kg: number | null
        }
        Insert: {
          avg_calories?: number | null
          avg_carbs?: number | null
          avg_fat?: number | null
          avg_fiber?: number | null
          avg_protein?: number | null
          consistency_score?: number | null
          days_logged?: number | null
          days_on_target?: number | null
          generated_at?: string | null
          id?: string
          report_data?: Json | null
          user_id: string
          week_end_date: string
          week_start_date: string
          weight_change_kg?: number | null
        }
        Update: {
          avg_calories?: number | null
          avg_carbs?: number | null
          avg_fat?: number | null
          avg_fiber?: number | null
          avg_protein?: number | null
          consistency_score?: number | null
          days_logged?: number | null
          days_on_target?: number | null
          generated_at?: string | null
          id?: string
          report_data?: Json | null
          user_id?: string
          week_end_date?: string
          week_start_date?: string
          weight_change_kg?: number | null
        }
        Relationships: []
      }
      weight_predictions: {
        Row: {
          accuracy: number | null
          actual_weight: number | null
          confidence_lower: number | null
          confidence_upper: number | null
          created_at: string | null
          id: string
          model_version: string | null
          predicted_weight: number
          prediction_date: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          actual_weight?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string | null
          id?: string
          model_version?: string | null
          predicted_weight: number
          prediction_date: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          actual_weight?: number | null
          confidence_lower?: number | null
          confidence_upper?: number | null
          created_at?: string | null
          id?: string
          model_version?: string | null
          predicted_weight?: number
          prediction_date?: string
          user_id?: string
        }
        Relationships: []
      }
      win_back_offers: {
        Row: {
          applicable_tiers: string[] | null
          bonus_credits: number | null
          created_at: string | null
          description: string | null
          discount_duration_months: number | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          max_previous_cancellations: number | null
          min_subscription_months: number | null
          name: string
          offer_code: string
          offer_type: string
          pause_duration_days: number | null
          priority: number | null
          target_tier: string | null
          updated_at: string | null
        }
        Insert: {
          applicable_tiers?: string[] | null
          bonus_credits?: number | null
          created_at?: string | null
          description?: string | null
          discount_duration_months?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_previous_cancellations?: number | null
          min_subscription_months?: number | null
          name: string
          offer_code: string
          offer_type: string
          pause_duration_days?: number | null
          priority?: number | null
          target_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          applicable_tiers?: string[] | null
          bonus_credits?: number | null
          created_at?: string | null
          description?: string | null
          discount_duration_months?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_previous_cancellations?: number | null
          min_subscription_months?: number | null
          name?: string
          offer_code?: string
          offer_type?: string
          pause_duration_days?: number | null
          priority?: number | null
          target_tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          calories_burned: number | null
          confirmed: boolean | null
          created_at: string
          duration_minutes: number | null
          gym_id: string | null
          id: string
          notes: string | null
          session_date: string
          source: string | null
          user_id: string | null
          workout_type: string | null
        }
        Insert: {
          calories_burned?: number | null
          confirmed?: boolean | null
          created_at?: string
          duration_minutes?: number | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          session_date: string
          source?: string | null
          user_id?: string | null
          workout_type?: string | null
        }
        Update: {
          calories_burned?: number | null
          confirmed?: boolean | null
          created_at?: string
          duration_minutes?: number | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          source?: string | null
          user_id?: string | null
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          city_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string | null
          polygon: Json | null
          updated_at: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar?: string | null
          polygon?: Json | null
          updated_at?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string | null
          polygon?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_daily_stats: {
        Row: {
          active_users: number | null
          avg_order_value: number | null
          date: string | null
          total_orders: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      challenge_leaderboard: {
        Row: {
          avatar_url: string | null
          challenge_id: string | null
          completed_at: string | null
          current_progress: number | null
          progress_percent: number | null
          rank: number | null
          target_value: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "community_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      restaurant_capacity_status: {
        Row: {
          capacity_status: string | null
          current_day_orders: number | null
          daily_reset_at: string | null
          id: string | null
          max_meals_per_day: number | null
          name: string | null
          remaining_capacity: number | null
          usage_percentage: number | null
        }
        Insert: {
          capacity_status?: never
          current_day_orders?: number | null
          daily_reset_at?: string | null
          id?: string | null
          max_meals_per_day?: number | null
          name?: string | null
          remaining_capacity?: never
          usage_percentage?: never
        }
        Update: {
          capacity_status?: never
          current_day_orders?: number | null
          daily_reset_at?: string | null
          id?: string | null
          max_meals_per_day?: number | null
          name?: string | null
          remaining_capacity?: never
          usage_percentage?: never
        }
        Relationships: []
      }
      restaurant_details_secure: {
        Row: {
          alternate_phone: string | null
          avg_prep_time_minutes: number | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          created_at: string | null
          cuisine_type: string[] | null
          dietary_tags: string[] | null
          id: string | null
          max_meals_per_day: number | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          operating_hours: Json | null
          restaurant_id: string | null
          swift_code: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          alternate_phone?: string | null
          avg_prep_time_minutes?: number | null
          bank_account_number?: never
          bank_iban?: never
          bank_name?: never
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string | null
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
          restaurant_id?: string | null
          swift_code?: never
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          alternate_phone?: string | null
          avg_prep_time_minutes?: number | null
          bank_account_number?: never
          bank_iban?: never
          bank_name?: never
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string | null
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
          restaurant_id?: string | null
          swift_code?: never
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurant_capacity_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_details_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      slow_query_candidates: {
        Row: {
          column_name: unknown
          correlation: number | null
          n_distinct: number | null
          null_frac: number | null
          schemaname: unknown
          tablename: unknown
        }
        Relationships: []
      }
      translation_statistics: {
        Row: {
          metric: string | null
          value: string | null
        }
        Relationships: []
      }
      user_orders_view: {
        Row: {
          calories: number | null
          carbs_g: number | null
          delivery_fee: number | null
          delivery_type: string | null
          fat_g: number | null
          id: string | null
          is_completed: boolean | null
          meal_description: string | null
          meal_id: string | null
          meal_image_url: string | null
          meal_name: string | null
          meal_type: string | null
          order_created_at: string | null
          protein_g: number | null
          restaurant_id: string | null
          restaurant_logo_url: string | null
          restaurant_name: string | null
          scheduled_date: string | null
          user_email: string | null
          user_full_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      webhook_queue_status: {
        Row: {
          count: number | null
          event_type: string | null
          newest: string | null
          oldest: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_delivery_assignment: {
        Args: { p_queue_id: string }
        Returns: boolean
      }
      add_delivered_meal_to_progress: {
        Args: { p_meal_id: string; p_order_id: string }
        Returns: boolean
      }
      add_to_delivery_queue: {
        Args: {
          p_order_id: string
          p_priority_reason?: string
          p_priority_score?: number
        }
        Returns: string
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_cancel_meal_schedule: {
        Args: { p_reason?: string; p_schedule_id: string }
        Returns: Json
      }
      assign_driver_to_queue: {
        Args: {
          p_driver_id: string
          p_expiry_minutes?: number
          p_queue_id: string
        }
        Returns: boolean
      }
      assign_driver_with_lock: {
        Args: { p_driver_id: string; p_job_id: string }
        Returns: Json
      }
      authenticate_partner_api_request: {
        Args: { p_api_key: string; p_api_secret: string }
        Returns: {
          authenticated: boolean
          name: string
          partner_id: string
          permissions: Json
          rate_limit: number
        }[]
      }
      auto_complete_delivered_orders: { Args: never; Returns: undefined }
      auto_group_deliveries: {
        Args: { p_scheduled_date: string; p_user_id: string }
        Returns: string[]
      }
      auto_rotate_api_keys: { Args: never; Returns: number }
      award_xp: {
        Args: { p_reason?: string; p_user_id: string; p_xp_amount: number }
        Returns: Json
      }
      book_recovery_session: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_credits_used: number
          p_partner_id: string
          p_service_name: string
          p_user_id: string
        }
        Returns: Json
      }
      calculate_annual_price: {
        Args: { p_monthly_price: number }
        Returns: number
      }
      calculate_daily_margin: { Args: { p_date: string }; Returns: string }
      calculate_delivery_priority: {
        Args: { p_order_id: string }
        Returns: number
      }
      calculate_driver_earnings: {
        Args: {
          p_city?: string
          p_delivery_fee: number
          p_distance_km?: number
          p_order_time?: string
          p_restaurant_id?: string
          p_tip_amount?: number
        }
        Returns: number
      }
      calculate_meal_quality_score: {
        Args: {
          added_sugars: boolean
          protein_present: boolean
          vegetables_count: number
          whole_grains: boolean
        }
        Returns: number
      }
      calculate_meal_rating: {
        Args: { p_meal_id: string }
        Returns: {
          average_rating: number
          five_star_count: number
          four_star_count: number
          one_star_count: number
          three_star_count: number
          total_reviews: number
          two_star_count: number
        }[]
      }
      calculate_next_retry: { Args: { attempt_count: number }; Returns: string }
      calculate_nps_score: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          detractors: number
          nps_score: number
          passives: number
          promoters: number
          total_responses: number
        }[]
      }
      calculate_restaurant_rating: {
        Args: { p_restaurant_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      calculate_rollover_credits: {
        Args: { p_subscription_id: string; p_user_id: string }
        Returns: Json
      }
      calculate_user_streak: { Args: { user_uuid: string }; Returns: number }
      calculate_weekly_adherence: {
        Args: { p_user_id: string; p_week_start: string }
        Returns: {
          adherence_rate: number
          avg_calories: number
          days_logged: number
        }[]
      }
      calculate_weight_change_rate: {
        Args: { p_user_id: string; p_weeks?: number }
        Returns: number
      }
      can_cancel_order: {
        Args: { p_order_id: string; p_role?: string }
        Returns: Json
      }
      cancel_meal_schedule:
        | { Args: { p_schedule_id: string }; Returns: Json }
        | { Args: { p_reason?: string; p_schedule_id: string }; Returns: Json }
      cancel_order: {
        Args: {
          p_cancelled_by_role?: string
          p_order_id: string
          p_reason: string
          p_reason_category?: string
        }
        Returns: Json
      }
      check_and_award_badges: { Args: { p_user_id: string }; Returns: Json }
      check_restaurant_capacity: {
        Args: { p_restaurant_id: string }
        Returns: {
          can_accept: boolean
          current_orders: number
          max_capacity: number
          message: string
          remaining_capacity: number
        }[]
      }
      claim_delivery_atomic: {
        Args: { p_delivery_id: string; p_driver_id: string }
        Returns: Json
      }
      claim_delivery_job: {
        Args: { p_driver_id: string; p_job_id: string }
        Returns: Json
      }
      cleanup_old_driver_locations: { Args: never; Returns: undefined }
      cleanup_old_top_meals: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_revoked_tokens: { Args: never; Returns: undefined }
      complete_meal_atomic: {
        Args: {
          p_calories?: number
          p_carbs_g?: number
          p_fat_g?: number
          p_fiber_g?: number
          p_log_date: string
          p_protein_g?: number
          p_schedule_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_subscription: {
        Args: {
          p_billing_interval?: string
          p_payment_method_id?: string
          p_tier: string
          p_user_id: string
        }
        Returns: Json
      }
      create_wallet_topup_invoice: {
        Args: {
          p_amount: number
          p_bonus_amount?: number
          p_payment_reference?: string
          p_user_id: string
        }
        Returns: string
      }
      credit_wallet: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      deactivate_old_push_tokens: {
        Args: { p_keep_count?: number; p_user_id: string }
        Returns: number
      }
      debit_wallet: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_reference_id?: string
          p_reference_type?: string
          p_user_id: string
        }
        Returns: string
      }
      decline_delivery_assignment: {
        Args: { p_queue_id: string; p_reason?: string }
        Returns: boolean
      }
      decrement_addon_usage: { Args: { addon_id: string }; Returns: undefined }
      decrement_monthly_meal_usage: {
        Args: { p_count?: number; p_subscription_id: string }
        Returns: boolean
      }
      delete_meal_review: {
        Args: { p_review_id: string; p_user_id: string }
        Returns: Json
      }
      detect_weight_plateau: {
        Args: { p_user_id: string; p_weeks_threshold?: number }
        Returns: boolean
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_admin_role: { Args: { p_user_id: string }; Returns: undefined }
      ensure_fleet_manager_role: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      escalate_to_manual_assignment: {
        Args: { p_queue_id: string; p_reason?: string }
        Returns: boolean
      }
      expire_old_rollover_credits: { Args: never; Returns: number }
      feature_nps_response: {
        Args: { p_response_id: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: { p_type: string }; Returns: string }
      generate_partner_api_credentials: {
        Args: { p_partner_id: string }
        Returns: {
          api_key: string
          plain_secret: string
        }[]
      }
      generate_pickup_qr_code: {
        Args: { p_delivery_job_id: string }
        Returns: string
      }
      generate_pickup_verification_code: { Args: never; Returns: string }
      generate_weekly_report: {
        Args: { p_user_id: string; p_week_start: string }
        Returns: string
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_challenges: {
        Args: { p_user_id?: string }
        Returns: {
          category: string
          challenge_type: string
          description: string
          difficulty_level: string
          end_date: string
          id: string
          is_joined: boolean
          participant_count: number
          reward_points: number
          start_date: string
          target_value: number
          title: string
          user_progress: number
          user_rank: number
          xp_reward: number
        }[]
      }
      get_affiliate_leaderboard_earnings: {
        Args: { limit_count?: number }
        Returns: {
          affiliate_tier: string
          avatar_url: string
          full_name: string
          id: string
          referral_count: number
          total_affiliate_earnings: number
        }[]
      }
      get_affiliate_leaderboard_referrals: {
        Args: { limit_count?: number }
        Returns: {
          affiliate_tier: string
          avatar_url: string
          full_name: string
          id: string
          referral_count: number
          total_affiliate_earnings: number
        }[]
      }
      get_affiliate_network: {
        Args: { p_referrer_id: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          tier: number
          user_id: string
        }[]
      }
      get_available_deliveries: {
        Args: {
          p_driver_lat?: number
          p_driver_lng?: number
          p_max_distance_km?: number
        }
        Returns: {
          delivery_address: string
          delivery_fee: number
          delivery_lat: number
          delivery_lng: number
          distance_km: number
          order_id: string
          priority_score: number
          queue_id: string
          queued_at: string
          restaurant_id: string
          restaurant_name: string
          tip_amount: number
        }[]
      }
      get_cancellation_stats: {
        Args: {
          p_end_date?: string
          p_restaurant_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_customer_driver_ids: {
        Args: { customer_uuid: string }
        Returns: {
          driver_id: string
        }[]
      }
      get_delivery_details_for_driver: {
        Args: { p_delivery_job_id: string }
        Returns: Json
      }
      get_meal_info_for_schedules: {
        Args: { p_schedule_ids: string[] }
        Returns: Json
      }
      get_meal_quality_grade: { Args: { score: number }; Returns: string }
      get_meal_reviews: {
        Args: {
          p_limit?: number
          p_meal_id: string
          p_offset?: number
          p_sort_by?: string
        }
        Returns: {
          created_at: string
          helpful_count: number
          is_verified_purchase: boolean
          photo_urls: string[]
          rating: number
          review_id: string
          review_text: string
          tags: string[]
          title: string
          user_avatar: string
          user_id: string
          user_name: string
          would_recommend: boolean
        }[]
      }
      get_meal_with_translation: {
        Args: {
          p_language_code?: Database["public"]["Enums"]["language_code"]
          p_meal_id: string
        }
        Returns: {
          calories: number
          carbs_g: number
          description: string
          fat_g: number
          fiber_g: number
          id: string
          image_url: string
          is_auto_translated: boolean
          is_available: boolean
          is_translated: boolean
          name: string
          order_count: number
          prep_time_minutes: number
          price: number
          protein_g: number
          rating: number
          restaurant_id: string
          review_status: string
        }[]
      }
      get_nps_trend_by_month: {
        Args: { p_months?: number }
        Returns: {
          month: string
          nps_score: number
          total_responses: number
        }[]
      }
      get_skip_analytics: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id?: string }
        Returns: {
          percentage: number
          reason_type: string
          total_skips: number
        }[]
      }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_affiliate_rank: {
        Args: { user_uuid: string }
        Returns: {
          earnings: number
          referrals: number
        }[]
      }
      get_user_health_goal: {
        Args: { user_uuid: string }
        Returns: {
          activity_level: string | null
          age: number | null
          created_at: string | null
          current_weight: number | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          goal: Database["public"]["Enums"]["health_goal_type"]
          height: number | null
          id: string
          target_weight: number | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_push_tokens: {
        Args: { p_user_id: string }
        Returns: {
          platform: string
          token: string
        }[]
      }
      get_user_restaurant_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_valid_next_statuses: {
        Args: { current_status: string }
        Returns: string[]
      }
      get_wallet_balance: { Args: { p_user_id: string }; Returns: number }
      get_win_back_offers: {
        Args: { p_step: number; p_subscription_id: string; p_user_id: string }
        Returns: {
          bonus_credits: number
          description: string
          discount_duration_months: number
          discount_percent: number
          name: string
          offer_code: string
          offer_id: string
          offer_type: string
          pause_duration_days: number
          target_tier: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_staff_permission: {
        Args: { p_permission: string; p_restaurant_id: string }
        Returns: boolean
      }
      has_user_submitted_nps: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_addon_usage: { Args: { addon_id: string }; Returns: undefined }
      increment_meal_usage: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      increment_monthly_meal_usage: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      increment_recovery_credits: {
        Args: { p_credits: number; p_period_start: string; p_user_id: string }
        Returns: undefined
      }
      increment_restaurant_order_count: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      increment_snack_usage: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      is_approved_affiliate: { Args: { _user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { p_ip: unknown }; Returns: boolean }
      is_restaurant_staff: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      join_challenge: {
        Args: { p_challenge_id: string; p_user_id: string }
        Returns: Json
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      manual_assign_driver: {
        Args: { p_driver_id: string; p_notes?: string; p_queue_id: string }
        Returns: boolean
      }
      mark_all_notifications_as_read: { Args: never; Returns: undefined }
      mark_notification_as_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
      mark_webhook_delivered: { Args: { p_id: string }; Returns: undefined }
      mark_webhook_failed: {
        Args: { p_error: string; p_http_status?: number; p_id: string }
        Returns: undefined
      }
      optimize_delivery_route: {
        Args: { p_delivery_group_id: string }
        Returns: Json
      }
      partner_confirm_handover:
        | {
            Args: { p_delivery_job_id: string; p_partner_user_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_delivery_job_id: string
              p_partner_user_id: string
              p_reason?: string
            }
            Returns: Json
          }
      pause_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_driver_withdrawal: {
        Args: {
          p_account_holder_name?: string
          p_amount: number
          p_bank_account_number?: string
          p_bank_name?: string
          p_driver_id: string
          p_payment_method?: string
        }
        Returns: string
      }
      process_payment_atomic: {
        Args: {
          p_amount: number
          p_description?: string
          p_gateway_reference: string
          p_payment_id: string
          p_payment_method: string
          p_user_id: string
        }
        Returns: Json
      }
      refresh_analytics_stats: { Args: never; Returns: undefined }
      refresh_verification_code: {
        Args: { p_delivery_job_id: string; p_partner_user_id: string }
        Returns: Json
      }
      request_subscription_freeze: {
        Args: {
          p_freeze_end_date: string
          p_freeze_start_date: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reschedule_meal: {
        Args: {
          p_new_date?: string
          p_new_meal_type?: string
          p_new_time_slot?: string
          p_schedule_id: string
        }
        Returns: Json
      }
      reset_daily_capacity_counts: { Args: never; Returns: undefined }
      reset_weekly_meal_quotas: { Args: never; Returns: number }
      resume_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      retry_failed_payment: {
        Args: { p_payment_id: string; p_user_id: string }
        Returns: Json
      }
      schedule_webhook: {
        Args: {
          p_event_type: string
          p_headers?: Json
          p_payload: Json
          p_webhook_url: string
        }
        Returns: string
      }
      select_nearest_branch: {
        Args: {
          p_customer_lat: number
          p_customer_lng: number
          p_restaurant_id: string
        }
        Returns: string
      }
      select_nearest_branch_for_meal: {
        Args: {
          p_delivery_address_id?: string
          p_meal_id: string
          p_user_id: string
        }
        Returns: string
      }
      send_announcement_notification: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      send_whatsapp_notification: {
        Args: { p_message: string; p_phone: string; p_template?: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_meal_review: {
        Args: {
          p_meal_id: string
          p_photo_urls?: string[]
          p_rating: number
          p_review_text?: string
          p_tags?: string[]
          p_title?: string
          p_user_id: string
          p_would_recommend?: boolean
        }
        Returns: Json
      }
      submit_skip_reason: {
        Args: {
          p_ai_confidence_score?: number
          p_details?: string
          p_meal_id: string
          p_meal_type?: string
          p_reason_type: string
          p_schedule_id: string
          p_scheduled_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      test_func: { Args: never; Returns: undefined }
      trigger_whatsapp_notification_processor: {
        Args: never
        Returns: undefined
      }
      uncomplete_meal_atomic: {
        Args: { p_log_date: string; p_schedule_id: string; p_user_id: string }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_challenge_progress: {
        Args: { p_challenge_id: string; p_progress: number; p_user_id: string }
        Returns: Json
      }
      update_order_status: {
        Args: { p_new_status: string; p_order_id: string; p_user_role: string }
        Returns: boolean
      }
      update_push_token_usage: { Args: { p_token: string }; Returns: undefined }
      update_restaurant_banking_info: {
        Args: {
          p_bank_account_number: string
          p_bank_iban: string
          p_bank_name: string
          p_restaurant_id: string
          p_swift_code: string
        }
        Returns: undefined
      }
      update_restaurant_capacity: {
        Args: { p_max_meals_per_day: number; p_restaurant_id: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upgrade_subscription: {
        Args: {
          p_new_billing_interval?: string
          p_new_tier: string
          p_subscription_id: string
        }
        Returns: Json
      }
      use_rollover_credit_if_available: {
        Args: { p_subscription_id: string; p_user_id: string }
        Returns: Json
      }
      verify_pickup_by_code: {
        Args: { p_driver_id: string; p_verification_code: string }
        Returns: Json
      }
      verify_pickup_by_qr:
        | { Args: { p_delivery_id: string; p_qr_code: string }; Returns: Json }
        | {
            Args: {
              p_delivery_id: string
              p_driver_id: string
              p_qr_code: string
            }
            Returns: Json
          }
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "very_active"
      affiliate_status: "pending" | "approved" | "rejected"
      app_role:
        | "user"
        | "admin"
        | "gym_owner"
        | "staff"
        | "restaurant"
        | "driver"
        | "partner"
      approval_status: "pending" | "approved" | "rejected"
      cancellation_reason:
        | "too_expensive"
        | "not_using_enough"
        | "moving_away"
        | "dietary_changes"
        | "quality_issues"
        | "delivery_issues"
        | "found_alternative"
        | "temporary_break"
        | "other"
      delivery_status:
        | "pending"
        | "claimed"
        | "picked_up"
        | "on_the_way"
        | "delivered"
        | "cancelled"
      gender_type: "male" | "female" | "prefer_not_to_say"
      health_goal: "lose" | "gain" | "maintain"
      health_goal_type:
        | "weight_loss"
        | "maintain_weight"
        | "build_muscle"
        | "medical_diet"
      language_code: "en" | "ar"
      notification_status: "unread" | "read" | "archived"
      notification_type:
        | "meal_reminder"
        | "plan_update"
        | "health_insight"
        | "system_alert"
        | "delivery_update"
        | "achievement"
        | "subscription"
        | "order_delivered"
        | "meal_scheduled"
        | "general"
        | "subscription_alert"
        | "order_update"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready_for_pickup"
        | "picked_up"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "completed"
      restaurant_status: "active" | "inactive" | "pending"
      subscription_plan: "weekly" | "monthly"
      subscription_status: "active" | "cancelled" | "expired" | "pending"
      vehicle_type: "bike" | "scooter" | "motorcycle" | "car"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      affiliate_status: ["pending", "approved", "rejected"],
      app_role: [
        "user",
        "admin",
        "gym_owner",
        "staff",
        "restaurant",
        "driver",
        "partner",
      ],
      approval_status: ["pending", "approved", "rejected"],
      cancellation_reason: [
        "too_expensive",
        "not_using_enough",
        "moving_away",
        "dietary_changes",
        "quality_issues",
        "delivery_issues",
        "found_alternative",
        "temporary_break",
        "other",
      ],
      delivery_status: [
        "pending",
        "claimed",
        "picked_up",
        "on_the_way",
        "delivered",
        "cancelled",
      ],
      gender_type: ["male", "female", "prefer_not_to_say"],
      health_goal: ["lose", "gain", "maintain"],
      health_goal_type: [
        "weight_loss",
        "maintain_weight",
        "build_muscle",
        "medical_diet",
      ],
      language_code: ["en", "ar"],
      notification_status: ["unread", "read", "archived"],
      notification_type: [
        "meal_reminder",
        "plan_update",
        "health_insight",
        "system_alert",
        "delivery_update",
        "achievement",
        "subscription",
        "order_delivered",
        "meal_scheduled",
        "general",
        "subscription_alert",
        "order_update",
      ],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "completed",
      ],
      restaurant_status: ["active", "inactive", "pending"],
      subscription_plan: ["weekly", "monthly"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
      vehicle_type: ["bike", "scooter", "motorcycle", "car"],
    },
  },
} as const
