"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, Clock, Trash2, Pencil, X, Upload, ImageIcon,
  Eye, EyeOff, LogOut, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu, PackageCheck, Banknote, Smartphone, CreditCard,
  Volume2, CircleCheck, DollarSign, Printer,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { formatBrazilianMoneyInput, maskBrazilianMoneyInput, parseBrazilianMoneyInput } from "@/lib/brazilian-money";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
import FinancialAccounts from "@/components/vendor/FinancialAccounts";
import OrderPrintButton from "@/components/vendor/OrderPrintButton";
import PrinterManager from "@/components/vendor/PrinterManager";
import { getVisibleConsumptionItems, getVisibleVendorOrderNotes, isAccountWithoutConsumption } from "@/lib/vendor-order-state";
import { DEFAULT_DEVICE_ALERT_PREFERENCES, readDeviceAlertPreferences, saveDeviceAlertPreferences, vibrateDevice, type DeviceAlertPreferences } from "@/lib/device-alert-preferences";

const WAITER_CALL_MARKER = "[WAITER_CALL]";
const SERVICE_REQUEST_MARKERS = [
  { marker: "[WAITER_CALL]", label: "Solicitando atendente", shortLabel: "Atendente", tone: "waiter" },
];

// ---------- TYPES ----------
interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  price: number;
  promotional_price: number | null;
  description: string;
  image_url: string;
  active: boolean;
  is_combo: boolean;
  option_group_name?: string | null;
  option_values?: string[] | null;
  menu_highlight?: boolean | null;
  promotion_starts_at?: string | null;
  promotion_ends_at?: string | null;
  stock_tracking_enabled?: boolean;
  stock_quantity?: number | null;
  physical_stock_quantity?: number | null;
  beach_stock_quantity?: number | null;
  blocked_by_stock?: boolean | null;
  sort_order: number;
}

interface OrderItem {
  id?: string;
  order_request_id?: string | null;
  q: number;
  n: string;
  subtotal?: number;
  cancelled?: boolean;
  category?: string | null;
}
interface OrderRequest {
  id: string;
  sequence: number;
  subtotal: number;
  status: string;
  created_at: string;
}
interface Order {
  id: string;
  customer_id: string;
  umbrella_id: string;
  umbrella: number;
  customer: string;
  phone: string;
  total: number;
  status: string;
  account_status?: string;
  active_request_id?: string | null;
  active_request?: OrderRequest | null;
  time: string;
  items: OrderItem[];
  account_items?: OrderItem[];
  notes?: string;
  paid?: boolean;
  requests?: OrderRequest[];
}

function hasWaiterCall(order?: Pick<Order, "notes"> | null) {
  return Boolean(order?.notes?.includes(WAITER_CALL_MARKER));
}

function getServiceRequest(order?: Pick<Order, "notes"> | null) {
  return SERVICE_REQUEST_MARKERS.find(request => order?.notes?.includes(request.marker)) || null;
}

function getVisibleOrderNotes(notes?: string) {
  return getVisibleVendorOrderNotes(notes, SERVICE_REQUEST_MARKERS.map((request) => request.marker));
}
interface UpsellRule { trigger_product_id: string; suggested_product_ids: string[]; message: string }
interface FlexiblePromotion { id: string; titulo: string; descricao?: string | null; desconto_tipo: string; desconto_valor: number; ativa: boolean; promocao_itens?: Array<{ product_id: string; quantidade: number; products?: { name?: string } }> }

interface ProductCategory {
  id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
  sort_order: number;
}

function productOptionGroups(product: Pick<Product, 'option_group_name' | 'option_values'>) {
  const values = Array.isArray(product.option_values) ? product.option_values.map(String).filter(Boolean) : [];
  if (values.length === 0) return [] as Array<{ name: string; options: string[] }>;
  if (!values.some(value => value.includes('::'))) return [{ name: product.option_group_name || 'Opcao', options: values }];
  const groups = new Map<string, string[]>();
  values.forEach(value => { const [rawName, ...parts] = value.split('::'); const name = rawName.trim() || 'Opcao'; const option = parts.join('::').trim(); if (option) groups.set(name, [...(groups.get(name) || []), option]); });
  return Array.from(groups, ([name, options]) => ({ name, options: Array.from(new Set(options)) }));
}

function isOrderEmpty(order: Pick<Order, "total" | "items" | "account_items">) {
  return isAccountWithoutConsumption(order);
}

