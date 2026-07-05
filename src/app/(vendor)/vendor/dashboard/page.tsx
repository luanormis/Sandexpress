"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, Clock, Trash2, Pencil, X, Upload,
  Eye, EyeOff, LogOut, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu, PackageCheck, Banknote, Smartphone, CreditCard,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
import { getVisibleConsumptionItems, getVisibleVendorOrderNotes, isAccountWithoutConsumption } from "@/lib/vendor-order-state";

const WAITER_CALL_MARKER = "[WAITER_CALL]";
const SERVICE_REQUEST_MARKERS = [
  { marker: "[WAITER_CALL]", label: "Solicitando atendente", shortLabel: "Atendente", tone: "waiter" },
];

// ---------- TYPES ----------
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  promotional_price: number | null;
  description: string;
  image_url: string;
  active: boolean;
  is_combo: boolean;
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

function isOrderEmpty(order: Pick<Order, "total" | "items" | "account_items">) {
  return isAccountWithoutConsumption(order);
}

function getFirstCustomerName(name?: string | null) {
  return String(name || '').trim().split(/\s+/)[0] || '';
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
  top_customers: { name: string; phone: string; visits: number; total_spent: number }[];
  hourly_sales: { hour: string; orders: number }[];
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

type PaymentFeeType = "percent" | "fixed";

const CATEGORIES = ["Bebidas", "Alcoolicos", "Nao Alcoolicos", "Comidas", "Petiscos", "Sobremesas", "Combos", "Extras"];

const DEFAULT_THEME: KioskTheme = {
  primary_color: "#ff6b00",
  secondary_color: "#82533f",
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
  { name: "Laranja vibrante", value: "#ff6b00" },
  { name: "Marrom primario", value: "#a04100" },
  { name: "Marrom cliente", value: "#572000" },
  { name: "Marrom estrutural", value: "#82533f" },
  { name: "Cafe escuro", value: "#3d1a0a" },
  { name: "Areia baixa", value: "#fff1eb" },
  { name: "Areia media", value: "#ffeae1" },
  { name: "Areia alta", value: "#f8ddd2" },
  { name: "Contorno", value: "#8e7164" },
  { name: "Creme", value: "#fff8f6" },
];

const PAYMENT_METHOD_OPTIONS = [
  { id: "cash", label: "Dinheiro", Icon: Banknote },
  { id: "pix", label: "Pix", Icon: Smartphone },
  { id: "debit_card", label: "Debito", Icon: CreditCard },
  { id: "credit_card", label: "Credito", Icon: CreditCard },
] as const;

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
    payment_methods?: Record<string, DailySalesPayment>;
  };
  orders?: DailySalesOrder[];
  top_products?: DailySalesProduct[];
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit_card: "Cartao debito",
  credit_card: "Cartao credito",
};

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
  const [productFilter, setProductFilter] = useState("Todos");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalMode, setProductModalMode] = useState<"stock" | "menu">("stock");

  // --- Umbrellas State ---
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [showAddUmbrella, setShowAddUmbrella] = useState(false);
  const [newUmbrellaNumber, setNewUmbrellaNumber] = useState("");

  // --- Reports State ---
  const [reportPeriod, setReportPeriod] = useState("month");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [closingMessage, setClosingMessage] = useState("");

  // --- Customers State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [team, setTeam] = useState<VendorUser[]>([]);
  const [teamForm, setTeamForm] = useState({
    name: "", email: "", login: "", role: "seller", password: "", password_confirm: "",
  });
  const [teamMessage, setTeamMessage] = useState("");
  const [themeForm, setThemeForm] = useState<KioskTheme>(DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeUploading, setThemeUploading] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const knownOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

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
    playToneSequence([
      { frequency: 880, start: 0, duration: 0.12 },
      { frequency: 1175, start: 0.14, duration: 0.18 },
    ]);
  };

  const playCashRegisterSound = () => {
    playToneSequence([
      { frequency: 1046, start: 0, duration: 0.08, type: "triangle" },
      { frequency: 1318, start: 0.08, duration: 0.08, type: "triangle" },
      { frequency: 1568, start: 0.17, duration: 0.18, type: "square" },
      { frequency: 784, start: 0.38, duration: 0.14, type: "triangle" },
    ]);
  };

  const playWaiterCallSound = () => {
    playToneSequence([
      { frequency: 740, start: 0, duration: 0.1, type: "square" },
      { frequency: 740, start: 0.16, duration: 0.1, type: "square" },
      { frequency: 988, start: 0.32, duration: 0.16, type: "triangle" },
    ]);
  };

  // Data loading functions
  const loadOrders = async (vid: string) => {
    try {
      const res = await fetch(`/api/orders?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        const nextStatusMap = new Map<string, string>();
        let hasNewOrder = false;
        let hasNewClosingRequest = false;
        let hasNewWaiterCall = false;
        data.forEach((order: Order) => {
          const currentSignature = `${order.status}:${getServiceRequest(order)?.marker || "normal"}:${order.notes || ""}`;
          const previousStatus = knownOrderStatusesRef.current.get(order.id);
          nextStatusMap.set(order.id, currentSignature);
          if (!previousStatus && order.status === "received") hasNewOrder = true;
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
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
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

  // Load vendor ID and initial data
  useEffect(() => {
    const vid = sessionStorage.getItem("vendor_id");
    if (vid) {
      setVendorId(vid);
      // Load initial data
      loadOrders(vid);
      loadProducts(vid);
      loadUmbrellas(vid);
      loadCustomers(vid);
      loadTeam(vid);
      loadTheme(vid);
    }
  }, []);

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
        setThemeMessage(data.error || "Nao foi possivel salvar a personalizacao.");
        return;
      }
      setThemeForm(buildThemeForm(data));
      setThemeMessage(activeTab === "payments"
        ? "Formas de pagamento salvas para este quiosque."
        : "Personalizacao salva. O login do cliente e os QRs ja usam essas cores.");
    } catch {
      setThemeMessage("Erro de rede ao salvar personalizacao.");
    } finally {
      setThemeSaving(false);
    }
  };

  const uploadThemeLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !vendorId) return;
    setThemeUploading(true);
    setThemeMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/vendors/${vendorId}/theme/logo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setThemeMessage(data.error || "Nao foi possivel enviar a logo.");
        return;
      }
      setThemeForm(prev => ({ ...prev, logo_url: data.logo_url || prev.logo_url }));
      setThemeMessage("Logo enviada e salva no quiosque.");
    } catch {
      setThemeMessage("Erro de rede ao enviar a logo.");
    } finally {
      setThemeUploading(false);
    }
  };

  useEffect(() => {
    if (!vendorId) return;
    const timer = window.setInterval(() => {
      loadOrders(vendorId);
      loadUmbrellas(vendorId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [vendorId]);

  useEffect(() => {
    const unlockAudio = () => {
      const audio = getAudioContext();
      audio?.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const createTeamUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vendorId) return;
    setTeamMessage("");
    if (teamForm.password !== teamForm.password_confirm) {
      setTeamMessage("A senha e a confirmacao nao conferem.");
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
        setTeamMessage(data.error || "Nao foi possivel criar usuario.");
        return;
      }
      setTeam(prev => [data, ...prev]);
      setTeamForm({ name: "", email: "", login: "", role: "seller", password: "", password_confirm: "" });
      setTeamMessage("Usuario criado. Ele ja pode entrar no painel pelo login e senha definidos.");
    } catch {
      setTeamMessage("Erro de rede ao criar usuario.");
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
    }
  }, [activeTab, reportPeriod, vendorId]);

  // Order management
  const moveOrder = async (id: string, newStatus: string) => {
    const currentOrder = orders.find(order => order.id === id);
    if (currentOrder && isOrderEmpty(currentOrder) && ['preparing', 'delivering', 'completed', 'closing_requested'].includes(newStatus)) {
      alert('Comanda vazia nao pode ir para preparo, entrega ou fechamento. Use "Liberar guarda-sol vazio".');
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

  const closeBusinessDay = async () => {
    if (!vendorId) return;
    const today = new Date().toISOString().split("T")[0];
    const confirmed = confirm("Fechar o dia agora? As vendas pagas de hoje serao consolidadas para relatorios.");
    if (!confirmed) return;

    setClosingDay(true);
    setClosingMessage("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, date: today }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClosingMessage(data.error || "Erro ao fechar o dia.");
        return;
      }
      setClosingMessage(`${data.message} Pedidos: ${data.report?.summary?.total_orders || 0} - Total: ${formatCurrency(Number(data.report?.summary?.total_revenue || 0))}`);
      fetch(`/api/reports?vendor_id=${vendorId}&period=${reportPeriod}`)
        .then(r => r.json())
        .then(d => setReportData(d))
        .catch(() => undefined);
    } catch (err) {
      console.error("Close business day error:", err);
      setClosingMessage("Erro de rede ao fechar o dia.");
    } finally {
      setClosingDay(false);
    }
  };

  const exportTodaySalesPdf = async () => {
    if (!vendorId) return;
    const today = new Date().toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/daily-report?vendor_id=${vendorId}&date=${today}`);
      const report = (await res.json()) as DailySalesReport;
      if (!res.ok) {
        alert(report.error || "Nao foi possivel exportar as vendas do dia.");
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
              body { margin: 0; padding: 28px; color: #241711; font-family: Arial, sans-serif; background: #fffaf7; }
              header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #ff6b00; padding-bottom: 18px; margin-bottom: 22px; }
              h1 { margin: 0; font-size: 28px; }
              h2 { margin: 28px 0 10px; font-size: 17px; color: #8a2f00; }
              p { margin: 4px 0; color: #6b5147; }
              .brand { text-align: right; font-weight: 800; color: #ff6b00; }
              .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
              .kpi { border: 1px solid #f0d2c4; border-radius: 10px; background: #fff; padding: 12px; }
              .kpi span { display: block; color: #7a6258; font-size: 11px; font-weight: 800; text-transform: uppercase; }
              .kpi strong { display: block; margin-top: 6px; font-size: 20px; }
              table { width: 100%; border-collapse: collapse; background: #fff; }
              th, td { border: 1px solid #ead7cc; padding: 8px; text-align: left; font-size: 12px; }
              th { background: #ffefe6; color: #572000; font-size: 11px; text-transform: uppercase; }
              footer { margin-top: 28px; color: #8a746a; font-size: 11px; text-align: center; }
              @media print { body { background: #fff; padding: 18px; } .kpis { break-inside: avoid; } }
            </style>
          </head>
          <body>
            <header>
              <div>
                <h1>Vendas do dia</h1>
                <p>${formatReportDate(today)}</p>
              </div>
              <div class="brand">SandExpress<br />Relatorio operacional</div>
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
            <footer>Relatorio gerado pelo SandExpress.</footer>
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
    } catch (err) {
      console.error('Save product error:', err);
      alert('Erro de rede ao salvar produto.');
    }
  };

  // Umbrella management
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
      const res = await fetch(`/api/qr?umbrella_id=${encodeURIComponent(umbrella.id)}&format=png`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Nao foi possivel gerar o QR Code.");
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
      return alert('Nao e possivel excluir guarda-sol com conta aberta.');
    }

    const confirmed = confirm(`Excluir definitivamente o guarda-sol ${umbrella.number}? Esta acao remove o QR gravado no banco.`);
    if (!confirmed) return;

    const vendorPassword = prompt('Digite a senha do admin do quiosque para confirmar a exclusao');
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

  const confirmAccountPaid = async (order: Order, paymentMethod: string) => {
    if (!vendorId) return;
    const label = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;
    const confirmed = confirm(`Confirmar pagamento da conta do guarda-sol ${order.umbrella} em ${label}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/close-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          umbrella_id: order.umbrella_id,
          payment_method: paymentMethod,
          notes: order.notes || 'Conta paga no Kanban',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Nao foi possivel confirmar o pagamento.');
        return;
      }
      setOrders(prev => prev.filter(o => o.id !== order.id));
      setUmbrellas(prev => prev.map(u => u.id === order.umbrella_id ? { ...u, is_occupied: false, current_order_id: null } : u));
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
        alert(data.error || 'Nao foi possivel cancelar o item.');
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
        alert(data.error || 'Nao foi possivel liberar o guarda-sol.');
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
        alert("Nao foi possivel marcar o garcom como atendido.");
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
  const filteredProducts = productFilter === "Todos" ? products : products.filter(p => p.category === productFilter);
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

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
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{colOrders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar">
          {colOrders.map(order => {
            const emptyAccount = isOrderEmpty(order);
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={cn(
                  "w-full bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-left transition-all hover:border-[#FF6B00] hover:shadow-md",
                  options.pulse && "animate-pulse border-[#ff6b00] bg-[#fff8f6] shadow-md",
                  getServiceRequest(order) && "border-red-300 bg-red-50 shadow-md ring-2 ring-red-200"
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

  const renderBeachMap = () => {
    const activeAccounts = orders.filter(order => !order.paid).length;
    const occupiedUmbrellas = umbrellas.filter(umbrella => umbrella.is_occupied || umbrella.current_order_id).length;
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-black text-gray-900">Mapa da praia</h3>
            <p className="text-xs font-bold text-gray-400">{occupiedUmbrellas} ocupados · {activeAccounts} contas abertas</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Livre</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#FF6B00]" />Ocupado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Conta</span>
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
            return (
              <button
                key={umbrella.id}
                onClick={() => order ? setSelectedOrder(order) : undefined}
                className={cn(
                  "relative aspect-square min-h-12 rounded-xl border text-sm font-black transition-all",
                  !umbrella.active && "border-gray-200 bg-gray-100 text-gray-300",
                  umbrella.active && !occupied && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                  umbrella.active && occupied && !closing && "border-orange-200 bg-orange-50 text-[#FF6B00] hover:bg-orange-100",
                  umbrella.active && closing && "border-orange-300 bg-orange-500 text-white hover:bg-orange-600",
                  umbrella.active && serviceRequest && "animate-pulse border-red-500 bg-red-600 text-white shadow-lg ring-4 ring-red-200"
                )}
                title={serviceRequest ? `${serviceRequest.label} - guarda-sol ${umbrella.number}` : order ? `${order.customer} - ${formatCurrency(order.total)}` : umbrella.label}
              >
                <span className="flex h-full min-w-0 flex-col items-center justify-center px-1 leading-tight">
                  <span>{umbrella.number}</span>
                  {firstCustomerName && (
                    <span className="mt-0.5 max-w-full truncate text-[10px] font-black opacity-80">
                      {firstCustomerName}
                    </span>
                  )}
                  {firstCustomerName && accountTotal && (
                    <span className="mt-0.5 max-w-full truncate text-[9px] font-black opacity-90">
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
    <div className="vendor-ops-shell min-h-app bg-white flex flex-col lg:flex-row font-sans">
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
          <div className="flex items-center gap-4">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Quiosque Aberto
            </span>
          </div>
        </header>

        {/* Tab Contents */}
          <div className="flex-1 overflow-auto bg-gray-50 p-3 pb-[calc(100px+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-6">

          {/* ========== ABA 1: PEDIDOS (KANBAN) ========== */}
          {activeTab === "orders" && (
            <div className="space-y-4">
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
                setProductModalMode("stock");
                setShowProductModal(true);
              }}
              onDeleteProduct={deleteProduct}
            />
          )}


          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Cardapio do cliente</h3>
                    <p className="text-gray-500 text-sm">{products.length} itens cadastrados · {products.filter(p => p.active).length} ativos</p>
                  </div>
                  <p className="rounded-xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">
                    Cadastro e estoque ficam na aba Estoque
                  </p>
                </div>

                {/* Category filter */}
                <div className="flex gap-2 overflow-x-auto mb-6 hide-scrollbar">
                  {["Todos", ...CATEGORIES].map(c => (
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
                        <th className="p-3">Promocao/Combo</th>
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
                                <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.is_combo ? "Combo" : p.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-gray-900">{formatCurrency(p.price)}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-black", p.promotional_price ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500")}>
                                {p.promotional_price ? formatCurrency(p.promotional_price) : "Sem promocao"}
                              </span>
                              {p.is_combo && (
                                <span className="w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">Combo</span>
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
                                  setProductModalMode("menu");
                                  setShowProductModal(true);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                                title="Alterar preco, promocao e combo"
                              >
                                <Pencil size={16} />
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
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Guarda-Sóis</h3>
                    <p className="text-gray-500 text-sm">{umbrellas.length} cadastrados · {umbrellas.filter(u => u.active).length} ativos</p>
                  </div>
                  <button
                    onClick={() => setShowAddUmbrella(true)}
                    className="bg-[#FF6B00] text-white px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 hover:bg-[#E56000] active:scale-95 transition-all"
                  >
                    <Plus size={20} /> Adicionar Barraca
                  </button>
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
                            download={`qr-barraca-${u.number}.png`}
                            className="flex items-center gap-1 text-sm font-bold text-[#FF6B00] hover:underline"
                          >
                            <Download size={14} /> Baixar PNG
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
                    <span className="text-sm font-black text-gray-700">Cor do botao</span>
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
                    <span className="text-sm font-black text-gray-700">Texto do botao</span>
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

                <div className="mt-5 rounded-2xl border border-dashed border-[#e2bfb0] bg-[#fff8f6] p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e2bfb0] bg-white shadow-sm">
                      {themeForm.logo_url ? (
                        <img src={themeForm.logo_url} alt="Logo do quiosque" className="h-full w-full object-contain p-3" />
                      ) : (
                        <Upload className="text-[#82533f]" size={30} />
                      )}
                    </div>
                    <label className="min-w-0 flex-1 space-y-2">
                      <span className="text-sm font-black text-gray-700">Logo do quiosque</span>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[#E56000]">
                        <Upload size={18} />
                        {themeUploading ? "Enviando logo..." : "Subir logo do quiosque"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={uploadThemeLogo}
                          disabled={themeUploading}
                        />
                      </label>
                      <input
                        value={themeForm.logo_url}
                        onChange={(event) => setThemeForm(prev => ({ ...prev, logo_url: event.target.value }))}
                        placeholder="/sandexpress-logo-fluid.png ou https://..."
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#ff6b00]"
                      />
                      <span className="block text-xs font-semibold text-gray-500">Tambem e possivel colar uma URL manualmente.</span>
                    </label>
                  </div>
                </div>

                {themeMessage && (
                  <p className="mt-5 rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#572000]">{themeMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={themeSaving}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
                  style={{ backgroundColor: themeForm.button_color, color: themeForm.button_text_color }}
                >
                  <Palette size={18} /> {themeSaving ? "Salvando..." : "Salvar personalizacao"}
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
                  <p className="text-sm font-semibold text-white/80">Login, cardapio e botoes do QR.</p>
                </div>
                <div className="space-y-4 bg-[#fff8f6] p-6">
                  <div className="rounded-xl border border-[#e2bfb0] bg-white p-4">
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
                  <p className="mt-4 rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#572000]">{themeMessage}</p>
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
            <div className="space-y-6">
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#FFF2E5] text-[#FF6B00] flex items-center justify-center shrink-0">
                    <CalendarCheck size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-lg">Fechamento do Dia</h3>
                    <p className="text-sm text-gray-500 max-w-2xl">
                      Consolida as vendas completadas e pagas de hoje em um registro fixo para relatorios,
                      auditoria e comparacao futura.
                    </p>
                    {closingMessage && (
                      <p className={cn(
                        "mt-3 rounded-lg px-3 py-2 text-sm font-bold",
                        closingMessage.startsWith("Erro") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                      )}>
                        {closingMessage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={exportTodaySalesPdf}
                    className="border-2 border-[#FF6B00] bg-white px-5 py-3 rounded-xl font-bold text-[#FF6B00] flex items-center justify-center gap-2 hover:bg-[#FFF2E5]"
                  >
                    <Download size={18} />
                    Exportar vendas do dia
                  </button>
                  <button
                    onClick={closeBusinessDay}
                    disabled={closingDay}
                    className="bg-[#394E59] hover:bg-[#263640] text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CalendarCheck size={18} />
                    {closingDay ? "Fechando..." : "Fechar dia"}
                  </button>
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
                      <p className="text-2xl font-display font-bold text-gray-900">{reportData.daily_summary.available_products}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Guarda-sóis ativos</p>
                      <p className="text-2xl font-display font-bold text-green-600">{reportData.daily_summary.active_umbrellas}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Pedidos hoje</p>
                      <p className="text-2xl font-display font-bold text-[#FF6B00]">{reportData.daily_summary.today_orders}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Receita hoje</p>
                      <p className="text-2xl font-display font-bold text-blue-600">{formatCurrency(reportData.daily_summary.today_revenue)}</p>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-gray-400 text-sm font-bold mb-1">Clientes novos hoje</p>
                      <p className="text-2xl font-display font-bold text-purple-600">{reportData.daily_summary.new_customers_today}</p>
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Faturamento</p>
                      <p className="text-3xl font-display font-bold text-gray-900">{formatCurrency(reportData.kpis.total_revenue)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Pedidos</p>
                      <p className="text-3xl font-display font-bold text-[#FF6B00]">{reportData.kpis.total_orders}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Ticket Médio</p>
                      <p className="text-3xl font-display font-bold text-gray-900">{formatCurrency(reportData.kpis.avg_ticket)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Clientes Únicos</p>
                      <p className="text-3xl font-display font-bold text-green-600">{reportData.kpis.unique_customers}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-400 text-sm font-bold mb-1">Satisfacao</p>
                      <p className="text-3xl font-display font-bold text-amber-500 flex items-center gap-2">
                        <Star size={24} fill="currentColor" />
                        {reportData.satisfaction?.average_rating || 0}
                      </p>
                      <p className="text-xs text-gray-400 font-bold">{reportData.satisfaction?.total_responses || 0} respostas</p>
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-[#FF6B00]" /> Meios de recebimento</h4>
                      <div className="space-y-3">
                        {Object.entries(reportData.payment_methods || {}).length === 0 ? (
                          <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-400">Nenhuma conta paga no periodo.</p>
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
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Star size={18} className="text-[#FF6B00]" fill="currentColor" /> Pesquisa de Satisfacao</h4>
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
                      <div className="flex items-end gap-2 h-40">
                        {reportData.hourly_sales.map((h, i) => {
                          const maxOrders = Math.max(...reportData.hourly_sales.map(s => s.orders));
                          const height = maxOrders > 0 ? (h.orders / maxOrders) * 100 : 0;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] text-gray-400 font-bold">{h.orders}</span>
                              <div
                                className="w-full bg-gradient-to-t from-[#FF6B00] to-[#FF9B50] rounded-t-md transition-all"
                                style={{ height: `${height}%`, minHeight: 4 }}
                              />
                              <span className="text-[10px] text-gray-400">{h.hour}</span>
                            </div>
                          );
                        })}
                      </div>
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
                        <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-400">Nenhum recebivel no periodo.</p>
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
              <form onSubmit={createTeamUser} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Criar usuario do quiosque</h3>
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
                  placeholder="Login do usuario"
                  value={teamForm.login}
                  onChange={e => setTeamForm(p => ({ ...p, login: e.target.value.trim() }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                />
                <select
                  value={teamForm.role}
                  onChange={e => setTeamForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                >
                  <option value="seller">Vendedor</option>
                  <option value="manager">Gerente</option>
                  <option value="owner">Proprietario</option>
                </select>
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
                {teamMessage && <p className="rounded-xl bg-[#fff8f6] p-3 text-sm font-bold text-[#572000]">{teamMessage}</p>}
                <button type="submit" className="w-full rounded-xl bg-[#FF6B00] py-3 font-black text-white hover:bg-[#E56000]">
                  Criar usuario
                </button>
              </form>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-4">Usuarios cadastrados</h3>
                <div className="space-y-3">
                  {team.map(user => (
                    <div key={user.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div>
                        <p className="font-bold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">Login: {user.login} {user.email ? `- ${user.email}` : ""}</p>
                      </div>
                      <span className="rounded-full bg-[#ffeae1] px-3 py-1 text-xs font-black text-[#a04100]">
                        {user.role === 'manager' ? 'Gerente' : user.role === 'owner' ? 'Proprietario' : 'Vendedor'}
                      </span>
                    </div>
                  ))}
                  {team.length === 0 && (
                    <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Nenhum usuario criado ainda.</p>
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
          product={editingProduct}
          vendorId={vendorId}
          mode={productModalMode}
          onSave={saveProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); setProductModalMode("stock"); }}
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
        />
      )}

      {payingOrder && (
        <PaymentMethodModal
          order={payingOrder}
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
function OrderModal({
  order,
  onClose,
  onMove,
  onPaid,
  onReleaseEmpty,
  onWaiterDone,
  onCancelItem,
}: {
  order: Order;
  onClose: () => void;
  onMove: (id: string, status: string) => Promise<void>;
  onPaid: (order: Order) => Promise<void>;
  onReleaseEmpty: (order: Order) => Promise<void>;
  onWaiterDone: (order: Order) => Promise<void>;
  onCancelItem: (order: Order, item: OrderItem) => Promise<void>;
}) {
  const serviceRequest = getServiceRequest(order);
  const emptyAccount = isOrderEmpty(order);
  const visibleItems = getVisibleConsumptionItems(order, Boolean(order.active_request));
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
              Esta comanda esta sem consumo. Para nao enviar para preparo ou fechamento, libere o guarda-sol vazio.
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
          {getVisibleOrderNotes(order.notes) && (
            <div className="whitespace-pre-line rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-700">
              {getVisibleOrderNotes(order.notes)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 p-4 sm:flex-row sm:p-6">
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

function PaymentMethodModal({
  order,
  settings,
  onClose,
  onConfirm,
}: {
  order: Order;
  settings: KioskTheme;
  onClose: () => void;
  onConfirm: (order: Order, paymentMethod: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const activePaymentOptions = PAYMENT_METHOD_OPTIONS.filter(({ id }) => settings[`${id}_active` as keyof KioskTheme] !== false);

  const handleConfirm = async (paymentMethod: string) => {
    setSubmitting(true);
    try {
      await onConfirm(order, paymentMethod);
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
            <h3 className="text-xl font-display font-bold text-gray-900">Conta paga</h3>
            <p className="mt-1 text-sm font-bold text-gray-500">{order.customer} - {formatCurrency(order.total)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {activePaymentOptions.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              disabled={submitting}
              onClick={() => handleConfirm(id)}
              className="min-h-24 rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-left transition hover:border-[#FF6B00] hover:bg-[#FFF2E5] disabled:opacity-50"
            >
              <Icon className="mb-3 text-[#FF6B00]" size={24} />
              <span className="block font-black text-gray-900">{label}</span>
            </button>
          ))}
        </div>
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
  onSave,
  onClose,
}: {
  product: Product | null;
  vendorId: string | null;
  mode?: "stock" | "menu";
  onSave: (p: Product) => Promise<void> | void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(product || {
    id: "", name: "", category: "Bebidas", price: 0, promotional_price: null,
    description: "", image_url: "", active: true, is_combo: false, stock_tracking_enabled: false,
    stock_quantity: null, physical_stock_quantity: 0, beach_stock_quantity: 0, blocked_by_stock: false,
    sort_order: 99,
  });
  const [uploading, setUploading] = useState(false);
  const [defaultImages, setDefaultImages] = useState<Array<{ id: string; name: string; image_url: string; category: string }>>([]);
  const isMenuMode = mode === "menu";

  useEffect(() => {
    if (isMenuMode) return;
    let cancelled = false;
    async function loadDefaultImages() {
      try {
        const res = await fetch(`/api/products/gallery?category=${encodeURIComponent(form.category)}&planType=free`);
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
  }, [form.category, isMenuMode]);

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
          <h3 className="text-xl font-display font-bold">{isMenuMode ? "Alterar cardapio" : product ? "Editar Produto" : "Novo Produto"}</h3>
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
          {/* Image upload */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Foto do Produto</label>
            <label className="cursor-pointer block">
              <div className="w-full h-40 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center hover:border-[#FF6B00] transition-colors overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                ) : uploading ? (
                  <div className="w-8 h-8 border-4 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={24} className="text-gray-300 mb-2" />
                    <span className="text-sm text-gray-400">Clique para enviar foto</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {defaultImages.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Imagens padrao</p>
                <div className="grid grid-cols-4 gap-2">
                  {defaultImages.slice(0, 8).map((image) => (
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
                value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_combo}
                onChange={e => setForm(prev => ({ ...prev, is_combo: e.target.checked }))}
                className="w-5 h-5 accent-[#FF6B00]"
              />
              <span className="text-sm font-bold text-gray-700">É um combo?</span>
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
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#e2bfb0] bg-[#fff8f6] p-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e2bfb0] bg-white p-3">
                <label className="block text-sm font-black text-[#3d1a0a] mb-1">Estoque central</label>
                <input
                  type="number"
                  min="0"
                  value={form.physical_stock_quantity || ""}
                  onChange={e => setForm(prev => ({ ...prev, physical_stock_quantity: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="w-full border-2 border-[#e2bfb0] rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-[#fff8f6] font-black text-[#3d1a0a]"
                  placeholder="Ex: 80"
                />
              </div>
              <div className="rounded-xl border border-[#ffb693] bg-[#fff1eb] p-3">
                <label className="block text-sm font-black text-[#a04100] mb-1">Estoque praia</label>
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
                  className="w-full border-2 border-[#ffb693] rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white font-black text-[#572000]"
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
            onClick={() => { if (form.name && form.price) onSave(form); }}
            className="flex-1 py-3 bg-[#FF6B00] text-white rounded-xl font-bold hover:bg-[#E56000] active:scale-95 transition-all"
          >
            {isMenuMode ? "Salvar cardapio" : product ? "Salvar alteracoes" : "Adicionar Produto"}
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
