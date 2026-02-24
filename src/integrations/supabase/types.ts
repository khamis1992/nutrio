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
      community_challenges: {
        Row: {
          challenge_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_active: boolean | null
          leaderboard_id: string | null
          participant_count: number | null
          reward_points: number | null
          start_date: string
          target_value: number
          title: string
        }
        Insert: {
          challenge_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          leaderboard_id?: string | null
          participant_count?: number | null
          reward_points?: number | null
          start_date: string
          target_value: number
          title: string
        }
        Update: {
          challenge_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          leaderboard_id?: string | null
          participant_count?: number | null
          reward_points?: number | null
          start_date?: string
          target_value?: number
          title?: string
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
      delivery_jobs: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          created_at: string | null
          customer_otp: string | null
          delivered_at: string | null
          delivery_fee: number | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          driver_earnings: number | null
          driver_id: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          picked_up_at: string | null
          pickup_photo_url: string | null
          schedule_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          created_at?: string | null
          customer_otp?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          picked_up_at?: string | null
          pickup_photo_url?: string | null
          schedule_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          created_at?: string | null
          customer_otp?: string | null
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          driver_earnings?: number | null
          driver_id?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          picked_up_at?: string | null
          pickup_photo_url?: string | null
          schedule_id?: string
          status?: string | null
          updated_at?: string | null
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
            foreignKeyName: "delivery_jobs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_jobs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["id"]
          },
        ]
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
      driver_payouts: {
        Row: {
          amount: number
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
            referencedRelation: "deliveries"
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
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          current_location: unknown
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_location_update: string | null
          license_number: string | null
          license_plate: string | null
          phone_number: string | null
          rating: number | null
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
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: unknown
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          phone_number?: string | null
          rating?: number | null
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
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_location?: unknown
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          license_number?: string | null
          license_plate?: string | null
          phone_number?: string | null
          rating?: number | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance?: number | null
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
          {
            foreignKeyName: "featured_listings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["restaurant_id"]
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
      meal_schedules: {
        Row: {
          addons_total: number | null
          created_at: string | null
          delivery_fee: number | null
          delivery_type: string | null
          id: string
          is_completed: boolean | null
          meal_id: string
          meal_type: string
          order_status: string | null
          restaurant_id: string | null
          scheduled_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          addons_total?: number | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id: string
          meal_type?: string
          order_status?: string | null
          restaurant_id?: string | null
          scheduled_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          addons_total?: number | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_type?: string | null
          id?: string
          is_completed?: boolean | null
          meal_id?: string
          meal_type?: string
          order_status?: string | null
          restaurant_id?: string | null
          scheduled_date?: string
          updated_at?: string | null
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
          {
            foreignKeyName: "meal_schedules_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "user_orders_view"
            referencedColumns: ["meal_id"]
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
      meals: {
        Row: {
          calories: number | null
          carbs: number | null
          carbs_g: number | null
          category_id: string | null
          created_at: string | null
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
          protein: number | null
          protein_g: number | null
          rating: number | null
          restaurant_id: string | null
          vendor: string | null
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          carbs_g?: number | null
          category_id?: string | null
          created_at?: string | null
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
          protein?: number | null
          protein_g?: number | null
          rating?: number | null
          restaurant_id?: string | null
          vendor?: string | null
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          carbs_g?: number | null
          category_id?: string | null
          created_at?: string | null
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
          protein?: number | null
          protein_g?: number | null
          rating?: number | null
          restaurant_id?: string | null
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
          plan_updates: boolean | null
          push_notifications: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          subscription_updates: boolean | null
          system_alerts: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          achievements?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          email_notifications?: boolean | null
          health_insights?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          plan_updates?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          subscription_updates?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievements?: boolean | null
          created_at?: string | null
          delivery_updates?: boolean | null
          email_notifications?: boolean | null
          health_insights?: boolean | null
          id?: string
          meal_reminders?: boolean | null
          plan_updates?: boolean | null
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          subscription_updates?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          created_at: string
          estimated_completion_time: string | null
          id: string
          notes: string | null
          order_id: string | null
          staff_member_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          staff_member_id?: string | null
          status: string
        }
        Update: {
          created_at?: string
          estimated_completion_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          staff_member_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
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
          restaurant_id: string | null
          special_instructions: string | null
          status: string
          tip_amount: number | null
          total_amount: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
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
          restaurant_id?: string | null
          special_instructions?: string | null
          status?: string
          tip_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
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
          restaurant_id?: string | null
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
          api_secret: string
          created_at: string
          email: string
          id: string
          last_used_at: string | null
          name: string
          permissions: Json | null
          rate_limit: number | null
          status: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string
          api_secret: string
          created_at?: string
          email: string
          id?: string
          last_used_at?: string | null
          name: string
          permissions?: Json | null
          rate_limit?: number | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          email?: string
          id?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json | null
          rate_limit?: number | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
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
          status: string | null
          updated_at: string | null
          user_id: string | null
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
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          next_scheduled_adjustment: string | null
          onboarding_completed: boolean | null
          plateau_weeks: number | null
          protein_target_g: number | null
          streak_days: number | null
          target_weight_kg: number | null
          tier1_referrer_id: string | null
          tier2_referrer_id: string | null
          tier3_referrer_id: string | null
          total_affiliate_earnings: number | null
          updated_at: string
          user_id: string
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
          next_scheduled_adjustment?: string | null
          onboarding_completed?: boolean | null
          plateau_weeks?: number | null
          protein_target_g?: number | null
          streak_days?: number | null
          target_weight_kg?: number | null
          tier1_referrer_id?: string | null
          tier2_referrer_id?: string | null
          tier3_referrer_id?: string | null
          total_affiliate_earnings?: number | null
          updated_at?: string
          user_id: string
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
          next_scheduled_adjustment?: string | null
          onboarding_completed?: boolean | null
          plateau_weeks?: number | null
          protein_target_g?: number | null
          streak_days?: number | null
          target_weight_kg?: number | null
          tier1_referrer_id?: string | null
          tier2_referrer_id?: string | null
          tier3_referrer_id?: string | null
          total_affiliate_earnings?: number | null
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
      restaurant_details: {
        Row: {
          alternate_phone: string | null
          avg_prep_time_minutes: number | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          created_at: string | null
          cuisine_type: string[] | null
          dietary_tags: string[] | null
          id: string
          max_meals_per_day: number | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          operating_hours: Json | null
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
          bank_iban?: string | null
          bank_name?: string | null
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
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
          bank_iban?: string | null
          bank_name?: string | null
          created_at?: string | null
          cuisine_type?: string[] | null
          dietary_tags?: string[] | null
          id?: string
          max_meals_per_day?: number | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          operating_hours?: Json | null
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
      restaurants: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approved_at: string | null
          approved_by: string | null
          avg_prep_time_minutes: number | null
          bank_info: Json | null
          created_at: string | null
          cuisine_type: string | null
          cuisine_types: string[] | null
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
          reviews_count: number | null
          status: Database["public"]["Enums"]["restaurant_status"] | null
          total_orders: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          avg_prep_time_minutes?: number | null
          bank_info?: Json | null
          created_at?: string | null
          cuisine_type?: string | null
          cuisine_types?: string[] | null
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
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          total_orders?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          avg_prep_time_minutes?: number | null
          bank_info?: Json | null
          created_at?: string | null
          cuisine_type?: string | null
          cuisine_types?: string[] | null
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
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          total_orders?: number | null
          updated_at?: string | null
          website?: string | null
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
        }
        Insert: {
          address?: string | null
          created_at?: string
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
        }
        Update: {
          address?: string | null
          created_at?: string
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
      subscriptions: {
        Row: {
          active: boolean | null
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
          plan: string | null
          plan_type: string | null
          price: number | null
          rollover_credits: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id: string | null
          tier: string | null
          user_id: string | null
          week_start_date: string | null
        }
        Insert: {
          active?: boolean | null
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
          plan?: string | null
          plan_type?: string | null
          price?: number | null
          rollover_credits?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id?: string | null
          tier?: string | null
          user_id?: string | null
          week_start_date?: string | null
        }
        Update: {
          active?: boolean | null
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
          plan?: string | null
          plan_type?: string | null
          price?: number | null
          rollover_credits?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          subscriber_id?: string | null
          tier?: string | null
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
      workout_sessions: {
        Row: {
          calories_burned: number | null
          created_at: string
          duration_minutes: number | null
          gym_id: string | null
          id: string
          notes: string | null
          session_date: string
          user_id: string | null
          workout_type: string | null
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string
          duration_minutes?: number | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          session_date: string
          user_id?: string | null
          workout_type?: string | null
        }
        Update: {
          calories_burned?: number | null
          created_at?: string
          duration_minutes?: number | null
          gym_id?: string | null
          id?: string
          notes?: string | null
          session_date?: string
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
    }
    Views: {
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
      add_delivered_meal_to_progress: {
        Args: { p_meal_id: string; p_order_id: string }
        Returns: boolean
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
      calculate_daily_margin: { Args: { p_date: string }; Returns: string }
      calculate_meal_quality_score: {
        Args: {
          added_sugars: boolean
          protein_present: boolean
          vegetables_count: number
          whole_grains: boolean
        }
        Returns: number
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
      cleanup_old_driver_locations: { Args: never; Returns: undefined }
      cleanup_old_top_meals: { Args: never; Returns: undefined }
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
      decrement_addon_usage: { Args: { addon_id: string }; Returns: undefined }
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
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      generate_invoice_number: { Args: { p_type: string }; Returns: string }
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
      get_meal_quality_grade: { Args: { score: number }; Returns: string }
      get_unread_notification_count: { Args: never; Returns: number }
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
      gettransactionid: { Args: never; Returns: unknown }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      is_approved_affiliate: { Args: { _user_id: string }; Returns: boolean }
      is_ip_blocked: { Args: { p_ip: unknown }; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_all_notifications_as_read: { Args: never; Returns: undefined }
      mark_notification_as_read: {
        Args: { notification_id: string }
        Returns: undefined
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
      reset_weekly_meal_quotas: { Args: never; Returns: number }
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
      unlockrows: { Args: { "": string }; Returns: number }
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
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready_for_pickup"
        | "picked_up"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
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
      ],
      restaurant_status: ["active", "inactive", "pending"],
      subscription_plan: ["weekly", "monthly"],
      subscription_status: ["active", "cancelled", "expired", "pending"],
      vehicle_type: ["bike", "scooter", "motorcycle", "car"],
    },
  },
} as const