function getFirstCustomerName(name?: string | null) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

function formatServiceTime(seconds: number) {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  return safe >= 60 ? `${Math.floor(safe / 60)}min ${safe % 60}s` : `${safe}s`;
}

interface Umbrella {
  id: string;
  vendor_id: string;
  number: number;
  label: string;
  active: boolean;
  is_occupied?: boolean;
  current_order_id?: string | null;
  map_x?: number | null;
  map_y?: number | null;
  qr_url: string | null;
  qr_path?: string | null;
  qr_image_url?: string;
}

interface ReportData {
  kpis: {
    total_revenue: number;
    total_gross_revenue?: number;
    total_payment_fees?: number;
    total_net_revenue?: number;
    total_service_fees?: number;
    total_orders: number;
    avg_ticket: number;
    unique_customers: number;
  };
  daily_summary: {
    available_products: number;
    active_umbrellas: number;
    today_orders: number;
    today_revenue: number;
    new_customers_today: number;
  };
  top_products: { name: string; quantity: number; revenue: number }[];
  category_performance?: { category: string; quantity: number; revenue: number; cost?: number; profit?: number; cost_configured?: boolean; margin_percent?: number }[];
  low_stock_alerts?: { name: string; category: string; quantity: number; blocked: boolean }[];
  top_customers: { name: string; phone: string; visits: number; total_spent: number }[];
  hourly_sales: { hour: string; orders: number; revenue: number; avg_ticket: number }[];
  staff_performance?: Array<{ user_id: string; name: string; orders: number; revenue: number; commission_type: string; commission_value: number; commission_due: number }>;
  waiter_service?: { total_calls: number; avg_response_seconds: number; avg_service_seconds: number; by_waiter: Array<{ user_id: string; name: string; calls: number; avg_response_seconds: number; avg_service_seconds: number }> };
  operational_times?: { completed_requests: number; avg_preparation_seconds: number; avg_service_seconds: number; delayed_requests: number; fastest_preparation_seconds: number; slowest_preparation_seconds: number };
  product_insights?: {
    least_sold: Array<{ name: string; quantity: number; revenue: number; profit?: number; margin_percent?: number; cost_configured?: boolean }>;
    highest_revenue_products: Array<{ name: string; quantity: number; revenue: number; profit?: number; margin_percent?: number; cost_configured?: boolean }>;
    highest_profit_products: Array<{ name: string; quantity: number; revenue: number; profit: number; margin_percent: number; cost_configured: boolean }>;
    stagnant_products: Array<{ name: string; category: string }>;
  };
  payment_methods?: Record<string, { count: number; gross: number; fees: number; net: number; total: number }>;
  receivables?: Array<{
    id: string;
    order_id: string;
    payment_method: string;
    gross_amount: number;
    fee_rate: number;
    fee_amount: number;
    net_amount: number;
    paid_at: string;
    expected_payment_date: string;
    status: string;
  }>;
  receivables_by_date?: Record<string, { gross: number; fees: number; net: number; count: number }>;
  satisfaction?: {
    average_rating: number;
    total_responses: number;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    latest: { rating: number; comment: string | null; created_at: string; customer_name: string }[];
  };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  visit_count: number;
  total_spent: number;
  last_visit_at: string;
}

interface VendorUser {
  id: string;
  name: string;
  email: string | null;
  login: string;
  role: string;
  active: boolean;
  created_at: string;
  commission_type?: "none" | "percent" | "fixed";
  commission_value?: number;
}

interface KioskTheme {
  primary_color: string;
  secondary_color: string;
  button_color: string;
  button_text_color: string;
  logo_url: string;
  cash_fee_rate?: number;
  cash_fee_type?: PaymentFeeType;
  cash_fixed_fee_amount?: number;
  cash_payout_days?: number;
  cash_active?: boolean;
  cash_api_enabled?: boolean;
  debit_card_fee_rate?: number;
  debit_card_fee_type?: PaymentFeeType;
  debit_card_fixed_fee_amount?: number;
  credit_card_fee_rate?: number;
  credit_card_fee_type?: PaymentFeeType;
  credit_card_fixed_fee_amount?: number;
  pix_fee_rate?: number;
  pix_fee_type?: PaymentFeeType;
  pix_fixed_fee_amount?: number;
  debit_card_payout_days?: number;
  debit_card_active?: boolean;
  debit_card_api_enabled?: boolean;
  credit_card_payout_days?: number;
  credit_card_active?: boolean;
  credit_card_api_enabled?: boolean;
  pix_payout_days?: number;
  pix_active?: boolean;
  pix_api_enabled?: boolean;
  tenant_id?: string;
}

