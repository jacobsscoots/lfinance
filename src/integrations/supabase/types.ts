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
      bills: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          due_date_rule: string
          due_day: number
          end_date: string | null
          frequency: Database["public"]["Enums"]["bill_frequency"]
          id: string
          is_active: boolean | null
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
          category_id?: string | null
          created_at?: string
          due_date_rule?: string
          due_day: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          is_active?: boolean | null
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
          category_id?: string | null
          created_at?: string
          due_date_rule?: string
          due_day?: number
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["bill_frequency"]
          id?: string
          is_active?: boolean | null
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
          energy_kj_per_100g: number | null
          fat_per_100g: number
          fibre_per_100g: number | null
          fixed_portion_grams: number | null
          food_type: string | null
          gross_pack_size_grams: number | null
          id: string
          ignore_macros: boolean
          image_url: string | null
          meal_eligibility: string[] | null
          name: string
          offer_label: string | null
          offer_price: number | null
          pack_size_grams: number | null
          packaging_weight_grams: number | null
          price: number
          product_type: string
          protein_per_100g: number
          quantity_in_use: number | null
          quantity_on_hand: number | null
          reorder_threshold: number | null
          retailer: string | null
          salt_per_100g: number | null
          saturates_per_100g: number | null
          serving_basis: string
          serving_size_grams: number | null
          source_url: string | null
          storage_notes: string | null
          sugars_per_100g: number | null
          target_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          default_discount_type?: string | null
          energy_kj_per_100g?: number | null
          fat_per_100g?: number
          fibre_per_100g?: number | null
          fixed_portion_grams?: number | null
          food_type?: string | null
          gross_pack_size_grams?: number | null
          id?: string
          ignore_macros?: boolean
          image_url?: string | null
          meal_eligibility?: string[] | null
          name: string
          offer_label?: string | null
          offer_price?: number | null
          pack_size_grams?: number | null
          packaging_weight_grams?: number | null
          price?: number
          product_type?: string
          protein_per_100g?: number
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          retailer?: string | null
          salt_per_100g?: number | null
          saturates_per_100g?: number | null
          serving_basis?: string
          serving_size_grams?: number | null
          source_url?: string | null
          storage_notes?: string | null
          sugars_per_100g?: number | null
          target_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          default_discount_type?: string | null
          energy_kj_per_100g?: number | null
          fat_per_100g?: number
          fibre_per_100g?: number | null
          fixed_portion_grams?: number | null
          food_type?: string | null
          gross_pack_size_grams?: number | null
          id?: string
          ignore_macros?: boolean
          image_url?: string | null
          meal_eligibility?: string[] | null
          name?: string
          offer_label?: string | null
          offer_price?: number | null
          pack_size_grams?: number | null
          packaging_weight_grams?: number | null
          price?: number
          product_type?: string
          protein_per_100g?: number
          quantity_in_use?: number | null
          quantity_on_hand?: number | null
          reorder_threshold?: number | null
          retailer?: string | null
          salt_per_100g?: number | null
          saturates_per_100g?: number | null
          serving_basis?: string
          serving_size_grams?: number | null
          source_url?: string | null
          storage_notes?: string | null
          sugars_per_100g?: number | null
          target_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          carbs_target_grams: number | null
          created_at: string
          daily_calorie_target: number | null
          fat_target_grams: number | null
          id: string
          max_grams_per_item: number | null
          min_grams_per_item: number | null
          mode: string
          portion_rounding: number | null
          protein_target_grams: number | null
          target_tolerance_percent: number | null
          updated_at: string
          user_id: string
          weekend_calorie_target: number | null
          weekend_carbs_target_grams: number | null
          weekend_fat_target_grams: number | null
          weekend_protein_target_grams: number | null
          weekend_targets_enabled: boolean
        }
        Insert: {
          carbs_target_grams?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          fat_target_grams?: number | null
          id?: string
          max_grams_per_item?: number | null
          min_grams_per_item?: number | null
          mode?: string
          portion_rounding?: number | null
          protein_target_grams?: number | null
          target_tolerance_percent?: number | null
          updated_at?: string
          user_id: string
          weekend_calorie_target?: number | null
          weekend_carbs_target_grams?: number | null
          weekend_fat_target_grams?: number | null
          weekend_protein_target_grams?: number | null
          weekend_targets_enabled?: boolean
        }
        Update: {
          carbs_target_grams?: number | null
          created_at?: string
          daily_calorie_target?: number | null
          fat_target_grams?: number | null
          id?: string
          max_grams_per_item?: number | null
          min_grams_per_item?: number | null
          mode?: string
          portion_rounding?: number | null
          protein_target_grams?: number | null
          target_tolerance_percent?: number | null
          updated_at?: string
          user_id?: string
          weekend_calorie_target?: number | null
          weekend_carbs_target_grams?: number | null
          weekend_fat_target_grams?: number | null
          weekend_protein_target_grams?: number | null
          weekend_targets_enabled?: boolean
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
      ],
      transaction_type: ["income", "expense"],
    },
  },
} as const
