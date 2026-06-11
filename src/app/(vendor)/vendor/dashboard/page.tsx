"use client";

import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, CheckCircle2, Clock, Trash2, Pencil, X, Upload, Image as ImageIcon,
  Eye, EyeOff, LogOut, Bell, ChevronDown, Phone, TrendingUp, Award, Star, CalendarCheck,
  Palette, Menu,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";

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
  sort_order: number;
}

interface OrderItem { q: number; n: string; }
interface Order {
  id: string;
  umbrella_id: string;
  umbrella: number;
  customer: string;
  phone: string;
  total: number;
  status: string;
  time: string;
  items: OrderItem[];
  notes?: string;
  paid?: boolean;
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
  qr_image_url?: string;
}

interface ReportData {
  kpis: { total_revenue: number; total_orders: number; avg_ticket: number; unique_customers: number };
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
  logo_url: string;
  tenant_id?: string;
}

const CATEGORIES = ["Bebidas", "Alcoólicos", "Não Alcoólicos", "Comidas", "Petiscos", "Sobremesas", "Combos", "Extras"];

const DEFAULT_THEME: KioskTheme = {
  primary_color: "#ff6b00",
  secondary_color: "#82533f",
  logo_url: "/sandexpress-logo.svg",
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

const TABS = [
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "opening", label: "Abertura", icon: CalendarCheck },
  { id: "menu", label: "Cardápio", icon: Utensils },
  { id: "qr", label: "Guarda-Sóis", icon: QrCode },
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

  // --- Products State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [productFilter, setProductFilter] = useState("Todos");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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

  // Data loading functions
  const loadOrders = async (vid: string) => {
    try {
      const res = await fetch(`/api/orders?vendor_id=${vid}`);
      if (res.ok) {
        const data = await res.json();
        const nextStatusMap = new Map<string, string>();
        let hasNewOrder = false;
        let hasNewClosingRequest = false;
        data.forEach((order: Order) => {
          const previousStatus = knownOrderStatusesRef.current.get(order.id);
          nextStatusMap.set(order.id, order.status);
          if (!previousStatus && order.status === "received") hasNewOrder = true;
          if (!previousStatus && order.status === "closing_requested") hasNewClosingRequest = true;
          if (previousStatus && previousStatus !== "closing_requested" && order.status === "closing_requested") {
            hasNewClosingRequest = true;
          }
        });
        if (knownOrderStatusesRef.current.size > 0) {
          if (hasNewOrder) playNewOrderSound();
          if (hasNewClosingRequest) playCashRegisterSound();
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
        setThemeForm({
          tenant_id: data.tenant_id,
          primary_color: data.primary_color || DEFAULT_THEME.primary_color,
          secondary_color: data.secondary_color || DEFAULT_THEME.secondary_color,
          logo_url: data.logo_url || DEFAULT_THEME.logo_url,
        });
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
      setThemeForm({
        tenant_id: data.tenant_id,
        primary_color: data.primary_color || DEFAULT_THEME.primary_color,
        secondary_color: data.secondary_color || DEFAULT_THEME.secondary_color,
        logo_url: data.logo_url || DEFAULT_THEME.logo_url,
      });
      setThemeMessage("Personalizacao salva. O login do cliente e os QRs ja usam essas cores.");
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
      } : u));
    } catch (err) {
      console.error("Failed to generate QR:", err);
      alert("Erro de rede ao gerar QR Code.");
    }
  };

  const markAccountPaid = async (order: Order) => {
    if (!vendorId) return;
    const confirmed = confirm(`Confirmar pagamento da conta do guarda-sol ${order.umbrella}?`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/close-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          umbrella_id: order.umbrella_id,
          payment_method: 'cash',
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
    } catch (err) {
      console.error('Pay account error:', err);
      alert('Erro de rede ao confirmar pagamento.');
    }
  };

  // Filtered products
  const filteredProducts = productFilter === "Todos" ? products : products.filter(p => p.category === productFilter);
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  // Kanban column renderer
  const renderKanbanColumn = (title: string, status: string, nextAction: string, nextStatus: string, color: string) => {
    const colOrders = orders.filter(o => o.status === status);
    return (
      <div className="bg-gray-100 rounded-lg p-3 flex flex-col h-[58vh] min-w-[220px] max-w-[240px]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm text-gray-700 capitalize flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
            {title}
          </h3>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{colOrders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar">
          {colOrders.map(order => (
            <div
              key={order.id}
              className={cn(
                "bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md",
                status === "received" && "animate-pulse border-[#ff6b00] bg-[#fff8f6] shadow-md"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="bg-[#FF6B00] text-white text-xs font-bold px-2 py-1 rounded-md">Barraca {order.umbrella}</span>
                  <p className="font-bold text-gray-900 mt-1">{order.customer}</p>
                  <p className="text-xs text-gray-400">{order.phone}</p>
                </div>
                <div className="text-right">
                  <span className="text-[#FF6B00] font-bold block">{formatCurrency(order.total)}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1 justify-end mt-1"><Clock size={12}/> {order.time}</span>
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-2 border-t border-gray-50 pt-2">
                {(order.items || []).map((i, idx) => <div key={idx}>{i.q}x {i.n}</div>)}
              </div>
              {order.notes && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg mb-2 border border-amber-100">
                  📝 {order.notes}
                </div>
              )}
              {nextStatus && (
                <button
                  onClick={() => moveOrder(order.id, nextStatus)}
                  className="w-full bg-gray-50 hover:bg-[#FF6B00] hover:text-white text-gray-700 border border-gray-200 font-bold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={16} /> {nextAction}
                </button>
              )}
            </div>
          ))}
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

  const renderCompactKanbanColumn = (title: string, status: string, nextAction: string, nextStatus: string, color: string) => {
    const colOrders = orders.filter(o => o.status === status);
    return (
      <div className="bg-gray-100 rounded-lg p-3 flex flex-col h-[58vh] min-w-[220px] max-w-[240px]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm text-gray-700 capitalize flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
            {title}
          </h3>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{colOrders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar">
          {colOrders.map(order => (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={cn(
                "w-full bg-white p-3 rounded-lg shadow-sm border border-gray-100 text-left transition-all hover:border-[#FF6B00] hover:shadow-md",
                status === "received" && "animate-pulse border-[#ff6b00] bg-[#fff8f6] shadow-md"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="bg-[#FF6B00] text-white text-[11px] font-bold px-2 py-1 rounded-md">#{order.umbrella}</span>
                <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={11}/> {order.time}</span>
              </div>
              <p className="mt-2 text-xs font-bold text-gray-400">Pedido #{order.id.slice(0, 8)}</p>
              <p className="text-sm font-black text-gray-900 truncate">{order.customer}</p>
              <p className="text-xs font-bold text-[#FF6B00]">{formatCurrency(order.total)}</p>
              <div className="mt-2 flex flex-col gap-1">
                {status === 'closing_requested' ? (
                  <span
                    onClick={(event) => { event.stopPropagation(); markAccountPaid(order); }}
                    className="w-full cursor-pointer rounded-md bg-green-600 px-2 py-1.5 text-center text-xs font-black text-white hover:bg-green-700"
                  >
                    Conta paga
                  </span>
                ) : nextStatus ? (
                  <span
                    onClick={(event) => { event.stopPropagation(); moveOrder(order.id, nextStatus); }}
                    className="w-full cursor-pointer rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-xs font-black text-gray-700 hover:bg-[#FF6B00] hover:text-white"
                  >
                    {nextAction}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
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
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-12">
          {umbrellas.map(umbrella => {
            const order = orders.find(item => item.umbrella_id === umbrella.id);
            const closing = order?.status === 'closing_requested';
            const occupied = Boolean(umbrella.is_occupied || umbrella.current_order_id || order);
            return (
              <button
                key={umbrella.id}
                onClick={() => order ? setSelectedOrder(order) : undefined}
                className={cn(
                  "aspect-square rounded-lg border text-xs font-black transition-all",
                  !umbrella.active && "border-gray-200 bg-gray-100 text-gray-300",
                  umbrella.active && !occupied && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                  umbrella.active && occupied && !closing && "border-orange-200 bg-orange-50 text-[#FF6B00] hover:bg-orange-100",
                  umbrella.active && closing && "border-orange-300 bg-orange-500 text-white hover:bg-orange-600"
                )}
                title={order ? `${order.customer} - ${formatCurrency(order.total)}` : umbrella.label}
              >
                {umbrella.number}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row font-sans">
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
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm relative",
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
          <button className="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 text-sm font-bold transition-colors rounded-lg hover:bg-red-50">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="min-h-16 sm:min-h-20 border-b border-gray-100 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 bg-white shrink-0">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl bg-gray-100 p-3 text-gray-700 lg:hidden" aria-label="Abrir menu">
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
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">

          {/* ========== ABA 1: PEDIDOS (KANBAN) ========== */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {renderBeachMap()}
              <div className="flex gap-3 overflow-x-auto pb-4">
                {renderCompactKanbanColumn("Recebido", "received", "Iniciar", "preparing", "bg-blue-500")}
                {renderCompactKanbanColumn("Preparando", "preparing", "Saiu", "delivering", "bg-yellow-500")}
                {renderCompactKanbanColumn("Entregando", "delivering", "Entregue", "completed", "bg-purple-500")}
                {renderCompactKanbanColumn("Conta Solicitada", "closing_requested", "Conta paga", "", "bg-orange-500")}
                {renderCompactKanbanColumn("Entregue", "completed", "Solicitar conta", "closing_requested", "bg-green-500")}
              </div>
            </div>
          )}

          {/* ========== ABA 2: CARDÁPIO ========== */}
          {activeTab === "opening" && (
            <OpeningDayStockControl vendorId={vendorId || undefined} />
          )}


          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Seus Produtos</h3>
                    <p className="text-gray-500 text-sm">{products.length} itens cadastrados · {products.filter(p => p.active).length} ativos</p>
                  </div>
                  <button
                    onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                    className="bg-[#FF6B00] text-white px-4 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2 hover:bg-[#E56000] active:scale-95 transition-all"
                  >
                    <Plus size={20} /> Adicionar Item
                  </button>
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
                  <table className="min-w-[760px] w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="p-3 rounded-tl-lg">Produto</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Preço</th>
                        <th className="p-3">Promo</th>
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
                                <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">
                              {p.is_combo ? "🎁 " : ""}{p.category}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-gray-900">{formatCurrency(p.price)}</td>
                          <td className="p-3 text-[#FF6B00] font-bold">{p.promotional_price ? formatCurrency(p.promotional_price) : "—"}</td>
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
                              <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => deleteProduct(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
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
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-sm font-black text-gray-700">Paleta SandExpress</p>
                  <div className="flex flex-wrap gap-2">
                    {BRAND_PALETTE.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        title={color.name}
                        onClick={() => setThemeForm(prev => ({ ...prev, primary_color: color.value }))}
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
                        placeholder="/sandexpress-logo.svg ou https://..."
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
                  style={{ backgroundColor: themeForm.primary_color }}
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
                    <p className="text-3xl font-black" style={{ color: themeForm.primary_color }}>{formatCurrency(128.5)}</p>
                  </div>
                  <button className="w-full rounded-xl py-3 text-sm font-black text-white" style={{ backgroundColor: themeForm.primary_color }}>
                    Abrir comanda
                  </button>
                  <button className="w-full rounded-xl py-3 text-sm font-black text-white" style={{ backgroundColor: themeForm.secondary_color }}>
                    Fechar conta
                  </button>
                </div>
              </aside>
            </div>
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
                <button
                  onClick={closeBusinessDay}
                  disabled={closingDay}
                  className="bg-[#394E59] hover:bg-[#263640] text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CalendarCheck size={18} />
                  {closingDay ? "Fechando..." : "Fechar dia"}
                </button>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* ========== MODAL: ADD/EDIT PRODUCT ========== */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          vendorId={vendorId}
          onSave={saveProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
        />
      )}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMove={moveOrder}
          onPaid={markAccountPaid}
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
}: {
  order: Order;
  onClose: () => void;
  onMove: (id: string, status: string) => Promise<void>;
  onPaid: (order: Order) => Promise<void>;
}) {
  const next = order.status === 'received'
    ? { label: 'Iniciar preparo', status: 'preparing' }
    : order.status === 'preparing'
      ? { label: 'Saiu para entrega', status: 'delivering' }
      : order.status === 'delivering'
        ? { label: 'Confirmar entrega', status: 'completed' }
        : order.status === 'completed'
          ? { label: 'Solicitar conta', status: 'closing_requested' }
          : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start p-6 border-b border-gray-100">
          <div>
            <p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p>
            <h3 className="text-xl font-display font-bold text-gray-900">Pedido #{order.id.slice(0, 8)}</h3>
            <p className="mt-1 text-sm font-bold text-gray-500">{order.customer} · {order.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-[#fff8f6] p-4">
            <p className="text-xs font-black uppercase text-[#82533F]">Total da conta</p>
            <p className="text-3xl font-black text-[#FF6B00]">{formatCurrency(order.total)}</p>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-black text-gray-700">Itens</h4>
            <div className="space-y-2">
              {(order.items || []).length === 0 ? (
                <p className="rounded-lg bg-gray-50 p-3 text-sm font-bold text-gray-400">Comanda aberta sem itens.</p>
              ) : (order.items || []).map((item, index) => (
                <div key={`${item.n}-${index}`} className="flex justify-between rounded-lg border border-gray-100 p-3 text-sm">
                  <span className="font-bold text-gray-900">{item.n}</span>
                  <span className="font-black text-[#FF6B00]">{item.q}x</span>
                </div>
              ))}
            </div>
          </div>
          {order.notes && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-700">
              {order.notes}
            </div>
          )}
        </div>
        <div className="flex gap-3 border-t border-gray-100 p-6">
          <button onClick={onClose} className="flex-1 rounded-xl border-2 border-gray-200 py-3 font-bold text-gray-600 hover:bg-gray-50">
            Fechar
          </button>
          {order.status === 'closing_requested' ? (
            <button onClick={() => onPaid(order)} className="flex-1 rounded-xl bg-green-600 py-3 font-black text-white hover:bg-green-700">
              Conta paga
            </button>
          ) : next ? (
            <button onClick={() => onMove(order.id, next.status)} className="flex-1 rounded-xl bg-[#FF6B00] py-3 font-black text-white hover:bg-[#E56000]">
              {next.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// PRODUCT MODAL COMPONENT
// =========================================================
function ProductModal({ product, vendorId, onSave, onClose }: { product: Product | null; vendorId: string | null; onSave: (p: Product) => Promise<void> | void; onClose: () => void }) {
  const [form, setForm] = useState<Product>(product || {
    id: "", name: "", category: "Bebidas", price: 0, promotional_price: null,
    description: "", image_url: "", active: true, is_combo: false, sort_order: 99,
  });
  const [uploading, setUploading] = useState(false);

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
          <h3 className="text-xl font-display font-bold">{product ? "Editar Produto" : "Novo Produto"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-4">
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

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
            <select
              value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none bg-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
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
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => { if (form.name && form.price) onSave(form); }}
            className="flex-1 py-3 bg-[#FF6B00] text-white rounded-xl font-bold hover:bg-[#E56000] active:scale-95 transition-all"
          >
            {product ? "Salvar Alterações" : "Adicionar Produto"}
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
