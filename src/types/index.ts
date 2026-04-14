// Tipos de Vendor/Quiosque
export interface Vendor {
  id: string
  name: string
  document_login: string
  cpf?: string | null
  cnpj?: string | null
  owner_name: string
  owner_phone: string
  owner_email?: string | null
  logo_url?: string | null
  primary_color: string
  secondary_color?: string | null
  is_active: boolean
  subscription_status: 'trial' | 'active' | 'overdue' | 'blocked'
  max_umbrellas: number
  plan_type?: 'trial' | 'monthly' | '6months' | '12months'
  created_at?: string
}

// Tipos de Produto/Cardápio
export interface Product {
  id: string
  vendor_id: string
  category: string
  name: string
  description?: string | null
  price: number
  promotional_price?: number | null
  image_url?: string | null
  is_default_image: boolean // Imagem padrão vs exclusiva (premium)
  image_plan_type?: 'free' | 'plus' // Qual plano permite esta imagem
  active: boolean
  is_combo: boolean
  sort_order: number
  stock_quantity?: number | null
  blocked_by_stock: boolean
  created_at?: string
  updated_at?: string
}

// Tipos de Guarda-sol
export interface Umbrella {
  id: string
  vendor_id: string
  number: number
  label?: string | null
  location_hint?: string | null
  active: boolean
  qr_url?: string | null
  created_at?: string
}

// Tipos de Cliente
export interface Customer {
  id: string
  vendor_id: string
  name: string
  phone: string
  visit_count: number
  total_spent: number
  last_visit_at?: string | null
  created_at?: string
}

// Tipos de Pedido
export interface Order {
  id: string
  vendor_id: string
  customer_id: string
  umbrella_id: string
  status: 'received' | 'preparing' | 'delivering' | 'completed' | 'cancelled'
  total: number
  notes?: string | null
  paid: boolean
  payment_method?: string | null
  created_at?: string
  updated_at?: string
}

// Tipos de Item do Pedido
export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at?: string
}

// Tipos de Ajuste de Conta (cancelamento/abatimento)
export interface AccountAdjustment {
  id: string
  vendor_id: string
  customer_id: string
  order_id?: string | null
  adjustment_type: 'cancellation' | 'deduction' | 'credit'
  description?: string | null
  amount: number
  reason?: string | null
  processed_by?: string | null
  password_verified: boolean
  created_at?: string
  updated_at?: string
}

// Tipos de Galeria de Imagens Padrão
export interface ProductImage {
  id: string
  category: string
  image_url: string
  title: string
  description?: string | null
  plan_type: 'free' | 'plus'
  created_at?: string | null
}

// Autenticação
export interface AuthResponse {
  vendor_id: string
  vendor_name: string
  owner_name: string
  token: string
  must_change_password: boolean
}

// Configuração Visual do Quiosque
export interface KioskTheme {
  primary_color: string
  secondary_color: string
  logo_url?: string | null
  plan_type: 'trial' | 'plus'
}

// Plano do Vendor
export interface VendorPlan {
  id: string
  vendor_id: string
  plan_type: 'free' | 'plus'
  can_upload_images: boolean
  max_custom_images: number
  custom_images_used: number
  custom_theme: string | null
  created_at?: string | null
  updated_at?: string | null
}

