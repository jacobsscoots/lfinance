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
      bank_accounts: {
        Row: {
          account_type: string | null
          balance: number
          connection_id: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          external_id: string | null
          id: string
          is_hidden: boolean
          is_primary: boolean | null
          last_synced_at: string | null
          name: string
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          balance?: number
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_hidden?: boolean
          is_primary?: boolean | null
          last_synced_at?: string | null
          name: string
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          balance?: number
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          external_id?: string | null
          id?: string
          is_hidden?: boolean
          is_primary?: boolean | null
          last_synced_at?: string | null
          name?: string
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_occurrences: {
        Row: {
          bill_id: string
          created_at: string
          due_date: string
          expected_amount: number
          id: string
          match_confidence: string | null
          notes: string | null
          paid_at: string | null
          paid_transaction_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          due_date: string
          expected_amount: number
          id?: string
          match_confidence?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_transaction_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          due_date?: string
          expected_amount?: number
          id?: string
          match_confidence?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_transaction_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_occurrences_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_occurrences_paid_transaction_id_fkey"
            columns: ["paid_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_reports: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          report_date: string
          report_type: string
          sent_via: string | null
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          report_date: string
          report_type: string
          sent_via?: string | null
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          report_date?: string
          report_type?: string
          sent_via?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          account_id: string | null
          amount: number
          bill_type: string | null
          category_id: string | null
          created_at: string
          due_date_rule: string
          due_day: number
          end_date: string | null
          frequency: Database["public"]["Enums"]["bill_frequency"]
          id: string
          is_active: boolean | null
          is_subscription: boolean | null
          is_variable: boolean | null
          name: string
          next_review_date: string | null
          notes: string | null
          provider: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bill_type?: string | null
          category_id?: string | null
          created_at?: string
          due_date_rule?: string
          due_day: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          is_variable?: boolean | null
          name: string
          next_review_date?: string | null
          notes?: string | null
          provider?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_type?: string | null
          category_id?: string | null
          created_at?: string
          due_date_rule?: string
          due_day?: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          is_active?: boolean | null
          is_subscription?: boolean | null
          is_variable?: boolean | null
          name?: string
          next_review_date?: string | null
          notes?: string | null
          provider?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bright_connections: {
        Row: {
          access_token: string | null
          created_at: string | null
          electricity_resource_id: string | null
          gas_resource_id: string | null
          id: string
          last_synced_at: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          electricity_resource_id?: string | null
          gas_resource_id?: string | null
          id?: string
          last_synced_at?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          electricity_resource_id?: string | null
          gas_resource_id?: string | null
          id?: string
          last_synced_at?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cheaper_bills_settings: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          in_app_notifications: boolean | null
          notification_email: string | null
          postcode: string | null
          preferred_contract_type: string | null
          risk_preference: string | null
          savings_threshold: number | null
          scan_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          notification_email?: string | null
          postcode?: string | null
          preferred_contract_type?: string | null
          risk_preference?: string | null
          savings_threshold?: number | null
          scan_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          notification_email?: string | null
          postcode?: string | null
          preferred_contract_type?: string | null
          risk_preference?: string | null
          savings_threshold?: number | null
          scan_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comparison_results: {
        Row: {
          annual_cost: number | null
          created_at: string
          features: Json | null
          id: string
          is_best_offer: boolean | null
          monthly_cost: number
          plan_name: string | null
          provider: string
          scanned_at: string | null
          service_type: string
          source: string | null
          tracked_service_id: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          annual_cost?: number | null
          created_at?: string
          features?: Json | null
          id?: string
          is_best_offer?: boolean | null
          monthly_cost: number
          plan_name?: string | null
          provider: string
          scanned_at?: string | null
          service_type: string
          source?: string | null
          tracked_service_id?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          annual_cost?: number | null
          created_at?: string
          features?: Json | null
          id?: string
          is_best_offer?: boolean | null
          monthly_cost?: number
          plan_name?: string | null
          provider?: string
          scanned_at?: string | null
          service_type?: string
          source?: string | null
          tracked_service_id?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_results_tracked_service_id_fkey"
            columns: ["tracked_service_id"]
            isOneToOne: false
            referencedRelation: "tracked_services"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notifications: {
        Row: {
          created_at: string
          deal_id: string | null
          id: string
          is_read: boolean | null
          message: string | null
          notification_type: string | null
          rule_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string | null
          rule_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          notification_type?: string | null
          rule_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "deal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_price_history: {
        Row: {
          deal_id: string
          id: string
          price: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          deal_id: string
          id?: string
          price: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          deal_id?: string
          id?: string
          price?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_price_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rules: {
        Row: {
          alert_cooldown_minutes: number | null
          category: string | null
          created_at: string
          enabled: boolean | null
          id: string
          keywords_exclude: string[] | null
          keywords_include: string[] | null
          last_notified_at: string | null
          location_filter: string | null
          max_price: number | null
          min_discount_percent: number | null
          min_price: number | null
          name: string
          notify_email: boolean | null
          notify_in_app: boolean | null
          shipping_filter: string | null
          store_blacklist: string[] | null
          store_whitelist: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_cooldown_minutes?: number | null
          category?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          keywords_exclude?: string[] | null
          keywords_include?: string[] | null
          last_notified_at?: string | null
          location_filter?: string | null
          max_price?: number | null
          min_discount_percent?: number | null
          min_price?: number | null
          name: string
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          shipping_filter?: string | null
          store_blacklist?: string[] | null
          store_whitelist?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_cooldown_minutes?: number | null
          category?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          keywords_exclude?: string[] | null
          keywords_include?: string[] | null
          last_notified_at?: string | null
          location_filter?: string | null
          max_price?: number | null
          min_discount_percent?: number | null
          min_price?: number | null
          name?: string
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          shipping_filter?: string | null
          store_blacklist?: string[] | null
          store_whitelist?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_scan_logs: {
        Row: {
          created_at: string
          deals_found: number | null
          deals_inserted: number | null
          deals_updated: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          request_time_ms: number | null
          source_id: string | null
          started_at: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deals_found?: number | null
          deals_inserted?: number | null
          deals_updated?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          request_time_ms?: number | null
          source_id?: string | null
          started_at?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deals_found?: number | null
          deals_inserted?: number | null
          deals_updated?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          request_time_ms?: number | null
          source_id?: string | null
          started_at?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_scan_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "deal_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_sources: {
        Row: {
          base_url: string
          config: Json | null
          created_at: string
          enabled: boolean | null
          etag: string | null
          id: string
          last_error: string | null
          last_modified: string | null
          last_scan_at: string | null
          last_scan_status: string | null
          max_pages: number | null
          name: string
          rate_limit_ms: number | null
          scan_frequency_minutes: number | null
          scan_url: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url: string
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          etag?: string | null
          id?: string
          last_error?: string | null
          last_modified?: string | null
          last_scan_at?: string | null
          last_scan_status?: string | null
          max_pages?: number | null
          name: string
          rate_limit_ms?: number | null
          scan_frequency_minutes?: number | null
          scan_url: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string
          config?: Json | null
          created_at?: string
          enabled?: boolean | null
          etag?: string | null
          id?: string
          last_error?: string | null
          last_modified?: string | null
          last_scan_at?: string | null
          last_scan_status?: string | null
          max_pages?: number | null
          name?: string
          rate_limit_ms?: number | null
          scan_frequency_minutes?: number | null
          scan_url?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          description_snippet: string | null
          discount_percent: number | null
          first_seen_at: string
          hash: string
          id: string
          image_url: string | null
          is_new: boolean | null
          last_seen_at: string
          old_price: number | null
          price: number
          price_dropped: boolean | null
          source_id: string | null
          source_name: string
          store: string | null
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description_snippet?: string | null
          discount_percent?: number | null
          first_seen_at?: string
          hash: string
          id?: string
          image_url?: string | null
          is_new?: boolean | null
          last_seen_at?: string
          old_price?: number | null
          price: number
          price_dropped?: boolean | null
          source_id?: string | null
          source_name: string
          store?: string | null
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description_snippet?: string | null
          discount_percent?: number | null
          first_seen_at?: string
          hash?: string
          id?: string
          image_url?: string | null
          is_new?: boolean | null
          last_seen_at?: string
          old_price?: number | null
          price?: number
          price_dropped?: boolean | null
          source_id?: string | null
          source_name?: string
          store?: string | null
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "deal_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_attachments: {
        Row: {
          created_at: string
          file_path: string
          filename: string
          id: string
          owner_id: string
          owner_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          filename: string
          id?: string
          owner_id: string
          owner_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          filename?: string
          id?: string
          owner_id?: string
          owner_type?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_balance_snapshots: {
        Row: {
          balance: number
          created_at: string
          debt_id: string
          id: string
          notes: string | null
          snapshot_date: string
          source: string
          user_id: string
        }
        Insert: {
          balance: number
          created_at?: string
          debt_id: string
          id?: string
          notes?: string | null
          snapshot_date: string
          source?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          debt_id?: string
          id?: string
          notes?: string | null
          snapshot_date?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_balance_snapshots_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payment_transactions: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payment_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "debt_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          category: string
          created_at: string
          debt_id: string
          fee_amount: number | null
          id: string
          interest_amount: number | null
          notes: string | null
          payment_date: string
          principal_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          debt_id: string
          fee_amount?: number | null
          id?: string
          interest_amount?: number | null
          notes?: string | null
          payment_date: string
          principal_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          debt_id?: string
          fee_amount?: number | null
          id?: string
          interest_amount?: number | null
          notes?: string | null
          payment_date?: string
          principal_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_settings: {
        Row: {
          created_at: string
          id: string
          monthly_budget: number | null
          no_payment_days_threshold: number
          preferred_strategy: string
          reminder_days_before: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          no_payment_days_threshold?: number
          preferred_strategy?: string
          reminder_days_before?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          no_payment_days_threshold?: number
          preferred_strategy?: string
          reminder_days_before?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_transactions: {
        Row: {
          account_name: string | null
          amount: number
          created_at: string
          description: string
          id: string
          reference: string | null
          transaction_date: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          amount: number
          created_at?: string
          description: string
          id?: string
          reference?: string | null
          transaction_date: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference?: string | null
          transaction_date?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          apr: number | null
          closed_date: string | null
          created_at: string
          creditor_name: string
          current_balance: number
          debt_type: string
          due_day: number | null
          id: string
          interest_type: string
          min_payment: number | null
          notes: string | null
          opened_date: string | null
          promo_end_date: string | null
          starting_balance: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apr?: number | null
          closed_date?: string | null
          created_at?: string
          creditor_name: string
          current_balance: number
          debt_type: string
          due_day?: number | null
          id?: string
          interest_type?: string
          min_payment?: number | null
          notes?: string | null
          opened_date?: string | null
          promo_end_date?: string | null
          starting_balance: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apr?: number | null
          closed_date?: string | null
          created_at?: string
          creditor_name?: string
          current_balance?: number
          debt_type?: string
          due_day?: number | null
          id?: string
          interest_type?: string
          min_payment?: number | null
          notes?: string | null
          opened_date?: string | null
          promo_end_date?: string | null
          starting_balance?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_profiles: {
        Row: {
          created_at: string
          dishwasher_runs_per_week: number | null
          dryer_runs_per_week: number | null
          eco_mode_dishwasher: boolean | null
          eco_mode_washer: boolean | null
          has_ev: boolean | null
          has_solar: boolean | null
          heating_type: string | null
          home_type: string | null
          id: string
          low_temp_washing: boolean | null
          notes: string | null
          occupants: number | null
          peak_time_avoidance: boolean | null
          shower_minutes_avg: number | null
          smart_meter: boolean | null
          smart_thermostat: boolean | null
          tariff_type: string | null
          thermostat_temp_c: number | null
          tumble_dryer_rare: boolean | null
          updated_at: string
          user_id: string
          washer_runs_per_week: number | null
          work_from_home_days: number | null
        }
        Insert: {
          created_at?: string
          dishwasher_runs_per_week?: number | null
          dryer_runs_per_week?: number | null
          eco_mode_dishwasher?: boolean | null
          eco_mode_washer?: boolean | null
          has_ev?: boolean | null
          has_solar?: boolean | null
          heating_type?: string | null
          home_type?: string | null
          id?: string
          low_temp_washing?: boolean | null
          notes?: string | null
          occupants?: number | null
          peak_time_avoidance?: boolean | null
          shower_minutes_avg?: number | null
          smart_meter?: boolean | null
          smart_thermostat?: boolean | null
          tariff_type?: string | null
          thermostat_temp_c?: number | null
          tumble_dryer_rare?: boolean | null
          updated_at?: string
          user_id: string
          washer_runs_per_week?: number | null
          work_from_home_days?: number | null
        }
        Update: {
          created_at?: string
          dishwasher_runs_per_week?: number | null
          dryer_runs_per_week?: number | null
          eco_mode_dishwasher?: boolean | null
          eco_mode_washer?: boolean | null
          has_ev?: boolean | null
          has_solar?: boolean | null
          heating_type?: string | null
          home_type?: string | null
          id?: string
          low_temp_washing?: boolean | null
          notes?: string | null
          occupants?: number | null
          peak_time_avoidance?: boolean | null
          shower_minutes_avg?: number | null
          smart_meter?: boolean | null
          smart_thermostat?: boolean | null
          tariff_type?: string | null
          thermostat_temp_c?: number | null
          tumble_dryer_rare?: boolean | null
          updated_at?: string
          user_id?: string
          washer_runs_per_week?: number | null
          work_from_home_days?: number | null
        }
        Relationships: []
      }
      energy_readings: {
        Row: {
          consumption_kwh: number | null
          cost_estimate: number | null
          created_at: string
          fuel_type: string
          id: string
          reading_date: string
          source: string | null
          user_id: string
        }
        Insert: {
          consumption_kwh?: number | null
          cost_estimate?: number | null
          created_at?: string
          fuel_type: string
          id?: string
          reading_date: string
          source?: string | null
          user_id: string
        }
        Update: {
          consumption_kwh?: number | null
          cost_estimate?: number | null
          created_at?: string
          fuel_type?: string
          id?: string
          reading_date?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      energy_recommendation_feedback: {
        Row: {
          created_at: string
          id: string
          recommendation_key: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommendation_key: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommendation_key?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_tariffs: {
        Row: {
          created_at: string
          fix_end_date: string | null
          fuel_type: string
          id: string
          is_current: boolean | null
          is_fixed: boolean | null
          provider: string
          standing_charge_daily: number | null
          tariff_name: string
          unit_rate_kwh: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fix_end_date?: string | null
          fuel_type: string
          id?: string
          is_current?: boolean | null
          is_fixed?: boolean | null
          provider: string
          standing_charge_daily?: number | null
          tariff_name: string
          unit_rate_kwh: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fix_end_date?: string | null
          fuel_type?: string
          id?: string
          is_current?: boolean | null
          is_fixed?: boolean | null
          provider?: string
          standing_charge_daily?: number | null
          tariff_name?: string
          unit_rate_kwh?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          created_at: string
          email: string
          id: string
          last_synced_at: string | null
          refresh_token: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email?: string
          id?: string
          last_synced_at?: string | null
          refresh_token?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_match_log: {
        Row: {
          action: string
          created_at: string
          id: string
          match_reasons: Json | null
          receipt_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          receipt_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          receipt_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_match_log_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "gmail_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_match_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_receipts: {
        Row: {
          amount: number | null
          attachment_path: string | null
          attachment_type: string | null
          created_at: string
          from_email: string | null
          gmail_connection_id: string | null
          id: string
          match_confidence: string | null
          match_status: string | null
          matched_at: string | null
          matched_transaction_id: string | null
          merchant_name: string | null
          message_id: string
          order_reference: string | null
          received_at: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          from_email?: string | null
          gmail_connection_id?: string | null
          id?: string
          match_confidence?: string | null
          match_status?: string | null
          matched_at?: string | null
          matched_transaction_id?: string | null
          merchant_name?: string | null
          message_id: string
          order_reference?: string | null
          received_at?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          from_email?: string | null
          gmail_connection_id?: string | null
          id?: string
          match_confidence?: string | null
          match_status?: string | null
          matched_at?: string | null
          matched_transaction_id?: string | null
          merchant_name?: string | null
          message_id?: string
          order_reference?: string | null
          received_at?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_receipts_gmail_connection_id_fkey"
            columns: ["gmail_connection_id"]
            isOneToOne: false
            referencedRelation: "gmail_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_receipts_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_sync_settings: {
        Row: {
          allowed_domains: string[] | null
          auto_attach: boolean | null
          created_at: string
          id: string
          scan_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_domains?: string[] | null
          auto_attach?: boolean | null
          created_at?: string
          id?: string
          scan_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_domains?: string[] | null
          auto_attach?: boolean | null
          created_at?: string
          id?: string
          scan_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_cycles: {
        Row: {
          actual_spend: number | null
          budget: number
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_spend?: number | null
          budget: number
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_spend?: number | null
          budget?: number
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_orders: {
        Row: {
          actual_delivery: string | null
          created_at: string
          delivery_cost: number | null
          dispatch_date: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          order_reference: string | null
          retailer: string
          subtotal: number
          total_amount: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_delivery?: string | null
          created_at?: string
          delivery_cost?: number | null
          dispatch_date?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date: string
          order_reference?: string | null
          retailer: string
          subtotal: number
          total_amount: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_delivery?: string | null
          created_at?: string
          delivery_cost?: number | null
          dispatch_date?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_reference?: string | null
          retailer?: string
          subtotal?: number
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_purchases: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_type: string | null
          final_cost: number | null
          grams_purchased: number | null
          gross_cost: number | null
          id: string
          notes: string | null
          order_id: string | null
          product_id: string
          purchase_date: string
          quantity: number
          retailer: string | null
          transaction_id: string | null
          unit_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          final_cost?: number | null
          grams_purchased?: number | null
          gross_cost?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          purchase_date: string
          quantity?: number
          retailer?: string | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          final_cost?: number | null
          grams_purchased?: number | null
          gross_cost?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          purchase_date?: string
          quantity?: number
          retailer?: string | null
          transaction_id?: string | null
          unit_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grocery_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "grocery_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grocery_purchases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_accounts: {
        Row: {
          compounding_method: string | null
          created_at: string
          expected_annual_return: number | null
          fund_type: string | null
          id: string
          monthly_contribution: number | null
          name: string
          notes: string | null
          provider: string | null
          risk_preset: string | null
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compounding_method?: string | null
          created_at?: string
          expected_annual_return?: number | null
          fund_type?: string | null
          id?: string
          monthly_contribution?: number | null
          name: string
          notes?: string | null
          provider?: string | null
          risk_preset?: string | null
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compounding_method?: string | null
          created_at?: string
          expected_annual_return?: number | null
          fund_type?: string | null
          id?: string
          monthly_contribution?: number | null
          name?: string
          notes?: string | null
          provider?: string | null
          risk_preset?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_settings: {
        Row: {
          created_at: string
          default_expected_return: number | null
          id: string
          projection_range_months: number | null
          show_projections: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_expected_return?: number | null
          id?: string
          projection_range_months?: number | null
          show_projections?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_expected_return?: number | null
          id?: string
          projection_range_months?: number | null
          show_projections?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          investment_account_id: string
          is_recurring: boolean | null
          notes: string | null
          recurring_frequency: string | null
          source_transaction_id: string | null
          transaction_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          investment_account_id: string
          is_recurring?: boolean | null
          notes?: string | null
          recurring_frequency?: string | null
          source_transaction_id?: string | null
          transaction_date: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          investment_account_id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurring_frequency?: string | null
          source_transaction_id?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_transactions_investment_account_id_fkey"
            columns: ["investment_account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_transactions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_valuations: {
        Row: {
          created_at: string
          id: string
          investment_account_id: string
          source: string | null
          user_id: string
          valuation_date: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          investment_account_id: string
          source?: string | null
          user_id: string
          valuation_date: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          investment_account_id?: string
          source?: string | null
          user_id?: string
          valuation_date?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_valuations_investment_account_id_fkey"
            columns: ["investment_account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_blackout_ranges: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_items: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          meal_plan_id: string
          meal_type: string
          product_id: string
          quantity_grams: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          meal_plan_id: string
          meal_type: string
          product_id: string
          quantity_grams?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          meal_plan_id?: string
          meal_type?: string
          product_id?: string
          quantity_grams?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          breakfast: string | null
          breakfast_status: string
          created_at: string
          dinner: string | null
          dinner_status: string
          eating_out_breakfast_calories: number | null
          eating_out_dinner_calories: number | null
          eating_out_lunch_calories: number | null
          eating_out_snack_calories: number | null
          grocery_cycle_id: string | null
          id: string
          lunch: string | null
          lunch_status: string
          meal_date: string
          notes: string | null
          snack_status: string
          snacks: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          breakfast?: string | null
          breakfast_status?: string
          created_at?: string
          dinner?: string | null
          dinner_status?: string
          eating_out_breakfast_calories?: number | null
          eating_out_dinner_calories?: number | null
          eating_out_lunch_calories?: number | null
          eating_out_snack_calories?: number | null
          grocery_cycle_id?: string | null
          id?: string
          lunch?: string | null
          lunch_status?: string
          meal_date: string
          notes?: string | null
          snack_status?: string
          snacks?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          breakfast?: string | null
          breakfast_status?: string
          created_at?: string
          dinner?: string | null
          dinner_status?: string
          eating_out_breakfast_calories?: number | null
          eating_out_dinner_calories?: number | null
          eating_out_lunch_calories?: number | null
          eating_out_snack_calories?: number | null
          grocery_cycle_id?: string | null
          id?: string
          lunch?: string | null
          lunch_status?: string
          meal_date?: string
          notes?: string | null
          snack_status?: string
          snacks?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_grocery_cycle_id_fkey"
            columns: ["grocery_cycle_id"]
            isOneToOne: false
            referencedRelation: "grocery_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          meal_type: string
          name: string
          slot_definitions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          meal_type: string
          name: string
          slot_definitions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          meal_type?: string
          name?: string
          slot_definitions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          created_at: string
          employer_name: string | null
          extraction_confidence: string | null
          extraction_raw: Json | null
          file_path: string
          gross_pay: number | null
          id: string
          match_status: string | null
          matched_at: string | null
          matched_transaction_id: string | null
          net_pay: number | null
          ni_deducted: number | null
          pay_period_end: string | null
          pay_period_start: string | null
          pension_deducted: number | null
          tax_deducted: number | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employer_name?: string | null
          extraction_confidence?: string | null
          extraction_raw?: Json | null
          file_path: string
          gross_pay?: number | null
          id?: string
          match_status?: string | null
          matched_at?: string | null
          matched_transaction_id?: string | null
          net_pay?: number | null
          ni_deducted?: number | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          pension_deducted?: number | null
          tax_deducted?: number | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employer_name?: string | null
          extraction_confidence?: string | null
          extraction_raw?: Json | null
          file_path?: string
          gross_pay?: number | null
          id?: string
          match_status?: string | null
          matched_at?: string | null
          matched_transaction_id?: string | null
          net_pay?: number | null
          ni_deducted?: number | null
          pay_period_end?: string | null
          pay_period_start?: string | null
          pension_deducted?: number | null
          tax_deducted?: number | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          calories_per_100g: number
          carbs_per_100g: number
          created_at: string
          default_discount_type: string | null
          default_unit_type: string
          eaten_factor: number
          editable_mode: string
          energy_kj_per_100g: number | null
          fat_per_100g: number
          fibre_per_100g: number | null
          fixed_portion_grams: number | null
          food_type: string | null
          gross_pack_size_grams: number | null
          id: string
          ignore_macros: boolean
          image_url: string | null
          max_portion_grams: number | null
          meal_eligibility: string[] | null
          min_portion_grams: number | null
          name: string
          offer_label: string | null
          offer_price: number | null
          pack_size_grams: number | null
          packaging_weight_grams: number | null
          portion_step_grams: number
          price: number
          product_type: string
          protein_per_100g: number
          quantity_in_use: number | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          retailer: string | null
          rounding_rule: string
          salt_per_100g: number | null
          saturates_per_100g: number | null
          seasoning_rate_per_100g: number | null
          serving_basis: string
          serving_size_grams: number | null
          source_url: string | null
          storage_notes: string | null
          sugars_per_100g: number | null
          target_quantity: number | null
          unit_size_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          default_discount_type?: string | null
          default_unit_type?: string
          eaten_factor?: number
          editable_mode?: string
          energy_kj_per_100g?: number | null
          fat_per_100g?: number
          fibre_per_100g?: number | null
          fixed_portion_grams?: number | null
          food_type?: string | null
          gross_pack_size_grams?: number | null
          id?: string
          ignore_macros?: boolean
          image_url?: string | null
          max_portion_grams?: number | null
          meal_eligibility?: string[] | null
          min_portion_grams?: number | null
          name: string
          offer_label?: string | null
          offer_price?: number | null
          pack_size_grams?: number | null
          packaging_weight_grams?: number | null
          portion_step_grams?: number
          price?: number
          product_type?: string
          protein_per_100g?: number
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          retailer?: string | null
          rounding_rule?: string
          salt_per_100g?: number | null
          saturates_per_100g?: number | null
          seasoning_rate_per_100g?: number | null
          serving_basis?: string
          serving_size_grams?: number | null
          source_url?: string | null
          storage_notes?: string | null
          sugars_per_100g?: number | null
          target_quantity?: number | null
          unit_size_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          default_discount_type?: string | null
          default_unit_type?: string
          eaten_factor?: number
          editable_mode?: string
          energy_kj_per_100g?: number | null
          fat_per_100g?: number
          fibre_per_100g?: number | null
          fixed_portion_grams?: number | null
          food_type?: string | null
          gross_pack_size_grams?: number | null
          id?: string
          ignore_macros?: boolean
          image_url?: string | null
          max_portion_grams?: number | null
          meal_eligibility?: string[] | null
          min_portion_grams?: number | null
          name?: string
          offer_label?: string | null
          offer_price?: number | null
          pack_size_grams?: number | null
          packaging_weight_grams?: number | null
          portion_step_grams?: number
          price?: number
          product_type?: string
          protein_per_100g?: number
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          retailer?: string | null
          rounding_rule?: string
          salt_per_100g?: number | null
          saturates_per_100g?: number | null
          seasoning_rate_per_100g?: number | null
          serving_basis?: string
          serving_size_grams?: number | null
          source_url?: string | null
          storage_notes?: string | null
          sugars_per_100g?: number | null
          target_quantity?: number | null
          unit_size_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_allowances: {
        Row: {
          allowance_type: string
          allowance_value: number | null
          created_at: string
          id: string
          is_unlimited: boolean | null
          tracked_service_id: string
          user_id: string
        }
        Insert: {
          allowance_type: string
          allowance_value?: number | null
          created_at?: string
          id?: string
          is_unlimited?: boolean | null
          tracked_service_id: string
          user_id: string
        }
        Update: {
          allowance_type?: string
          allowance_value?: number | null
          created_at?: string
          id?: string
          is_unlimited?: boolean | null
          tracked_service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_allowances_tracked_service_id_fkey"
            columns: ["tracked_service_id"]
            isOneToOne: false
            referencedRelation: "tracked_services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_date: string
          tracked_service_id: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_date: string
          tracked_service_id: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          tracked_service_id?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payments_tracked_service_id_fkey"
            columns: ["tracked_service_id"]
            isOneToOne: false
            referencedRelation: "tracked_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      toiletry_items: {
        Row: {
          brand: string | null
          calculated_usage_rate: number | null
          category: string
          cost_per_item: number
          created_at: string
          current_remaining: number
          current_weight_grams: number | null
          empty_weight_grams: number | null
          finished_at: string | null
          full_weight_grams: number | null
          gross_size: number | null
          id: string
          image_url: string | null
          last_restocked_at: string | null
          last_weighed_at: string | null
          name: string
          notes: string | null
          offer_label: string | null
          offer_price: number | null
          opened_at: string | null
          pack_size: number
          packaging_weight: number | null
          quantity_in_use: number | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          size_unit: string
          source_url: string | null
          status: string
          target_quantity: number | null
          total_size: number
          updated_at: string
          usage_rate_per_day: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          calculated_usage_rate?: number | null
          category?: string
          cost_per_item?: number
          created_at?: string
          current_remaining?: number
          current_weight_grams?: number | null
          empty_weight_grams?: number | null
          finished_at?: string | null
          full_weight_grams?: number | null
          gross_size?: number | null
          id?: string
          image_url?: string | null
          last_restocked_at?: string | null
          last_weighed_at?: string | null
          name: string
          notes?: string | null
          offer_label?: string | null
          offer_price?: number | null
          opened_at?: string | null
          pack_size?: number
          packaging_weight?: number | null
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          size_unit?: string
          source_url?: string | null
          status?: string
          target_quantity?: number | null
          total_size: number
          updated_at?: string
          usage_rate_per_day?: number
          user_id: string
        }
        Update: {
          brand?: string | null
          calculated_usage_rate?: number | null
          category?: string
          cost_per_item?: number
          created_at?: string
          current_remaining?: number
          current_weight_grams?: number | null
          empty_weight_grams?: number | null
          finished_at?: string | null
          full_weight_grams?: number | null
          gross_size?: number | null
          id?: string
          image_url?: string | null
          last_restocked_at?: string | null
          last_weighed_at?: string | null
          name?: string
          notes?: string | null
          offer_label?: string | null
          offer_price?: number | null
          opened_at?: string | null
          pack_size?: number
          packaging_weight?: number | null
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          size_unit?: string
          source_url?: string | null
          status?: string
          target_quantity?: number | null
          total_size?: number
          updated_at?: string
          usage_rate_per_day?: number
          user_id?: string
        }
        Relationships: []
      }
      toiletry_orders: {
        Row: {
          actual_delivery: string | null
          created_at: string
          delivery_cost: number | null
          dispatch_date: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          order_reference: string | null
          retailer: string
          subtotal: number
          total_amount: number
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_delivery?: string | null
          created_at?: string
          delivery_cost?: number | null
          dispatch_date?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date: string
          order_reference?: string | null
          retailer: string
          subtotal: number
          total_amount: number
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_delivery?: string | null
          created_at?: string
          delivery_cost?: number | null
          dispatch_date?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_reference?: string | null
          retailer?: string
          subtotal?: number
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toiletry_orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      toiletry_price_checks: {
        Row: {
          checked_at: string | null
          created_at: string | null
          delivery_days: number | null
          dispatch_days: number | null
          id: string
          in_stock: boolean | null
          offer_label: string | null
          offer_price: number | null
          price: number
          product_name: string | null
          product_url: string | null
          retailer: string
          toiletry_item_id: string
          total_lead_time: number | null
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string | null
          delivery_days?: number | null
          dispatch_days?: number | null
          id?: string
          in_stock?: boolean | null
          offer_label?: string | null
          offer_price?: number | null
          price: number
          product_name?: string | null
          product_url?: string | null
          retailer: string
          toiletry_item_id: string
          total_lead_time?: number | null
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string | null
          delivery_days?: number | null
          dispatch_days?: number | null
          id?: string
          in_stock?: boolean | null
          offer_label?: string | null
          offer_price?: number | null
          price?: number
          product_name?: string | null
          product_url?: string | null
          retailer?: string
          toiletry_item_id?: string
          total_lead_time?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toiletry_price_checks_toiletry_item_id_fkey"
            columns: ["toiletry_item_id"]
            isOneToOne: false
            referencedRelation: "toiletry_items"
            referencedColumns: ["id"]
          },
        ]
      }
      toiletry_purchases: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_type: string | null
          final_price: number
          id: string
          notes: string | null
          order_id: string | null
          purchase_date: string
          quantity: number
          toiletry_item_id: string
          transaction_id: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          final_price: number
          id?: string
          notes?: string | null
          order_id?: string | null
          purchase_date: string
          quantity?: number
          toiletry_item_id: string
          transaction_id?: string | null
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          final_price?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          purchase_date?: string
          quantity?: number
          toiletry_item_id?: string
          transaction_id?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toiletry_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "toiletry_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toiletry_purchases_toiletry_item_id_fkey"
            columns: ["toiletry_item_id"]
            isOneToOne: false
            referencedRelation: "toiletry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toiletry_purchases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_services: {
        Row: {
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          estimated_savings_annual: number | null
          exit_fee: number | null
          id: string
          is_tracking_enabled: boolean | null
          last_recommendation: string | null
          last_recommendation_reason: string | null
          last_scan_date: string | null
          monthly_cost: number | null
          notes: string | null
          plan_name: string | null
          provider: string
          service_type: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          estimated_savings_annual?: number | null
          exit_fee?: number | null
          id?: string
          is_tracking_enabled?: boolean | null
          last_recommendation?: string | null
          last_recommendation_reason?: string | null
          last_scan_date?: string | null
          monthly_cost?: number | null
          notes?: string | null
          plan_name?: string | null
          provider: string
          service_type: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          estimated_savings_annual?: number | null
          exit_fee?: number | null
          id?: string
          is_tracking_enabled?: boolean | null
          last_recommendation?: string | null
          last_recommendation_reason?: string | null
          last_scan_date?: string | null
          monthly_cost?: number | null
          notes?: string | null
          plan_name?: string | null
          provider?: string
          service_type?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          bill_id: string | null
          category_id: string | null
          created_at: string
          description: string
          external_id: string | null
          id: string
          investment_account_id: string | null
          is_pending: boolean | null
          merchant: string | null
          receipt_path: string | null
          receipt_source: string | null
          receipt_uploaded_at: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          bill_id?: string | null
          category_id?: string | null
          created_at?: string
          description: string
          external_id?: string | null
          id?: string
          investment_account_id?: string | null
          is_pending?: boolean | null
          merchant?: string | null
          receipt_path?: string | null
          receipt_source?: string | null
          receipt_uploaded_at?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          bill_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string
          external_id?: string | null
          id?: string
          investment_account_id?: string | null
          is_pending?: boolean | null
          merchant?: string | null
          receipt_path?: string | null
          receipt_source?: string | null
          receipt_uploaded_at?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_investment_account_id_fkey"
            columns: ["investment_account_id"]
            isOneToOne: false
            referencedRelation: "investment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      uk_bank_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_nutrition_settings: {
        Row: {
          activity_level: string | null
          age: number | null
          body_fat_percent: number | null
          carbs_target_grams: number | null
          created_at: string
          daily_calorie_target: number | null
          fat_per_kg: number | null
          fat_target_grams: number | null
          formula: string | null
          goal_type: string | null
          height_cm: number | null
          id: string
          last_calculated_at: string | null
          max_grams_per_item: number | null
          min_grams_per_item: number | null
          mode: string
          portion_rounding: number | null
          protein_per_kg: number | null
          protein_target_grams: number | null
          sex: string | null
          target_tolerance_percent: number | null
          updated_at: string
          user_id: string
          weekend_calorie_target: number | null
          weekend_carbs_target_grams: number | null
          weekend_fat_target_grams: number | null
          weekend_protein_target_grams: number | null
          weekend_targets_enabled: boolean
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          body_fat_percent?: number | null
          carbs_target_grams?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          fat_per_kg?: number | null
          fat_target_grams?: number | null
          formula?: string | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          last_calculated_at?: string | null
          max_grams_per_item?: number | null
          min_grams_per_item?: number | null
          mode?: string
          portion_rounding?: number | null
          protein_per_kg?: number | null
          protein_target_grams?: number | null
          sex?: string | null
          target_tolerance_percent?: number | null
          updated_at?: string
          user_id: string
          weekend_calorie_target?: number | null
          weekend_carbs_target_grams?: number | null
          weekend_fat_target_grams?: number | null
          weekend_protein_target_grams?: number | null
          weekend_targets_enabled?: boolean
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          body_fat_percent?: number | null
          carbs_target_grams?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          fat_per_kg?: number | null
          fat_target_grams?: number | null
          formula?: string | null
          goal_type?: string | null
          height_cm?: number | null
          id?: string
          last_calculated_at?: string | null
          max_grams_per_item?: number | null
          min_grams_per_item?: number | null
          mode?: string
          portion_rounding?: number | null
          protein_per_kg?: number | null
          protein_target_grams?: number | null
          sex?: string | null
          target_tolerance_percent?: number | null
          updated_at?: string
          user_id?: string
          weekend_calorie_target?: number | null
          weekend_carbs_target_grams?: number | null
          weekend_fat_target_grams?: number | null
          weekend_protein_target_grams?: number | null
          weekend_targets_enabled?: boolean
          weight_kg?: number | null
        }
        Relationships: []
      }
      user_payday_settings: {
        Row: {
          adjustment_rule: string
          created_at: string
          id: string
          payday_date: number
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_rule?: string
          created_at?: string
          id?: string
          payday_date?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_rule?: string
          created_at?: string
          id?: string
          payday_date?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_nutrition_targets: {
        Row: {
          carbs_target_grams: number | null
          created_at: string
          fat_target_grams: number | null
          friday_calories: number
          id: string
          monday_calories: number
          plan_mode: string
          protein_target_grams: number | null
          saturday_calories: number
          sunday_calories: number
          thursday_calories: number
          tuesday_calories: number
          updated_at: string
          user_id: string
          wednesday_calories: number
          week_start_date: string
          zigzag_enabled: boolean
          zigzag_schedule: string | null
        }
        Insert: {
          carbs_target_grams?: number | null
          created_at?: string
          fat_target_grams?: number | null
          friday_calories: number
          id?: string
          monday_calories: number
          plan_mode?: string
          protein_target_grams?: number | null
          saturday_calories: number
          sunday_calories: number
          thursday_calories: number
          tuesday_calories: number
          updated_at?: string
          user_id: string
          wednesday_calories: number
          week_start_date: string
          zigzag_enabled?: boolean
          zigzag_schedule?: string | null
        }
        Update: {
          carbs_target_grams?: number | null
          created_at?: string
          fat_target_grams?: number | null
          friday_calories?: number
          id?: string
          monday_calories?: number
          plan_mode?: string
          protein_target_grams?: number | null
          saturday_calories?: number
          sunday_calories?: number
          thursday_calories?: number
          tuesday_calories?: number
          updated_at?: string
          user_id?: string
          wednesday_calories?: number
          week_start_date?: string
          zigzag_enabled?: boolean
          zigzag_schedule?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      bank_connections_safe: {
        Row: {
          created_at: string | null
          id: string | null
          last_synced_at: string | null
          provider: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          last_synced_at?: string | null
          provider?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_viewing_via_safe_view: { Args: never; Returns: boolean }
    }
    Enums: {
      bill_frequency:
        | "weekly"
        | "fortnightly"
        | "monthly"
        | "quarterly"
        | "yearly"
        | "biannual"
      transaction_type: "income" | "expense"
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
      bill_frequency: [
        "weekly",
        "fortnightly",
        "monthly",
        "quarterly",
        "yearly",
        "biannual",
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
