export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          cpf: string | null
          document_login: string
          address: string | null
          city: string | null
          state: string | null
          owner_name: string
          owner_phone: string
          owner_email: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string | null
          password_hash: string | null
          password_needs_reset: boolean
          password_reset_token: string | null
          password_reset_expires_at: string | null
          subscription_status: string
          trial_ends_at: string | null
          plan_type: string | null
          plan_expires_at: string | null
          max_umbrellas: number
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          cnpj?: string | null
          cpf?: string | null
          document_login: string
          address?: string | null
          city?: string | null
          state?: string | null
          owner_name: string
          owner_phone: string
          owner_email?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          password_hash?: string | null
          password_needs_reset?: boolean
          password_reset_token?: string | null
          password_reset_expires_at?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          plan_type?: string | null
          plan_expires_at?: string | null
          max_umbrellas?: number
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          name?: string
          cnpj?: string | null
          cpf?: string | null
          document_login?: string
          address?: string | null
          city?: string | null
          state?: string | null
          owner_name?: string
          owner_phone?: string
          owner_email?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string | null
          password_hash?: string | null
          password_needs_reset?: boolean
          password_reset_token?: string | null
          password_reset_expires_at?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          plan_type?: string | null
          plan_expires_at?: string | null
          max_umbrellas?: number
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          vendor_id: string
          name: string
          phone: string
          visit_count: number
          total_spent: number
          last_visit_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          name: string
          phone: string
          visit_count?: number
          total_spent?: number
          last_visit_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          name?: string
          phone?: string
          visit_count?: number
          total_spent?: number
          last_visit_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      umbrellas: {
        Row: {
          id: string
          vendor_id: string
          number: number
          label: string | null
          location_hint: string | null
          active: boolean | null
          qr_url: string | null
          is_occupied: boolean
          current_order_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          number: number
          label?: string | null
          location_hint?: string | null
          active?: boolean | null
          qr_url?: string | null
          is_occupied?: boolean
          current_order_id?: string | null
          created_at?: string | null
        }
        Update: {
          number?: number
          label?: string | null
          location_hint?: string | null
          active?: boolean | null
          qr_url?: string | null
          is_occupied?: boolean
          current_order_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          vendor_id: string
          category: string
          name: string
          description: string | null
          price: number
          promotional_price: number | null
          image_url: string | null
          is_default_image: boolean | null
          image_plan_type: string | null
          active: boolean | null
          is_combo: boolean | null
          sort_order: number | null
          stock_quantity: number | null
          blocked_by_stock: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          category?: string
          name: string
          description?: string | null
          price?: number
          promotional_price?: number | null
          image_url?: string | null
          is_default_image?: boolean | null
          image_plan_type?: string | null
          active?: boolean | null
          is_combo?: boolean | null
          sort_order?: number | null
          stock_quantity?: number | null
          blocked_by_stock?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          name?: string
          description?: string | null
          price?: number
          promotional_price?: number | null
          image_url?: string | null
          is_default_image?: boolean | null
          image_plan_type?: string | null
          active?: boolean | null
          is_combo?: boolean | null
          sort_order?: number | null
          stock_quantity?: number | null
          blocked_by_stock?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          id: string
          category: string
          title: string
          image_url: string
          description: string | null
          plan_type: string
          created_at: string | null
        }
        Insert: {
          id?: string
          category: string
          title: string
          image_url: string
          description?: string | null
          plan_type: string
          created_at?: string | null
        }
        Update: {
          category?: string
          title?: string
          image_url?: string
          description?: string | null
          plan_type?: string
        }
        Relationships: []
      }
      vendor_plans: {
        Row: {
          id: string
          vendor_id: string
          plan_type: string
          can_upload_images: boolean
          max_custom_images: number
          custom_images_used: number
          custom_theme: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          plan_type: string
          can_upload_images: boolean
          max_custom_images: number
          custom_images_used?: number
          custom_theme?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          plan_type?: string
          can_upload_images?: boolean
          max_custom_images?: number
          custom_images_used?: number
          custom_theme?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          vendor_id: string
          customer_id: string
          umbrella_id: string
          status: string
          total: number
          notes: string | null
          paid: boolean | null
          payment_method: string | null
          pending_close: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          customer_id: string
          umbrella_id: string
          status?: string
          total?: number
          notes?: string | null
          paid?: boolean | null
          payment_method?: string | null
          pending_close?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          status?: string
          total?: number
          notes?: string | null
          paid?: boolean | null
          payment_method?: string | null
          pending_close?: boolean
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_umbrella_id_fkey"; columns: ["umbrella_id"]; referencedRelation: "umbrellas"; referencedColumns: ["id"] },
          { foreignKeyName: "orders_vendor_id_fkey"; columns: ["vendor_id"]; referencedRelation: "vendors"; referencedColumns: ["id"] }
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          cancelled: boolean
          cancelled_at: string | null
          cancel_reason: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          cancelled?: boolean
          cancelled_at?: string | null
          cancel_reason?: string | null
          created_at?: string | null
        }
        Update: {
          quantity?: number
          unit_price?: number
          subtotal?: number
          cancelled?: boolean
          cancelled_at?: string | null
          cancel_reason?: string | null
        }
        Relationships: [
          { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] }
        ]
      }
      account_adjustments: {
        Row: {
          id: string
          vendor_id: string
          customer_id: string
          order_id: string | null
          adjustment_type: string
          description: string | null
          amount: number
          reason: string | null
          processed_by: string | null
          password_verified: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          customer_id: string
          order_id?: string | null
          adjustment_type: string
          description?: string | null
          amount: number
          reason?: string | null
          processed_by?: string | null
          password_verified?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          order_id?: string | null
          adjustment_type?: string
          description?: string | null
          amount?: number
          reason?: string | null
          processed_by?: string | null
          password_verified?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_otps: {
        Row: {
          id: string
          phone: string
          vendor_id: string
          code: string
          expires_at: string
          used: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          phone: string
          vendor_id: string
          code: string
          expires_at: string
          used?: boolean
          created_at?: string | null
        }
        Update: {
          used?: boolean
        }
        Relationships: [
          { foreignKeyName: "customer_otps_vendor_id_fkey"; columns: ["vendor_id"]; referencedRelation: "vendors"; referencedColumns: ["id"] }
        ]
      }
      rate_limit_buckets: {
        Row: {
          key: string
          count: number
          reset_at: string
        }
        Insert: {
          key: string
          count?: number
          reset_at: string
        }
        Update: {
          count?: number
          reset_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_stock: {
        Args: { p_product_id: string; p_qty: number }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
