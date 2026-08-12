"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, Clock, Trash2, Pencil, X, Upload,
  Eye, EyeOff, LogOut, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu, PackageCheck, Banknote, Smartphone, CreditCard,
  Printer,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
import PrinterManager, { printRoutedOrder } from "@/components/vendor/PrinterManager";
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
  logo_url: "/logo-sandexpress.png",
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
  { name: "Laranja SandExpress", value: "#ff6b00" },
  { name: "Laranja forte", value: "#a04100" },
  { name: "Marrom praia", value: "#82533f" },
  { name: "Cacau", value: "#3d1a0a" },
  { name: "Areia", value: "#f8ddd2" },
  { name: "Creme", value: "#fff8f6" },
  { name: "Verde livre", value: "#15803d" },
  { name: "Azul mar", value: "#0f6b78" },
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  debit_card: "Cartao debito",
  credit_card: "Cartao credito",
};

const TABS = [
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "stock", label: "Estoque", icon: PackageCheck },
  { id: "menu", label: "CardÃ¡pio", icon: Utensils },
  { id: "qr", label: "Guarda-SÃ³is", icon: QrCode },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "reports", label: "RelatÃ³rios", icon: BarChart3 },
  { id: "theme", label: "Personalizacao", icon: Palette },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "team", label: "Equipe", icon: Users },
  { id: "printers", label: "Impressoras", icon: Printer },
];

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function VendorDashboard() {
  const pathname = usePathname();
  const isBeachOperations = pathname.startsWith("/vendor/operations");
  const visibleTabs = isBeachOperations ? TABS.filter(tab => ["orders", "stock", "reports", "printers"].includes(tab.id)) : TABS;
  const [activeTab, setActiveTab] = useState("orders");
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [beachAccess, setBeachAccess] = useState<boolean | null>(isBeachOperations ? null : true);
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
    if (!auß½tæÚ$z{-®éÜj×–ç6WBÓ&rÖ&Æ6²óS¢ÓSfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"ÓB"öä6Æ–6³×¶öä6Æ÷6WÓàĞ¢ÆF—b6Æ74æÖSÒ&&r×v†—FR&÷VæFVBÓ'†ÂÖ‚×rÖÆrrÖgVÆÂÖ‚Ö‚Õ³“f…Ò÷fW&fÆ÷r×’ÖWFò6†F÷rÓ'†Â"öä6Æ–6³×¶RÓâRç7F÷&÷vF–öâ‚—ÓàĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2Ö6VçFW"Ób&÷&FW"Ö"&÷&FW"Öw&’Ó#àĞ¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆB#ç¶—4ÖVçTÖöFRò$ÇFW&"6&F–ò"¢&öGV7Bò$VF—F"&öGWFò"¢$æ÷fò&öGWFò'ÓÂöƒ3àĞ¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ'FW‡BÖw&’ÓC†÷fW#§FW‡BÖw&’Óc#ãÅ‚6—¦S×³#GÒóãÂö'WGFöãàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'Ób76R×’ÓB#àĞ¢¶—4ÖVçTÖöFRbb€Ğ¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Ó#&rÖw&’ÓSÓB#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2föçBÖ&Æ6²WW&66RFW‡BÖw&’ÓS#å&öGWFóÂ÷àĞ¢Ç6Æ74æÖSÒ&×BÓföçBÖ&Æ6²FW‡BÖw&’Ó“#ç¶f÷&ÒææÖWÓÂ÷àĞ¢Ç6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓS#ç¶f÷&Òæ6FVv÷'—ÓÂ÷àĞ¢ÂöF—càĞ¢—ĞĞ¢²—4ÖVçTÖöFRbb€Ğ¢ÃàĞ¢²ò¢–ÖvRWÆöB¢÷ĞĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó"#äf÷FòFò&öGWFóÂöÆ&VÃàĞ¢ÆÆ&VÂ6Æ74æÖSÒ&7W'6÷"×ö–çFW"&Æö6²#àĞ¢ÆF—b6Æ74æÖSÒ'rÖgVÆÂ‚ÓC&÷&FW"Ó"&÷&FW"ÖF6†VB&÷&FW"Öw&’Ó#&÷VæFVB×†ÂfÆW‚fÆW‚Ö6öÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"†÷fW#¦&÷&FW"Õ²4dcd#ÒG&ç6—F–öâÖ6öÆ÷'2÷fW&fÆ÷rÖ†–FFVâ#àĞ¢¶f÷&Òæ–ÖvU÷W&Âò€Ğ¢Æ–Ör7&3×¶f÷&Òæ–ÖvU÷W&ÇÒÇCÒ""6Æ74æÖSÒ'rÖgVÆÂ‚ÖgVÆÂö&¦V7BÖ6÷fW""óàĞ¢’¢WÆöF–ærò€Ğ¢ÆF—b6Æ74æÖSÒ'rÓ‚‚Ó‚&÷&FW"ÓB&÷&FW"Õ²4dcd#Ò&÷&FW"×B×G&ç7&VçB&÷VæFVBÖgVÆÂæ–ÖFR×7–â"óàĞ¢’¢€Ğ¢ÃàĞ¢ÅWÆöB6—¦S×³#GÒ6Æ74æÖSÒ'FW‡BÖw&’Ó3Ö"Ó""óàĞ¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓC#ä6Æ—VR&Vçf–"f÷FóÂ÷7ãàĞ¢ÂóàĞ¢—ĞĞ¢ÂöF—càĞ¢Æ–çWBG—SÒ&f–ÆR"66WCÒ&–ÖvRò¢"6Æ74æÖSÒ&†–FFVâ"öä6†ævS×¶†æFÆT–ÖvUWÆöGÒóàĞ¢ÂöÆ&VÃàĞ¢¶–ÖvTÖW76vRbbÇ&öÆSÒ'7FGW2"6Æ74æÖSÒ&×BÓ"&÷VæFVBÖÆr&rÖ÷&ævRÓSÓ"FW‡B×6ÒföçBÖ&öÆBFW‡BÖ÷&ævRÓƒ#ç¶–ÖvTÖW76vWÓÂ÷çĞ¢¶FVfVÇD–ÖvW2æÆVæwF‚âbb€¢ÆF—b6Æ74æÖSÒ&×BÓ2#à¢ÆÆ&VÂ6Æ74æÖSÒ&Ö"Ó"&Æö6²FW‡B×‡2föçBÖ&Æ6²WW&66RG&6¶–ær×v–FRFW‡BÖw&’ÓS"‡FÖÄf÷#Ò'&öGV7BÖ–ÖvR×6V&6‚#ä'W66"ævÆW&–vW&ÃÂöÆ&VÃà¢ÆF—b6Æ74æÖSÒ'&VÆF—fRÖ"Ó2#à¢Å6V&6‚&–Ö†–FFVãÒ'G'VR"6—¦S×³wÒ6Æ74æÖSÒ&'6öÇWFRÆVgBÓ2F÷Óó"×G&ç6ÆFR×’Óó"FW‡BÖw&’ÓC"óà¢Æ–çWB–CÒ'&öGV7BÖ–ÖvR×6V&6‚"G—SÒ'6V&6‚"fÇVS×¶–ÖvU6V&6‡Òöä6†ævS×¶WfVçBÓâ6WD–ÖvU6V&6‚†WfVçBçF&vWBçfÇVR—ÒÆ6V†öÆFW#Ò$æöÖRÂ&öGWFò÷R6FVv÷&–"6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"Ó"&÷&FW"Öw&’Ó#’Ó"ÂÓ"Ó2÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Õ²4dcd#Ò"óà¢ÂöF—cà¢Ç6Æ74æÖSÒ&Ö"Ó"FW‡B×‡2föçBÖ&öÆBFW‡BÖw&’ÓS#ç·f—6–&ÆT–ÖvW2æÆVæwF‡ÒÖ–æ–GW&‡2’F—7öæ—fVÂ†—2“Â÷à¢ÆF—b6Æ74æÖSÒ&w&–BÖ‚Ö‚Ós"w&–BÖ6öÇ2Ó2vÓ"÷fW&fÆ÷r×’ÖWFò"Ó6Ó¦w&–BÖ6öÇ2ÓB#à¢·f—6–&ÆT–ÖvW2æÖ‚†–ÖvR’Óâ€¢Æ'WGFöà¢¶W“×¶–ÖvRæ–GĞĞ¢G—SÒ&'WGFöâ ¢F—FÆS×¶–ÖvRææÖWĞ¢&–×&W76VC×¶f÷&Òæ–ÖvU÷W&ÂÓÓÒ–ÖvRæ–ÖvU÷W&ÇĞ¢öä6Æ–6³×²‚’Óâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ–ÖvU÷W&Ã¢–ÖvRæ–ÖvU÷W&ÂÒ’—Ğ¢6Æ74æÖS×¶6â€¢&7V7B×7V&R÷fW&fÆ÷rÖ†–FFVâ&÷VæFVBÖÆr&÷&FW"Ó"&rÖw&’ÓSfö7W3¦÷WFÆ–æRÖæöæRfö7W3§&–ærÓ"fö7W3§&–ærÕ²4dcd#Ò"À¢f÷&Òæ–ÖvU÷W&ÂÓÓÒ–ÖvRæ–ÖvU÷W&Âò&&÷&FW"Õ²4dcd#Ò"¢&&÷&FW"Öw&’Ó# Ğ¢—ĞĞ¢àĞ¢Æ–Ör7&3×¶–ÖvRæ–ÖvU÷W&ÇÒÇC×¶–ÖvRææÖWÒÆöF–æsÒ&Æ§’"FV6öF–æsÒ&7–æ2"6Æ74æÖSÒ&‚ÖgVÆÂrÖgVÆÂö&¦V7BÖ6÷fW""óà¢Âö'WGFöãà¢’—Ğ¢ÂöF—cà¢·f—6–&ÆT–ÖvW2æÆVæwF‚ÓÓÒbbÇ6Æ74æÖSÒ'&÷VæFVBÖÆr&rÖw&’ÓSÓ2FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓS#äæVæ‡VÖ–ÖvVÒVæ6öçG&FâFVçFR÷WG&òFW&Öò÷RVçf–RVÖæ÷f–ÖvVÒãÂ÷çĞ¢ÂöF—cà¢—Ğ¢ÂöF—càĞ Ğ¢²ò¢æÖR¢÷ĞĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#äæöÖR£ÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ'FW‡B"&WV—&V@Ğ¢fÇVS×¶f÷&ÒææÖWÒöä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂæÖS¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR Ğ¢Æ6V†öÆFW#Ò$Wƒ¢6W'fV¦†V–æV¶VâcÖÂ Ğ¢óàĞ¢ÂöF—càĞ Ğ¢²ò¢FW67&—F–öâ¢÷ĞĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#äFW67&œ:|:6óÂöÆ&VÃàĞ¢ÇFW‡F&VĞ¢fÇVS×¶f÷&ÒæFW67&—F–öçÒöä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂFW67&—F–öã¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR Ğ¢&÷w3×³'ĞĞ¢Æ6V†öÆFW#Ò$FW67&Wfò&öGWFòâââ Ğ¢óàĞ¢ÂöF—càĞ Ğ¢ÂóàĞ¢—ĞĞ Ğ¢²ò¢&–6R&÷r¢÷ĞĞ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓB#àĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#å&\:vòæ÷&ÖÂ£ÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ&çVÖ&W""7FWÒ#ã"&WV—&V@Ğ¢fÇVS×¶f÷&Òç&–6RÇÂ"'Òöä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ&–6S¢'6TfÆöB†RçF&vWBçfÇVR’ÇÂÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR Ğ¢Æ6V†öÆFW#Ò%"BÃ Ğ¢óàĞ¢ÂöF—càĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#å&\:vò&öÖö6–öæÃÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ&çVÖ&W""7FWÒ#ã Ğ¢fÇVS×¶f÷&Òç&öÖ÷F–öæÅ÷&–6RÇÂ"'Òöä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ&öÖ÷F–öæÅ÷&–6S¢'6TfÆöB†RçF&vWBçfÇVR’ÇÂçVÆÂÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR Ğ¢Æ6V†öÆFW#Ò$÷6–öæÂ Ğ¢óàĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢²—4ÖVçTÖöFRbb€Ğ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#ä6FVv÷&–ÂöÆ&VÃàĞ¢Ç6VÆV7@Ğ¢fÇVS×¶f÷&Òæ6FVv÷'—Òöä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ6FVv÷'“¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&r×v†—FR Ğ¢àĞ¢´4DTtõ$”U2æÖ†2ÓâÆ÷F–öâ¶W“×¶7ÒfÇVS×¶7Óç¶7ÓÂö÷F–öãâ—ĞĞ¢Â÷6VÆV7CàĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢²ò¢FövvÆW2¢÷ĞĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚×w&vÓb#àĞ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#àĞ¢Æ–çW@Ğ¢G—SÒ&6†V6¶&÷‚ Ğ¢6†V6¶VC×¶f÷&Òæ—5ö6öÖ&÷ĞĞ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ—5ö6öÖ&ó¢RçF&vWBæ6†V6¶VBÒ’—ĞĞ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò Ğ¢óàĞ¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#ì8’VÒ6öÖ&óóÂ÷7ãàĞ¢ÂöÆ&VÃàĞ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#àĞ¢Æ–çW@Ğ¢G—SÒ&6†V6¶&÷‚ Ğ¢6†V6¶VC×¶f÷&Òæ7F—fWĞĞ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ7F—fS¢RçF&vWBæ6†V6¶VBÒ’—ĞĞ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò Ğ¢óàĞ¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#äF—7öì:×fVÂæò6&L:–óÂ÷7ãàĞ¢ÂöÆ&VÃàĞ¢²—4ÖVçTÖöFRbb€Ğ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"vÓ"7W'6÷"×ö–çFW"#àĞ¢Æ–çW@Ğ¢G—SÒ&6†V6¶&÷‚ Ğ¢6†V6¶VC×´&ööÆVâ†f÷&Òç7Fö6µ÷G&6¶–æuöVæ&ÆVB—ĞĞ¢öä6†ævS×¶RÓâ°Ğ¢6öç7BVæ&ÆVBÒRçF&vWBæ6†V6¶VC°Ğ¢6WDf÷&Ò‡&WbÓâ‡°Ğ¢ââç&WbÀĞ¢7Fö6µ÷G&6¶–æuöVæ&ÆVC¢Væ&ÆVBÀĞ¢7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbç7Fö6µ÷VçF—G’¢çVÆÂÀĞ¢‡—6–6Å÷7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbç‡—6–6Å÷7Fö6µ÷VçF—G’¢ÀĞ¢&V6…÷7Fö6µ÷VçF—G“¢Væ&ÆVBò&Wbæ&V6…÷7Fö6µ÷VçF—G’¢ÀĞ¢&Æö6¶VEö'•÷7Fö6³¢Væ&ÆVBò&Wbæ&Æö6¶VEö'•÷7Fö6²¢fÇ6RÀĞ¢Ò’“°Ğ¢×ĞĞ¢6Æ74æÖSÒ'rÓR‚ÓR66VçBÕ²4dcd#Ò Ğ¢óàĞ¢Ç7â6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ós#ä6öçF&–Æ—¦"W7F÷VSÂ÷7ãàĞ¢ÂöÆ&VÃàĞ¢—ĞĞ¢ÂöF—càĞ Ğ¢²—4ÖVçTÖöFRbbf÷&Òç7Fö6µ÷G&6¶–æuöVæ&ÆVBbb€Ğ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2ÓvÓB&÷VæFVB×†Â&÷&FW"&÷&FW"Ö÷&ævRÓ&rÖ÷&ævRÓSÓB6Ó¦w&–BÖ6öÇ2Ó"#àĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#äW7F÷VRf—6–6óÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ&çVÖ&W" Ğ¢Ö–ãÒ# Ğ¢fÇVS×¶f÷&Òç‡—6–6Å÷7Fö6µ÷VçF—G’ÇÂ"'ĞĞ¢öä6†ævS×¶RÓâ6WDf÷&Ò‡&WbÓâ‡²ââç&WbÂ‡—6–6Å÷7Fö6µ÷VçF—G“¢ÖF‚æÖ‚ƒÂ'6T–çB†RçF&vWBçfÇVRÂ’ÇÂ’Ò’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Ö÷&ævRÓ&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&r×v†—FR Ğ¢Æ6V†öÆFW#Ò$Wƒ¢ƒ Ğ¢óàĞ¢ÂöF—càĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓsÖ"Ó#äW7F÷VR&–ÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ&çVÖ&W" Ğ¢Ö–ãÒ# Ğ¢fÇVS×¶f÷&Òæ&V6…÷7Fö6µ÷VçF—G’ÇÂ"'ĞĞ¢öä6†ævS×¶RÓâ°Ğ¢6öç7BæW‡E7Fö6²ÒÖF‚æÖ‚ƒÂ'6T–çB†RçF&vWBçfÇVRÂ’ÇÂ“°Ğ¢6WDf÷&Ò‡&WbÓâ‡°Ğ¢ââç&WbÀĞ¢&V6…÷7Fö6µ÷VçF—G“¢æW‡E7Fö6²ÀĞ¢7Fö6µ÷VçF—G“¢æW‡E7Fö6²ÀĞ¢&Æö6¶VEö'•÷7Fö6³¢æW‡E7Fö6²ÃÒÀĞ¢Ò’“°Ğ¢×ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"Ó"&÷&FW"Ö÷&ævRÓ&÷VæFVB×†ÂÓ2fö7W3¦&÷&FW"Õ²4dcd#Ò÷WFÆ–æRÖæöæR&r×v†—FR Ğ¢Æ6V†öÆFW#Ò$Wƒ¢#B Ğ¢óàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢—ĞĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’ÓfÆW‚vÓ2#àĞ¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ&fÆW‚Ó’Ó2&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖw&’Óc†÷fW#¦&rÖw&’ÓS#àĞ¢6æ6VÆ Ğ¢Âö'WGFöãàĞ¢Æ'WGFöàĞ¢öä6Æ–6³×²‚’Óâ²–b†f÷&ÒææÖRbbf÷&Òç&–6R’öå6fR†f÷&Ò“²×ĞĞ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÕ²4dcd#ÒFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆB†÷fW#¦&rÕ²4SScÒ7F—fS§66ÆRÓ“RG&ç6—F–öâÖÆÂ Ğ¢àĞ¢¶—4ÖVçTÖöFRò%6Çf"6&F–ò"¢&öGV7Bò%6Çf"ÇFW&6öW2"¢$F–6–öæ"&öGWFò'ĞĞ¢Âö'WGFöãàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞĞ¢òò5U5DôÔU"ÔôDÂ4ôÕôäTå@Ğ¢òòÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓÓĞĞ¦gVæ7F–öâ7W7FöÖW$ÖöFÂ‡²7W7FöÖW"Âöä6Æ÷6RÓ¢²7W7FöÖW#¢7W7FöÖW#²öä6Æ÷6S¢‚’Óâfö–BÒ’°Ğ¢6öç7BfuF–6¶WBÒ7W7FöÖW"çf—6—Eö6÷VçBâò7W7FöÖW"çF÷FÅ÷7VçBò7W7FöÖW"çf—6—Eö6÷VçB¢°Ğ Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ&f—†VB–ç6WBÓ&rÖ&Æ6²óS¢ÓSfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"ÓB"öä6Æ–6³×¶öä6Æ÷6WÓàĞ¢ÆF—b6Æ74æÖSÒ&&r×v†—FR&÷VæFVBÓ'†ÂÖ‚×rÖÆrrÖgVÆÂÖ‚Ö‚Õ³“f…Ò÷fW&fÆ÷r×’ÖWFò6†F÷rÓ'†Â"öä6Æ–6³×¶RÓâRç7F÷&÷vF–öâ‚—ÓàĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2Ö6VçFW"Ób&÷&FW"Ö"&÷&FW"Öw&’Ó#àĞ¢ÆF—càĞ¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶7W7FöÖW"ææÖWÓÂöƒ3àĞ¢Ç6Æ74æÖSÒ'FW‡BÖw&’ÓSFW‡B×6ÒfÆW‚—FV×2Ö6VçFW"vÓ#ãÅ†öæR6—¦S×³'Òóç¶7W7FöÖW"ç†öæWÓÂ÷àĞ¢ÂöF—càĞ¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ'FW‡BÖw&’ÓC†÷fW#§FW‡BÖw&’Óc#ãÅ‚6—¦S×³#GÒóãÂö'WGFöãàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'Ób#àĞ¢²ò¢7W7FöÖW"µ—2¢÷ĞĞ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó2vÓBÖ"Ób#àĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åF÷FÂv7FóÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÕ²4dcd#Ò#ç¶f÷&ÖD7W'&Væ7’†7W7FöÖW"çF÷FÅ÷7VçB—ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åf—6—F3Â÷àĞ¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶7W7FöÖW"çf—6—Eö6÷VçGÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓSÓB&÷VæFVB×†ÂFW‡BÖ6VçFW"#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åF–6¶WBÜ:–F–óÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖF—7Æ’föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶f÷&ÖD7W'&Væ7’†fuF–6¶WB—ÓÂ÷àĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ&&÷&FW"×B&÷&FW"Öw&’ÓBÓB#àĞ¢ÆƒB6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’ÓSWW&66RG&6¶–ær×v–FW7BFW‡B×‡2Ö"ÓB#ä–æf÷&Ö:|;VW3ÂöƒCàĞ¢ÆF—b6Æ74æÖSÒ'76R×’Ó2FW‡B×6Ò#àĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#àĞ¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#å&–ÖV—&f—6—FÂ÷7ãàĞ¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#î(	CÂ÷7ãàĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#àĞ¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#ì9¦ÇF–Öf—6—FÂ÷7ãàĞ¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#ç¶æWrFFR†7W7FöÖW"æÆ7E÷f—6—EöB’çFôÆö6ÆTFFU7G&–ær‚'BÔ%""—ÓÂ÷7ãàĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ#àĞ¢Ç7â6Æ74æÖSÒ'FW‡BÖw&’ÓS#äg&W\:¦æ6–Â÷7ãàĞ¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&’Ó“#àĞ¢¶7W7FöÖW"çf—6—Eö6÷VçBâRò$6Æ–VçFRf–VÂ	øøb"¢7W7FöÖW"çf—6—Eö6÷VçBâò%&V6÷'&VçFR"¢$æ÷fò'ĞĞ¢Â÷7ãàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’Ó#àĞ¢Æ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÒ6Æ74æÖSÒ'rÖgVÆÂ’Ó2&÷&FW"Ó"&÷&FW"Öw&’Ó#&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖw&’Óc†÷fW#¦&rÖw&’ÓS#àĞ¢fV6† Ğ¢Âö'WGFöãàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ 