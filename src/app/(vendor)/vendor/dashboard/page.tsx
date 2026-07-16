"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, Clock, Trash2, Pencil, X, Upload, ImageIcon,
  Eye, EyeOff, LogOut, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu, PackageCheck, Banknote, Smartphone, CreditCard,
  Volume2, CircleCheck, DollarSign,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
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
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "theme", label: "Personalizacao", icon: Palette },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "team", label: "Equipe", icon: Users },
];

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function VendorDashboard() {
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
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [productFilter, setProductFilter] = useState("Todos");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productDraft, setProductDraft] = useState<Product | null>(null);
  const [productModalMode, setProductModalMode] = useState<"stock" | "menu">("stock");
  const [categoryForm, setCategoryForm] = useState({ name: "", parent_id: "" });
  const [categoryMessage, setCategoryMessage] = useState("");

  // --- Umbrellas State ---
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [showAddUmbrella, setShowAddUmbrella] = useState(false);
  const [newUmbrellaNumber, setNewUmbrellaNumber] = useState("");
  const [manualAccountUmbrella, setManualAccountUmbrella] = useState<Umbrella | null>(null);
  const [manualOrderingOrder, setManualOrderingOrder] = useState<Order | null>(null);
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [stockAdjustmentHistory, setStockAdjustmentHistory] = useState<StockAdjustmentHistory | null>(null);
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false);
  const [stockHistoryError, setStockHistoryError] = useState("");
  const [showUpsellSettings, setShowUpsellSettings] = useState(false);
  const [showPromotionSettings, setShowPromotionSettings] = useState(false);
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [flexiblePromotions, setFlexiblePromotions] = useState<FlexiblePromotion[]>([]);

  // --- Reports State ---
  const [reportPeriod, setReportPeriod] = useState("month");
  const [salesChartType, setSalesChartType] = useState<"bars" | "pie">("bars");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [closingMessage, setClosingMessage] = useState("");
  const [cashControl, setCashControl] = useState<CashControl | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [todayCashSales, setTodayCashSales] = useState(0);
  const [cashControlLoading, setCashControlLoading] = useState(true);
  const [managementIntelligence, setManagementIntelligence] = useState<ManagementIntelligence | null>(null);
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [dailySalesGoal, setDailySalesGoal] = useState(0);
  const [dailySalesGoalDraft, setDailySalesGoalDraft] = useState("");
  const [editingDailyGoal, setEditingDailyGoal] = useState(false);
  const [savingDailyGoal, setSavingDailyGoal] = useState(false);
  const [dailyGoalMessage, setDailyGoalMessage] = useState("");
  const [soundAlertsReady, setSoundAlertsReady] = useState(false);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertPreferences, setAlertPreferences] = useState<DeviceAlertPreferences>(DEFAULT_DEVICE_ALERT_PREFERENCES);

  // --- Customers State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [team, setTeam] = useState<VendorUser[]>([]);
  const [teamForm, setTeamForm] = useState({
    name: "", email: "", login: "", role: "seller", password: "", password_confirm: "", commission_type: "none", commission_value: "",
  });
  const [teamMessage, setTeamMessage] = useState("");
  const [commissionUser, setCommissionUser] = useState<VendorUser | null>(null);
  const [commissionForm, setCommissionForm] = useState({ type: "none", value: "" });
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState("");
  const [themeForm, setThemeForm] = useState<KioskTheme>(DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const knownOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const ordersRevisionRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const cashRegisterAudioRef = useRef<HTMLAudioElement | null>(null);
  const orderBellAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertPreferencesRef = useRef<DeviceAlertPreferences>(DEFAULT_DEVICE_ALERT_PREFERENCES);

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
    return audioContextRef.current;
  };

  const playToneSequence = (tones: { frequency: number; start: number; duration: number; type?: OscillatorType }[]) => {
    const audio = getAudioContext();
    if (!audio) return;
    if (audio.state === "suspended") {
      audio.resume().catch(() => undefined);
    }
    const base = audio.currentTime + 0.02;
    tones.forEach((tone) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type || "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.001, base + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.18, base + tone.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, base + tone.start + tone.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(base + tone.start);
      oscillator.stop(base + tone.start + tone.duration + 0.03);
    });
  };

  const playNewOrderSound = () => {
    vibrateDevice(alertPreferencesRef.current);
    if (typeof window === "undefined" || alertPreferencesRef.current.volume <= 0) return;
    const sound = orderBellAudioRef.current || new Audio('/sounds/order-bell.mp3');
    orderBellAudioRef.current = sound;
    sound.currentTime = 0;
    sound.volume = alertPreferencesRef.current.volume;
    sound.play().catch(() => {
      playToneSequence([
        { frequency: 880, start: 0, duration: 0.12 },
        { frequency: 1175, start: 0.14, duration: 0.18 },
      ]);
    });
  };

  const playCashRegisterSound = () => {
    vibrateDevice(alertPreferencesRef.current);
    if (typeof window === "undefined" || alertPreferencesRef.current.volume <= 0) return;
    const sound = cashRegisterAudioRef.current || new Audio('/sounds/cash-register-kaching.mp3');
    cashRegisterAudioRef.current = sound;
    sound.currentTime = 0;
    sound.volume = alertPreferencesRef.current.volume;
    sound.play().catch(() => {
      playToneSequence([
        { frequency: 1046, start: 0, duration: 0.08, type: "triangle" },
        { frequency: 1318, start: 0.08, duration: 0.08, type: "triangle" },
        { frequency: 1568, start: 0.17, duration: 0.18, type: "square" },
        { frequency: 784, start: 0.38, duration: 0.14, type: "triangle" },
      ]);
    });
  };

  const playWaiterCallSound = () => {
    playToneSequence([
      { frequency: 740, start: 0, duration: 0.1, type: "square" },
      { frequency: 740, start: 0.16, duration: 0.1, type: "square" },
      { frequency: 988, start: 0.32, duration: 0.16, type: "triangle" },
    ]);
  };

  const activateSoundAlerts = async () => {
    const audioContext = getAudioContext();
    await audioContext?.resume().catch(() => undefined);
    const sounds = [cashRegisterAudioRef.current, orderBellAudioRef.current].filter(Boolean) as HTMLAudioElement[];
    if (sounds.length === 0) return;
    try {
      for (const sound of sounds) {
        sound.muted = true;
        sound.currentTime = 0;
        await sound.play();
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      }
      setSoundAlertsReady(true);
    } catch {
      sounds.forEach(sound => { sound.muted = false; });
      setSoundAlertsReady(false);
    }
  };

  const updateAlertPreferences = (next: DeviceAlertPreferences) => {
    alertPreferencesRef.current = next;
    setAlertPreferences(next);
    saveDeviceAlertPreferences(next);
    if (orderBellAudioRef.current) orderBellAudioRef.current.volume = next.volume;
  };

  // Data loading functions
  const loadOrders = async (vid: string) => {
    try {
      const res = await fetch(`/api/orders?vendor_id=${vid}`);
      if (res.ok) {
        ordersRevisionRef.current = res.headers.get('X-Orders-Revision') || ordersRevisionRef.current;
        const data = await res.json();
        const nextStatusMap = new Map<string, string>();
        let hasNewOrder = false;
        let hasNewClosingRequest = false;
        let hasNewWaiterCall = false;
        data.forEach((order: Order) => {
          const requestId = order.active_request?.id || order.active_request_id || "";
          const currentSignature = `${order.status}:${requestId}:${getServiceRequest(order)?.marker || "normal"}:${order.notes || ""}`;
          const previousStatus = knownOrderStatusesRef.current.get(order.id);
          nextStatusMap.set(order.id, currentSignature);
          if (!previousStatus && order.status === "received") hasNewOrder = true;
          if (previousStatus && order.status === "received" && (requestId ? !previousStatus.includes(`:${requestId}:`) : !previousStatus.startsWith("received:"))) hasNewOrder = true;
          if (!previousStatus && order.status === "closing_requested") hasNewClosingRequest = true;
          if (!previousStatus && getServiceRequest(order)) hasNewWaiterCall = true;
          if (previousStatus && !previousStatus.startsWith("closing_requested") && order.status === "closing_requested") {
            hasNewClosingRequest = true;
          }
          if (previousStatus && previousStatus.includes("normal") && getServiceRequest(order)) hasNewWaiterCall = true;
        });
        if (knownOrderStatusesRef.current.size > 0) {
          if (hasNewOrder) playNewOrderSound();
          if (hasNewClosingRequest) playCashRegisterSound();
          if (hasNewWaiterCall) playWaiterCallSound();
        }
        knownOrderStatusesRef.current = nextStatusMap;
        setOrders(data);
        setNewOrderCount(data.filter((o: Order) => o.status === 'received').length);
        return data as Order[];
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
    return [] as Order[];
  };

  const loadOrdersWhenChanged = async (vid: string) => {
    try {
      const response = await fetch(`/api/orders?vendor_id=${vid}&mode=revision`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const revision = String(data.revision || '');
      if (!ordersRevisionRef.current || revision !== ordersRevisionRef.current) await loadOrders(vid);
    } catch (error) {
      console.error('Failed to check order updates:', error);
    }
  };

  const loadProducts = async (vid: string) => {
    try {
      const res = await fetch(`/api/products?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadUpsellSettings = async (vid: string) => {
    try {
      const res = await fetch(`/api/upsell-settings?vendor_id=${vid}`);
      const data = await res.json();
      setUpsellRules(data.rules || []);
    } catch {
      setUpsellRules([]);
    }
  };

  const loadFlexiblePromotions = async (vid: string) => {
    try {
      const res = await fetch(`/api/promotions?vendor_id=${vid}`);
      const data = await res.json().catch(() => ({}));
      setFlexiblePromotions(data.promotions || []);
    } catch { setFlexiblePromotions([]); }
  };

  const loadUmbrellas = async (vid: string) => {
    try {
      const res = await fetch(`/api/umbrellas?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setUmbrellas(data);
      }
    } catch (err) {
      console.error('Failed to load umbrellas:', err);
    }
  };

  const loadCustomers = async (vid: string) => {
    try {
      const res = await fetch(`/api/customers?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadTeam = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendor-users?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  };

  const loadTheme = async (vid: string) => {
    try {
      const res = await fetch(`/api/vendors/${vid}/theme`);
      if (res.ok) {
        const data = await res.json();
        setThemeForm(buildThemeForm(data));
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    }
  };

  const loadManagementIntelligence = async (vid: string) => {
    try {
      const res = await fetch(`/api/management-assistant?vendor_id=${vid}`);
      const data = await res.json();
      if (res.ok && !data.error) setManagementIntelligence(data);
    } catch (err) {
      console.error('Failed to load management summary:', err);
    }
  };

  const loadDailySalesGoal = async (vid: string) => {
    try {
      const res = await fetch(`/api/sales-goal?vendor_id=${vid}`);
      const data = await res.json();
      if (res.ok) {
        const goal = Number(data.daily_goal || 0);
        setDailySalesGoal(goal);
        setDailySalesGoalDraft(goal > 0 ? String(goal) : "");
      }
    } catch (err) {
      console.error('Failed to load daily sales goal:', err);
    }
  };

  const loadTodayCashControl = async (vid: string) => {
    setCashControlLoading(true);
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const response = await fetch(`/api/daily-report?vendor_id=${vid}&date=${today}`);
      const data = await response.json();
      if (response.ok) {
        setCashControl(data.cash_control || null);
        setTodayCashSales(Number(data.summary?.payment_methods?.cash?.total || 0));
      }
    } catch (error) {
      console.error('Failed to load cash control:', error);
    } finally { setCashControlLoading(false); }
  };

  // Load vendor ID and initial data
  useEffect(() => {
    const vid = sessionStorage.getItem("vendor_id");
    if (vid) {
      setVendorId(vid);
      // Load initial data
      loadOrders(vid);
      loadProducts(vid);
      loadUpsellSettings(vid);
      loadFlexiblePromotions(vid);
      loadProductCategories(vid);
      loadUmbrellas(vid);
      loadCustomers(vid);
      loadTeam(vid);
      loadTheme(vid);
      loadManagementIntelligence(vid);
      loadDailySalesGoal(vid);
      loadTodayCashControl(vid);
    }
  }, []);

  const saveDailySalesGoal = async () => {
    if (!vendorId) return;
    const goal = Number(String(dailySalesGoalDraft).replace(',', '.'));
    if (!Number.isFinite(goal) || goal < 0) {
      setDailyGoalMessage("Informe um valor valido.");
      return;
    }
    setSavingDailyGoal(true);
    setDailyGoalMessage("");
    try {
      const res = await fetch('/api/sales-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, daily_goal: goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nao foi possivel salvar a meta.');
      setDailySalesGoal(Number(data.daily_goal || 0));
      setDailySalesGoalDraft(data.daily_goal > 0 ? String(data.daily_goal) : "");
      setEditingDailyGoal(false);
      setDailyGoalMessage("Meta atualizada.");
    } catch (error) {
      setDailyGoalMessage(error instanceof Error ? error.message : "Erro ao salvar a meta.");
    } finally {
      setSavingDailyGoal(false);
    }
  };

  const saveTheme = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vendorId) return;
    setThemeSaving(true);
    setThemeMessage("");
    try {
      const res = await fetch(`/api/vendors/${vendorId}/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(themeForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setThemeMessage(data.error || "Não foi possível salvar a personalização.");
        return;
      }
      setThemeForm(buildThemeForm(data));
      setThemeMessage(activeTab === "payments"
        ? "Formas de pagamento salvas para este quiosque."
        : "Personalização salva. O login do cliente e os QRs já usam essas cores.");
    } catch {
      setThemeMessage("Erro de rede ao salvar personalização.");
    } finally {
      setThemeSaving(false);
    }
  };

  useEffect(() => {
    if (!vendorId) return;
    let refreshing = false;
    const refreshOrders = async (includeUmbrellas = false) => {
      if (refreshing || document.visibilityState !== 'visible' || !navigator.onLine) return;
      refreshing = true;
      try {
        await Promise.all([loadOrdersWhenChanged(vendorId), includeUmbrellas ? loadUmbrellas(vendorId) : Promise.resolve()]);
      } finally {
        refreshing = false;
      }
    };
    const ordersTimer = window.setInterval(() => void refreshOrders(false), 5000);
    const umbrellasTimer = window.setInterval(() => void refreshOrders(true), 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshOrders(true); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(ordersTimer);
      window.clearInterval(umbrellasTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId || activeTab !== "orders") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) loadManagementIntelligence(vendorId);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [activeTab, vendorId]);

  useEffect(() => {
    const preferences = readDeviceAlertPreferences();
    alertPreferencesRef.current = preferences;
    setAlertPreferences(preferences);
    const sound = new Audio('/sounds/cash-register-kaching.mp3');
    const orderBell = new Audio('/sounds/order-bell.mp3');
    sound.preload = 'auto';
    orderBell.preload = 'auto';
    orderBell.volume = preferences.volume;
    cashRegisterAudioRef.current = sound;
    orderBellAudioRef.current = orderBell;
    const unlockAudio = () => { activateSoundAlerts(); };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      sound.pause();
      orderBell.pause();
      cashRegisterAudioRef.current = null;
      orderBellAudioRef.current = null;
    };
  }, []);

  const createTeamUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vendorId) return;
    setTeamMessage("");
    if (teamForm.password !== teamForm.password_confirm) {
      setTeamMessage("A senha e a confirmação não conferem.");
      return;
    }
    try {
      const res = await fetch('/api/vendor-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, ...teamForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTeamMessage(data.error || "Não foi possível criar usuário.");
        return;
      }
      setTeam(prev => [data, ...prev]);
      setTeamForm({ name: "", email: "", login: "", role: "seller", password: "", password_confirm: "", commission_type: "none", commission_value: "" });
      setTeamMessage("Usuário criado. Ele já pode entrar no painel pelo login e senha definidos.");
    } catch {
      setTeamMessage("Erro de rede ao criar usuário.");
    }
  };

  // Load reports when tab or period changes
  useEffect(() => {
    if (activeTab === "reports" && vendorId) {
      setReportLoading(true);
      fetch(`/api/reports?vendor_id=${vendorId}&period=${reportPeriod}`)
        .then(r => r.json())
        .then(d => { setReportData(d); setReportLoading(false); })
        .catch(() => setReportLoading(false));
      loadTodayCashControl(vendorId);
      loadManagementIntelligence(vendorId);
    }
  }, [activeTab, reportPeriod, vendorId]);

  useEffect(() => {
    if (activeTab === "stock" && vendorId) loadStockAdjustments(vendorId);
  }, [activeTab, vendorId]);

  // Order management
  const moveOrder = async (id: string, newStatus: string) => {
    const currentOrder = orders.find(order => order.id === id);
    if (currentOrder && isOrderEmpty(currentOrder) && ['preparing', 'delivering', 'completed', 'closing_requested'].includes(newStatus)) {
      alert('Comanda vazia não pode ir para preparo, entrega ou fechamento. Use "Liberar guarda-sol vazio".');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao atualizar pedido.');
        return;
      }
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setSelectedOrder(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
    } catch (err) {
      console.error('Move order error:', err);
      alert('Erro de rede ao atualizar pedido.');
    }
  };

  const submitCashControl = async (values: { opening_cash?: number; counted_cash?: number; difference_reason?: string; notes?: string }) => {
    if (!vendorId) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    setClosingDay(true);
    setClosingMessage("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, date: today, action: cashControl?.status === "open" ? "close" : "open", ...values }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar o caixa.");
      }
      setCashControl(data.cash_control || null);
      setShowCashModal(false);
      setClosingMessage(data.closed ? `${data.message} Diferença: ${formatCurrency(Number(data.cash_control?.difference || 0))}` : data.message);
      fetch(`/api/reports?vendor_id=${vendorId}&period=${reportPeriod}`)
        .then(r => r.json())
        .then(d => setReportData(d))
        .catch(() => undefined);
    } catch (err) {
      console.error("Cash control error:", err);
      throw err;
    } finally {
      setClosingDay(false);
    }
  };

  const openCommissionEditor = (user: VendorUser) => {
    setCommissionUser(user);
    setCommissionForm({ type: user.commission_type || 'none', value: user.commission_type && user.commission_type !== 'none' ? String(user.commission_value || 0) : '' });
    setCommissionMessage("");
  };

  const saveCommission = async () => {
    if (!vendorId || !commissionUser) return;
    setCommissionSaving(true); setCommissionMessage("");
    try {
      const response = await fetch('/api/vendor-users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, user_id: commissionUser.id, commission_type: commissionForm.type, commission_value: commissionForm.type === 'none' ? 0 : Number(commissionForm.value) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel atualizar a comissao.');
      setTeam(current => current.map(user => user.id === commissionUser.id ? { ...user, commission_type: data.commission_type, commission_value: Number(data.commission_value || 0) } : user));
      setCommissionUser(null);
      setTeamMessage(`Comissao de ${commissionUser.name} atualizada.`);
    } catch (error) {
      setCommissionMessage(error instanceof Error ? error.message : 'Erro ao atualizar comissao.');
    } finally { setCommissionSaving(false); }
  };

  const askManagementAssistant = async (question: string) => {
    if (!vendorId) return;
    setAssistantLoading(true);
    try {
      const res = await fetch('/api/management-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, question }) });
      const data = await res.json();
      setAssistantAnswer(res.ok ? data.answer : data.error || 'Não foi possível responder.');
    } catch {
      setAssistantAnswer('Sem conexão para consultar os dados agora.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const loadProductCategories = async (vid: string) => {
    try {
      const res = await fetch(`/api/product-categories?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        setProductCategories(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load product categories:', err);
    }
  };

  const exportTodaySalesPdf = async () => {
    if (!vendorId) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    try {
      const res = await fetch(`/api/daily-report?vendor_id=${vendorId}&date=${today}`);
      const report = (await res.json()) as DailySalesReport;
      if (!res.ok) {
        alert(report.error || "Não foi possível exportar as vendas do dia.");
        return;
      }

      const paymentRows = Object.entries(report.summary?.payment_methods || {})
        .map(([method, data]) => `
          <tr>
            <td>${escapeReportValue(PAYMENT_METHOD_LABELS[method] || method)}</td>
            <td>${Number(data.count || 0)}</td>
            <td>${formatCurrency(Number(data.gross ?? data.total ?? 0))}</td>
            <td>${formatCurrency(Number(data.fees || 0))}</td>
            <td>${formatCurrency(Number(data.net ?? data.total ?? 0))}</td>
          </tr>
        `).join("");

      const productRows = (report.top_products || [])
        .map((product: DailySalesProduct) => `
          <tr>
            <td>${escapeReportValue(product.name)}</td>
            <td>${Number(product.quantity || 0)}</td>
            <td>${formatCurrency(Number(product.revenue || 0))}</td>
          </tr>
        `).join("");

      const stockRows = (report.low_stock_alerts || [])
        .map((item: DailySalesStockAlert) => `
          <tr>
            <td>${escapeReportValue(item.name)}</td>
            <td>${escapeReportValue(item.category)}</td>
            <td>${Number(item.quantity || 0)} un.</td>
            <td>${item.blocked || Number(item.quantity || 0) <= 0 ? "Sem estoque" : "Baixo"}</td>
          </tr>
        `).join("");

      const categoryRows = (report.category_performance || [])
        .map((item: DailySalesCategory) => `
          <tr>
            <td>${escapeReportValue(item.category)}</td>
            <td>${Number(item.quantity || 0)}</td>
            <td>${formatCurrency(Number(item.revenue || 0))}</td>
          </tr>
        `).join("");

      const orderRows = (report.orders || [])
        .map((order: DailySalesOrder) => {
          const paymentMethod = order.payment_method || "cash";
          return `
            <tr>
              <td>${escapeReportValue(order.umbrella_number)}</td>
              <td>${escapeReportValue(order.customer_name)}</td>
              <td>${escapeReportValue(order.customer_phone)}</td>
              <td>${Number(order.items_count || 0)}</td>
              <td>${escapeReportValue(PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod)}</td>
              <td>${formatCurrency(Number(order.gross_total ?? order.total ?? 0))}</td>
              <td>${formatCurrency(Number(order.payment_fee_amount || 0))}</td>
              <td>${formatCurrency(Number(order.net_total ?? order.total ?? 0))}</td>
              <td>${new Date(order.paid_at || order.created_at || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
            </tr>
          `;
        }).join("");

      const html = `
        <html>
          <head>
            <meta charset="UTF-8" />
            <title>Vendas do dia - ${formatReportDate(today)}</title>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 28px; color: #111111; font-family: Arial, sans-serif; background: #ffffff; }
              header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #111111; padding-bottom: 18px; margin-bottom: 22px; }
              h1 { margin: 0; font-size: 28px; }
              h2 { margin: 28px 0 10px; font-size: 17px; color: #111111; }
              p { margin: 4px 0; color: #444444; }
              .brand { text-align: right; font-weight: 800; color: #111111; }
              .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
              .kpi { border: 1px solid #bdbdbd; border-radius: 10px; background: #f4f4f4; padding: 12px; }
              .kpi span { display: block; color: #555555; font-size: 11px; font-weight: 800; text-transform: uppercase; }
              .kpi strong { display: block; margin-top: 6px; color: #111111; font-size: 20px; }
              table { width: 100%; border-collapse: collapse; background: #ffffff; }
              th, td { border: 1px solid #cfcfcf; padding: 8px; color: #111111; text-align: left; font-size: 12px; }
              th { background: #e5e5e5; font-size: 11px; text-transform: uppercase; }
              tr:nth-child(even) td { background: #f7f7f7; }
              footer { margin-top: 28px; color: #555555; font-size: 11px; text-align: center; }
              @media print { body { background: #ffffff; padding: 18px; } .kpis { break-inside: avoid; } }
            </style>
          </head>
          <body>
            <header>
              <div>
                <h1>Vendas do dia</h1>
                <p>${formatReportDate(today)}</p>
              </div>
              <div class="brand">SandExpress<br />Relatório operacional</div>
            </header>
            <section class="kpis">
              <div class="kpi"><span>Faturamento bruto</span><strong>${formatCurrency(Number(report.summary?.total_gross_revenue ?? report.summary?.total_revenue ?? 0))}</strong></div>
              <div class="kpi"><span>Taxas</span><strong>${formatCurrency(Number(report.summary?.total_payment_fees || 0))}</strong></div>
              <div class="kpi"><span>Liquido</span><strong>${formatCurrency(Number(report.summary?.total_net_revenue ?? report.summary?.total_revenue ?? 0))}</strong></div>
              <div class="kpi"><span>Pedidos pagos</span><strong>${Number(report.summary?.total_orders || 0)}</strong></div>
            </section>
            <section class="kpis">
              <div class="kpi"><span>Itens vendidos</span><strong>${Number(report.summary?.total_items_sold || 0)}</strong></div>
              <div class="kpi"><span>Ticket medio</span><strong>${formatCurrency(Number(report.summary?.avg_ticket || 0))}</strong></div>
              <div class="kpi"><span>Clientes unicos</span><strong>${Number(report.summary?.unique_customers || 0)}</strong></div>
              <div class="kpi"><span>Gerado em</span><strong>${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></div>
            </section>
            <h2>Meios de pagamento</h2>
            <table>
              <thead><tr><th>Metodo</th><th>Contas</th><th>Bruto</th><th>Taxas</th><th>Liquido</th></tr></thead>
              <tbody>${paymentRows || `<tr><td colspan="5">Nenhuma venda paga no dia.</td></tr>`}</tbody>
            </table>
            <h2>Alertas de estoque</h2>
            <table>
              <thead><tr><th>Produto</th><th>Categoria</th><th>Restante</th><th>Status</th></tr></thead>
              <tbody>${stockRows || `<tr><td colspan="4">Nenhum produto com estoque baixo.</td></tr>`}</tbody>
            </table>
            <h2>Drinks, porções e categorias</h2>
            <table>
              <thead><tr><th>Categoria</th><th>Itens vendidos</th><th>Faturamento</th></tr></thead>
              <tbody>${categoryRows || `<tr><td colspan="3">Sem vendas por categoria.</td></tr>`}</tbody>
            </table>
            <h2>Produtos mais vendidos</h2>
            <table>
              <thead><tr><th>Produto</th><th>Quantidade</th><th>Faturamento</th></tr></thead>
              <tbody>${productRows || `<tr><td colspan="3">Sem produtos vendidos.</td></tr>`}</tbody>
            </table>
            <h2>Pedidos pagos</h2>
            <table>
              <thead><tr><th>Guarda-sol</th><th>Cliente</th><th>Telefone</th><th>Itens</th><th>Pagamento</th><th>Bruto</th><th>Taxa</th><th>Liquido</th><th>Hora</th></tr></thead>
              <tbody>${orderRows || `<tr><td colspan="9">Nenhum pedido pago no dia.</td></tr>`}</tbody>
            </table>
            <footer>Relatório gerado pelo SandExpress.</footer>
          </body>
        </html>
      `;

      const printWindow = window.open("", "", "width=960,height=720");
      if (!printWindow) {
        alert("O navegador bloqueou a janela de PDF. Libere pop-ups para exportar.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      console.error("Export daily sales report error:", err);
      alert("Erro de rede ao exportar vendas do dia.");
    }
  };

  // Product management
  const toggleProduct = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || 'Erro ao atualizar produto.');
      }
      const updated = await res.json();
      setProducts(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err) {
      console.error('Toggle product error:', err);
      alert('Erro de rede ao atualizar produto.');
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este produto?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || 'Erro ao remover produto.');
      }
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Delete product error:', err);
      alert('Erro de rede ao remover produto.');
    }
  };

  const saveProduct = async (product: Product) => {
    if (!vendorId) {
      return alert('Não foi possível identificar o seu quiosque. Faça login novamente.');
    }

    try {
      const method = editingProduct ? 'PATCH' : 'POST';
      const url = editingProduct ? `/api/products/${product.id}` : '/api/products';
      const payload = { ...product, vendor_id: vendorId };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || 'Erro ao salvar produto.');
      }
      const saved = await res.json();
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === saved.id ? saved : p));
      } else {
        setProducts(prev => [saved, ...prev]);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductDraft(null);
    } catch (err) {
      console.error('Save product error:', err);
      alert('Erro de rede ao salvar produto.');
    }
  };

  const saveProductCategory = async () => {
    if (!vendorId || !categoryForm.name.trim()) return;
    setCategoryMessage("");
    try {
      const res = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          name: categoryForm.name,
          parent_id: categoryForm.parent_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCategoryMessage(data.error || 'Não foi possível salvar categoria.');
        return;
      }
      setProductCategories(prev => [data, ...prev.filter(item => item.id !== data.id)]);
      setCategoryForm({ name: "", parent_id: "" });
      setCategoryMessage(data.parent_id ? "Subcategoria salva." : "Categoria salva.");
    } catch {
      setCategoryMessage("Erro de rede ao salvar categoria.");
    }
  };

  const deleteProductCategory = async (category: ProductCategory) => {
    if (!vendorId) return;
    const confirmed = confirm(`Excluir "${category.name}" do menu de categorias? Os produtos não serão apagados.`);
    if (!confirmed) return;
    setCategoryMessage("");
    try {
      const res = await fetch(`/api/product-categories?id=${encodeURIComponent(category.id)}&vendor_id=${encodeURIComponent(vendorId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCategoryMessage(data.error || 'Não foi possível excluir a categoria.');
        return;
      }
      setProductCategories(prev => prev.filter(item => item.id !== category.id && item.parent_id !== category.id));
      if (productFilter === category.name) setProductFilter("Todos");
      setCategoryMessage("Categoria excluída do menu.");
    } catch {
      setCategoryMessage("Erro de rede ao excluir categoria.");
    }
  };

  // Umbrella management
  const registerStockAdjustment = async (values: { product_id: string; quantity: number; reason: string; location: string; note: string }) => {
    if (!vendorId) throw new Error("Quiosque não identificado.");
    const res = await fetch('/api/stock-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, ...values }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Não foi possível registrar a baixa.');
    await loadProducts(vendorId);
    await loadStockAdjustments(vendorId);
    setShowStockAdjustment(false);
  };

  const loadStockAdjustments = async (id: string) => {
    setStockHistoryLoading(true);
    setStockHistoryError("");
    try {
      const response = await fetch(`/api/stock-adjustments?vendor_id=${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as movimentações.");
      setStockAdjustmentHistory(data);
    } catch (error) {
      setStockHistoryError(error instanceof Error ? error.message : "Erro ao carregar movimentações.");
    } finally {
      setStockHistoryLoading(false);
    }
  };

  const saveUpsellSettings = async (rules: UpsellRule[]) => {
    if (!vendorId) throw new Error("Quiosque não identificado.");
    const res = await fetch('/api/upsell-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, rules }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Não foi possível salvar as sugestões.');
    setUpsellRules(data.rules || []);
    setShowUpsellSettings(false);
  };

  const openManualAccount = async (umbrella: Umbrella, name: string, phone: string) => {
    if (!vendorId) throw new Error('Quiosque nao identificado.');
    const res = await fetch('/api/vendor/manual-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId, umbrella_id: umbrella.id, name, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Nao foi possivel abrir a comanda.');

    const refreshedOrders = await loadOrders(vendorId);
    await loadUmbrellas(vendorId);
    const openedOrder = refreshedOrders.find(order => order.id === data.order_id);
    setManualAccountUmbrella(null);
    if (openedOrder) setSelectedOrder(openedOrder);
  };

  const launchManualItems = async (order: Order, cart: Record<string, number>, notes: string) => {
    if (!vendorId) throw new Error('Quiosque nao identificado.');
    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    if (items.length === 0) throw new Error('Selecione pelo menos um item.');

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendorId,
        customer_id: order.customer_id,
        umbrella_id: order.umbrella_id,
        items,
        notes: notes.trim() || 'Pedido lancado manualmente pelo quiosque',
        idempotency_key: crypto.randomUUID(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Nao foi possivel lancar os itens.');

    const refreshedOrders = await loadOrders(vendorId);
    await loadUmbrellas(vendorId);
    setManualOrderingOrder(null);
    const refreshed = refreshedOrders.find(item => item.id === order.id);
    setSelectedOrder(refreshed || null);
  };

  const addUmbrella = async () => {
    const num = parseInt(newUmbrellaNumber);
    if (!vendorId) {
      return alert('Não foi possível identificar o seu quiosque. Faça login novamente.');
    }
    if (!num || umbrellas.some(u => u.number === num)) return alert('Número inválido ou já existe!');

    try {
      const res = await fetch('/api/umbrellas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, number: num, label: `Barraca ${num}` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || 'Erro ao adicionar guarda-sol.');
      }
      const saved = await res.json();
      setUmbrellas(prev => [...prev, saved]);
      setNewUmbrellaNumber('');
      setShowAddUmbrella(false);
    } catch (err) {
      console.error('Add umbrella error:', err);
      alert('Erro de rede ao adicionar guarda-sol.');
    }
  };

  const toggleUmbrella = async (id: string) => {
    const current = umbrellas.find(u => u.id === id);
    if (!current) return;

    try {
      const res = await fetch(`/api/umbrellas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current.active }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return alert(err?.error || 'Erro ao atualizar guarda-sol.');
      }
      const updated = await res.json();
      setUmbrellas(prev => prev.map(u => u.id === id ? updated : u));
    } catch (err) {
      console.error('Toggle umbrella error:', err);
      alert('Erro de rede ao atualizar guarda-sol.');
    }
  };

  const generateQR = async (umbrella: Umbrella) => {
    try {
      const res = await fetch(`/api/qr?umbrella_id=${encodeURIComponent(umbrella.id)}&format=json`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não foi possível gerar o QR Code.");
        return;
      }
      setUmbrellas(prev => prev.map(u => u.id === umbrella.id ? {
        ...u,
        qr_image_url: data.qr_image_url,
        qr_url: data.target_url,
        qr_path: data.target_path,
      } : u));
    } catch (err) {
      console.error("Failed to generate QR:", err);
      alert("Erro de rede ao gerar QR Code.");
    }
  };

  const deleteUmbrella = async (umbrella: Umbrella) => {
    if (umbrella.is_occupied || umbrella.current_order_id) {
      return alert('Não e possível excluir guarda-sol com conta aberta.');
    }

    const confirmed = confirm(`Excluir definitivamente o guarda-sol ${umbrella.number}? Esta acao remove o QR gravado no banco.`);
    if (!confirmed) return;

    const vendorPassword = prompt('Digite a senha do admin do quiosque para confirmar a exclusão');
    if (!vendorPassword) return;

    try {
      const res = await fetch(`/api/umbrellas/${umbrella.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_password: vendorPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return alert(data.error || 'Erro ao excluir guarda-sol.');
      }
      setUmbrellas(prev => prev.filter(u => u.id !== umbrella.id));
    } catch (err) {
      console.error('Delete umbrella error:', err);
      alert('Erro de rede ao excluir guarda-sol.');
    }
  };

  const markAccountPaid = async (order: Order) => {
    setPayingOrder(order);
  };

  const confirmAccountPaid = async (order: Order, paymentMethod: string, amount: number, payerName: string) => {
    if (!vendorId) return;
    const label = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;
    const confirmed = confirm(`Confirmar recebimento de ${formatCurrency(amount)} do guarda-sol ${order.umbrella} em ${label}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/account-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          order_id: order.id,
          amount,
          payment_method: paymentMethod,
          payer_name: payerName || order.customer,
          note: 'Recebido pelo painel do quiosque',
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível confirmar o pagamento.');
        return;
      }
      if (data.closed) {
        setOrders(prev => prev.filter(o => o.id !== order.id));
        setUmbrellas(prev => prev.map(u => u.id === order.umbrella_id ? { ...u, is_occupied: false, current_order_id: null } : u));
      } else {
        await loadOrders(vendorId);
        alert(`Pagamento registrado. Saldo restante: ${formatCurrency(Number(data.remaining_amount || 0))}.`);
      }
      setSelectedOrder(null);
      setPayingOrder(null);
    } catch (err) {
      console.error('Pay account error:', err);
      alert('Erro de rede ao confirmar pagamento.');
    }
  };

  const cancelOrderItem = async (order: Order, item: OrderItem) => {
    if (!item.id || item.cancelled) return;
    const reason = prompt(`Motivo do cancelamento de "${item.n}"`, 'Cancelado pela gestao do quiosque');
    if (!reason) return;

    try {
      const res = await fetch(`/api/order-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível cancelar o item.');
        return;
      }

      setOrders(prev => prev.map(current => {
        if (current.id !== order.id) return current;
        return {
          ...current,
          total: Number(data.total || 0),
          items: current.items.map(currentItem => currentItem.id === item.id ? { ...currentItem, cancelled: true } : currentItem),
        };
      }));
      setSelectedOrder(prev => prev?.id === order.id ? {
        ...prev,
        total: Number(data.total || 0),
        items: prev.items.map(currentItem => currentItem.id === item.id ? { ...currentItem, cancelled: true } : currentItem),
      } : prev);
    } catch (err) {
      console.error('Cancel order item error:', err);
      alert('Erro de rede ao cancelar item.');
    }
  };

  const releaseEmptyUmbrella = async (order: Order) => {
    if (!isOrderEmpty(order)) {
      alert('Esta comanda possui consumo. Feche a conta normalmente.');
      return;
    }

    const confirmed = confirm(`Liberar o guarda-sol ${order.umbrella} sem consumo?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          notes: `${getVisibleOrderNotes(order.notes)}\nGuarda-sol liberado sem consumo pelo painel.`.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Não foi possível liberar o guarda-sol.');
        return;
      }
      setOrders(prev => prev.filter(item => item.id !== order.id));
      setUmbrellas(prev => prev.map(umbrella => umbrella.id === order.umbrella_id
        ? { ...umbrella, is_occupied: false, current_order_id: null }
        : umbrella
      ));
      setSelectedOrder(null);
    } catch (err) {
      console.error('Release empty umbrella error:', err);
      alert('Erro de rede ao liberar guarda-sol.');
    }
  };

  const acknowledgeWaiterCall = async (order: Order) => {
    if (!vendorId) return;
    const cleanedNotes = (order.notes || "")
      .split("\n")
      .filter(line => !line.includes(WAITER_CALL_MARKER))
      .join("\n")
      .trim();
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: cleanedNotes || null }),
      });
      if (!res.ok) {
        alert("Não foi possível marcar o garcom como atendido.");
        return;
      }
      const updated = { ...order, notes: cleanedNotes || undefined };
      setOrders(prev => prev.map(item => item.id === order.id ? updated : item));
      setSelectedOrder(updated);
      await loadOrders(vendorId);
    } catch (err) {
      console.error("Acknowledge waiter error:", err);
      alert("Erro ao marcar o garcom como atendido.");
    }
  };

  // Filtered products
  const rootProductCategories = productCategories.filter(category => !category.parent_id && category.active !== false);
  const customCategoryNames = rootProductCategories.map(category => category.name);
  const productCategoryNames = products.map(product => product.category).filter(Boolean);
  const menuCategories = customCategoryNames.length > 0
    ? Array.from(new Set(customCategoryNames))
    : Array.from(new Set(productCategoryNames));
  const filteredProducts = productFilter === "Todos" ? products : products.filter(p => p.category === productFilter);
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );
  const panelThemeStyle = {
    "--vendor-primary": themeForm.primary_color,
    "--vendor-secondary": themeForm.secondary_color,
    "--vendor-button": themeForm.button_color,
    "--vendor-button-text": themeForm.button_text_color,
  } as React.CSSProperties;

  const renderCompactKanbanColumn = (
    title: string,
    filterOrder: (order: Order) => boolean,
    nextAction: string,
    nextStatus: string,
    color: string,
    options: { pulse?: boolean; paidAction?: boolean } = {}
  ) => {
    const colOrders = orders.filter(filterOrder);
    return (
      <div className="vendor-kanban-column bg-gray-100 rounded-lg p-3 flex flex-col min-h-[16rem] lg:min-h-[calc(100vh-21rem)]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm text-gray-700 capitalize flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
            {title}
          </h3>
          <span className="vendor-kanban-count bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{colOrders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar">
          {colOrders.map(order => {
            const emptyAccount = isOrderEmpty(order);
            const requestAgeMinutes = order.active_request?.created_at ? Math.max(0, Math.floor((Date.now() - new Date(order.active_request.created_at).getTime()) / 60000)) : 0;
            const delayed = Boolean(order.active_request && requestAgeMinutes >= 20 && ['received', 'preparing'].includes(order.status));
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={cn(
                  "vendor-order-card w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-left transition-all hover:border-[#FF6B00] hover:shadow-md",
                  options.pulse && "animate-pulse border-[#ff6b00] bg-[#fff8f6] shadow-md",
                  getServiceRequest(order) && "border-red-300 bg-red-50 shadow-md ring-2 ring-red-200",
                  delayed && "border-red-500 bg-red-50 ring-2 ring-red-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="bg-[#FF6B00] text-white text-[11px] font-bold px-2 py-1 rounded-md">#{order.umbrella}</span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={11}/> {order.time}</span>
                </div>
                {getServiceRequest(order) && (
                  <p className="mt-2 rounded-md bg-red-600 px-2 py-1 text-center text-xs font-black uppercase text-white animate-pulse">
                    {getServiceRequest(order)?.label}
                  </p>
                )}
                {delayed && <p className="mt-2 rounded-md bg-red-700 px-2 py-1 text-center text-xs font-black uppercase text-white">Atrasado · {requestAgeMinutes} min</p>}
                {emptyAccount && (
                  <p className="mt-2 rounded-md bg-gray-100 px-2 py-1 text-center text-xs font-black uppercase text-gray-500">
                    Sem consumo
                  </p>
                )}
                <p className="mt-2 text-xs font-bold text-gray-400">
                  {order.active_request ? `Pedido ${order.active_request.sequence}` : `Comanda #${order.id.slice(0, 8)}`}
                </p>
                <p className="text-sm font-black text-gray-900 truncate">{order.customer}</p>
                <p className="text-xs font-bold text-[#FF6B00]">
                  {order.active_request ? `Pedido: ${formatCurrency(Number(order.active_request.subtotal || 0))}` : `Conta: ${formatCurrency(order.total)}`}
                </p>
                {order.active_request && (
                  <p className="text-[11px] font-bold text-gray-400">Conta: {formatCurrency(order.total)}</p>
                )}
                <div className="mt-2 flex flex-col gap-1">
                  {emptyAccount ? (
                    <span
                      onClick={(event) => { event.stopPropagation(); releaseEmptyUmbrella(order); }}
                      role="button"
                      tabIndex={0}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-3 py-2 text-center text-sm font-black text-white hover:bg-slate-900"
                    >
                      Liberar guarda-sol vazio
                    </span>
                  ) : options.paidAction ? (
                    <span
                      onClick={(event) => { event.stopPropagation(); markAccountPaid(order); }}
                      role="button"
                      tabIndex={0}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-green-600 px-3 py-2 text-center text-sm font-black text-white hover:bg-green-700"
                    >
                      Conta paga
                    </span>
                  ) : nextStatus ? (
                    <span
                      onClick={(event) => { event.stopPropagation(); moveOrder(order.id, nextStatus); }}
                      role="button"
                      tabIndex={0}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-black text-gray-700 hover:bg-[#FF6B00] hover:text-white"
                    >
                      {nextAction}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
          {colOrders.length === 0 && (
            <div className="text-center py-8 text-gray-300">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum pedido</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTodayManagementSummary = () => {
    const today = managementIntelligence?.today;
    const progress = dailySalesGoal > 0 ? Math.min(100, Math.round((Number(today?.revenue || 0) / dailySalesGoal) * 100)) : 0;
    const cards = [
      { label: "Faturamento", value: formatCurrency(Number(today?.revenue || 0)) },
      { label: "Pedidos", value: String(today?.orders || 0) },
      { label: "Clientes", value: String(today?.customers || 0) },
      { label: "Ticket medio", value: formatCurrency(Number(today?.avg_ticket || 0)) },
      { label: "Produtos vendidos", value: String(today?.items_sold || 0) },
      { label: "Lucro estimado", value: formatCurrency(Number(today?.estimated_profit || 0)) },
    ];
    return (
      <section className="vendor-today-summary rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#C65300]">Hoje</p>
            <h3 className="text-lg font-black text-gray-900">Resumo do quiosque</h3>
          </div>
          <button type="button" onClick={() => { setEditingDailyGoal(value => !value); setDailyGoalMessage(""); }} className="vendor-daily-goal-button min-h-11 rounded-xl border-2 border-orange-200 bg-orange-50 px-4 text-base font-black text-[#9A3E00] hover:bg-orange-100">
            {dailySalesGoal > 0 ? `Meta: ${formatCurrency(dailySalesGoal)}` : "Definir meta diaria"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {cards.map(card => <div key={card.label} className="vendor-summary-metric rounded-xl bg-gray-50 p-3"><p className="text-xs font-black uppercase text-gray-600">{card.label}</p><p className="mt-1 break-words text-xl font-black text-gray-950">{card.value}</p></div>)}
        </div>
        {dailySalesGoal > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-3 text-sm font-black text-gray-700"><span>Progresso da meta</span><span>{progress}%</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-orange-100"><div className={cn("h-full rounded-full transition-all", progress >= 100 ? "bg-green-600" : "bg-[#FF6B00]")} style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-sm font-bold text-gray-600">{progress >= 100 ? "Meta alcancada. Excelente resultado!" : `Faltam ${formatCurrency(Math.max(0, dailySalesGoal - Number(today?.revenue || 0)))} para atingir a meta.`}</p>
          </div>
        )}
        {editingDailyGoal && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-black uppercase text-gray-700">Meta de faturamento por dia
              <input type="number" min="0" step="0.01" value={dailySalesGoalDraft} onChange={event => setDailySalesGoalDraft(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border-2 border-white bg-white px-3 text-base font-black text-gray-950 outline-none focus:border-[#FF6B00]" placeholder="Ex.: 3000,00" />
            </label>
            <button type="button" onClick={saveDailySalesGoal} disabled={savingDailyGoal} className="min-h-11 rounded-xl bg-[#FF6B00] px-5 font-black text-white hover:bg-[#E56000] disabled:opacity-60">{savingDailyGoal ? "Salvando..." : "Salvar meta"}</button>
          </div>
        )}
        {dailyGoalMessage && <p className="mt-2 text-sm font-black text-[#8A3E22]">{dailyGoalMessage}</p>}
      </section>
    );
  };

  const renderBeachMap = () => {
    const activeAccounts = orders.filter(order => !order.paid).length;
    const occupiedUmbrellas = umbrellas.filter(umbrella => umbrella.is_occupied || umbrella.current_order_id).length;
    return (
      <section className="vendor-beach-map rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-gray-900">Mapa da praia</h3>
            <p className="text-sm font-bold text-gray-400">{occupiedUmbrellas} ocupados · {activeAccounts} contas abertas</p>
          </div>
          <div className="vendor-beach-legend flex flex-wrap items-center gap-3 text-sm font-black text-gray-500">
            <span className="is-free inline-flex items-center gap-1.5"><CircleCheck size={17} aria-hidden="true" />Livre</span>
            <span className="is-occupied inline-flex items-center gap-1.5"><Clock size={17} aria-hidden="true" />Ocupada</span>
            <span className="is-closing inline-flex items-center gap-1.5"><DollarSign size={17} aria-hidden="true" />Conta</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8 md:grid-cols-12">
          {umbrellas.map(umbrella => {
            const order = orders.find(item => item.umbrella_id === umbrella.id);
            const closing = order?.status === 'closing_requested';
            const serviceRequest = getServiceRequest(order);
            const emptyAccount = order ? isOrderEmpty(order) : false;
            const occupied = Boolean(umbrella.is_occupied || umbrella.current_order_id || order);
            const firstCustomerName = getFirstCustomerName(order?.customer);
            const accountTotal = order ? formatCurrency(Number(order.total || 0)) : '';
            const StatusIcon = closing ? DollarSign : occupied ? Clock : CircleCheck;
            const statusLabel = closing ? 'Conta' : occupied ? 'Ocupada' : 'Livre';
            return (
              <button
                key={umbrella.id}
                onClick={() => order
                  ? setSelectedOrder(order)
                  : umbrella.active ? setManualAccountUmbrella(umbrella) : undefined}
                className={cn(
                  "relative aspect-square min-h-12 rounded-xl border text-sm font-black transition-all",
                  "vendor-umbrella-tile",
                  !umbrella.active && "is-inactive border-gray-200 bg-gray-100 text-gray-300",
                  umbrella.active && !occupied && "is-free border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                  umbrella.active && occupied && !closing && "is-occupied border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
                  umbrella.active && closing && "is-closing border-orange-300 bg-orange-500 text-white hover:bg-orange-600",
                  umbrella.active && serviceRequest && "is-service animate-pulse border-red-500 bg-red-600 text-white shadow-lg ring-4 ring-red-200"
                )}
                title={serviceRequest
                  ? `${serviceRequest.label} - guarda-sol ${umbrella.number}`
                  : order ? `${order.customer} - ${formatCurrency(order.total)}`
                    : umbrella.active ? `Abrir comanda manual no guarda-sol ${umbrella.number}` : 'Guarda-sol inativo'}
              >
                <span className="flex h-full min-w-0 flex-col items-center justify-center px-1 leading-tight">
                  <span className="text-lg font-black">{umbrella.number}</span>
                  {umbrella.active && (
                    <span className="vendor-umbrella-status mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide">
                      <StatusIcon size={14} strokeWidth={2.75} aria-hidden="true" />
                      {statusLabel}
                    </span>
                  )}
                  {firstCustomerName && (
                    <span className="mt-1 max-w-full truncate text-[11px] font-black opacity-90">
                      {firstCustomerName}
                    </span>
                  )}
                  {firstCustomerName && accountTotal && (
                    <span className="mt-0.5 max-w-full truncate text-[10px] font-black">
                      {accountTotal}
                    </span>
                  )}
                </span>
                {serviceRequest && (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-white/95 px-1 py-0.5 text-[9px] font-black uppercase text-red-600">
                    {serviceRequest.shortLabel}
                  </span>
                )}
                {!serviceRequest && emptyAccount && !firstCustomerName && (
                  <span className="absolute inset-x-1 bottom-1 rounded bg-white/90 px-1 py-0.5 text-[9px] font-black uppercase text-gray-500">
                    Vazio
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="vendor-ops-shell min-h-app bg-white flex flex-col lg:flex-row font-sans" style={panelThemeStyle}>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-100 bg-gray-50 flex flex-col shrink-0 transition-transform lg:static lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-xl text-[#FF6B00]">SandExpress</h1>
              <p className="text-sm text-gray-500 font-semibold">Painel Gerencial</p>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden" aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
              className={cn(
                "tap-target w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm relative",
                activeTab === tab.id ? "bg-[#FF6B00] text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
              )}
            >
              <tab.icon size={20} />
              {tab.label}
              {tab.id === "orders" && newOrderCount > 0 && activeTab !== "orders" && (
                <span className="absolute right-3 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                  {newOrderCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button className="tap-target w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 text-sm font-bold transition-colors rounded-lg hover:bg-red-50">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="min-h-16 border-b border-gray-100 flex items-center justify-between gap-3 bg-white px-3 pt-safe sm:min-h-20 sm:px-6 lg:px-8 shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="tap-target rounded-xl bg-gray-100 p-3 text-gray-700 lg:hidden" aria-label="Abrir menu">
              <Menu size={20} />
            </button>
            <h2 className="truncate text-xl sm:text-2xl font-bold font-display text-gray-800">
            {TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button type="button" onClick={() => { setShowAlertSettings(true); activateSoundAlerts(); }} className={cn("vendor-sound-button flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-black", soundAlertsReady ? "bg-blue-100 text-blue-800" : "animate-pulse bg-orange-100 text-[#9A3E00]")} title="Configurar som, volume e vibracao" aria-label="Configurar alertas de novos pedidos">
              <Volume2 size={16} /> <span className="hidden sm:inline">{soundAlertsReady ? "Som ativo" : "Ativar som"}</span>
            </button>
            <button type="button" disabled={cashControlLoading || cashControl?.status === 'closed'} onClick={() => setShowCashModal(true)} className={cn("vendor-cash-button flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-black", cashControlLoading ? "bg-gray-100 text-gray-600" : cashControl?.status === 'open' ? "bg-green-100 text-green-800" : cashControl?.status === 'closed' ? "bg-red-100 text-red-800" : "animate-pulse bg-amber-100 text-amber-900")} title={cashControl?.status === 'open' ? 'Clique para fechar o caixa' : 'Clique para abrir o caixa'}>
              <Banknote size={16} /> <span className="hidden sm:inline">{cashControlLoading ? 'Carregando caixa' : cashControl?.status === 'open' ? 'Caixa aberto' : cashControl?.status === 'closed' ? 'Dia encerrado' : 'Abrir caixa'}</span>
            </button>
          </div>
        </header>

        {showAlertSettings && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="alert-settings-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-gray-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h3 id="alert-settings-title" className="text-xl font-black">Alertas sonoros</h3><p className="mt-1 text-sm font-semibold text-gray-600">Teste separadamente novo pedido e pedido de fechamento de conta.</p></div><button type="button" onClick={() => setShowAlertSettings(false)} className="rounded-full bg-gray-100 p-2" aria-label="Fechar"><X size={20} /></button></div>
            <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-gray-200 p-4"><span><strong className="block">Vibrar celular ou tablet</strong><small className="text-gray-600">Ativado por padrao em aparelhos compativeis.</small></span><input type="checkbox" checked={alertPreferences.vibrationEnabled} onChange={event => updateAlertPreferences({ ...alertPreferences, vibrationEnabled: event.target.checked })} className="h-6 w-6 accent-[#FF6B00]" /></label>
            <label className="mt-4 block rounded-2xl border border-gray-200 p-4"><span className="flex justify-between font-black"><span>Volume da campainha</span><span>{Math.round(alertPreferences.volume * 100)}%</span></span><input type="range" min="0" max="100" step="5" value={Math.round(alertPreferences.volume * 100)} onChange={event => updateAlertPreferences({ ...alertPreferences, volume: Number(event.target.value) / 100 })} className="mt-4 w-full accent-[#FF6B00]" /><small className="mt-2 block text-gray-600">O resultado tambem respeita o volume fisico e o modo silencioso do aparelho.</small></label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={async () => { await activateSoundAlerts(); playNewOrderSound(); }} className="min-h-12 rounded-2xl bg-[#FF6B00] px-3 font-black text-white"><Volume2 className="mr-2 inline" size={19} /> Novo pedido</button>
              <button type="button" onClick={async () => { await activateSoundAlerts(); playCashRegisterSound(); }} className="min-h-12 rounded-2xl bg-[#3D1A0A] px-3 font-black text-white"><Banknote className="mr-2 inline" size={19} /> Pedido da conta</button>
            </div>
          </div>
        </div>}

        {/* Tab Contents */}
          <div className="flex-1 overflow-auto bg-gray-50 p-3 pb-[calc(100px+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-6">

          {/* ========== ABA 1: PEDIDOS (KANBAN) ========== */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {renderTodayManagementSummary()}
              {renderBeachMap()}
              <div className="vendor-kanban-board grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                {renderCompactKanbanColumn(
                  "Mesa aberta",
                  (order) => !order.paid && order.status !== "closing_requested" && Number(order.total || 0) <= 0,
                  "",
                  "",
                  "bg-slate-500"
                )}
                {renderCompactKanbanColumn(
                  "Recebido",
                  (order) => !order.paid && ["received", "preparing", "delivering"].includes(order.status) && Number(order.total || 0) > 0,
                  "Entregue",
                  "completed",
                  "bg-blue-500",
                  { pulse: true }
                )}
                {renderCompactKanbanColumn(
                  "Fechar conta",
                  (order) => !order.paid && order.status === "closing_requested",
                  "Conta paga",
                  "",
                  "bg-orange-500",
                  { paidAction: true }
                )}
              </div>
            </div>
          )}

          {/* ========== ABA 2: CARDÁPIO ========== */}
          {activeTab === "stock" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setShowStockAdjustment(true)} className="rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700">
                  Registrar perda ou consumo
                </button>
              </div>
              <OpeningDayStockControl
              vendorId={vendorId || undefined}
              products={products}
              onProductsLoaded={(loaded) => setProducts(loaded.map((product) => ({
                ...product,
                promotional_price: product.promotional_price ?? null,
                description: product.description || "",
                image_url: product.image_url || "",
                is_combo: Boolean(product.is_combo),
                stock_tracking_enabled: Boolean(product.stock_tracking_enabled),
                physical_stock_quantity: product.physical_stock_quantity ?? 0,
                beach_stock_quantity: product.beach_stock_quantity ?? 0,
                blocked_by_stock: product.blocked_by_stock ?? false,
                sort_order: product.sort_order ?? 0,
              })))}
              onAddProduct={() => {
                setEditingProduct(null);
                setProductDraft(null);
                setProductModalMode("stock");
                setShowProductModal(true);
              }}
              onEditProduct={(product) => {
                setEditingProduct({
                  ...product,
                  promotional_price: product.promotional_price ?? null,
                  description: product.description || "",
                  image_url: product.image_url || "",
                  is_combo: Boolean(product.is_combo),
                  stock_tracking_enabled: Boolean(product.stock_tracking_enabled),
                  physical_stock_quantity: product.physical_stock_quantity ?? 0,
                  beach_stock_quantity: product.beach_stock_quantity ?? 0,
                  blocked_by_stock: product.blocked_by_stock ?? false,
                  sort_order: product.sort_order ?? 0,
                });
                setProductDraft(null);
                setProductModalMode("stock");
                setShowProductModal(true);
              }}
              onDeleteProduct={deleteProduct}
              />

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-black uppercase text-red-700">Auditoria de estoque</p><h3 className="text-xl font-black text-gray-950">Perdas e baixas registradas</h3><p className="mt-1 text-sm font-bold text-gray-600">Últimas 100 movimentações, com responsável e impacto estimado.</p></div>
                  <button type="button" onClick={() => vendorId && loadStockAdjustments(vendorId)} disabled={stockHistoryLoading} className="min-h-11 rounded-xl border-2 border-gray-200 px-4 text-sm font-black text-gray-800 hover:bg-gray-50 disabled:opacity-50">{stockHistoryLoading ? "Atualizando..." : "Atualizar histórico"}</button>
                </div>
                {stockHistoryError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-800">{stockHistoryError}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-red-50 p-3"><p className="text-xs font-black uppercase text-red-700">Itens baixados</p><p className="mt-1 text-2xl font-black text-red-900">{stockAdjustmentHistory?.total_quantity || 0}</p></div>
                  <div className="rounded-xl bg-orange-50 p-3"><p className="text-xs font-black uppercase text-orange-700">Custo estimado</p><p className="mt-1 text-2xl font-black text-orange-900">{formatCurrency(Number(stockAdjustmentHistory?.total_estimated_cost || 0))}</p></div>
                  {Object.entries(stockAdjustmentHistory?.summary || {}).sort(([, a], [, b]) => b.quantity - a.quantity).slice(0, 2).map(([reason, data]) => <div key={reason} className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-black uppercase text-gray-600">{STOCK_REASON_LABELS[reason] || reason}</p><p className="mt-1 text-2xl font-black text-gray-950">{data.quantity} un.</p><p className="text-xs font-bold text-gray-600">{formatCurrency(Number(data.estimated_cost || 0))}</p></div>)}
                </div>
                <div className="mt-4 space-y-2">
                  {!stockHistoryLoading && (stockAdjustmentHistory?.items || []).length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-700">Nenhuma perda ou baixa registrada.</p>}
                  {(stockAdjustmentHistory?.items || []).map(item => (
                    <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-gray-950">{item.product_name}</p><span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-black text-red-800">{STOCK_REASON_LABELS[item.reason] || item.reason}</span></div><p className="mt-1 text-sm font-bold text-gray-700">{item.note}</p></div>
                        <div className="shrink-0 text-left sm:text-right"><p className="text-lg font-black text-red-800">-{item.quantity} un.</p><p className="text-xs font-bold text-gray-600">Impacto: {formatCurrency(Number(item.estimated_cost || 0))}</p></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs font-bold text-gray-600"><span>{item.location === 'physical' ? 'Estoque central' : 'Estoque da praia'}</span><span>Saldo: {item.previous_quantity} → {item.next_quantity}</span><span>{item.user_name}</span><span>{new Date(item.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span></div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}


          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Cardápio do cliente</h3>
                    <p className="text-gray-500 text-sm">{products.length} itens cadastrados · {products.filter(p => p.active).length} ativos</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => setShowUpsellSettings(true)} className="rounded-xl border border-blue-500 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-100">Sugestões de venda</button>
                    <button type="button" onClick={() => setShowPromotionSettings(true)} className="rounded-xl border border-green-600 bg-green-50 px-4 py-2 text-sm font-black text-green-700 hover:bg-green-100">Promoções prontas</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setProductDraft(null);
                        setProductModalMode("stock");
                        setShowProductModal(true);
                      }}
                      className="rounded-xl bg-[#FF6B00] px-4 py-2 text-sm font-black text-white hover:bg-[#e56000]"
                    >
                      Criar produto
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setProductDraft({
                          id: "",
                          name: "",
                          category: rootProductCategories.find(category => category.name.toLowerCase().includes("combo"))?.name || rootProductCategories[0]?.name || "",
                          subcategory: "Promoções",
                          price: 0,
                          promotional_price: null,
                          description: "",
                          image_url: "",
                          active: true,
                          is_combo: true,
                          menu_highlight: true,
                          option_group_name: "",
                          option_values: [],
                          stock_tracking_enabled: false,
                          stock_quantity: null,
                          physical_stock_quantity: 0,
                          beach_stock_quantity: 0,
                          blocked_by_stock: false,
                          sort_order: -10,
                        });
                        setProductModalMode("stock");
                        setShowProductModal(true);
                      }}
                      className="rounded-xl border border-[#FF6B00] bg-white px-4 py-2 text-sm font-black text-[#d45700] hover:bg-orange-50"
                    >
                      Montar combo / promoção
                    </button>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-xs font-black uppercase text-[#8a3e22]">Categoria do menu superior</label>
                      <input
                        value={categoryForm.name}
                        onChange={(event) => setCategoryForm(prev => ({ ...prev, name: event.target.value, parent_id: "" }))}
                        className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#ff6b00]"
                        placeholder="Ex: Bebidas, Petiscos, Porções"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveProductCategory}
                      className="rounded-xl bg-[#ff6b00] px-5 py-3 text-sm font-black text-white hover:bg-[#e56000]"
                    >
                      Criar
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-[#5a2d1d]">
                    Use esta área apenas para criar ou excluir o menu superior, como Bebidas, Petiscos e Porções. As subcategorias são escolhidas dentro da janela Criar produto.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {rootProductCategories.map(category => {
                      const children = productCategories.filter(item => item.parent_id === category.id && item.active !== false);
                      return (
                        <div key={category.id} className="rounded-xl border border-orange-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#3d1a0a]">{category.name}</p>
                              <p className="text-xs font-bold text-[#8a3e22]">{children.length} subcategorias</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteProductCategory(category)}
                              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-50"
                              title="Excluir categoria do menu superior"
                            >
                              Excluir
                            </button>
                          </div>
                          {children.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {children.map(child => (
                                <span key={child.id} className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-[#8a3e22]">
                                  {child.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {rootProductCategories.length === 0 && (
                      <p className="rounded-xl border border-orange-200 bg-white p-3 text-sm font-bold text-[#8a3e22]">
                        Nenhuma categoria cadastrada. Crie uma categoria para ela aparecer no menu superior e no cadastro de produto.
                      </p>
                    )}
                  </div>
                  {categoryMessage && <p className="mt-2 text-sm font-black text-[#8a3e22]">{categoryMessage}</p>}
                </div>

                {/* Category filter */}
                <div className="flex gap-2 overflow-x-auto mb-6 hide-scrollbar">
                  {["Todos", ...menuCategories].map(c => (
                    <button
                      key={c}
                      onClick={() => setProductFilter(c)}
                      className={cn(
                        "px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all border",
                        productFilter === c ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Products table */}
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="p-3 rounded-tl-lg">Produto</th>
                        <th className="p-3">Preço</th>
                        <th className="p-3">Promoção/Combo</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 rounded-tr-lg">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(p => (
                        <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 shrink-0 overflow-hidden">
                                {p.image_url ? (
                                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Utensils size={16} />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{p.name}</p>
                                <p className="text-xs text-gray-400 truncate max-w-[240px]">
                                  {p.is_combo ? "Combo" : p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}
                                </p>
                                {Array.isArray(p.option_values) && p.option_values.length > 0 && (
                                  <p className="text-[11px] font-bold text-orange-700 truncate max-w-[240px]">
                                    {p.option_group_name || "Opções"}: {p.option_values.map(value => value.replace('::', ': ')).join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-gray-900">{formatCurrency(p.price)}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-black", p.promotional_price ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500")}>
                                {p.promotional_price ? formatCurrency(p.promotional_price) : "Sem promoção"}
                              </span>
                              {p.is_combo && (
                                <span className="w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">Combo</span>
                              )}
                              {p.menu_highlight && (
                                <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Destaque no topo</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => toggleProduct(p.id)}
                              className={cn("flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-colors", p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}
                            >
                              {p.active ? <><Eye size={12} /> Ativo</> : <><EyeOff size={12} /> Inativo</>}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductDraft(null);
                                  setProductModalMode("menu");
                                  setShowProductModal(true);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                                title="Alterar preço, promoção e combo"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => deleteProduct(p.id)}
                                className="p-2 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition-colors"
                                title="Excluir item do cardápio"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========== ABA 3: GUARDA-SÓIS / QR CODES ========== */}
          {activeTab === "qr" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Guarda-Sóis</h3>
                    <p className="text-gray-500 text-sm">{umbrellas.length} cadastrados · {umbrellas.filter(u => u.active).length} ativos</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vendorId && umbrellas.length > 0 && (
                      <a
                        href={`/vendor/qr-print?vendor_id=${encodeURIComponent(vendorId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="border-2 border-[#FF6B00] bg-white text-[#C75200] px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 hover:bg-orange-50 active:scale-95 transition-all"
                      >
                        <Download size={19} /> Imprimir todos os QRs
                      </a>
                    )}
                    <button
                      onClick={() => setShowAddUmbrella(true)}
                      className="bg-[#FF6B00] text-white px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 hover:bg-[#E56000] active:scale-95 transition-all"
                    >
                      <Plus size={20} /> Adicionar Barraca
                    </button>
                  </div>
                </div>

                {/* Add umbrella inline form */}
                {showAddUmbrella && (
                  <div className="bg-[#F5E1C0]/30 border border-[#F5E1C0] rounded-xl p-4 mb-6 flex items-center gap-4">
                    <input
                      type="number"
                      placeholder="Número da barraca"
                      value={newUmbrellaNumber}
                      onChange={e => setNewUmbrellaNumber(e.target.value)}
                      className="border-2 border-gray-200 rounded-lg px-4 py-2 w-48 focus:border-[#FF6B00] outline-none"
                    />
                    <button onClick={addUmbrella} className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#E56000]">Adicionar</button>
                    <button onClick={() => setShowAddUmbrella(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  </div>
                )}

                {/* Umbrellas grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {umbrellas.map(u => (
                    <div key={u.id} className={cn("border rounded-2xl p-5 transition-all", u.active ? "bg-white border-gray-100 shadow-sm" : "bg-gray-50 border-gray-200 opacity-60")}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-xl text-gray-900">#{u.number}</h4>
                          <p className="text-sm text-gray-500">{u.label}</p>
                        </div>
                        <button
                          onClick={() => toggleUmbrella(u.id)}
                          className={cn("text-xs font-bold px-3 py-1 rounded-full", u.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}
                        >
                          {u.active ? "Ativo" : "Inativo"}
                        </button>
                      </div>

                      {u.qr_image_url ? (
                        <div className="flex flex-col items-center gap-3">
                          <img src={u.qr_image_url} alt={`QR Barraca ${u.number}`} className="w-40 h-40 rounded-lg border border-gray-100" />
                          <p className="text-xs text-gray-400 text-center break-all">{u.qr_url}</p>
                          <a
                            href={u.qr_image_url}
                            download={`qr-guarda-sol-${u.number}-sandexpress.svg`}
                            className="flex items-center gap-1 text-sm font-bold text-[#FF6B00] hover:underline"
                          >
                            <Download size={14} /> Baixar QR com logo
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => generateQR(u)}
                          disabled={!u.active}
                          className="w-full bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-[#FF6B00] hover:text-white hover:border-[#FF6B00] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <QrCode size={18} /> Gerar QR Code
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteUmbrella(u)}
                        disabled={Boolean(u.is_occupied || u.current_order_id)}
                        className="mt-4 w-full border border-red-200 bg-red-50 text-red-700 font-bold py-2 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} /> Excluir guarda-sol
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========== ABA: PERSONALIZACAO ========== */}
          {activeTab === "theme" && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <form onSubmit={saveTheme} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-black text-gray-900">Identidade do quiosque</h3>
                  <p className="text-sm font-semibold text-gray-500">Cores e logo gravadas no tenant deste quiosque.</p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-black text-gray-700">Cor principal</span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <input
                        type="color"
                        value={themeForm.primary_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, primary_color: event.target.value }))}
                        className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        value={themeForm.primary_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, primary_color: event.target.value }))}
                        className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold uppercase outline-none"
                      />
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-black text-gray-700">Cor secundaria</span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <input
                        type="color"
                        value={themeForm.secondary_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, secondary_color: event.target.value }))}
                        className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        value={themeForm.secondary_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, secondary_color: event.target.value }))}
                        className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold uppercase outline-none"
                      />
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-black text-gray-700">Cor do botão</span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <input
                        type="color"
                        value={themeForm.button_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, button_color: event.target.value }))}
                        className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        value={themeForm.button_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, button_color: event.target.value }))}
                        className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold uppercase outline-none"
                      />
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-black text-gray-700">Texto do botão</span>
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <input
                        type="color"
                        value={themeForm.button_text_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, button_text_color: event.target.value }))}
                        className="h-11 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        value={themeForm.button_text_color}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, button_text_color: event.target.value }))}
                        className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold uppercase outline-none"
                      />
                    </div>
                  </label>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-sm font-black text-gray-700">Paleta SandExpress</p>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_PALETTE.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        title={color.name}
                        onClick={() => setThemeForm(prev => ({ ...prev, primary_color: color.value, button_color: color.value }))}
                        className="h-10 w-10 rounded-lg border border-gray-200 shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-dashed border-[#85736C] bg-[#fff8f6] p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#85736C] bg-white shadow-sm">
                      {themeForm.logo_url ? (
                        <img src={themeForm.logo_url} alt="Logo do quiosque" className="h-full w-full object-contain p-3" />
                      ) : (
                        <Upload className="text-[#3D1A0A]" size={30} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="text-sm font-black text-gray-700">Logo do quiosque</span>
                      <p className="rounded-xl border border-[#EFD5CA] bg-white px-4 py-3 text-sm font-bold leading-5 text-[#3D1A0A]">
                        A logo e definida pelo admin geral. Neste painel o quiosque pode ajustar apenas as cores da experiencia do cliente.
                      </p>
                    </div>
                  </div>
                </div>

                {themeMessage && (
                  <p className="mt-5 rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#3D1A0A]">{themeMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={themeSaving}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
                  style={{ backgroundColor: themeForm.button_color, color: themeForm.button_text_color }}
                >
                  <Palette size={18} /> {themeSaving ? "Salvando..." : "Salvar personalização"}
                </button>
              </form>

              <aside className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="p-6 text-white" style={{ backgroundColor: themeForm.primary_color }}>
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/95 shadow-md">
                    {themeForm.logo_url ? (
                      <img src={themeForm.logo_url} alt="Logo do quiosque" className="h-full w-full object-contain p-2" />
                    ) : (
                      <Utensils className="text-gray-800" size={34} />
                    )}
                  </div>
                  <h4 className="mt-5 text-2xl font-black">Preview cliente</h4>
                  <p className="text-sm font-semibold text-white/80">Login, cardápio e botões do QR.</p>
                </div>
                <div className="space-y-4 bg-[#fff8f6] p-6">
                  <div className="rounded-xl border border-[#85736C] bg-white p-4">
                    <p className="text-xs font-black uppercase" style={{ color: themeForm.secondary_color }}>Total da conta</p>
                    <p className="text-3xl font-black" style={{ color: themeForm.primary_color }}>{formatCurrency(0)}</p>
                  </div>
                  <button className="w-full rounded-xl py-3 text-sm font-black" style={{ backgroundColor: themeForm.button_color, color: themeForm.button_text_color }}>
                    Abrir comanda
                  </button>
                  <button className="w-full rounded-xl py-3 text-sm font-black" style={{ backgroundColor: themeForm.secondary_color, color: themeForm.button_text_color }}>
                    Fechar conta
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* ========== ABA: PAGAMENTOS ========== */}
          {activeTab === "payments" && (
            <form onSubmit={saveTheme} className="space-y-6">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Formas de pagamento</h3>
                    <p className="text-sm font-semibold text-gray-500">
                      Cadastre meios aceitos, taxas e prazo de recebimento deste quiosque.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={themeSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#E56000] disabled:opacity-60"
                  >
                    <CreditCard size={18} /> {themeSaving ? "Salvando..." : "Salvar pagamentos"}
                  </button>
                </div>
                {themeMessage && (
                  <p className="mt-4 rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#3D1A0A]">{themeMessage}</p>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {PAYMENT_SETTINGS.map(({ id, label, Icon, feeField, typeField, fixedField, daysField, activeField }) => {
                  const feeType = (themeForm[typeField as keyof KioskTheme] === "fixed" ? "fixed" : "percent") as PaymentFeeType;
                  const active = themeForm[activeField as keyof KioskTheme] !== false;
                  return (
                    <section key={id} className={cn("rounded-2xl border bg-white p-5 shadow-sm", active ? "border-gray-100" : "border-gray-200 opacity-75")}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF2E5] text-[#FF6B00]">
                            <Icon size={22} />
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900">{label}</h4>
                            <p className="text-xs font-bold text-gray-400">{active ? "Disponivel no fechamento" : "Oculto no fechamento"}</p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-black text-gray-600">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(event) => setThemeForm(prev => ({ ...prev, [activeField]: event.target.checked }))}
                            className="h-4 w-4 accent-[#FF6B00]"
                          />
                          Ativo
                        </label>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr_1fr]">
                        <div>
                          <p className="mb-2 text-xs font-black uppercase text-gray-500">Tipo da taxa</p>
                          <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                            {[
                              ["percent", "%"],
                              ["fixed", "R$"],
                            ].map(([value, text]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setThemeForm(prev => ({ ...prev, [typeField]: value as PaymentFeeType }))}
                                className={cn("rounded-lg px-3 py-2 text-sm font-black", feeType === value ? "bg-white text-[#FF6B00] shadow-sm" : "text-gray-500")}
                              >
                                {text}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="space-y-2">
                          <span className="text-xs font-black uppercase text-gray-500">{feeType === "fixed" ? "Valor fixo" : "Percentual"}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={Number(themeForm[(feeType === "fixed" ? fixedField : feeField) as keyof KioskTheme] || 0)}
                            onChange={(event) => setThemeForm(prev => ({ ...prev, [feeType === "fixed" ? fixedField : feeField]: Number(event.target.value) || 0 }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#ff6b00]"
                            aria-label={`${label} ${feeType === "fixed" ? "valor fixo" : "percentual"}`}
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-black uppercase text-gray-500">Dias para cair</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={Number(themeForm[daysField as keyof KioskTheme] || 0)}
                            onChange={(event) => setThemeForm(prev => ({ ...prev, [daysField]: Math.max(0, Math.floor(Number(event.target.value) || 0)) }))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#ff6b00]"
                            aria-label={`${label} dias para recebimento`}
                          />
                        </label>
                      </div>

                    </section>
                  );
                })}
              </div>
            </form>
          )}

          {activeTab === "reports" && (
            <div className="vendor-sales-surface space-y-6 rounded-2xl border border-[#e5c2ae] bg-[#fff3ec] p-3 text-[#2d1b14] sm:p-5">
              <div className="bg-white border border-[#e5c2ae] shadow-sm rounded-2xl p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#F7E5D8] text-[#6B3321] flex items-center justify-center shrink-0">
                    <CalendarCheck size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-lg">Fechamento do Dia</h3>
                    <p className="text-sm text-gray-500 max-w-2xl">
                      Relatório simples para ver o que vendeu, quanto entrou, o que está acabando e onde precisa agir.
                      O PDF sai em preto e cinza para facilitar impressão e leitura.
                    </p>
                    {closingMessage && (
                      <p className={cn(
                        "mt-3 rounded-lg px-3 py-2 text-sm font-bold",
                        closingMessage.startsWith("Erro") ? "bg-red-50 text-red-700" : "bg-[#F7E5D8] text-[#5A2D1D]"
                      )}>
                        {closingMessage}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-black text-gray-500">
                      {cashControl?.status === "open"
                        ? `Caixa aberto · Fundo inicial ${formatCurrency(cashControl.opening_cash)}`
                        : cashControl?.status === "closed"
                          ? `Caixa fechado · Diferença ${formatCurrency(Number(cashControl.difference || 0))}`
                          : "Caixa ainda não aberto hoje"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex-none">
                  <button
                    onClick={exportTodaySalesPdf}
                    className="min-h-11 rounded-xl border-2 border-[#8A3E22] bg-white px-3 py-2 text-sm font-black text-[#5A2D1D] flex items-center justify-center gap-2 hover:bg-[#FFF2E5] sm:w-44"
                  >
                    <Download size={18} />
                    Exportar vendas
                  </button>
                  <button
                    onClick={() => setShowCashModal(true)}
                    disabled={closingDay || cashControl?.status === "closed"}
                    className="min-h-11 rounded-xl bg-[#2F4858] px-3 py-2 text-sm font-black text-white flex items-center justify-center gap-2 hover:bg-[#243845] disabled:opacity-50 sm:w-44"
                  >
                    <CalendarCheck size={18} />
                    {closingDay ? "Processando..." : cashControl?.status === "open" ? "Fechar caixa" : cashControl?.status === "closed" ? "Caixa fechado" : "Abrir caixa"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase text-[#FF6B00]">Previsão de movimento</p>
                  <div className="mt-2 flex items-end justify-between gap-4"><div><h3 className="text-xl font-black text-gray-900 capitalize">{managementIntelligence?.forecast.day || "Amanhã"}</h3><p className="text-sm font-bold text-gray-500">{managementIntelligence?.forecast.expected_orders || 0} pedidos · {formatCurrency(Number(managementIntelligence?.forecast.expected_revenue || 0))}</p></div><p className="text-4xl font-black text-[#FF6B00]">{managementIntelligence?.forecast.movement_percent || 0}%</p></div>
                  {managementIntelligence?.forecast.weather?.available && <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-blue-50 p-2 text-center"><p className="text-xs font-bold text-gray-500">Clima</p><p className="text-sm font-black text-blue-700">{managementIntelligence.forecast.weather.condition}</p></div><div className="rounded-xl bg-orange-50 p-2 text-center"><p className="text-xs font-bold text-gray-500">Máxima</p><p className="text-sm font-black text-orange-700">{managementIntelligence.forecast.weather.temperature_max}°C</p></div><div className="rounded-xl bg-slate-50 p-2 text-center"><p className="text-xs font-bold text-gray-500">Chuva</p><p className="text-sm font-black text-slate-700">{managementIntelligence.forecast.weather.precipitation_probability}%</p></div></div>}
                  <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-black text-gray-700">{managementIntelligence?.forecast.suggestion || "A previsão aparecerá quando houver histórico suficiente."}</p>
                  <p className="mt-2 text-xs font-bold text-gray-400">Baseado em {managementIntelligence?.forecast.sample_days || 0} dias equivalentes, ajustado pela previsão da Open-Meteo. {managementIntelligence?.forecast.weather?.location || managementIntelligence?.forecast.weather?.error}</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase text-blue-600">Assistente gerencial</p><h3 className="mt-1 text-xl font-black text-gray-900">Pergunte em um toque</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{["Quanto vendi hoje?", "Qual garçom vendeu mais?", "Qual produto está acabando?", "Qual é meu lucro da semana?", "O que devo comprar amanhã?", "Qual foi o melhor horário hoje?", "Como está minha meta?", "Quais produtos estão parados?"].map(question => <button key={question} disabled={assistantLoading} onClick={() => { setAssistantQuestion(question); askManagementAssistant(question); }} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50">{question}</button>)}</div>
                  <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); const question = assistantQuestion.trim(); if (question) askManagementAssistant(question); }}>
                    <input value={assistantQuestion} onChange={event => setAssistantQuestion(event.target.value)} maxLength={160} aria-label="Pergunta para o assistente" placeholder="Digite sua pergunta..." className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-500" />
                    <button type="submit" disabled={assistantLoading || !assistantQuestion.trim()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">Perguntar</button>
                  </form>
                  <p className="mt-3 min-h-16 rounded-xl bg-gray-50 p-3 text-sm font-black leading-6 text-gray-700" aria-live="polite">{assistantLoading ? "Consultando seus dados..." : assistantAnswer || "Escolha uma pergunta ou escreva do seu jeito."}</p>
                </div>
              </div>

              {/* Period filter */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "week", label: "Semana" },
                  { id: "month", label: "Mês" },
                  { id: "quarter", label: "Trimestre" },
                  { id: "semester", label: "Semestre" },
                  { id: "year", label: "Ano" },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setReportPeriod(p.id)}
                    className={cn(
                      "px-5 py-2 rounded-full font-bold text-sm border transition-all",
                      reportPeriod === p.id ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {reportData && !reportLoading ? (
                <>
                  {/* Daily summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Itens disponíveis</p>
                      <p className="sales-value-gradient text-2xl font-display font-bold">{reportData.daily_summary.available_products}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Guarda-sóis ativos</p>
                      <p className="sales-value-gradient text-2xl font-display font-bold">{reportData.daily_summary.active_umbrellas}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Pedidos hoje</p>
                      <p className="sales-value-gradient text-2xl font-display font-bold">{reportData.daily_summary.today_orders}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Receita hoje</p>
                      <p className="sales-value-gradient text-2xl font-display font-bold">{formatCurrency(reportData.daily_summary.today_revenue)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Clientes novos hoje</p>
                      <p className="sales-value-gradient text-2xl font-display font-bold">{reportData.daily_summary.new_customers_today}</p>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Faturamento</p>
                      <p className="sales-value-gradient text-3xl font-display font-bold">{formatCurrency(reportData.kpis.total_revenue)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Pedidos</p>
                      <p className="sales-value-gradient text-3xl font-display font-bold">{reportData.kpis.total_orders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Ticket Médio</p>
                      <p className="sales-value-gradient text-3xl font-display font-bold">{formatCurrency(reportData.kpis.avg_ticket)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Clientes Únicos</p>
                      <p className="sales-value-gradient text-3xl font-display font-bold">{reportData.kpis.unique_customers}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Taxa de Serviço</p>
                      <p className="text-3xl font-display font-bold text-green-700">{formatCurrency(Number(reportData.kpis.total_service_fees || 0))}</p>
                      <p className="text-xs font-bold text-gray-500">Separada das vendas</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Satisfação</p>
                      <p className="text-3xl font-display font-bold text-amber-500 flex items-center gap-2">
                        <Star size={24} fill="currentColor" />
                        {reportData.satisfaction?.average_rating || 0}
                      </p>
                      <p className="text-xs text-gray-400 font-bold">{reportData.satisfaction?.total_responses || 0} respostas</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-[#e5c2ae] bg-[#fffaf6] p-5 shadow-sm">
                      <h4 className="mb-2 flex items-center gap-2 text-base font-black text-[#2d1b14]">
                        <PackageCheck size={18} className="text-[#a44100]" />
                        Como ler rapido
                      </h4>
                      <p className="text-sm font-bold leading-6 text-[#5a2d1d]">
                        Primeiro veja faturamento e pedidos. Depois confira estoque baixo. Por último, olhe produtos e categorias
                        para saber o que comprar mais e o que vende melhor.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#e5c2ae] bg-white p-5 shadow-sm">
                      <h4 className="mb-3 flex items-center gap-2 text-base font-black text-[#2d1b14]">
                        <PackageCheck size={18} className="text-[#a44100]" />
                        Estoque quase acabando
                      </h4>
                      <div className="space-y-2">
                        {(reportData.low_stock_alerts || []).length === 0 ? (
                          <p className="rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#5a2d1d]">Nenhum produto com alerta agora.</p>
                        ) : (reportData.low_stock_alerts || []).slice(0, 4).map((item) => (
                          <div key={`${item.name}-${item.category}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5c2ae] bg-[#fffaf6] px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#2d1b14]">{item.name}</p>
                              <p className="text-xs font-bold text-[#5a2d1d]">{item.category}</p>
                            </div>
                            <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-black", item.blocked || item.quantity <= 0 ? "bg-[#8f1d1d] text-white" : "bg-[#fff1e8] text-[#8a3e22]")}>
                              {item.quantity} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#e5c2ae] bg-white p-5 shadow-sm">
                      <h4 className="mb-3 flex items-center gap-2 text-base font-black text-[#2d1b14]">
                        <Award size={18} className="text-[#a44100]" />
                        Drinks e porções
                      </h4>
                      <p className="mb-3 text-sm font-bold leading-6 text-[#5a2d1d]">
                        Aqui aparece o faturamento por categoria. Margem real entra quando o custo dos insumos for cadastrado.
                      </p>
                      <div className="space-y-2">
                        {(reportData.category_performance || []).length === 0 ? (
                          <p className="rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#5a2d1d]">Sem vendas pagas no período.</p>
                        ) : (reportData.category_performance || []).slice(0, 4).map((item) => (
                          <div key={item.category} className="rounded-xl bg-[#fff1e8] px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-sm font-black text-[#2d1b14]">{item.category}</span>
                              <span className="text-sm font-black text-[#a44100]">{formatCurrency(item.revenue)}</span>
                            </div>
                            <p className="text-xs font-bold text-[#5a2d1d]">{item.quantity} itens vendidos</p>
                            {item.cost_configured ? <p className="mt-1 text-xs font-black text-green-800">Lucro {formatCurrency(Number(item.profit || 0))} · margem {Number(item.margin_percent || 0)}%</p> : <p className="mt-1 text-xs font-black text-amber-800">Cadastre todos os custos para ver o lucro</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                      <h4 className="mb-4 flex items-center gap-2 font-black text-gray-950"><TrendingUp size={18} className="text-[#FF6B00]" /> Maior faturamento por produto</h4>
                      <div className="space-y-2">
                        {(reportData.product_insights?.highest_revenue_products || []).length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-600">Sem vendas pagas no periodo.</p> : (reportData.product_insights?.highest_revenue_products || []).map((product, index) => <div key={product.name} className="flex items-center justify-between gap-3 rounded-xl bg-orange-50 p-3"><div className="min-w-0"><p className="truncate font-black text-gray-950">{index + 1}. {product.name}</p><p className="text-xs font-bold text-gray-700">{product.quantity} vendidos</p></div><span className="shrink-0 font-black text-[#9A3E00]">{formatCurrency(product.revenue)}</span></div>)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
                      <h4 className="mb-4 flex items-center gap-2 font-black text-gray-950"><Award size={18} className="text-green-700" /> Maior lucro por produto</h4>
                      <div className="space-y-2">
                        {(reportData.product_insights?.highest_profit_products || []).length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Cadastre o custo dos produtos vendidos para calcular o lucro.</p> : (reportData.product_insights?.highest_profit_products || []).map((product, index) => <div key={product.name} className="rounded-xl bg-green-50 p-3"><div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate font-black text-gray-950">{index + 1}. {product.name}</p><span className="shrink-0 font-black text-green-800">{formatCurrency(product.profit)}</span></div><p className="mt-1 text-xs font-black text-green-900">Margem {product.margin_percent}% · faturamento {formatCurrency(product.revenue)}</p></div>)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                      <h4 className="mb-4 flex items-center gap-2 font-black text-gray-900"><Users size={18} className="text-[#FF6B00]" /> Faturamento e comissão por garçom</h4>
                      <div className="space-y-3">
                        {(reportData.staff_performance || []).length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Nenhuma venda lançada por usuário da equipe neste período.</p> : (reportData.staff_performance || []).map(staff => (
                          <div key={staff.user_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-gray-900">{staff.name}</p><p className="text-xs font-bold text-gray-500">{staff.orders} pedidos</p></div><p className="font-black text-[#FF6B00]">{formatCurrency(staff.revenue)}</p></div><div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm"><span className="font-bold text-gray-500">Comissão a pagar</span><span className="font-black text-green-700">{formatCurrency(staff.commission_due)}</span></div></div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                      <h4 className="mb-4 flex items-center gap-2 font-black text-gray-900"><TrendingUp size={18} className="text-[#FF6B00]" /> Produtos parados e menor saída</h4>
                      <div className="space-y-2">
                        {(reportData.product_insights?.stagnant_products || []).slice(0, 5).map(product => <div key={`${product.name}-${product.category}`} className="flex justify-between rounded-xl bg-red-50 p-3"><span className="font-black text-gray-900">{product.name}</span><span className="text-xs font-bold text-red-700">Sem vendas</span></div>)}
                        {(reportData.product_insights?.least_sold || []).slice(0, 5).map(product => <div key={product.name} className="flex justify-between rounded-xl bg-gray-50 p-3"><span className="font-black text-gray-900">{product.name}</span><span className="text-sm font-black text-gray-600">{product.quantity} vendidos</span></div>)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                    <h4 className="mb-4 flex items-center gap-2 font-black text-gray-900"><Clock size={18} className="text-blue-600" /> Desempenho dos chamados</h4>
                    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-black text-blue-700">ATENDIMENTOS</p><p className="text-2xl font-black text-blue-950">{reportData.waiter_service?.total_calls || 0}</p></div><div className="rounded-xl bg-orange-50 p-4"><p className="text-xs font-black text-orange-700">TEMPO PARA ASSUMIR</p><p className="text-2xl font-black text-orange-950">{formatServiceTime(reportData.waiter_service?.avg_response_seconds || 0)}</p></div><div className="rounded-xl bg-green-50 p-4"><p className="text-xs font-black text-green-700">DURAÇÃO MÉDIA</p><p className="text-2xl font-black text-green-950">{formatServiceTime(reportData.waiter_service?.avg_service_seconds || 0)}</p></div></div>
                    {(reportData.waiter_service?.by_waiter || []).length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{reportData.waiter_service!.by_waiter.map(waiter => <div key={waiter.user_id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3"><div><p className="font-black text-gray-900">{waiter.name}</p><p className="text-xs font-bold text-gray-500">{waiter.calls} chamados · resposta {formatServiceTime(waiter.avg_response_seconds)}</p></div><span className="text-sm font-black text-green-700">{formatServiceTime(waiter.avg_service_seconds)}</span></div>)}</div>}
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
                    <h4 className="mb-4 flex items-center gap-2 font-black text-gray-900"><Utensils size={18} className="text-[#FF6B00]" /> Tempo de preparo e atendimento</h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-orange-50 p-4"><p className="text-xs font-black text-orange-700">PREPARO MÉDIO</p><p className="text-2xl font-black text-orange-950">{formatServiceTime(reportData.operational_times?.avg_preparation_seconds || 0)}</p></div><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-black text-blue-700">ATENDIMENTO TOTAL</p><p className="text-2xl font-black text-blue-950">{formatServiceTime(reportData.operational_times?.avg_service_seconds || 0)}</p></div><div className="rounded-xl bg-green-50 p-4"><p className="text-xs font-black text-green-700">MAIS RÁPIDO</p><p className="text-2xl font-black text-green-950">{formatServiceTime(reportData.operational_times?.fastest_preparation_seconds || 0)}</p></div><div className={`rounded-xl p-4 ${(reportData.operational_times?.delayed_requests || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><p className={`text-xs font-black ${(reportData.operational_times?.delayed_requests || 0) > 0 ? 'text-red-700' : 'text-gray-600'}`}>ACIMA DE 20 MIN</p><p className="text-2xl font-black text-gray-950">{reportData.operational_times?.delayed_requests || 0}</p></div></div>
                    {(reportData.operational_times?.completed_requests || 0) === 0 && <p className="mt-3 text-sm font-bold text-gray-500">A medição começa automaticamente nas próximas movimentações do Kanban.</p>}
                  </div>

                  <div className="grid gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#FF6B00]" /> Meios de recebimento</h4>
                      <div className="space-y-3">
                        {Object.entries(reportData.payment_methods || {}).length === 0 ? (
                          <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-400">Nenhuma conta paga no período.</p>
                        ) : Object.entries(reportData.payment_methods || {}).map(([method, data]) => (
                          <div key={method} className="rounded-xl border border-gray-100 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-black text-gray-900">{PAYMENT_METHOD_LABELS[method] || method}</p>
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-500">{data.count} conta{data.count === 1 ? "" : "s"}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-xs font-bold text-gray-400">Bruto</p>
                                <p className="font-black text-gray-900">{formatCurrency(data.gross)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-400">Taxas</p>
                                <p className="font-black text-red-600">{formatCurrency(data.fees)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-400">Liquido</p>
                                <p className="font-black text-green-700">{formatCurrency(data.net)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Star size={18} className="text-[#FF6B00]" fill="currentColor" /> Pesquisa de Satisfação</h4>
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = reportData.satisfaction?.distribution?.[rating as 1 | 2 | 3 | 4 | 5] || 0;
                        const total = reportData.satisfaction?.total_responses || 0;
                        const width = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <span className="w-14 text-sm font-bold text-gray-500">{rating} estrela{rating > 1 ? "s" : ""}</span>
                            <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-[#FF6B00]" style={{ width: `${width}%` }} />
                            </div>
                            <span className="w-8 text-right text-sm font-bold text-gray-700">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Hourly Sales Chart (CSS bars) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-[#FF6B00]" /> Vendas por Horário</h4>
                      <div className="mb-4 inline-grid grid-cols-2 rounded-xl border border-[#e5c2ae] bg-[#fff8f3] p-1 text-xs font-black">
                        <button type="button" onClick={() => setSalesChartType("bars")} className={cn("rounded-lg px-3 py-2", salesChartType === "bars" ? "bg-[#2F4858] text-white" : "text-[#5A2D1D]")}>Barras</button>
                        <button type="button" onClick={() => setSalesChartType("pie")} className={cn("rounded-lg px-3 py-2", salesChartType === "pie" ? "bg-[#2F4858] text-white" : "text-[#5A2D1D]")}>Pizza</button>
                      </div>
                      {salesChartType === "bars" ? (
                      <div className="flex items-end gap-2 h-40">
                        {reportData.hourly_sales.map((h, i) => {
                          const maxRevenue = Math.max(...reportData.hourly_sales.map(s => s.revenue));
                          const height = maxRevenue > 0 ? (h.revenue / maxRevenue) * 100 : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="whitespace-nowrap text-[9px] font-bold text-[#5A2D1D]" title={`${formatCurrency(h.revenue)} · ${h.orders} pedido(s) · ticket ${formatCurrency(h.avg_ticket)}`}>{h.revenue >= 1000 ? `R$${(h.revenue / 1000).toFixed(1)}k` : `R$${Math.round(h.revenue)}`}</span>
                              <div
                                className="w-full rounded-t-md bg-gradient-to-t from-[#8A3E22] to-[#FF6B00] transition-all"
                                style={{ height: `${height}%`, minHeight: 4 }}
                              />
                              <span className="text-[10px] font-bold text-[#6B3A28]">{h.hour}</span>
                            </div>
                          );
                        })}
                      </div>
                      ) : (
                        (() => {
                          const slices = reportData.hourly_sales.filter((h) => h.revenue > 0);
                          const total = slices.reduce((sum, h) => sum + h.revenue, 0);
                          let cursor = 0;
                          const gradient = total > 0
                            ? slices.map((h, i) => {
                                const start = cursor;
                                const end = cursor + (h.revenue / total) * 100;
                                cursor = end;
                                return `${SALES_CHART_COLORS[i % SALES_CHART_COLORS.length]} ${start}% ${end}%`;
                              }).join(", ")
                            : "#E5C2AE 0% 100%";
                          return (
                            <div className="grid gap-5 sm:grid-cols-[12rem_1fr] sm:items-center">
                              <div
                                className="mx-auto h-44 w-44 rounded-full border-[10px] border-[#fff8f3] shadow-inner"
                                style={{ background: `conic-gradient(${gradient})` }}
                                aria-label="Grafico de pizza de vendas por horário"
                              />
                              <div className="grid gap-2 text-sm">
                                {slices.length === 0 ? (
                                  <p className="rounded-xl bg-[#fff8f3] p-4 font-bold text-[#6B3A28]">Sem vendas no período.</p>
                                ) : slices.map((h, i) => (
                                  <div key={h.hour} className="flex items-center justify-between gap-3 rounded-xl bg-[#fff8f3] px-3 py-2">
                                    <span className="flex items-center gap-2 font-black text-[#2d1b14]">
                                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SALES_CHART_COLORS[i % SALES_CHART_COLORS.length] }} />
                                      {h.hour}
                                    </span>
                                    <span className="text-right font-black text-[#5A2D1D]">{formatCurrency(h.revenue)}<small className="block text-[10px] font-bold opacity-75">{h.orders} pedido{h.orders === 1 ? "" : "s"} · ticket {formatCurrency(h.avg_ticket)}</small></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Top Products */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Award size={18} className="text-[#FF6B00]" /> Produtos Mais Vendidos</h4>
                      <div className="space-y-3">
                        {reportData.top_products.map((p, i) => {
                          const maxQty = Math.max(...reportData.top_products.map(x => x.quantity));
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-400 w-5">{i + 1}.</span>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-sm text-gray-900">{p.name}</span>
                                  <span className="text-xs text-gray-400">{p.quantity} un · {formatCurrency(p.revenue)}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="bg-[#FF6B00] h-2 rounded-full transition-all" style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Top Customers */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Star size={18} className="text-[#FF6B00]" /> Melhores Clientes</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-[640px] w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                          <tr>
                            <th className="p-3 rounded-tl-lg">#</th>
                            <th className="p-3">Nome</th>
                            <th className="p-3">Telefone</th>
                            <th className="p-3">Visitas</th>
                            <th className="p-3 rounded-tr-lg">Total Gasto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.top_customers.map((c, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="p-3 font-bold text-[#FF6B00]">{i + 1}</td>
                              <td className="p-3 font-bold text-gray-900">{c.name}</td>
                              <td className="p-3 text-gray-500">{c.phone}</td>
                              <td className="p-3 text-gray-700">{c.visits}</td>
                              <td className="p-3 font-bold text-gray-900">{formatCurrency(c.total_spent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CalendarCheck size={18} className="text-[#FF6B00]" /> Recebiveis por data</h4>
                    <div className="space-y-3">
                      {Object.entries(reportData.receivables_by_date || {}).length === 0 ? (
                        <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-400">Nenhum recebível no período.</p>
                      ) : Object.entries(reportData.receivables_by_date || {}).map(([date, data]) => (
                        <div key={date} className="rounded-xl border border-gray-100 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black text-gray-900">{date === "sem_data" ? "Sem data" : new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR")}</p>
                            <span className="rounded-full bg-[#FFF2E5] px-3 py-1 text-xs font-black text-[#FF6B00]">{data.count} venda{data.count === 1 ? "" : "s"}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <p className="text-xs font-bold text-gray-400">Bruto</p>
                              <p className="font-black text-gray-900">{formatCurrency(data.gross)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400">Taxas</p>
                              <p className="font-black text-red-600">{formatCurrency(data.fees)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-400">Cai na conta</p>
                              <p className="font-black text-green-700">{formatCurrency(data.net)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* ========== ABA 5: CLIENTES ========== */}
          {activeTab === "customers" && (
            <div className="space-y-6">
              {/* Customer KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-gray-400 text-sm font-bold mb-1">Total de Clientes</p>
                  <p className="text-3xl font-display font-bold text-gray-900">{customers.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-gray-400 text-sm font-bold mb-1">Novos Hoje</p>
                  <p className="text-3xl font-display font-bold text-green-600">
                    {customers.filter(c => new Date(c.last_visit_at).toDateString() === new Date().toDateString() && c.visit_count === 1).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-gray-400 text-sm font-bold mb-1">Recorrentes</p>
                  <p className="text-3xl font-display font-bold text-[#FF6B00]">{customers.filter(c => c.visit_count > 1).length}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Lista de Clientes</h3>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar nome ou telefone..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#FF6B00] outline-none"
                    />
                  </div>
                </div>

                <table className="min-w-[640px] w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="p-3 rounded-tl-lg">Cliente</th>
                      <th className="p-3">Telefone</th>
                      <th className="p-3">Visitas</th>
                      <th className="p-3">Total Gasto</th>
                      <th className="p-3 rounded-tr-lg">Última Visita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(c => (
                      <tr
                        key={c.id}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <td className="p-3 font-bold text-gray-900">{c.name}</td>
                        <td className="p-3 text-gray-500 flex items-center gap-1"><Phone size={12} />{c.phone}</td>
                        <td className="p-3">
                          <span className={cn("text-sm font-bold px-2 py-0.5 rounded", c.visit_count > 5 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                            {c.visit_count}x
                          </span>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{formatCurrency(c.total_spent)}</td>
                        <td className="p-3 text-sm text-gray-400">{new Date(c.last_visit_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== ABA 6: EQUIPE ========== */}
          {activeTab === "team" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 lg:col-span-2">
                <p className="font-black">Acesso exclusivo do garcom</p>
                <p className="mt-1 text-sm font-bold leading-5 text-blue-800">Crie o usuario como Garcom / Vendedor. Depois que o administrador liberar o modulo, ele entra pelo botao “Acesso do garcom” e atende mesas e guarda-sois em /garcom.</p>
              </div>
              <form onSubmit={createTeamUser} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Criar usuário do quiosque</h3>
                  <p className="mt-1 text-sm text-gray-500">Use para vendedores, operadores ou gerentes acessarem o painel.</p>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Nome"
                  value={teamForm.name}
                  onChange={e => setTeamForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                />
                <input
                  type="email"
                  placeholder="Email opcional"
                  value={teamForm.email}
                  onChange={e => setTeamForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                />
                <input
                  type="text"
                  required
                  placeholder="Login do usuário"
                  value={teamForm.login}
                  onChange={e => setTeamForm(p => ({ ...p, login: e.target.value.trim() }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                />
                <select
                  value={teamForm.role}
                  onChange={e => setTeamForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                >
                  <option value="seller">Garçom / Vendedor</option>
                  <option value="manager">Gerente</option>
                  <option value="owner">Proprietario</option>
                </select>
                {teamForm.role === "seller" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm font-black text-gray-700">Comissão
                      <select value={teamForm.commission_type} onChange={e => setTeamForm(p => ({ ...p, commission_type: e.target.value }))} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]">
                        <option value="none">Sem comissão</option><option value="percent">Percentual das vendas</option><option value="fixed">Valor fixo por pedido</option>
                      </select>
                    </label>
                    <label className="text-sm font-black text-gray-700">{teamForm.commission_type === "fixed" ? "Valor por pedido" : "Percentual"}
                      <input type="number" min="0" max={teamForm.commission_type === "percent" ? 100 : undefined} step="0.01" disabled={teamForm.commission_type === "none"} value={teamForm.commission_value} onChange={e => setTeamForm(p => ({ ...p, commission_value: e.target.value }))} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00] disabled:opacity-50" placeholder={teamForm.commission_type === "fixed" ? "R$ 0,00" : "0%"} />
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Senha"
                    value={teamForm.password}
                    onChange={e => setTeamForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Confirmar"
                    value={teamForm.password_confirm}
                    onChange={e => setTeamForm(p => ({ ...p, password_confirm: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                  />
                </div>
                {teamMessage && <p className="rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#3D1A0A]">{teamMessage}</p>}
                <button type="submit" className="w-full rounded-xl bg-[#FF6B00] py-3 font-black text-white hover:bg-[#E56000]">
                  Criar usuário
                </button>
              </form>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-4">Usuários cadastrados</h3>
                <div className="space-y-3">
                  {team.map(user => (
                    <div key={user.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div>
                        <p className="font-bold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">Login: {user.login} {user.email ? `- ${user.email}` : ""}</p>
                        {user.commission_type && user.commission_type !== 'none' && (
                          <p className="mt-1 text-xs font-black text-[#FF6B00]">Comissão: {user.commission_type === 'percent' ? `${user.commission_value}% das vendas` : `${formatCurrency(Number(user.commission_value || 0))} por pedido`}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full bg-[#EFD5CA] px-3 py-1 text-xs font-black text-[#3D1A0A]">
                          {user.role === 'manager' ? 'Gerente' : user.role === 'owner' ? 'Proprietario' : 'Garcom / Vendedor'}
                        </span>
                        {user.role === 'seller' && <button type="button" onClick={() => openCommissionEditor(user)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-[#9A3E00] hover:bg-orange-100">Editar comissao</button>}
                      </div>
                    </div>
                  ))}
                  {team.length === 0 && (
                    <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Nenhum usuário criado ainda.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-3 pt-2 app-bottom-safe shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
              className={cn(
                "tap-target relative flex min-w-[74px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-black",
                activeTab === tab.id ? "bg-[#FF6B00] text-white shadow-sm" : "text-gray-500"
              )}
            >
              <tab.icon size={19} />
              <span className="mt-0.5 max-w-[68px] truncate">{tab.label}</span>
              {tab.id === "orders" && newOrderCount > 0 && activeTab !== "orders" && (
                <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {newOrderCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ========== MODAL: ADD/EDIT PRODUCT ========== */}
      {showProductModal && (
        <ProductModal
          product={editingProduct || productDraft}
          vendorId={vendorId}
          mode={productModalMode}
          categories={productCategories}
          existingCategoryNames={menuCategories}
          onCategoryCreated={(category) => setProductCategories(prev => [category, ...prev.filter(item => item.id !== category.id)])}
          onSave={saveProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); setProductDraft(null); setProductModalMode("stock"); }}
        />
      )}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMove={moveOrder}
          onPaid={markAccountPaid}
          onReleaseEmpty={releaseEmptyUmbrella}
          onWaiterDone={acknowledgeWaiterCall}
          onCancelItem={cancelOrderItem}
          onAddItems={(order) => { setSelectedOrder(null); setManualOrderingOrder(order); }}
        />
      )}

      {manualAccountUmbrella && (
        <ManualAccountModal
          umbrella={manualAccountUmbrella}
          onClose={() => setManualAccountUmbrella(null)}
          onSubmit={openManualAccount}
        />
      )}

      {manualOrderingOrder && (
        <ManualOrderMenuModal
          order={manualOrderingOrder}
          products={products}
          onClose={() => setManualOrderingOrder(null)}
          onSubmit={launchManualItems}
        />
      )}

      {showCashModal && (
        <CashControlModal
          mode={cashControl?.status === "open" ? "close" : "open"}
          cashControl={cashControl}
          cashSales={todayCashSales}
          submitting={closingDay}
          onClose={() => setShowCashModal(false)}
          onSubmit={submitCashControl}
        />
      )}

      {showStockAdjustment && (
        <StockAdjustmentModal products={products} onClose={() => setShowStockAdjustment(false)} onSubmit={registerStockAdjustment} />
      )}

      {showUpsellSettings && <UpsellSettingsModal products={products.filter(product => product.active)} initialRules={upsellRules} onClose={() => setShowUpsellSettings(false)} onSave={saveUpsellSettings} />}
      {showPromotionSettings && <PromotionSettingsModal vendorId={vendorId || ''} products={products.filter(product => product.active)} promotions={flexiblePromotions} onClose={() => setShowPromotionSettings(false)} onChanged={() => vendorId ? loadFlexiblePromotions(vendorId) : Promise.resolve()} />}

      {commissionUser && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setCommissionUser(null)}><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}><button type="button" onClick={() => setCommissionUser(null)} className="float-right rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X /></button><p className="text-xs font-black uppercase text-[#C65300]">Comissao automatica</p><h3 className="text-2xl font-black text-gray-950">{commissionUser.name}</h3><p className="mt-1 text-sm font-bold text-gray-600">A nova regra sera usada nos proximos relatorios e fica registrada no historico.</p><label className="mt-5 block text-sm font-black text-gray-800">Forma de comissao<select value={commissionForm.type} onChange={event => setCommissionForm({ type: event.target.value, value: event.target.value === 'none' ? '' : commissionForm.value })} className="mt-2 min-h-12 w-full rounded-xl border-2 border-gray-200 bg-white p-3 outline-none focus:border-[#FF6B00]"><option value="none">Sem comissao</option><option value="percent">Percentual das vendas</option><option value="fixed">Valor fixo por pedido</option></select></label>{commissionForm.type !== 'none' && <label className="mt-4 block text-sm font-black text-gray-800">{commissionForm.type === 'percent' ? 'Percentual' : 'Valor por pedido'}<input type="number" min="0" max={commissionForm.type === 'percent' ? 100 : undefined} step="0.01" value={commissionForm.value} onChange={event => setCommissionForm(current => ({ ...current, value: event.target.value }))} className="mt-2 min-h-12 w-full rounded-xl border-2 border-gray-200 p-3 text-lg font-black text-gray-950 outline-none focus:border-[#FF6B00]" placeholder={commissionForm.type === 'percent' ? 'Ex.: 10' : 'Ex.: 5,00'} /></label>}{commissionMessage && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{commissionMessage}</p>}<button type="button" disabled={commissionSaving || (commissionForm.type !== 'none' && (!commissionForm.value || Number(commissionForm.value) < 0))} onClick={saveCommission} className="mt-5 min-h-13 w-full rounded-xl bg-[#FF6B00] py-3 font-black text-white hover:bg-[#E56000] disabled:opacity-40">{commissionSaving ? 'Salvando...' : 'Salvar comissao'}</button></div></div>}

      {payingOrder && (
        <PaymentMethodModal
          order={payingOrder}
          vendorId={vendorId || ''}
          settings={themeForm}
          onClose={() => setPayingOrder(null)}
          onConfirm={confirmAccountPaid}
        />
      )}

      {/* ========== MODAL: CUSTOMER DETAIL ========== */}
      {selectedCustomer && (
        <CustomerModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

// =========================================================
// ORDER MODAL COMPONENT
// =========================================================
function PromotionSettingsModal({ vendorId, products, promotions, onClose, onChanged }: { vendorId: string; products: Product[]; promotions: FlexiblePromotion[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [benefitType, setBenefitType] = useState<'percent' | 'fixed' | 'closed_price' | 'free_product'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [rewardProductId, setRewardProductId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const applyTemplate = (type: typeof benefitType) => {
    setBenefitType(type);
    if (type === 'percent') { setTitle('10% de desconto'); setDiscountValue('10'); }
    if (type === 'fixed') { setTitle('R$ 10 de desconto'); setDiscountValue('10'); }
    if (type === 'closed_price') { setTitle('Combo especial'); setDiscountValue('49.90'); }
    if (type === 'free_product') { setTitle('Compre e ganhe'); setDiscountValue(''); }
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const itemIds = [...new Set([...selected, ...(benefitType === 'free_product' && rewardProductId ? [rewardProductId] : [])])];
      const response = await fetch('/api/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, title, description, benefit_type: benefitType, discount_value: discountValue, reward_product_id: rewardProductId, items: itemIds.map(product_id => ({ product_id, quantity: product_id === rewardProductId ? 1 : Math.max(1, selectedQuantities[product_id] || 1), group: product_id === rewardProductId ? 'brinde' : 'principal' })), starts_at: startsAt ? new Date(startsAt).toISOString() : null, ends_at: endsAt ? new Date(endsAt).toISOString() : null, limit_per_order: 1 }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel criar a promocao.');
      setTitle(''); setDescription(''); setSelected([]); setSelectedQuantities({}); setRewardProductId(''); await onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao criar promocao.'); }
    finally { setSaving(false); }
  };
  const toggle = async (promotion: FlexiblePromotion) => {
    const response = await fetch('/api/promotions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, id: promotion.id, active: !promotion.ativa }) });
    if (response.ok) await onChanged();
  };
  const remove = async (promotion: FlexiblePromotion) => {
    if (!confirm(`Excluir a promocao "${promotion.titulo}"?`)) return;
    const response = await fetch(`/api/promotions?vendor_id=${vendorId}&id=${promotion.id}`, { method: 'DELETE' });
    if (response.ok) await onChanged();
  };
  const benefitLabel = (promotion: FlexiblePromotion) => promotion.descricao?.startsWith('[PRODUTO_GRATIS]') ? 'Produto gratis' : promotion.desconto_tipo === 'percentual' ? `${promotion.desconto_valor}% de desconto` : promotion.desconto_tipo === 'preco_fechado' ? `Combo por ${formatCurrency(Number(promotion.desconto_valor))}` : `${formatCurrency(Number(promotion.desconto_valor))} de desconto`;
  const selectedGross = [...new Set([...selected, ...(benefitType === 'free_product' && rewardProductId ? [rewardProductId] : [])])].reduce((sum, id) => {
    const product = products.find(item => item.id === id);
    const quantity = id === rewardProductId ? 1 : Math.max(1, selectedQuantities[id] || 1);
    return sum + Number(product?.promotional_price ?? product?.price ?? 0) * quantity;
  }, 0);
  const numericBenefit = Math.max(0, Number(discountValue || 0));
  const reward = products.find(product => product.id === rewardProductId);
  const rewardPrice = Number(reward?.promotional_price ?? reward?.price ?? 0);
  const projectedDiscount = benefitType === 'percent' ? selectedGross * Math.min(100, numericBenefit) / 100 : benefitType === 'closed_price' ? Math.max(0, selectedGross - numericBenefit) : benefitType === 'free_product' ? rewardPrice : Math.min(selectedGross, numericBenefit);
  const projectedTotal = Math.max(0, selectedGross - projectedDiscount);
  const invalidClosedPrice = benefitType === 'closed_price' && (numericBenefit <= 0 || numericBenefit >= selectedGross);

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-4" onClick={onClose}><div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6" onClick={event => event.stopPropagation()}>
    <div className="flex justify-between gap-4"><div><p className="text-xs font-black uppercase text-green-700">Ofertas automaticas</p><h3 className="text-2xl font-black text-gray-950">Promoções prontas</h3><p className="mt-1 text-sm font-bold text-gray-600">O desconto entra automaticamente quando todos os produtos estiverem no carrinho.</p></div><button onClick={onClose}><X /></button></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{([['percent','10% OFF'],['fixed','R$ de desconto'],['closed_price','Preço de combo'],['free_product','Produto grátis']] as const).map(([type, label]) => <button key={type} onClick={() => applyTemplate(type)} className={`rounded-xl border-2 p-3 text-sm font-black ${benefitType === type ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{label}</button>)}</div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-black text-gray-800">Nome da oferta<input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-green-600" placeholder="Ex: Combo fim de tarde" /></label>{benefitType !== 'free_product' && <label className="text-sm font-black text-gray-800">{benefitType === 'percent' ? 'Percentual' : benefitType === 'closed_price' ? 'Preço final do combo' : 'Valor do desconto'}<input type="number" min="0" step="0.01" value={discountValue} onChange={event => setDiscountValue(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-green-600" /></label>}</div>
    <textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-4 min-h-20 w-full rounded-xl border-2 border-gray-200 p-3" placeholder="Mensagem que o cliente verá" />
    <p className="mt-4 text-sm font-black text-gray-800">Produtos necessários para ativar a oferta</p><div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{products.map(product => { const checked = selected.includes(product.id); return <div key={product.id} className={`rounded-xl border p-3 text-sm font-bold ${checked ? 'border-green-400 bg-green-50 text-gray-900' : 'border-gray-200 text-gray-800'}`}><label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={event => { setSelected(current => event.target.checked ? [...current, product.id] : current.filter(id => id !== product.id)); if (event.target.checked) setSelectedQuantities(current => ({ ...current, [product.id]: current[product.id] || 1 })); }} /><span className="min-w-0 flex-1 truncate">{product.name}</span><span className="text-xs text-gray-600">{formatCurrency(Number(product.promotional_price ?? product.price))}</span></label>{checked && <label className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-gray-700">Quantidade<input type="number" min="1" max="50" value={selectedQuantities[product.id] || 1} onChange={event => setSelectedQuantities(current => ({ ...current, [product.id]: Math.max(1, Math.min(50, Number(event.target.value) || 1)) }))} className="h-9 w-20 rounded-lg border border-green-300 bg-white px-2 text-center text-sm font-black" /></label>}</div>; })}</div>
    {benefitType === 'free_product' && <label className="mt-4 block text-sm font-black text-gray-800">Produto grátis<select value={rewardProductId} onChange={event => setRewardProductId(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3"><option value="">Escolha o brinde</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>}
    {selectedGross > 0 && <div className={`mt-4 rounded-xl border p-4 ${invalidClosedPrice ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}`}><p className="text-xs font-black uppercase text-gray-700">Simulação da oferta</p><div className="mt-2 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs font-bold text-gray-600">Preço normal</p><p className="font-black text-gray-900">{formatCurrency(selectedGross)}</p></div><div><p className="text-xs font-bold text-gray-600">Economia</p><p className="font-black text-green-700">{formatCurrency(projectedDiscount)}</p></div><div><p className="text-xs font-bold text-gray-600">Cliente paga</p><p className="font-black text-green-800">{formatCurrency(projectedTotal)}</p></div></div>{invalidClosedPrice && <p className="mt-2 text-sm font-black text-red-800">O preço do combo precisa ser menor que {formatCurrency(selectedGross)}.</p>}</div>}
    <details className="mt-4 rounded-xl border border-gray-200 p-3"><summary className="cursor-pointer text-sm font-black text-gray-700">Agendar início e fim (opcional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className="rounded-xl border-2 border-gray-200 p-3" /><input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} className="rounded-xl border-2 border-gray-200 p-3" /></div></details>
    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={saving || title.trim().length < 3 || selected.length === 0 || invalidClosedPrice || (benefitType === 'free_product' && (!rewardProductId || !selected.some(id => id !== rewardProductId)))} onClick={save} className="mt-4 min-h-13 w-full rounded-xl bg-green-600 py-3 font-black text-white disabled:opacity-40">{saving ? 'Salvando...' : 'Criar promoção'}</button>
    <div className="mt-6 border-t pt-5"><h4 className="font-black text-gray-950">Promoções cadastradas</h4><div className="mt-3 space-y-2">{promotions.map(promotion => <div key={promotion.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div className="min-w-0"><p className="truncate font-black text-gray-900">{promotion.titulo}</p><p className="text-xs font-bold text-green-700">{benefitLabel(promotion)} · {promotion.promocao_itens?.map(item => item.products?.name).filter(Boolean).join(' + ')}</p></div><div className="flex gap-2"><button onClick={() => toggle(promotion)} className={`rounded-lg px-3 py-2 text-xs font-black ${promotion.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{promotion.ativa ? 'Ativa' : 'Pausada'}</button><button onClick={() => remove(promotion)} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={17} /></button></div></div>)}{promotions.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Nenhuma promoção cadastrada.</p>}</div></div>
  </div></div>;
}

function UpsellSettingsModal({ products, initialRules, onClose, onSave }: { products: Product[]; initialRules: UpsellRule[]; onClose: () => void; onSave: (rules: UpsellRule[]) => Promise<void> }) {
  const [rules, setRules] = useState<UpsellRule[]>(initialRules);
  const [trigger, setTrigger] = useState(products[0]?.id || "");
  const [targets, setTargets] = useState<string[]>([]);
  const [message, setMessage] = useState("Que tal adicionar também?");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const addRule = () => {
    if (!trigger || targets.length === 0) return setError("Escolha o produto principal e ao menos um complemento.");
    setRules(current => [...current.filter(rule => rule.trigger_product_id !== trigger), { trigger_product_id: trigger, suggested_product_ids: targets, message }]);
    setTargets([]); setError("");
  };
  const save = async () => { setSaving(true); setError(""); try { await onSave(rules); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}><div className="flex justify-between"><div><p className="text-xs font-black uppercase text-blue-600">Upsell</p><h3 className="text-2xl font-black text-gray-900">Sugestões de venda</h3><p className="text-sm font-bold text-gray-500">Escolha o que oferecer quando um produto entrar no carrinho.</p></div><button onClick={onClose}><X /></button></div><label className="mt-5 block text-sm font-black text-gray-700">Quando o cliente adicionar<select value={trigger} onChange={e => setTrigger(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3">{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><p className="mt-4 text-sm font-black text-gray-700">Sugerir estes complementos</p><div className="mt-2 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{products.filter(product => product.id !== trigger).map(product => <label key={product.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-bold text-gray-700"><input type="checkbox" checked={targets.includes(product.id)} onChange={e => setTargets(current => e.target.checked ? [...current, product.id] : current.filter(id => id !== product.id))} />{product.name}</label>)}</div><input value={message} onChange={e => setMessage(e.target.value)} maxLength={120} className="mt-4 w-full rounded-xl border-2 border-gray-200 p-3" placeholder="Mensagem da sugestão" /><button onClick={addRule} className="mt-3 w-full rounded-xl border-2 border-blue-500 py-3 font-black text-blue-700">Adicionar regra</button><div className="mt-5 space-y-2">{rules.map((rule, index) => <div key={`${rule.trigger_product_id}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 p-3"><div><p className="font-black text-gray-900">{products.find(p => p.id === rule.trigger_product_id)?.name}</p><p className="text-xs font-bold text-gray-500">Sugere {rule.suggested_product_ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(", ")}</p></div><button onClick={() => setRules(current => current.filter((_, i) => i !== index))} className="text-red-600"><Trash2 size={18} /></button></div>)}</div>{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={saving} onClick={save} className="mt-5 w-full rounded-xl bg-blue-600 py-3 font-black text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar sugestões"}</button></div></div>;
}

function StockAdjustmentModal({ products, onClose, onSubmit }: {
  products: Product[];
  onClose: () => void;
  onSubmit: (values: { product_id: string; quantity: number; reason: string; location: string; note: string }) => Promise<void>;
}) {
  const controlled = products.filter(product => product.stock_tracking_enabled);
  const [productId, setProductId] = useState(controlled[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("loss");
  const [location, setLocation] = useState("beach");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selected = controlled.find(product => product.id === productId);
  const current = location === "physical" ? Number(selected?.physical_stock_quantity || 0) : Number(selected?.beach_stock_quantity ?? selected?.stock_quantity ?? 0);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError("");
    try { await onSubmit({ product_id: productId, quantity: Number(quantity), reason, location, note }); }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Erro ao registrar baixa."); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex justify-between gap-4"><div><p className="text-xs font-black uppercase text-red-600">Controle de estoque</p><h3 className="text-2xl font-black text-gray-900">Registrar saída sem venda</h3></div><button type="button" onClick={onClose}><X /></button></div>
        <label className="mt-5 block text-sm font-black text-gray-700">Produto<select required value={productId} onChange={event => setProductId(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3"><option value="">Selecione</option>{controlled.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-black text-gray-700">Local<select value={location} onChange={event => setLocation(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3"><option value="beach">Estoque em uso</option><option value="physical">Estoque físico</option></select></label>
          <label className="text-sm font-black text-gray-700">Quantidade (atual: {current})<input required type="number" min="1" max={current || undefined} value={quantity} onChange={event => setQuantity(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3" /></label>
        </div>
        <label className="mt-4 block text-sm font-black text-gray-700">Motivo<select value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3"><option value="loss">Perda</option><option value="internal_consumption">Consumo interno</option><option value="theft">Furto identificado</option><option value="breakage">Quebra ou avaria</option><option value="expired">Produto vencido</option><option value="count_error">Erro de contagem</option><option value="other">Outro</option></select></label>
        <label className="mt-4 block text-sm font-black text-gray-700">Justificativa<textarea required value={note} onChange={event => setNote(event.target.value)} maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border-2 border-gray-200 p-3" placeholder="Explique o que aconteceu" /></label>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button disabled={submitting || controlled.length === 0} className="mt-5 min-h-12 w-full rounded-xl bg-red-600 py-3 font-black text-white disabled:opacity-50">{submitting ? "Registrando..." : "Confirmar baixa"}</button>
      </form>
    </div>
  );
}

function CashControlModal({ mode, cashControl, cashSales, submitting, onClose, onSubmit }: {
  mode: "open" | "close";
  cashControl: CashControl | null;
  cashSales: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: { opening_cash?: number; counted_cash?: number; difference_reason?: string; notes?: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const numericAmount = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const expected = Number((Number(cashControl?.opening_cash || 0) + cashSales).toFixed(2));
  const difference = Number((numericAmount - expected).toFixed(2));
  const needsReason = mode === "close" && Math.abs(difference) >= 0.01;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (needsReason && !reason) return setError("Escolha uma justificativa para a diferença.");
    if (needsReason && notes.trim().length < 5) return setError("Explique em poucas palavras o que causou a diferença.");
    setError("");
    try {
      await onSubmit(mode === "open"
        ? { opening_cash: numericAmount, notes }
        : { counted_cash: numericAmount, difference_reason: reason, notes });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível atualizar o caixa.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase text-[#FF6B00]">Controle financeiro</p><h3 className="text-2xl font-black text-gray-900">{mode === "open" ? "Abrir caixa" : "Fechar caixa"}</h3></div>
          <button type="button" onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>
        {mode === "close" && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold text-gray-500">Fundo inicial</p><p className="font-black text-gray-900">{formatCurrency(Number(cashControl?.opening_cash || 0))}</p></div>
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold text-gray-500">Vendas em dinheiro</p><p className="font-black text-gray-900">{formatCurrency(cashSales)}</p></div>
            <div className="col-span-2 rounded-xl bg-orange-50 p-3"><p className="text-xs font-bold text-gray-500">Dinheiro esperado</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(expected)}</p></div>
          </div>
        )}
        <label className="mt-5 block text-sm font-black text-gray-700">
          {mode === "open" ? "Fundo inicial em dinheiro" : "Valor contado no caixa"}
          <input autoFocus required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg font-black outline-none focus:border-[#FF6B00]" placeholder="0,00" />
        </label>
        {mode === "close" && <p className={cn("mt-3 rounded-xl p-3 text-sm font-black", difference === 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>Diferença: {formatCurrency(difference)}</p>}
        {needsReason && (
          <label className="mt-4 block text-sm font-black text-gray-700">Justificativa obrigatória
            <select required value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]">
              <option value="">Selecione</option><option value="discount">Desconto concedido</option><option value="loss">Perda ou quebra</option><option value="typing_error">Erro de digitação</option><option value="change_error">Erro de troco</option><option value="payment_method_error">Forma de pagamento incorreta</option><option value="unregistered_expense">Despesa não registrada</option><option value="cash_withdrawal">Sangria/retirada</option><option value="cash_deposit">Suprimento/entrada não registrada</option><option value="other">Outro motivo</option>
            </select>
          </label>
        )}
        <label className="mt-4 block text-sm font-black text-gray-700">Observação {needsReason ? "obrigatória" : "opcional"}
          <textarea required={needsReason} value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} className="mt-2 min-h-20 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]" placeholder={needsReason ? "Explique o que causou a diferença" : "Detalhes da abertura ou fechamento"} />
        </label>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button disabled={submitting} className="mt-5 min-h-12 w-full rounded-xl bg-[#FF6B00] py-3 font-black text-white disabled:opacity-50">{submitting ? "Processando..." : mode === "open" ? "Confirmar abertura" : "Conferir e fechar"}</button>
      </form>
    </div>
  );
}

function OrderModal({
  order,
  onClose,
  onMove,
  onPaid,
  onReleaseEmpty,
  onWaiterDone,
  onCancelItem,
  onAddItems,
}: {
  order: Order;
  onClose: () => void;
  onMove: (id: string, status: string) => Promise<void>;
  onPaid: (order: Order) => Promise<void>;
  onReleaseEmpty: (order: Order) => Promise<void>;
  onWaiterDone: (order: Order) => Promise<void>;
  onCancelItem: (order: Order, item: OrderItem) => Promise<void>;
  onAddItems: (order: Order) => void;
}) {
  const serviceRequest = getServiceRequest(order);
  const emptyAccount = isOrderEmpty(order);
  const visibleItems = getVisibleConsumptionItems(order, Boolean(order.active_request));
  const visibleOrderNotes = getVisibleOrderNotes(order.notes);
  const next = emptyAccount ? null : order.status === 'received'
    ? { label: 'Iniciar preparo', status: 'preparing' }
    : order.status === 'preparing'
      ? { label: 'Saiu para entrega', status: 'delivering' }
      : order.status === 'delivering'
        ? { label: 'Confirmar entrega', status: 'completed' }
        : order.status === 'completed'
          ? { label: 'Solicitar conta', status: 'closing_requested' }
          : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start p-6 border-b border-gray-100">
          <div>
            <p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p>
            <h3 className="text-xl font-display font-bold text-gray-900">
              {order.active_request ? `Pedido ${order.active_request.sequence}` : `Comanda #${order.id.slice(0, 8)}`}
            </h3>
            <p className="mt-1 text-sm font-bold text-gray-500">{order.customer} · {order.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-4">
          {serviceRequest && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="text-sm font-black uppercase">{serviceRequest.label}</p>
              <p className="mt-1 text-sm font-bold">Cliente pediu este atendimento no guarda-sol.</p>
              <button
                onClick={() => onWaiterDone(order)}
                className="mt-3 w-full rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700"
              >
                Atendimento resolvido
              </button>
            </div>
          )}
          <div className="rounded-xl bg-[#fff8f6] p-4">
            <p className="text-xs font-black uppercase text-[#82533F]">Total da conta</p>
            <p className="text-3xl font-black text-[#FF6B00]">{formatCurrency(order.total)}</p>
          </div>
          {emptyAccount && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-bold text-gray-600">
              Esta comanda está sem consumo. Para não enviar para preparo ou fechamento, libere o guarda-sol vazio.
            </div>
          )}
          <div>
            <h4 className="mb-2 text-sm font-black text-gray-700">
              {order.active_request ? "Itens deste pedido" : "Itens da comanda"}
            </h4>
            <div className="space-y-2">
              {visibleItems.length === 0 ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm font-bold text-gray-400">Comanda aberta sem itens.</p>
              ) : visibleItems.map((item, index) => (
                <div key={`${item.id || item.n}-${index}`} className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 text-sm",
                  item.cancelled && "bg-gray-50 text-gray-400 line-through"
                )}>
                  <span className="font-bold text-gray-900">{item.n}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[#FF6B00]">{item.q}x</span>
                    {item.subtotal !== undefined && (
                      <span className="text-xs font-black text-gray-400">{formatCurrency(item.subtotal)}</span>
                    )}
                    {!item.cancelled && item.id && !order.paid && (
                      <button
                        onClick={() => onCancelItem(order, item)}
                        className="rounded-lg border border-red-100 px-2 py-1 text-xs font-black text-red-600 hover:bg-red-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {visibleOrderNotes && (
              <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
                <p className="mb-1 text-xs font-black uppercase tracking-wide text-amber-700">Observação do cliente</p>
                <p className="whitespace-pre-line font-black leading-6">{visibleOrderNotes}</p>
              </div>
            )}
          </div>
          {order.requests && order.requests.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-black text-gray-700">Pedidos nesta comanda</h4>
              <div className="space-y-2">
                {order.requests.map((request) => (
                  <div key={request.id} className={cn(
                    "flex items-center justify-between rounded-lg border p-3 text-sm",
                    request.id === order.active_request_id ? "border-blue-200 bg-blue-50" : "border-orange-100 bg-orange-50"
                  )}>
                    <div>
                      <p className="font-black text-gray-900">Pedido {request.sequence}</p>
                      <p className="text-xs font-bold text-gray-500">
                        {new Date(request.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {request.status}
                      </p>
                    </div>
                    <p className="font-black text-[#FF6B00]">{formatCurrency(Number(request.subtotal || 0))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 sm:p-6">
          {!order.paid && order.status !== 'closing_requested' && (
            <button onClick={() => onAddItems(order)} className="min-h-12 rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700">
              <span className="inline-flex items-center gap-2"><Utensils size={18} /> Lancar itens</span>
            </button>
          )}
          <button onClick={onClose} className="min-h-12 flex-1 rounded-xl border-2 border-gray-200 py-3 font-bold text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
          {emptyAccount ? (
            <button onClick={() => onReleaseEmpty(order)} className="min-h-12 flex-1 rounded-xl bg-slate-800 py-3 font-black text-white hover:bg-slate-900">
              Liberar guarda-sol vazio
            </button>
          ) : order.status === 'closing_requested' ? (
            <button onClick={() => onPaid(order)} className="min-h-12 flex-1 rounded-xl bg-green-600 py-3 font-black text-white hover:bg-green-700">
              Conta paga
            </button>
          ) : next ? (
            <button onClick={() => onMove(order.id, next.status)} className="min-h-12 flex-1 rounded-xl bg-[#FF6B00] py-3 font-black text-white hover:bg-[#E56000]">
              {next.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ManualAccountModal({
  umbrella,
  onClose,
  onSubmit,
}: {
  umbrella: Umbrella;
  onClose: () => void;
  onSubmit: (umbrella: Umbrella, name: string, phone: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(umbrella, name, phone);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel abrir a comanda.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {umbrella.number}</p>
            <h3 className="text-xl font-black text-gray-900">Abrir comanda manual</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500">Cadastre o cliente sem precisar ler o QR Code.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400"><X size={24} /></button>
        </div>
        <label className="mt-6 block text-sm font-black text-gray-700">
          Nome do cliente
          <input autoFocus required minLength={2} value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none focus:border-[#FF6B00]" placeholder="Nome do cliente" />
        </label>
        <label className="mt-4 block text-sm font-black text-gray-700">
          Telefone com DDD
          <input required inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none focus:border-[#FF6B00]" placeholder="(11) 99999-9999" />
        </label>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button disabled={submitting} className="mt-6 min-h-12 w-full rounded-xl bg-[#FF6B00] py-3 font-black text-white disabled:opacity-50">
          {submitting ? 'Abrindo...' : 'Abrir comanda'}
        </button>
      </form>
    </div>
  );
}

function ManualOrderMenuModal({
  order,
  products,
  onClose,
  onSubmit,
}: {
  order: Order;
  products: Product[];
  onClose: () => void;
  onSubmit: (order: Order, cart: Record<string, number>, notes: string) => Promise<void>;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState<Product | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<string, string>>({});
  const availableProducts = products.filter(product => product.active && !product.blocked_by_stock && product.name.toLowerCase().includes(search.toLowerCase()));
  const priceFor = (product: Product) => Number(product.promotional_price ?? product.price);
  const totalItems = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = products.reduce((sum, product) => sum + priceFor(product) * (cart[product.id] || 0), 0);

  const changeQuantity = (productId: string, delta: number) => {
    setCart(current => ({ ...current, [productId]: Math.max(0, Math.min(50, (current[productId] || 0) + delta)) }));
  };
  const optionSignature = (product: Product) => productOptionGroups(product).map(group => `${group.name}: ${optionSelections[`${product.id}:${group.name}`] || group.options[0]}`).join(' | ');
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const optionNotes = products.filter(product => (cart[product.id] || 0) > 0 && productOptionGroups(product).length > 0).map(product => `${product.name}: ${optionSignature(product)}`).join('; ');
      await onSubmit(order, cart, [notes.trim(), optionNotes ? `Opcoes escolhidas: ${optionNotes}` : ''].filter(Boolean).join('\n'));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel lancar os itens.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[96vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
        <div className="border-b border-gray-100 p-5">
          <div className="flex items-start justify-between">
            <div><p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p><h3 className="text-xl font-black text-gray-900">Lancar itens na comanda</h3><p className="text-sm font-bold text-gray-500">{order.customer} - {order.phone}</p></div>
            <button onClick={onClose} className="text-gray-400"><X size={24} /></button>
          </div>
          <div className="relative mt-4"><Search className="absolute left-3 top-3.5 text-gray-400" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-4 outline-none focus:border-[#FF6B00]" placeholder="Buscar no cardapio" /></div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {availableProducts.map(product => { const groups = productOptionGroups(product); return <div key={product.id} className="rounded-xl border border-gray-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-gray-900">{product.name}</p><p className="text-xs font-bold text-gray-500">{product.category}</p><p className="font-black text-[#FF6B00]">{formatCurrency(priceFor(product))}</p>{groups.length > 0 && (cart[product.id] || 0) > 0 && <p className="mt-1 text-xs font-black text-blue-700">{optionSignature(product)}</p>}</div><div className="flex items-center gap-2"><button onClick={() => changeQuantity(product.id, -1)} className="h-10 w-10 rounded-xl bg-gray-100 text-xl font-black">-</button><span className="w-7 text-center font-black">{cart[product.id] || 0}</span><button onClick={() => groups.length > 0 ? setConfiguringProduct(product) : changeQuantity(product.id, 1)} className="h-10 w-10 rounded-xl bg-[#FF6B00] text-xl font-black text-white">+</button></div></div>{groups.length > 0 && <button type="button" onClick={() => setConfiguringProduct(product)} className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-xs font-black text-blue-700">Escolher opcoes</button>}</div>; })}
          {availableProducts.length === 0 && <p className="py-8 text-center font-bold text-gray-400">Nenhum item disponivel.</p>}
          <textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} className="mt-3 min-h-20 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]" placeholder="Observacao do pedido (opcional)" />
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 p-4"><div><p className="text-xs font-bold text-gray-400">{totalItems} itens</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(total)}</p></div><button disabled={submitting || totalItems === 0} onClick={handleSubmit} className="min-h-12 rounded-xl bg-blue-600 px-6 py-3 font-black text-white disabled:opacity-40">{submitting ? 'Lancando...' : 'Lancar pedido'}</button></div>
      </div>
      {configuringProduct && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setConfiguringProduct(null)}><div className="w-full max-w-md rounded-3xl bg-white p-5" onClick={event => event.stopPropagation()}><button type="button" onClick={() => setConfiguringProduct(null)} className="float-right text-2xl text-gray-500">×</button><p className="text-xs font-black uppercase text-blue-700">Escolher opcoes</p><h4 className="text-xl font-black text-gray-950">{configuringProduct.name}</h4><div className="mt-4 space-y-3">{productOptionGroups(configuringProduct).map(group => <div key={group.name} className="rounded-xl border border-gray-200 p-3"><p className="text-sm font-black text-gray-800">{group.name}</p><div className="mt-2 flex flex-wrap gap-2">{group.options.map(option => <button key={option} type="button" onClick={() => setOptionSelections(current => ({ ...current, [`${configuringProduct.id}:${group.name}`]: option }))} className={`rounded-full border px-3 py-2 text-sm font-black ${(optionSelections[`${configuringProduct.id}:${group.name}`] || group.options[0]) === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>{option}</button>)}</div></div>)}</div><button type="button" onClick={() => { changeQuantity(configuringProduct.id, 1); setConfiguringProduct(null); }} className="mt-4 min-h-12 w-full rounded-xl bg-blue-600 font-black text-white">Adicionar com estas escolhas</button></div></div>}
    </div>
  );
}

function PaymentMethodModal({
  order,
  vendorId,
  settings,
  onClose,
  onConfirm,
}: {
  order: Order;
  vendorId: string;
  settings: KioskTheme;
  onClose: () => void;
  onConfirm: (order: Order, paymentMethod: string, amount: number, payerName: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [remaining, setRemaining] = useState(Number(order.total || 0));
  const [paidAmount, setPaidAmount] = useState(0);
  const [serviceFeeAmount, setServiceFeeAmount] = useState(0);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState(String(order.total || ''));
  const [payerName, setPayerName] = useState(order.customer || 'Cliente');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const activePaymentOptions = PAYMENT_METHOD_OPTIONS.filter(({ id }) => settings[`${id}_active` as keyof KioskTheme] !== false);

  useEffect(() => {
    fetch(`/api/account-payments?vendor_id=${vendorId}&order_id=${order.id}`)
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!data) return;
        const nextRemaining = Number(data.remaining_amount || 0);
        setRemaining(nextRemaining);
        setPaidAmount(Number(data.paid_amount || 0));
        setServiceFeeAmount(Number(data.service_fee_amount || 0));
        setAmount(String(nextRemaining));
      })
      .finally(() => setLoadingSummary(false));
  }, [vendorId, order.id]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(order, paymentMethod, mode === 'full' ? remaining : Number(amount), payerName);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p>
            <h3 className="text-xl font-display font-bold text-gray-900">Receber conta</h3>
            <p className="mt-1 text-sm font-bold text-gray-500">{order.customer} · Consumo {formatCurrency(order.total)}{serviceFeeAmount > 0 ? ` + serviço ${formatCurrency(serviceFeeAmount)}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-green-50 p-3"><p className="text-xs font-black text-green-700">JA RECEBIDO</p><p className="text-xl font-black text-green-700">{formatCurrency(paidAmount)}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs font-black text-orange-700">SALDO</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(remaining)}</p></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => { setMode('full'); setAmount(String(remaining)); }} className={`rounded-xl border-2 p-3 text-sm font-black ${mode === 'full' ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>Receber saldo</button><button onClick={() => setMode('partial')} className={`rounded-xl border-2 p-3 text-sm font-black ${mode === 'partial' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600'}`}>Receber parte</button></div>
        <input value={payerName} onChange={event => setPayerName(event.target.value)} className="mt-4 w-full rounded-xl border-2 border-gray-200 p-3 font-bold outline-none focus:border-[#FF6B00]" placeholder="Nome de quem pagou" />
        {mode === 'partial' && <input value={amount} onChange={event => setAmount(event.target.value.replace(',', '.'))} inputMode="decimal" className="mt-3 w-full rounded-xl border-2 border-gray-200 p-3 text-lg font-black outline-none focus:border-blue-600" placeholder="Valor recebido" />}
        <p className="mb-2 mt-4 text-sm font-black text-gray-700">Forma de pagamento</p><div className="grid grid-cols-2 gap-3">
          {activePaymentOptions.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              disabled={submitting}
              onClick={() => setPaymentMethod(id)}
              className={`min-h-20 rounded-2xl border-2 p-4 text-left transition disabled:opacity-50 ${paymentMethod === id ? 'border-[#FF6B00] bg-[#FFF2E5]' : 'border-gray-100 bg-gray-50'}`}
            >
              <Icon className="mb-3 text-[#FF6B00]" size={24} />
              <span className="block font-black text-gray-900">{label}</span>
            </button>
          ))}
        </div>
        <button disabled={submitting || loadingSummary || remaining <= 0 || (mode === 'partial' && (Number(amount) <= 0 || Number(amount) > remaining))} onClick={handleConfirm} className="mt-5 min-h-14 w-full rounded-xl bg-green-600 font-black text-white disabled:opacity-40">{submitting ? 'Registrando...' : mode === 'full' ? `Receber ${formatCurrency(remaining)} e fechar` : `Registrar ${formatCurrency(Number(amount || 0))}`}</button>
      </div>
    </div>
  );
}

// =========================================================
// PRODUCT MODAL COMPONENT
// =========================================================
function ProductModal({
  product,
  vendorId,
  mode = "stock",
  categories,
  existingCategoryNames,
  onCategoryCreated,
  onSave,
  onClose,
}: {
  product: Product | null;
  vendorId: string | null;
  mode?: "stock" | "menu";
  categories: ProductCategory[];
  existingCategoryNames: string[];
  onCategoryCreated?: (category: ProductCategory) => void;
  onSave: (p: Product) => Promise<void> | void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(product || {
    id: "", name: "", category: "", price: 0, promotional_price: null,
    subcategory: "", option_group_name: "", option_values: [], menu_highlight: false,
    description: "", image_url: "", active: true, is_combo: false, stock_tracking_enabled: false,
    stock_quantity: null, physical_stock_quantity: 0, beach_stock_quantity: 0, blocked_by_stock: false,
    sort_order: 99,
  });
  const [hasOptions, setHasOptions] = useState(() => Boolean(product?.option_group_name || product?.option_values?.length));
  const [optionGroups, setOptionGroups] = useState<Array<{ name: string; options: string[] }>>(() => {
    const values = Array.isArray(product?.option_values) ? product.option_values.filter(Boolean) : [];
    if (values.some(value => value.includes('::'))) {
      const groups = new Map<string, string[]>();
      values.forEach(value => { const [rawName, ...parts] = value.split('::'); const name = rawName.trim() || 'Opcao'; const option = parts.join('::').trim(); if (option) groups.set(name, [...(groups.get(name) || []), option]); });
      return Array.from(groups, ([name, options]) => ({ name, options }));
    }
    return [{ name: product?.option_group_name || 'Opcao', options: values.length > 0 ? values : [''] }];
  });
  const [uploading, setUploading] = useState(false);
  const [defaultImages, setDefaultImages] = useState<Array<{ id: string; name: string; image_url: string; category: string; tags?: string[] }>>([]);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [subcategoryMessage, setSubcategoryMessage] = useState("");
  const isMenuMode = mode === "menu";
  const rootCategories = categories.filter(category => !category.parent_id && category.active !== false);
  const selectedRoot = rootCategories.find(category => category.name === form.category);
  const subcategories = selectedRoot
    ? categories.filter(category => category.parent_id === selectedRoot.id && category.active !== false)
    : [];
  const categoryNames = Array.from(new Set([...existingCategoryNames, ...rootCategories.map(category => category.name)].filter(Boolean)));
  const normalizedOptionGroups = optionGroups.map(group => ({ name: group.name.trim() || 'Opcao', options: group.options.map(option => option.trim()).filter(Boolean) })).filter(group => group.options.length > 0).slice(0, 8);
  const normalizedOptionValues = normalizedOptionGroups.flatMap(group => group.options.map(option => `${group.name}::${option}`)).slice(0, 50);

  const updateOptionGroup = (groupIndex: number, updater: (group: { name: string; options: string[] }) => { name: string; options: string[] }) => setOptionGroups(current => current.map((group, index) => index === groupIndex ? updater(group) : group));
  const addOptionGroup = () => setOptionGroups(current => [...current, { name: `Escolha ${current.length + 1}`, options: [''] }]);
  const removeOptionGroup = (groupIndex: number) => setOptionGroups(current => current.length <= 1 ? [{ name: 'Opcao', options: [''] }] : current.filter((_, index) => index !== groupIndex));

  const createSubcategory = async () => {
    if (!vendorId || !selectedRoot?.id || !newSubcategoryName.trim()) {
      setSubcategoryMessage("Escolha uma categoria principal e informe o nome da subcategoria.");
      return;
    }
    setSubcategoryMessage("");
    try {
      const res = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          name: newSubcategoryName,
          parent_id: selectedRoot.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubcategoryMessage(data.error || "Não foi possível criar a subcategoria.");
        return;
      }
      onCategoryCreated?.(data);
      setForm(prev => ({ ...prev, subcategory: data.name }));
      setNewSubcategoryName("");
      setSubcategoryMessage("Subcategoria criada e selecionada.");
    } catch {
      setSubcategoryMessage("Erro de rede ao criar subcategoria.");
    }
  };

  useEffect(() => {
    if (isMenuMode) return;
    let cancelled = false;
    async function loadDefaultImages() {
      try {
        const params = new URLSearchParams({
          category: form.category,
          q: form.name || form.category,
          planType: "free",
        });
        const res = await fetch(`/api/products/gallery?${params.toString()}`);
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok) {
          setDefaultImages(data?.data?.images || []);
        }
      } catch {
        if (!cancelled) setDefaultImages([]);
      }
    }
    loadDefaultImages();
    return () => {
      cancelled = true;
    };
  }, [form.category, form.name, isMenuMode]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!vendorId) return alert('Não foi possível identificar o seu quiosque. Faça login novamente.');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("vendor_id", vendorId);
      const res = await fetch("/api/products/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setForm(prev => ({ ...prev, image_url: data.url }));
    } catch (err) {
      console.error("Upload failed:", err);
      alert('Erro ao enviar imagem.');
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-display font-bold">{isMenuMode ? "Alterar cardápio" : product ? "Editar Produto" : "Novo Produto"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-4">
          {isMenuMode && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase text-gray-500">Produto</p>
              <p className="mt-1 font-black text-gray-900">{form.name}</p>
              <p className="text-sm font-bold text-gray-500">{form.category}</p>
            </div>
          )}
          {!isMenuMode && (
            <>
          {/* Global image catalog */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Foto do Produto</label>
            <div className="block">
              <div className="w-full h-40 border-2 border-gray-200 rounded-xl flex flex-col items-center justify-center overflow-hidden bg-gray-50">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon size={24} className="text-gray-300 mb-2" />
                    <span className="px-4 text-center text-sm font-bold text-gray-400">Escolha uma imagem do catálogo global abaixo</span>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-gray-500">
              O catálogo global é administrado pelo SandExpress. Digite o nome do item para receber sugestões por categoria e tags.
            </p>
            {defaultImages.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Referências do catálogo global</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {defaultImages.slice(0, 12).map((image) => (
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
                type="number" step="0.01" required
                value={form.price || ""} onChange={e => setForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Preço Promocional</label>
              <input
                type="number" step="0.01"
                value={form.promotional_price || ""} onChange={e => setForm(prev => ({ ...prev, promotional_price: parseFloat(e.target.value) || null }))}
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
