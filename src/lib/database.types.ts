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
          /* Insert Types... */
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
          /* Update Types... */
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
      }
      customers: {
        Row: {
          id: string
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          name?: string
          phone?: string
          visit_count?: number
          total_spent?: number
          last_visit_at?: string | null
          updated_at?: string | null
        }
      }
      umbrellas: {
        Row: {
          id: string
          tenant_id: string
          vendor_id: string
          number: number
          label: string | null
          location_hint: string | null
          active: boolean | null
          qr_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          vendor_id: string
          number: number
          label?: string | null
          location_hint?: string | null
          active?: boolean | null
          qr_url?: string | null
          created_at?: string | null
        }
        Update: {
          tenant_id?: string
          number?: number
          label?: string | null
          location_hint?: string | null
          active?: boolean | null
          qr_url?: string | null
        }
      }
      products: {
        Row: {
          id: string
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
      }
      product_images: {
        Row: {
          id: string
          category: string
          name: string
          image_url: string
          description: string | null
          plan_type: string
          created_at: string | null
        }
        Insert: {
          id?: string
          category: string
          name: string
          image_url: string
          description?: string | null
          plan_type: string
          created_at?: string | null
        }
        Update: {
          category?: string
          name?: string
          image_url?: string
          description?: string | null
          plan_type?: string
        }
      }
      vendor_plans: {
        Row: {
          id: string
          vendor_id: string
          plan_type: string
          can_upload_images: boolean
          max_custom_images: number
          custom_images_used: number
          custom_theme: boolean
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
          custom_theme?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          plan_type?: string
          can_upload_images?: boolean
          max_custom_images?: number
          custom_images_used?: number
          custom_theme?: boolean
          updated_at?: string | null
        }
      }
      tenants: {
        Row: {
          id: string
          name: string
          status: string
          city: string | null
          state: string | null
          region: string | null
          beach_name: string | null
          primary_color: string | null
          logo_url: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          status?: string
          city?: string | null
          state?: string | null
          region?: string | null
          beach_name?: string | null
          primary_color?: string | null
          logo_url?: string | null
          created_at?: string | null
        }
        Update: {
          name?: string
          status?: string
          city?: string | null
          state?: string | null
          region?: string | null
          beach_name?: string | null
          primary_color?: string | null
          logo_url?: string | null
        }
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          name: string
          email: string | null
          role: string
          password_hash: string | null
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          email?: string | null
          role?: string
          password_hash?: string | null
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          tenant_id?: string
          name?: string
          email?: string | null
          role?: string
          password_hash?: string | null
          is_active?: boolean
          updated_at?: string | null
        }
      }
      sessions: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string | null
          umbrella_id: string | null
          status: string
          opened_at: string | null
          closed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id?: string | null
          umbrella_id?: string | null
          status?: string
          opened_at?: string | null
          closed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          tenant_id?: string
          customer_id?: string | null
          umbrella_id?: string | null
          status?: string
          opened_at?: string | null
          closed_at?: string | null
          updated_at?: string | null
        }
      }
      orders: {
        Row: {
          id: string
          tenant_id: string
          vendor_id: string
          customer_id: string
          umbrella_id: string
          status: string
          total: number
          notes: string | null
          paid: boolean | null
          payment_method: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          vendor_id: string
          customer_id: string
          umbrella_id: string
          status?: string
          total?: number
          notes?: string | null
          paid?: boolean | null
          payment_method?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          tenant_id?: string
          status?: string
          total?: number
          notes?: string | null
          paid?: boolean | null
          payment_method?: string | null
          updated_at?: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          tenant_id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at?: string | null
        }
        Update: {
          tenant_id?: string
          quantity?: number
          unit_price?: number
          subtotal?: number
        }
      }
      Views: {}
      Functions: {}
    }
  }
}
