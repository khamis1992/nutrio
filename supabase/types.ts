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
            foreignKeyName: "deliveries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "meal_schedules"
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
          id: string
          is_online: boolean | null
          license_number: string | null
          rating: number | null
          total_deliveries: number | null
          updated_at: string | null
          user_id: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
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
          id?: string
          is_online?: boolean | null
          license_number?: string | null
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
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
          id?: string
          is_online?: boolean | null
          license_number?: string | null
          rating?: number | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
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
        ]
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
        ]
      }
      meals: {
        Row: {
          available: boolean | null
          calories: number | null
          carbs: number | null
          category_id: string | null
          created_at: string | null
          description: string | null
          fats: number | null
          id: string
          image_url: string | null
          ingredients: string | null
          meal_type: string | null
          name: string
          price: number | null
          protein: number | null
          restaurant_id: string | null
          vendor: string | null
        }
        Insert: {
          available?: boolean | null
          calories?: number | null
          carbs?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          fats?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          meal_type?: string | null
          name: string
          price?: number | null
          protein?: number | null
          restaurant_id?: string | null
          vendor?: string | null
        }
        Update: {
          available?: boolean | null
          calories?: number | null
          carbs?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          fats?: number | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          meal_type?: string | null
          name?: string
          price?: number | null
          protein?: number | null
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
      order_items: {
        Row: {
          created_at: string | null
          id: string
          meal_name: string
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          meal_name: string
          order_id: string
          quantity?: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          meal_name?: string
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
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
          phone_number: string | null
          picked_up_at: string | null
          preparing_at: string | null
          ready_for_pickup_at: string | null
          restaurant_id: string | null
          special_instructions: string | null
          status: string
          tip_amount: number | null
          total_amount: number
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
          phone_number?: string | null
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_for_pickup_at?: string | null
          restaurant_id?: string | null
          special_instructions?: string | null
          status?: string
          tip_amount?: number | null
          total_amount: number
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
          phone_number?: string | null
          picked_up_at?: string | null
          preparing_at?: string | null
          ready_for_pickup_at?: string | null
          restaurant_id?: string | null
          special_instructions?: string | null
          status?: string
          tip_amount?: number | null
          total_amount?: number
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
          created_at: string | null
          cuisine_type: string | null
          description: string | null
          dietary_tags: string[] | null
          email: string | null
          id: string
          image_url: string | null
          is_partner: boolean | null
          latitude: number | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          operating_hours: Json | null
          owner_id: string | null
          phone_number: string | null
          rating: number | null
          reviews_count: number | null
          status: Database["public"]["Enums"]["restaurant_status"] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          cuisine_type?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_partner?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          operating_hours?: Json | null
          owner_id?: string | null
          phone_number?: string | null
          rating?: number | null
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          cuisine_type?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_partner?: boolean | null
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          operating_hours?: Json | null
          owner_id?: string | null
          phone_number?: string | null
          rating?: number | null
          reviews_count?: number | null
          status?: Database["public"]["Enums"]["restaurant_status"] | null
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
          id: string
          includes_gym: boolean | null
          plan_type: string | null
          price: number | null
          start_date: string | null
          subscriber_id: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          includes_gym?: boolean | null
          plan_type?: string | null
          price?: number | null
          start_date?: string | null
          subscriber_id?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          includes_gym?: boolean | null
          plan_type?: string | null
          price?: number | null
          start_date?: string | null
          subscriber_id?: string | null
          user_id?: string | null
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
      [_ in never]: never
    }
    Functions: {
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
      generate_invoice_number: { Args: { p_type: string }; Returns: string }
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
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_all_notifications_as_read: { Args: never; Returns: undefined }
      mark_notification_as_read: {
        Args: { notification_id: string }
        Returns: undefined
      }
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
      send_whatsapp_notification: {
        Args: { p_message: string; p_phone: string; p_template?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "user"
        | "admin"
        | "gym_owner"
        | "staff"
        | "restaurant"
        | "driver"
      approval_status: "pending" | "approved" | "rejected"
      delivery_status:
        | "pending"
        | "claimed"
        | "picked_up"
        | "on_the_way"
        | "delivered"
        | "cancelled"
      gender_type: "male" | "female" | "prefer_not_to_say"
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
      vehicle_type: "bike" | "scooter" | "motorcycle" | "car"
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
      app_role: ["user", "admin", "gym_owner", "staff", "restaurant", "driver"],
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
      vehicle_type: ["bike", "scooter", "motorcycle", "car"],
    },
  },
} as const