interface CashControl {
  status: "open" | "closed";
  opened_at: string;
  opening_cash: number;
  expected_cash?: number;
  counted_cash?: number;
  difference?: number;
  difference_reason?: string;
  notes?: string;
}

interface StockAdjustmentHistory {
  items: Array<{
    id: string;
    created_at: string;
    product_name: string;
    reason: string;
    location: string;
    quantity: number;
    previous_quantity: number;
    next_quantity: number;
    note: string;
    user_name: string;
    estimated_cost: number;
  }>;
  summary: Record<string, { quantity: number; estimated_cost: number }>;
  total_quantity: number;
  total_estimated_cost: number;
}

interface ManagementIntelligence {
  forecast: { day: string; movement_percent: number; expected_orders: number; expected_revenue: number; sample_days: number; suggestion: string; historical_percent?: number; weather_adjustment?: number; weather?: { available: boolean; location?: string; condition?: string; temperature_max?: number; temperature_min?: number; precipitation_probability?: number; precipitation_sum?: number; wind_speed_max?: number; error?: string } };
  today: { revenue: number; orders: number; customers: number; avg_ticket: number; items_sold: number; estimated_profit: number };
}

type PaymentFeeType = "percent" | "fixed";

const DEFAULT_THEME: KioskTheme = {
  primary_color: "#ff6b00",
  secondary_color: "#451704",
  button_color: "#ff6b00",
  button_text_color: "#ffffff",
  logo_url: "/sandexpress-logo-fluid.png",
  cash_fee_rate: 0,
  cash_fee_type: "percent",
  cash_fixed_fee_amount: 0,
  cash_payout_days: 0,
  cash_active: true,
  cash_api_enabled: false,
  debit_card_fee_rate: 0,
  debit_card_fee_type: "percent",
  debit_card_fixed_fee_amount: 0,
  credit_card_fee_rate: 0,
  credit_card_fee_type: "percent",
  credit_card_fixed_fee_amount: 0,
  pix_fee_rate: 0,
  pix_fee_type: "percent",
  pix_fixed_fee_amount: 0,
  debit_card_payout_days: 1,
  debit_card_active: true,
  debit_card_api_enabled: false,
  credit_card_payout_days: 30,
  credit_card_active: true,
  credit_card_api_enabled: false,
  pix_payout_days: 0,
  pix_active: true,
  pix_api_enabled: false,
};

const BRAND_PALETTE = [
  { name: "Primary / Laranja", value: "#ff6b00" },
  { name: "Marrom escuro", value: "#201411" },
  { name: "Card marrom", value: "#451704" },
  { name: "Marrom profundo", value: "#301107" },
  { name: "Texto creme", value: "#fff8f6" },
  { name: "Texto suave", value: "#f4d6c8" },
  { name: "Laranja suave", value: "#ff9b50" },
  { name: "Borda laranja", value: "#7a2b00" },
];

const PAYMENT_METHOD_OPTIONS = [
  { id: "cash", label: "Dinheiro", Icon: Banknote },
  { id: "pix", label: "Pix", Icon: Smartphone },
  { id: "debit_card", label: "Debito", Icon: CreditCard },
  { id: "credit_card", label: "Credito", Icon: CreditCard },
] as const;

const STOCK_REASON_LABELS: Record<string, string> = {
  loss: "Perda",
  internal_consumption: "Consumo interno",
  theft: "Furto",
  breakage: "Quebra",
  expired: "Produto vencido",
  count_error: "Erro de contagem",
  other: "Outro",
};

