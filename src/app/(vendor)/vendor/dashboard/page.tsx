"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, Clock, Trash2, Pencil, X, Upload, ImageIcon,
  Eye, EyeOff, LogOut, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu, PackageCheck, Banknote, Smartphone, CreditCard,
  Volume2, CircleCheck, DollarSign,
  Printer,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
import PrinterManager from "@/components/vendor/PrinterManager";
import OrderPrintButton from "@/components/vendor/OrderPrintButton";
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
  category?: string;
  subtotal?: number;
  cancelled?: boolean;
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
    pió]væÚ$z{-®éÜj×ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#å7V&6FVv÷&–ò7V&ÖVçSÂöÆ&VÃà¢Ç6VÆV7@¢fÇVS×¶f÷&Òç7V&6FVv÷'’ÇÂ"'Ğ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ7V&6FVv÷'“¢RçF&vWBçfÇVRÒ’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&r×v†—FR ¢à¢Æ÷F–öâfÇVSÒ"#å6VÒ7V&6FVv÷&–Âö÷F–öãà¢·7V&6FVv÷&–W2æÖ†6FVv÷'’ÓâÆ÷F–öâ¶W“×¶6FVv÷'’æ–GÒfÇVS×¶6FVv÷'’ææÖWÓç¶6FVv÷'’ææÖWÓÂö÷F–öãâ—Ğ¢Â÷6VÆV7Cà¢ÆF—b6Æ74æÖSÒ&×BÓ2&÷VæFVB×†Â&÷&FW"&÷&FW"Ö÷&ævRÓ&rÖ÷&ævRÓSósÓ2#à¢Ç6Æ74æÖSÒ&Ö"Ó"FW‡B×‡2föçBÖ&Æ6²WW&66RFW‡BÕ²3†6S#%Ò#ä7&–"7V&6FVv÷&–æW7F6FVv÷&–Â÷à¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚Ö6öÂvÓ"6Ó¦fÆW‚×&÷r#à¢Æ–çW@¢fÇVS×¶æWu7V&6FVv÷'”æÖWĞ¢öä6†ævS×¶RÓâ6WDæWu7V&6FVv÷'”æÖR†RçF&vWBçfÇVR—Ğ¢F—6&ÆVC×²6VÆV7FVE&ö÷GĞ¢6Æ74æÖSÒ&Ö–â×rÓfÆW‚Ó&÷&FW"Ó"&÷&FW"Ö÷&ævRÓ&÷VæFVB×†ÂÓ2FW‡B×6ÒföçBÖ&öÆBfö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæRF—6&ÆVC¦&rÖw&’ÓF—6&ÆVC§FW‡BÖw&’ÓC ¢Æ6V†öÆFW#×·6VÆV7FVE&ö÷Bò$Wƒ¢Æ–Ü:6òÂ&6†’ÂwV&ì:"¢$W66öÆ†6FVv÷&–&–æ6—Â&–ÖV—&ò'Ğ¢óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢öä6Æ–6³×¶7&VFU7V&6FVv÷'—Ğ¢F—6&ÆVC×²6VÆV7FVE&ö÷BÇÂæWu7V&6FVv÷'”æÖRçG&–Ò‚—Ğ¢6Æ74æÖSÒ'&÷VæFVB×†Â&rÕ²4dcd#Ò‚ÓB’Ó2FW‡B×6ÒföçBÖ&Æ6²FW‡B×v†—FR†÷fW#¦&rÕ²6SScÒF—6&ÆVC¦7W'6÷"Öæ÷BÖÆÆ÷vVBF—6&ÆVC¦&rÖw&’Ó3 ¢à¢7&– ¢Âö'WGFöãà¢ÂöF—cà¢·7V&6FVv÷'”ÖW76vRbbÇ6Æ74æÖSÒ&×BÓ"FW‡B×‡2föçBÖ&Æ6²FW‡BÕ²3†6S#%Ò#ç·7V&6FVv÷'”ÖW76vWÓÂ÷çĞ¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'6Ó¦6öÂ×7âÓ"#à¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"Ö÷&ævRÓ&rÖ÷&ævRÓSósÓ27W'6÷"×ö–çFW"#à¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×¶†4÷F–öç7Ğ¢öä6†ævS×¶RÓâ°¢6öç7B6†V6¶VBÒRçF&vWBæ6†V6¶VC°¢6WD†4÷F–öç2†6†V6¶VB“°¢–b†6†V6¶VBbb÷F–öäw&÷W2æÆVæwF‚ÓÓÒ’6WD÷F–öäw&÷W2…·²æÖS¢t÷6òrÂ÷F–öç3¢²ruÒÕÒ“°¢×Ğ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò ¢óà¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&Æ6²FW‡BÕ²3V&CEÒ#äW7FR&öGWFòFVÒ6&÷&W2ö÷:|;VW2&ò6Æ–VçFRW66öÆ†W#Â÷7ãà¢ÂöÆ&VÃà¢¶†4÷F–öç2bb€¢ÆF—b6Æ74æÖSÒ&×BÓ276R×’Ó2&÷VæFVB×†Â&÷&FW"&÷&FW"Ö÷&ævRÓ&r×v†—FRÓB#à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâvÓ2#ãÆF—cãÇ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&Æ6²FW‡BÖw&’Ó“#äWF2FRW66öÆ†Â÷ãÇ6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡BÖw&’ÓS#äW‚ã¢&V&–FÂ6ö×æ†ÖVçFòRÖöÆ†òãÂ÷ãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×¶FD÷F–öäw&÷WÒ6Æ74æÖSÒ'&÷VæFVBÖÆr&rÕ²4dcd#Ò‚Ó2’Ó"FW‡B×‡2föçBÖ&Æ6²FW‡B×v†—FR†÷fW#¦&rÕ²6SScÒ#â²æ÷fòw'WóÂö'WGFöããÂöF—cà¢¶÷F–öäw&÷W2æÖ‚†w&÷WÂw&÷W–æFW‚’ÓâÆF—b¶W“×¶w&÷W–æFW‡Ò6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"Ö÷&ævRÓ&rÖ÷&ævRÓSóCÓ2#ãÆF—b6Æ74æÖSÒ&fÆW‚vÓ"#ãÆ–çWBfÇVS×¶w&÷WææÖWÒöä6†ævS×¶WfVçBÓâWFFT÷F–öäw&÷W†w&÷W–æFW‚Â7W'&VçBÓâ‡²ââæ7W'&VçBÂæÖS¢WfVçBçF&vWBçfÇVRÒ’—Ò6Æ74æÖSÒ&Ö–â×rÓfÆW‚Ó&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"Öw&’Ó#&r×v†—FRÓ2föçBÖ&Æ6²÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Õ²4dcd#Ò"Æ6V†öÆFW#Ò$æöÖRFòw'Wó¢&V&–F"óãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’Óâ&VÖ÷fT÷F–öäw&÷W†w&÷W–æFW‚—Ò6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"×&VBÓ#‚Ó2FW‡B×‡2föçBÖ&Æ6²FW‡B×&VBÓs†÷fW#¦&r×&VBÓS#å&VÖ÷fW"w'WóÂö'WGFöããÂöF—cãÆF—b6Æ74æÖSÒ&×BÓ276R×’Ó"#ç¶w&÷Wæ÷F–öç2æÖ‚†÷F–öâÂ÷F–öä–æFW‚’ÓâÆF—b¶W“×¶÷F–öä–æFW‡Ò6Æ74æÖSÒ&fÆW‚vÓ"#ãÆ–çWBfÇVS×¶÷F–öçÒöä6†ævS×¶WfVçBÓâWFFT÷F–öäw&÷W†w&÷W–æFW‚Â7W'&VçBÓâ‡²ââæ7W'&VçBÂ÷F–öç3¢7W'&VçBæ÷F–öç2æÖ‚‡fÇVRÂ–æFW‚’Óâ–æFW‚ÓÓÒ÷F–öä–æFW‚òWfVçBçF&vWBçfÇVR¢fÇVR’Ò’—Ò6Æ74æÖSÒ&Ö–â×rÓfÆW‚Ó&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"Öw&’Ó#&r×v†—FRÓ2÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Õ²4dcd#Ò"Æ6V†öÆFW#×¶÷F–öä–æFW‚ÓÓÒòtW‚ã¢6ö6Ô6öÆr¢tæ÷fW66öÆ†wÒóãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâWFFT÷F–öäw&÷W†w&÷W–æFW‚Â7W'&VçBÓâ‡²ââæ7W'&VçBÂ÷F–öç3¢7W'&VçBæ÷F–öç2æÆVæwF‚ÃÒò²ruÒ¢7W'&VçBæ÷F–öç2æf–ÇFW"‚…òÂ–æFW‚’Óâ–æFW‚ÓÒ÷F–öä–æFW‚’Ò’—Ò6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"×&VBÓ#‚Ó2FW‡B×6ÒföçBÖ&Æ6²FW‡B×&VBÓs#ì9sÂö'WGFöããÂöF—câ—ÓÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâWFFT÷F–öäw&÷W†w&÷W–æFW‚Â7W'&VçBÓâ‡²ââæ7W'&VçBÂ÷F–öç3¢²ââæ7W'&VçBæ÷F–öç2ÂruÒÒ’—Ò6Æ74æÖSÒ&×BÓ"rÖgVÆÂ&÷VæFVBÖÆr&÷&FW"Ó"&÷&FW"ÖF6†VB&÷&FW"Ö÷&ævRÓ3’Ó"FW‡B×‡2föçBÖ&Æ6²FW‡BÕ²3”4SÒ#â²F–6–öæ"W66öÆ†Âö'WGFöããÂöF—câ—Ğ¢Ç6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡BÖw&’Óc#äò6Æ–VçFRW66öÆ†RVÖ÷:|:6òFR6Fw'WòçFW2FRF–6–öæ"ò6öÖ&òò6'&–æ†òãÂ÷à¢ÂöF—cà¢—Ğ¢ÂöF—cà¢ÂöF—cà¢—Ğ ¢²ò¢FövvÆW2¢÷Ğ¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚×w&vÓb#à¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#à¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×¶f÷&Òæ—5ö6öÖ&÷Ğ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ—5ö6öÖ&ó¢RçF&vWBæ6†V6¶VBÂÖVçUö†–v†Æ–v‡C¢RçF&vWBæ6†V6¶VBòG'VR¢&WbæÖVçUö†–v†Æ–v‡BÒ’—Ğ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò ¢óà¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#ì8’VÒ6öÖ&óóÂ÷7ãà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#à¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×´&ööÆVâ†f÷&ÒæÖVçUö†–v†Æ–v‡B—Ğ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂÖVçUö†–v†Æ–v‡C¢RçF&vWBæ6†V6¶VBÒ’—Ğ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò ¢óà¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#äÖ÷7G&"&–ÖV—&òæò6&L:–óÂ÷7ãà¢ÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#à¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×¶f÷&Òæ7F—fWĞ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ7F—fS¢RçF&vWBæ6†V6¶VBÒ’—Ğ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò ¢óà¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#äF—7öì:×fVÂæò6&L:–óÂ÷7ãà¢ÂöÆ&VÃà¢²—4ÖVçTÖöFRbb€¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#à¢Æ–çW@¢G—SÒ&6†V6¶&÷‚ ¢6†V6¶VC×´&ööÆVâ†f÷&Òç7Fö6µ÷G&6¶–æuöVæ&ÆVB—Ğ¢öä6†ævS×¶RÓâ°¢6öç7BVæ&ÆVBÒRçF&vWBæ6†V6¶VC°¢6WDf÷&Ò‡&WbÓâ‡°¢ââç&WbÀ¢7Fö6µ÷G&6¶–æuöVæ&ÆVC¢Væ&ÆVBÀ¢7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbç7Fö6µ÷VçF—G’¢çVÆÂÀ¢‡—6–6Å÷7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbç‡—6–6Å÷7Fö6µ÷VçF—G’¢À¢&V6…÷7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbæ&V6…÷7Fö6µ÷VçF—G’¢À¢&Æö6¶VEö'•÷7Fö6³¢Væ&ÆVBò&Wbæ&Æö6¶VEö'•÷7Fö6²¢fÇ6RÀ¢Ò’“°¢×Ğ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò ¢óà¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#ä6öçF&–Æ—¦"W7F÷VSÂ÷7ãà¢ÂöÆ&VÃà¢—Ğ¢ÂöF—cà ¢²—4ÖVçTÖöFRbbf÷&Òç7Fö6µ÷G&6¶–æuöVæ&ÆVBbb€¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2ÓvÓB&÷VæFVB×†Â&÷&FW"&÷&FW"Õ²3ƒSs3d5Ò&rÕ²6ffc†ceÒÓB6Ó¦w&–BÖ6öÇ2Ó"#à¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Õ²3ƒSs3d5Ò&r×v†—FRÓ2#à¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&Æ6²FW‡BÕ²36CÒÖ"Ó#äW7F÷VR6VçG&ÃÂöÆ&VÃà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢fÇVS×¶f÷&Òç‡—6–6Å÷7Fö6µ÷VçF—G’ÇÂ"'Ğ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ‡—6–6Å÷7Fö6µ÷VçF—G“¢ÖF‚æÖ‚ƒÂ'6T–çB†RçF&vWBçfÇVRÂ’ÇÂ’Ò’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Õ²3ƒSs3d5Ò&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&rÕ²6ffc†ceÒföçBÖ&Æ6²FW‡BÕ²36CÒ ¢Æ6V†öÆFW#Ò$Wƒ¢ƒ ¢óà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Õ²4ddD$4%Ò&rÕ²4TdCT4ÒÓ2#à¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&Æ6²FW‡BÕ²4dcd#ÒÖ"Ó#äW7F÷VR&–ÂöÆ&VÃà¢Æ–çW@¢G—SÒ&çVÖ&W" ¢Ö–ãÒ# ¢fÇVS×¶f÷&Òæ&V6…÷7Fö6µ÷VçF—G’ÇÂ"'Ğ¢öä6†ævS×¶RÓâ°¢6öç7BæW‡E7Fö6²ÒÖF‚æÖ‚ƒÂ'6T–çB†RçF&vWBçfÇVRÂ’ÇÂ“°¢6WDf÷&Ò‡&WbÓâ‡°¢ââç&WbÀ¢&V6…÷7Fö6µ÷VçF—G“¢æW‡E7Fö6²À¢7Fö6µ÷VçF—G“¢æW‡E7Fö6²À¢&Æö6¶VEö'•÷7Fö6³¢æW‡E7Fö6²ÃÒÀ¢Ò’“°¢×Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Õ²4ddD$4%Ò&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&r×v†—FRföçBÖ&Æ6²FW‡BÕ²34CÒ ¢Æ6V†öÆFW#Ò$Wƒ¢#B ¢óà¢ÂöF—cà¢ÂöF—cà¢—Ğ¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’ÓfÆW‚vÓ2#à¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ&fÆW‚Ó’Ó2&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖw&’Óc†÷fW#¦&rÖw&’ÓS#à¢6æ6VÆ ¢Âö'WGFöãà¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ°¢–b‚f÷&ÒææÖRçG&–Ò‚’’°¢ÆW'B‚$–æf÷&ÖRòæöÖRFò&öGWFòâ"“°¢&WGW&ã°¢Ğ¢–b‚f÷&Òæ6FVv÷'’çG&–Ò‚’’°¢ÆW'B‚$–æf÷&ÖR÷RW66öÆ†VÖ6FVv÷&–â"“°¢&WGW&ã°¢Ğ¢–b‚çVÖ&W"æ—4f–æ—FR„çVÖ&W"†f÷&Òç&–6R’’ÇÂçVÖ&W"†f÷&Òç&–6R’Â’°¢ÆW'B‚$–æf÷&ÖRVÒ&\:vòl:Æ–Fòâ"“°¢&WGW&ã°¢Ğ¢–b††4÷F–öç2bbæ÷&ÖÆ—¦VD÷F–öåfÇVW2æÆVæwF‚ÓÓÒ’°¢ÆW'B‚$F–6–öæRVÆòÖVæ÷2VÖÆ–æ†FR6&÷"ö÷:|:6ò÷RFW6Ö'VR6&÷&W2ö÷:|;VW2â"“°¢&WGW&ã°¢Ğ¢öå6fR‡°¢ââæf÷&ÒÀ¢6FVv÷'“¢f÷&Òæ6FVv÷'’çG&–Ò‚’À¢7V&6FVv÷'“¢f÷&Òç7V&6FVv÷'“òçG&–Ò‚’ÇÂçVÆÂÀ¢÷F–öåöw&÷WöæÖS¢†4÷F–öç2ò†æ÷&ÖÆ—¦VD÷F–öäw&÷W2æÆVæwF‚âò$ÖöçFR6WR6öÖ&ò"¢æ÷&ÖÆ—¦VD÷F–öäw&÷W5³ÓòææÖRÇÂ$÷6ò"’¢""À¢÷F–öå÷fÇVW3¢†4÷F–öç2òæ÷&ÖÆ—¦VD÷F–öåfÇVW2¢µÒÀ¢ÖVçUö†–v†Æ–v‡C¢&ööÆVâ†f÷&ÒæÖVçUö†–v†Æ–v‡BÇÂf÷&Òæ—5ö6öÖ&òÇÂf÷&Òç&öÖ÷F–öæÅ÷&–6R’À¢Ò“°¢×Ğ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÕ²4dcd#ÒFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆB†÷fW#¦&rÕ²4SScÒ7F—fS§66ÆRÓ“RG&ç6—F–öâÖÆÂ ¢à¢¶—4ÖVçTÖöFRò%6Çf"6&L:–ò"¢&öGV7Bò%6Çf"ÇFW&:|;VW2"¢$F–6–öæ"&öGWFò'Ğ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢“°§Ğ ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¢òò5U5DôÔU"ÔôDÂ4ôÕôäTå@¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞ¦gVæ7F–öâ7W7FöÖW$ÖöFÂ‡²7W7FöÖW"Âöä6Æ÷6RÓ¢²7W7FöÖW#¢7W7FöÖW#²öä6Æ÷6S¢‚’Óâfö–BÒ’°¢6öç7BfuF–6¶WBÒ7W7FöÖW"çf—6—Eö6÷VçBâò7W7FöÖW"çF÷FÅ÷7VçBò7W7FöÖW"çf—6—Eö6÷VçB¢° ¢&WGW&â€¢ÆF—b6Æ74æÖSÒ&f—†VB–ç6WBÓ&rÖ&Æ6²óS¢ÓSfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"ÓB"öä6Æ–6³×¶öä6Æ÷6WÓà¢ÆF—b6Æ74æÖSÒ&&r×v†—FR&÷VæFVBÓ'†ÂÖ‚×rÖÆrrÖgVÆÂÖ‚Ö‚Õ³“f…Ò÷fW&fÆ÷r×’ÖWFò6†F÷rÓ'†Â"öä6Æ–6³×¶RÓâRç7F÷&÷vF–öâ‚—Óà¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2Ö6VçFW"Ób&÷&FW"Ö"&÷&FW"Öw&’Ó#à¢ÆF—cà¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶7W7FöÖW"ææÖWÓÂöƒ3à¢Ç6Æ74æÖSÒ'FW‡BÖw&’ÓSFW‡B×6ÒfÆW‚—FV×2Ö6VçFW"vÓ#ãÅ†öæR6—¦S×³'Òóç¶7W7FöÖW"ç†öæWÓÂ÷à¢ÂöF—cà¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ'FW‡BÖw&’ÓC†÷fW#§FW‡BÖw&’Óc#ãÅ‚6—¦S×³#GÒóãÂö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'Ób#à¢²ò¢7W7FöÖW"µ—2¢÷Ğ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó2vÓBÖ"Ób#à¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åF÷FÂv7FóÂ÷à¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÕ²4dcd#Ò#ç¶f÷&ÖD7W'&Væ7’†7W7FöÖW"çF÷FÅ÷7VçB—ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åf—6—F3Â÷à¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶7W7FöÖW"çf—6—Eö6÷VçGÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åF–6¶WBÜ:–F–óÂ÷à¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶f÷&ÖD7W'&Væ7’†fuF–6¶WB—ÓÂ÷à¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&&÷&FW"×B&÷&FW"Öw&’ÓBÓB#à¢ÆƒB6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’ÓSWW&66RG&6¶–ær×v–FW7BFW‡B×‡2Ö"ÓB#ä–æf÷&Ö:|;VW3ÂöƒCà¢ÆF—b6Æ74æÖSÒ'76R×’Ó2FW‡B×6Ò#à¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#à¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#å&–ÖV—&f—6—FÂ÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#î(	CÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#à¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#ì9¦ÇF–Öf—6—FÂ÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶æWrFFR†7W7FöÖW"æÆ7E÷f—6—EöB’çFôÆö6ÆTFFU7G&–ær‚'BÔ%""—ÓÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#à¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#äg&W\:¦æ6–Â÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#à¢¶7W7FöÖW"çf—6—Eö6÷VçBâRò$6Æ–VçFRf–VÂ	øøb"¢7W7FöÖW"çf—6—Eö6÷VçBâò%&V6÷'&VçFR"¢$æ÷fò'Ğ¢Â÷7ãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’Ó#à¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ'rÖgVÆÂ’Ó2&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖw&’Óc†÷fW#¦&rÖw&’ÓS#à¢fV6† ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢“°§Ğ 