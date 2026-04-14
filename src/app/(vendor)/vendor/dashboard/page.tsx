"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, QrCode, BarChart3, Users, Plus, Utensils, Download,
  Search, CheckCircle2, Clock, Trash2, Pencil, X, Upload, Image as ImageIcon,
  Eye, EyeOff, LogOut, Bell, ChevronDown, Phone, TrendingUp, Award, Star,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

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
  umbrella: number;
  customer: string;
  phone: string;
  total: number;
  status: string;
  time: string;
  items: OrderItem[];
  notes?: string;
}

interface Umbrella {
  id: string;
  number: number;
  label: string;
  active: boolean;
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

// ---------- MOCK DATA ----------
function mapApiOrder(o: Record<string, unknown>): Order {
  const customers = o.customers as { name?: string; phone?: string } | null | undefined;
  const umbrellas = o.umbrellas as { number?: number } | null | undefined;
  const orderItems =
    (o.order_items as { quantity: number; products?: { name?: string } | null }[]) || [];
  const created = new Date(String(o.created_at));
  const diffMin = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
  return {
    id: String(o.id),
    umbrella: umbrellas?.number ?? 0,
    customer: customers?.name || "—",
    phone: customers?.phone || "—",
    total: Number(o.total),
    status: String(o.status),
    time: `${diffMin} min`,
    items: orderItems.map((i) => ({ q: i.quantity, n: i.products?.name || "Item" })),
    notes: (o.notes as string) || undefined,
  };
}

const CATEGORIES = ["Bebidas", "Alcoólicos", "Não Alcoólicos", "Comidas", "Petiscos", "Sobremesas", "Combos", "Extras"];

const TABS = [
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "menu", label: "Cardápio", icon: Utensils },
  { id: "qr", label: "Guarda-Sóis", icon: QrCode },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "customers", label: "Clientes", icon: Users },
];

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function VendorDashboard() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("orders");

  // --- Orders State ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);

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

  // --- Customers State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const vid = typeof window !== "undefined" ? localStorage.getItem("vendor_id") : null;
    if (!vid) {
      router.replace("/vendor/login");
      return;
    }
    setVendorId(vid);
  }, [router]);

  const loadOrders = useCallback(async () => {
    if (!vendorId) return;
    const res = await fetch(`/api/orders?vendor_id=${vendorId}`, { credentials: "include" });
    if (!res.ok) return;
    const raw = await res.json();
    if (!Array.isArray(raw)) return;
    setOrders(raw.map((row: Record<string, unknown>) => mapApiOrder(row)));
    setNewOrderCount(raw.filter((x: { status: string }) => x.status === "received").length);
  }, [vendorId]);

  const loadProducts = useCallback(async () => {
    if (!vendorId) return;
    const res = await fetch(`/api/products?vendor_id=${vendorId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  }, [vendorId]);

  const loadUmbrellas = useCallback(async () => {
    if (!vendorId) return;
    const res = await fetch(`/api/umbrellas?vendor_id=${vendorId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setUmbrellas(Array.isArray(data) ? data : []);
  }, [vendorId]);

  const loadCustomers = useCallback(async () => {
    if (!vendorId) return;
    const res = await fetch(`/api/customers?vendor_id=${vendorId}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setCustomers(Array.isArray(data) ? data : []);
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    void loadOrders();
  }, [vendorId, loadOrders]);

  useEffect(() => {
    if (!vendorId || activeTab !== "orders") return;
    const t = setInterval(() => void loadOrders(), 5000);
    return () => clearInterval(t);
  }, [vendorId, activeTab, loadOrders]);

  useEffect(() => {
    if (!vendorId) return;
    if (activeTab === "menu") void loadProducts();
    if (activeTab === "qr") void loadUmbrellas();
    if (activeTab === "customers") void loadCustomers();
  }, [vendorId, activeTab, loadProducts, loadUmbrellas, loadCustomers]);

  // Load reports when tab or period changes
  useEffect(() => {
    if (activeTab === "reports" && vendorId) {
      setReportLoading(true);
      fetch(`/api/reports?vendor_id=${vendorId}&period=${reportPeriod}`)
        .then((r) => r.json())
        .then((d) => {
          setReportData(d);
          setReportLoading(false);
        })
        .catch(() => setReportLoading(false));
    }
  }, [activeTab, reportPeriod, vendorId]);

  // Order management
  const moveOrder = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) void loadOrders();
  };

  // Product management
  const toggleProduct = async (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !p.active }),
    });
    if (res.ok) void loadProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este produto?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) void loadProducts();
  };

  const saveProduct = async (product: Product) => {
    if (!vendorId) return;
    if (editingProduct) {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(product),
      });
      if (res.ok) void loadProducts();
    } else {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_id: vendorId,
          name: product.name,
          category: product.category,
          price: product.price,
          promotional_price: product.promotional_price,
          description: product.description,
          image_url: product.image_url,
          active: product.active,
          is_combo: product.is_combo,
          sort_order: product.sort_order,
        }),
      });
      if (res.ok) void loadProducts();
    }
    setShowProductModal(false);
    setEditingProduct(null);
  };

  // Umbrella management
  const addUmbrella = async () => {
    const num = parseInt(newUmbrellaNumber);
    if (!num || umbrellas.some((u) => u.number === num)) return alert("Número inválido ou já existe!");
    if (!vendorId) return;
    const res = await fetch("/api/umbrellas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ vendor_id: vendorId, number: num, label: `Barraca ${num}` }),
    });
    if (res.ok) {
      setNewUmbrellaNumber("");
      setShowAddUmbrella(false);
      void loadUmbrellas();
    }
  };

  const toggleUmbrella = async (id: string) => {
    const u = umbrellas.find((x) => x.id === id);
    if (!u) return;
    const res = await fetch(`/api/umbrellas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active: !u.active }),
    });
    if (res.ok) void loadUmbrellas();
  };

  const generateQR = (umbrella: Umbrella) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const targetUrl = `${baseUrl}/u/${umbrella.id}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}&format=png&margin=20`;
    setUmbrellas(prev => prev.map(u => u.id === umbrella.id ? { ...u, qr_image_url: qrImg, qr_url: targetUrl } : u));
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
      <div className="bg-gray-100 rounded-2xl p-4 flex flex-col h-[calc(100vh-140px)] min-w-[300px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700 capitalize flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color}`}></span>
            {title}
          </h3>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{colOrders.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 hide-scrollbar">
          {colOrders.map(order => (
            <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
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
                {order.items.map((i, idx) => <div key={idx}>{i.q}x {i.n}</div>)}
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

  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-100 bg-gray-50 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 bg-white">
          <h1 className="font-display font-bold text-xl text-[#FF6B00]">SandExpress</h1>
          <p className="text-sm text-gray-500 font-semibold">Painel Gerencial</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("vendor_id");
              router.push("/vendor/login");
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-red-500 text-sm font-bold transition-colors rounded-lg hover:bg-red-50"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-gray-100 flex items-center justify-between px-8 bg-white shrink-0">
          <h2 className="text-2xl font-bold font-display text-gray-800">
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Quiosque Aberto
            </span>
          </div>
        </header>

        {/* Tab Contents */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">

          {/* ========== ABA 1: PEDIDOS (KANBAN) ========== */}
          {activeTab === "orders" && (
            <div className="flex gap-4 overflow-x-auto pb-4 h-full">
              {renderKanbanColumn("Recebido", "received", "Iniciar Preparo", "preparing", "bg-blue-500")}
              {renderKanbanColumn("Preparando", "preparing", "Saiu para Entrega", "delivering", "bg-yellow-500")}
              {renderKanbanColumn("Entregando", "delivering", "Confirmar Entrega", "completed", "bg-purple-500")}
              {renderKanbanColumn("Entregue", "completed", "", "", "bg-green-500")}
            </div>
          )}

          {/* ========== ABA 2: CARDÁPIO ========== */}
          {activeTab === "menu" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
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
                  <table className="w-full text-left">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* ========== ABA 4: RELATÓRIOS ========== */}
          {activeTab === "reports" && (
            <div className="space-y-6">
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
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
                      <table className="w-full text-left">
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
              <div className="grid grid-cols-3 gap-4">
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
                      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#FF6B00] outline-none w-64"
                    />
                  </div>
                </div>

                <table className="w-full text-left">
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
        </div>
      </main>

      {/* ========== MODAL: ADD/EDIT PRODUCT ========== */}
      {showProductModal && (
        <ProductModal
          product={editingProduct}
          vendorId={vendorId || ""}
          onSave={saveProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); }}
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
// PRODUCT MODAL COMPONENT
// =========================================================
function ProductModal({
  product,
  vendorId,
  onSave,
  onClose,
}: {
  product: Product | null;
  vendorId: string;
  onSave: (p: Product) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Product>(product || {
    id: "", name: "", category: "Bebidas", price: 0, promotional_price: null,
    description: "", image_url: "", active: true, is_combo: false, sort_order: 99,
  });
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-3 gap-4 mb-6">
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