const PAYMENT_SETTINGS = [
  {
    id: "cash",
    label: "Dinheiro",
    Icon: Banknote,
    feeField: "cash_fee_rate",
    typeField: "cash_fee_type",
    fixedField: "cash_fixed_fee_amount",
    daysField: "cash_payout_days",
    activeField: "cash_active",
    apiField: "cash_api_enabled",
  },
  {
    id: "pix",
    label: "Pix",
    Icon: Smartphone,
    feeField: "pix_fee_rate",
    typeField: "pix_fee_type",
    fixedField: "pix_fixed_fee_amount",
    daysField: "pix_payout_days",
    activeField: "pix_active",
    apiField: "pix_api_enabled",
  },
  {
    id: "debit_card",
    label: "Cartao debito",
    Icon: CreditCard,
    feeField: "debit_card_fee_rate",
    typeField: "debit_card_fee_type",
    fixedField: "debit_card_fixed_fee_amount",
    daysField: "debit_card_payout_days",
    activeField: "debit_card_active",
    apiField: "debit_card_api_enabled",
  },
  {
    id: "credit_card",
    label: "Cartao credito",
    Icon: CreditCard,
    feeField: "credit_card_fee_rate",
    typeField: "credit_card_fee_type",
    fixedField: "credit_card_fixed_fee_amount",
    daysField: "credit_card_payout_days",
    activeField: "credit_card_active",
    apiField: "credit_card_api_enabled",
  },
] as const;

function buildThemeForm(data: Partial<KioskTheme> & Record<string, unknown>): KioskTheme {
  return {
    tenant_id: data.tenant_id as string | undefined,
    primary_color: String(data.primary_color || DEFAULT_THEME.primary_color),
    secondary_color: String(data.secondary_color || DEFAULT_THEME.secondary_color),
    button_color: String(data.button_color || data.primary_color || DEFAULT_THEME.button_color),
    button_text_color: String(data.button_text_color || DEFAULT_THEME.button_text_color),
    logo_url: String(data.logo_url || DEFAULT_THEME.logo_url),
    cash_fee_rate: Number(data.cash_fee_rate || 0),
    cash_fee_type: data.cash_fee_type === "fixed" ? "fixed" : "percent",
    cash_fixed_fee_amount: Number(data.cash_fixed_fee_amount || 0),
    cash_payout_days: Number(data.cash_payout_days ?? 0),
    cash_active: data.cash_active !== false,
    cash_api_enabled: data.cash_api_enabled === true,
    debit_card_fee_rate: Number(data.debit_card_fee_rate || 0),
    debit_card_fee_type: data.debit_card_fee_type === "fixed" ? "fixed" : "percent",
    debit_card_fixed_fee_amount: Number(data.debit_card_fixed_fee_amount || 0),
    credit_card_fee_rate: Number(data.credit_card_fee_rate || 0),
    credit_card_fee_type: data.credit_card_fee_type === "fixed" ? "fixed" : "percent",
    credit_card_fixed_fee_amount: Number(data.credit_card_fixed_fee_amount || 0),
    pix_fee_rate: Number(data.pix_fee_rate || 0),
    pix_fee_type: data.pix_fee_type === "fixed" ? "fixed" : "percent",
    pix_fixed_fee_amount: Number(data.pix_fixed_fee_amount || 0),
    debit_card_payout_days: Number(data.debit_card_payout_days ?? 1),
    debit_card_active: data.debit_card_active !== false,
    debit_card_api_enabled: data.debit_card_api_enabled === true,
    credit_card_payout_days: Number(data.credit_card_payout_days ?? 30),
    credit_card_active: data.credit_card_active !== false,
    credit_card_api_enabled: data.credit_card_api_enabled === true,
    pix_payout_days: Number(data.pix_payout_days ?? 0),
    pix_active: data.pix_active !== false,
    pix_api_enabled: data.pix_api_enabled === true,
  };
}

type DailySalesPayment = {
  count?: number;
  gross?: number;
  fees?: number;
  net?: number;
  total?: number;
};

type DailySalesProduct = {
  name?: string;
  quantity?: number;
  revenue?: number;
};

type DailySalesCategory = {
  category?: string;
  quantity?: number;
  revenue?: number;
};

type DailySalesStockAlert = {
  name?: string;
  category?: string;
  quantity?: number;
  blocked?: boolean;
};

type DailySalesOrder = {
  umbrella_number?: string | number;
  customer_name?: string;
  customer_phone?: string;
  items_count?: number;
  payment_method?: string;
  gross_total?: number;
  total?: number;
  payment_fee_amount?: number;
  net_total?: number;
  paid_at?: string;
  created_at?: string;
};

type DailySalesReport = {
  error?: string;
  summary?: {
    total_orders?: number;
    total_revenue?: number;
    total_items_sold?: number;
    avg_ticket?: number;
    unique_customers?: number;
    total_gross_revenue?: number;
    total_payment_fees?: number;
    total_net_revenue?: number;
    total_service_fees?: number;
    payment_methods?: Record<string, DailySalesPayment>;
  };
  orders?: DailySalesOrder[];
  top_products?: DailySalesProduct[];
  category_performance?: DailySalesCategory[];
  low_stock_alerts?: DailySalesStockAlert[];
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit_card: "Cartao debito",
  credit_card: "Cartao credito",
};

const SALES_CHART_COLORS = ["#FF6B00", "#8A3E22", "#C65300", "#2F4858", "#B65F32", "#6D4A3A", "#D9802E", "#4B2A1E"];

function escapeReportValue(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReportDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

const TABS = [
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "stock", label: "Estoque", icon: PackageCheck },
  { id: "menu", label: "Cardápio", icon: Utensils },
  { id: "qr", label: "Guarda-Sóis", icon: QrCode },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "financial", label: "Contas", icon: DollarSign },
  { id: "printers", label: "Impressoras", icon: Printer },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "theme", label: "Personalizacao", icon: Palette },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "team", label: "Equipe", icon: Users },
];

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function VendorDashboard() {
  const pathname = usePathname();
  const isBeachOperations = pathname.startsWith("/vendor/operations");
  const visibleTabs = isBeachOperations ? TABS.filter(tab => ["orders", "stock", "financial", "reports", "printers"].includes(tab.id)) : TABS;
  const [beachAccess, setBeachAccess] = useState<boolean | null>(isBeachOperations ? null : true);
  const [activeTab, setActiveTab] = useState("orders");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Orders State ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  // --- Products State ---
  const [products, setProducts] = useState<Product[]>([]);
  cons…59261 tokens truncated…> (
                    <button
                      key={image.id}
                      type="button"
                      title={image.name}
                      onClick={() => setForm(prev => ({ ...prev, image_url: image.image_url }))}
                      className={cn(
                        "aspect-square overflow-hidden rounded-lg border-2 bg-gray-50",
                        form.image_url === image.image_url ? "border-[#FF6B00]" : "border-gray-200"
                      )}
                    >
                      <img src={image.image_url} alt={image.name} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {defaultImages.length === 0 && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
                Nenhuma imagem encontrada ainda. Tente uma categoria como bebidas, petiscos, pastéis, porções de peixe, batata ou calabresa.
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nome *</label>
            <input
              type="text" required
              value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
              placeholder="Ex: Cerveja Heineken 600ml"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
            <textarea
              value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
              rows={2}
              placeholder="Descreva o produto..."
            />
          </div>

            </>
          )}

          {/* Price row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Preço Normal *</label>
              <input
                type="text" inputMode="numeric" required
                value={priceInput} onChange={e => { const masked = maskBrazilianMoneyInput(e.target.value); setPriceInput(masked); setForm(prev => ({ ...prev, price: parseBrazilianMoneyInput(masked) ?? 0 })); }}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Preço Promocional</label>
              <input
                type="text" inputMode="numeric"
                value={promotionalPriceInput} onChange={e => { const masked = maskBrazilianMoneyInput(e.target.value); setPromotionalPriceInput(masked); setForm(prev => ({ ...prev, promotional_price: parseBrazilianMoneyInput(masked) })); }}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                placeholder="Opcional"
              />
            </div>
          </div>

          {!isMenuMode && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={e => {
                  setForm(prev => ({ ...prev, category: e.target.value, subcategory: "" }));
                  setNewSubcategoryName("");
                  setSubcategoryMessage("");
                }}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white"
              >
                <option value="">Selecione uma categoria cadastrada</option>
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {categoryNames.length === 0 && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                  Crie primeiro uma categoria no bloco “Categoria ou subcategoria” para ela aparecer aqui.
                </p>
              )}
            </div>
          )}

          {!isMenuMode && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Subcategoria / submenu</label>
                <select
                  value={form.subcategory || ""}
                  onChange={e => setForm(prev => ({ ...prev, subcategory: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white"
                >
                  <option value="">Sem subcategoria</option>
                  {subcategories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
                <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 p-3">
                  <p className="mb-2 text-xs font-black uppercase text-[#8a3e22]">Criar subcategoria nesta categoria</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newSubcategoryName}
                      onChange={e => setNewSubcategoryName(e.target.value)}
                      disabled={!selectedRoot}
                      className="min-w-0 flex-1 border-2 border-orange-100 rounded-xl p-3 text-sm font-bold focus:border-[#FF6B00] outline-none disabled:bg-gray-100 disabled:text-gray-400"
                      placeholder={selectedRoot ? "Ex: Limão, Abacaxi, Guaraná" : "Escolha a categoria principal primeiro"}
                    />
                    <button
                      type="button"
                      onClick={createSubcategory}
                      disabled={!selectedRoot || !newSubcategoryName.trim()}
                      className="rounded-xl bg-[#FF6B00] px-4 py-3 text-sm font-black text-white hover:bg-[#e56000] disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      Criar
                    </button>
                  </div>
                  {subcategoryMessage && <p className="mt-2 text-xs font-black text-[#8a3e22]">{subcategoryMessage}</p>}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 rounded-xl border-2 border-orange-100 bg-orange-50/70 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasOptions}
                    onChange={e => {
                      const checked = e.target.checked;
                      setHasOptions(checked);
                      if (checked && optionGroups.length === 0) setOptionGroups([{ name: 'Opcao', options: [''] }]);
                    }}
                    className="w-5 h-5 accent-[#FF6B00]"
                  />
                  <span className="text-sm font-black text-[#5a2d1d]">Este produto tem sabores/opções para o cliente escolher</span>
                </label>
                {hasOptions && (
                  <div className="mt-3 space-y-3 rounded-xl border border-orange-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-gray-900">Etapas de escolha</p><p className="text-xs font-bold text-gray-500">Ex.: bebida, acompanhamento e molho.</p></div><button type="button" onClick={addOptionGroup} className="rounded-lg bg-[#FF6B00] px-3 py-2 text-xs font-black text-white hover:bg-[#e56000]">+ Novo grupo</button></div>
                    {optionGroups.map((group, groupIndex) => <div key={groupIndex} className="rounded-xl border-2 border-orange-100 bg-orange-50/40 p-3"><div className="flex gap-2"><input value={group.name} onChange={event => updateOptionGroup(groupIndex, current => ({ ...current, name: event.target.value }))} className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white p-3 font-black outline-none focus:border-[#FF6B00]" placeholder="Nome do grupo: Bebida" /><button type="button" onClick={() => removeOptionGroup(groupIndex)} className="rounded-xl border border-red-200 px-3 text-xs font-black text-red-700 hover:bg-red-50">Remover grupo</button></div><div className="mt-3 space-y-2">{group.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input value={option} onChange={event => updateOptionGroup(groupIndex, current => ({ ...current, options: current.options.map((value, index) => index === optionIndex ? event.target.value : value) }))} className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white p-3 outline-none focus:border-[#FF6B00]" placeholder={optionIndex === 0 ? 'Ex.: Coca-Cola' : 'Nova escolha'} /><button type="button" onClick={() => updateOptionGroup(groupIndex, current => ({ ...current, options: current.options.length <= 1 ? [''] : current.options.filter((_, index) => index !== optionIndex) }))} className="rounded-xl border border-red-200 px-3 text-sm font-black text-red-700">×</button></div>)}</div><button type="button" onClick={() => updateOptionGroup(groupIndex, current => ({ ...current, options: [...current.options, ''] }))} className="mt-2 w-full rounded-lg border-2 border-dashed border-orange-300 py-2 text-xs font-black text-[#9A3E00]">+ Adicionar escolha</button></div>)}
                    <p className="text-xs font-bold text-gray-600">O cliente escolhe uma opção de cada grupo antes de adicionar o combo ao carrinho.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_combo}
                onChange={e => setForm(prev => ({ ...prev, is_combo: e.target.checked, menu_highlight: e.target.checked ? true : prev.menu_highlight }))}
                className="w-5 h-5 accent-[#FF6B00]"
              />
              <span className="text-sm font-bold text-gray-700">É um combo?</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(form.menu_highlight)}
                onChange={e => setForm(prev => ({ ...prev, menu_highlight: e.target.checked }))}
                className="w-5 h-5 accent-[#FF6B00]"
              />
              <span className="text-sm font-bold text-gray-700">Mostrar primeiro no cardápio</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                className="w-5 h-5 accent-[#FF6B00]"
              />
              <span className="text-sm font-bold text-gray-700">Disponível no cardápio</span>
            </label>
            {!isMenuMode && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.stock_tracking_enabled)}
                  onChange={e => {
                    const enabled = e.target.checked;
                    setForm(prev => ({
                      ...prev,
                      stock_tracking_enabled: enabled,
                      stock_quantity: enabled ? prev.stock_quantity : null,
                      physical_stock_quantity: enabled ? prev.physical_stock_quantity : 0,
                      beach_stock_quantity: enabled ? prev.beach_stock_quantity : 0,
                      blocked_by_stock: enabled ? prev.blocked_by_stock : false,
                    }));
                  }}
                  className="w-5 h-5 accent-[#FF6B00]"
                />
                <span className="text-sm font-bold text-gray-700">Contabilizar estoque</span>
              </label>
            )}
          </div>

          {!isMenuMode && form.stock_tracking_enabled && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#85736C] bg-[#fff8f6] p-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#85736C] bg-white p-3">
                <label className="block text-sm font-black text-[#3d1a0a] mb-1">Estoque central</label>
                <input
                  type="number"
                  min="0"
                  value={form.physical_stock_quantity || ""}
                  onChange={e => setForm(prev => ({ ...prev, physical_stock_quantity: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="w-full border-2 border-[#85736C] rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-[#fff8f6] font-black text-[#3d1a0a]"
                  placeholder="Ex: 80"
                />
              </div>
              <div className="rounded-xl border border-[#FFDBCB] bg-[#EFD5CA] p-3">
                <label className="block text-sm font-black text-[#FF6B00] mb-1">Estoque praia</label>
                <input
                  type="number"
                  min="0"
                  value={form.beach_stock_quantity || ""}
                  onChange={e => {
                    const nextStock = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setForm(prev => ({
                      ...prev,
                      beach_stock_quantity: nextStock,
                      stock_quantity: nextStock,
                      blocked_by_stock: nextStock <= 0,
                    }));
                  }}
                  className="w-full border-2 border-[#FFDBCB] rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white font-black text-[#3D1A0A]"
                  placeholder="Ex: 24"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) {
                alert("Informe o nome do produto.");
                return;
              }
              if (!form.category.trim()) {
                alert("Informe ou escolha uma categoria.");
                return;
              }
              if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
                alert("Informe um preço válido.");
                return;
              }
              if (hasOptions && normalizedOptionValues.length === 0) {
                alert("Adicione pelo menos uma linha de sabor/opção ou desmarque sabores/opções.");
                return;
              }
              onSave({
                ...form,
                category: form.category.trim(),
                subcategory: form.subcategory?.trim() || null,
                option_group_name: hasOptions ? (normalizedOptionGroups.length > 1 ? "Monte seu combo" : normalizedOptionGroups[0]?.name || "Opcao") : "",
                option_values: hasOptions ? normalizedOptionValues : [],
                menu_highlight: Boolean(form.menu_highlight || form.is_combo || form.promotional_price),
              });
            }}
            className="flex-1 py-3 bg-[#FF6B00] text-white rounded-xl font-bold hover:bg-[#E56000] active:scale-95 transition-all"
          >
            {isMenuMode ? "Salvar cardápio" : product ? "Salvar alterações" : "Adicionar Produto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// CUSTOMER MODAL COMPONENT
// =========================================================
function CustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const avgTicket = customer.visit_count > 0 ? customer.total_spent / customer.visit_count : 0;


  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-display font-bold text-gray-900">{customer.name}</h3>
            <p className="text-gray-500 text-sm flex items-center gap-1"><Phone size={12} />{customer.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6">
          {/* Customer KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-400 font-bold mb-1">Total Gasto</p>
              <p className="font-display font-bold text-[#FF6B00]">{formatCurrency(customer.total_spent)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-400 font-bold mb-1">Visitas</p>
              <p className="font-display font-bold text-gray-900">{customer.visit_count}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl text-center">
              <p className="text-xs text-gray-400 font-bold mb-1">Ticket Médio</p>
              <p className="font-display font-bold text-gray-900">{formatCurrency(avgTicket)}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-bold text-gray-500 uppercase tracking-widest text-xs mb-4">Informações</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Primeira visita</span>
                <span className="font-bold text-gray-900">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Última visita</span>
                <span className="font-bold text-gray-900">{new Date(customer.last_visit_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Frequência</span>
                <span className="font-bold text-gray-900">
                  {customer.visit_count > 5 ? "Cliente fiel 🏆" : customer.visit_count > 1 ? "Recorrente" : "Novo"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

