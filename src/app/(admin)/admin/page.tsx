"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Store, TrendingUp, Plus, ShieldCheck, Ban, CheckCircle2,
  X, Search, Eye, AlertTriangle, DollarSign, Phone, Mail, Clock, Menu, Trash2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PLAN_PRICES } from "@/lib/plans";

// ---------- TYPES ----------
interface Vendor {
  id: string;
  name: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string | null;
  city: string | null;
  state: string | null;
  beach_name?: string | null;
  cnpj: string | null;
  cpf: string | null;
  subscription_status: string;
  plan_type: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  is_active: boolean;
  max_umbrellas: number;
  created_at: string;
}

interface PlatformReport {
  gmv: number;
  total_orders: number;
  total_customers: number;
  total_visitors: number;
  total_products_sold: number;
  avg_ticket: number;
  active_vendors: number;
  trial_vendors: number;
  overdue_vendors: number;
  blocked_vendors: number;
  retention_rate: number;
  top_vendors: { name: string; city: string; beach: string; revenue: number; orders: number; visitors: number }[];
  top_products: { product_id: string; name: string; category: string; quantity: number; revenue: number; orders: number }[];
  top_categories: { category: string; quantity: number; revenue: number }[];
  top_cities: { city: string; quantity: number; revenue: number; orders: number }[];
  top_beaches: { beach: string; city: string; quantity: number; revenue: number; orders: number }[];
  hourly_sales: { hour: number; orders: number; quantity: number; revenue: number }[];
  peak_hour: { hour: number; orders: number; quantity: number; revenue: number };
  peak_product_hours: { product: string; category: string; hour: number; quantity: number; revenue: number }[];
  monthly_received: number;
  next_cycle_receivable: number;
  overdue_amount: number;
  filter_options: {
    vendors: { id: string; name: string }[];
    cities: string[];
    beaches: string[];
  };
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vendors", label: "Quiosques", icon: Store },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "new", label: "Novo Quiosque", icon: Plus },
  { id: "danger", label: "Risco", icon: Trash2 },
];

const ANNUAL_PLAN_TYPES = new Set(["annual", "12months"]);

function isAnnualPlan(planType: string | null) {
  return ANNUAL_PLAN_TYPES.has(planType || "");
}

function getVendorPlanLabel(vendor: Vendor) {
  if (isAnnualPlan(vendor.plan_type)) return "Anual";
  if (vendor.plan_type === "monthly") return "Mensal";
  if (vendor.plan_type === "trial" || vendor.subscription_status === "trial") return "Teste";
  return vendor.plan_type || "Sem plano";
}

function getVendorMonthlyAmount(vendor: Vendor) {
  if (vendor.plan_type === "trial" || vendor.subscription_status === "trial") return 0;
  return isAnnualPlan(vendor.plan_type) ? PLAN_PRICES.annualMonthly : PLAN_PRICES.monthly;
}

function getRemainingAnnualInstallments(vendor: Vendor) {
  if (!isAnnualPlan(vendor.plan_type)) return null;
  if (!vendor.plan_expires_at) return 12;
  const expiresAt = new Date(vendor.plan_expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return 12;
  const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
  return Math.min(12, Math.max(0, Math.ceil(daysLeft / 30.44)));
}

function getVendorBillingSummary(vendor: Vendor) {
  if (vendor.plan_type === "trial" || vendor.subscription_status === "trial") {
    return vendor.trial_ends_at
      ? `Teste ate ${new Date(vendor.trial_ends_at).toLocaleDateString("pt-BR")}`
      : "Teste gratis";
  }
  if (isAnnualPlan(vendor.plan_type)) {
    const remaining = getRemainingAnnualInstallments(vendor);
    const suffix = remaining === 1 ? "parcela restante" : "parcelas restantes";
    return `${remaining ?? 12} ${suffix}`;
  }
  return "Cobranca mensal";
}

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [platformReport, setPlatformReport] = useState<PlatformReport | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [adminDataError, setAdminDataError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vendorActionLoading, setVendorActionLoading] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState<"customers" | "kiosk" | null>(null);
  const [dangerForm, setDangerForm] = useState({
    vendor_id: "",
    admin_password: "",
    customer_confirmation: "",
    kiosk_confirmation: "",
  });
  const [dangerMessage, setDangerMessage] = useState("");
  const [analyticsFilters, setAnalyticsFilters] = useState({
    vendor_id: "",
    city: "",
    beach: "",
    product: "",
    from: "",
    to: "",
  });

  // Registration form
  const [regForm, setRegForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false,
  });
  const [regSuccess, setRegSuccess] = useState(false);
  const [regError, setRegError] = useState("");

  const handleAdminSessionExpired = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("admin_token");
    setAdminPassword("");
    setAuthError("Sessao expirada. Entre novamente para carregar os dados.");
  };

  useEffect(() => {
    if (isAuthenticated && (activeTab === "analytics" || activeTab === "overview")) {
      loadPlatformReport();
    }
  }, [activeTab, isAuthenticated]);

  // Admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setAdminDataError("");
        sessionStorage.setItem("admin_token", "authenticated");
        await loadVendors();
        await loadPlatformReport();
      } else {
        setAuthError("Senha incorreta.");
      }
    } catch {
      setAuthError("Erro ao conectar.");
    }
  };

  useEffect(() => {
    async function restoreAdminSession() {
      const res = await fetch("/api/auth/admin", { credentials: "include" });
      if (!res.ok) {
        sessionStorage.removeItem("admin_token");
        return;
      }
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_token", "authenticated");
      await loadVendors();
      await loadPlatformReport();
    }
    restoreAdminSession();
  }, []);

  const loadVendors = async () => {
    try {
      const res = await fetch('/api/vendors', { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        handleAdminSessionExpired();
        return;
      }
      if (!res.ok) {
        setAdminDataError(data.error || "Nao foi possivel carregar quiosques.");
        return;
      }
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setAdminDataError("Erro de rede ao carregar quiosques.");
    }
  };

  const loadPlatformReport = async (filters = analyticsFilters) => {
    try {
      setAnalyticsLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await fetch(`/api/reports/platform${params.toString() ? `?${params.toString()}` : ''}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        handleAdminSessionExpired();
        return;
      }
      if (!res.ok) {
        setAdminDataError(data.error || "Nao foi possivel carregar analytics.");
        return;
      }
      setPlatformReport(data);
      setAdminDataError("");
    } catch (err) {
      console.error('Failed to load platform report:', err);
      setAdminDataError("Erro de rede ao carregar analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const updateVendor = async (id: string, payload: Partial<Vendor>) => {
    setVendorActionLoading(id);
    try {
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Nao foi possivel atualizar o quiosque.");
        return;
      }
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
      setSelectedVendor(prev => prev?.id === id ? { ...prev, ...data } : prev);
    } catch (err) {
      console.error("Vendor update error:", err);
      alert("Erro de rede ao atualizar o quiosque.");
    } finally {
      setVendorActionLoading(null);
    }
  };

  const toggleVendor = async (vendor: Vendor) => {
    const newActive = !vendor.is_active;
    await updateVendor(vendor.id, {
      is_active: newActive,
      subscription_status: newActive ? (vendor.subscription_status === "blocked" ? "active" : vendor.subscription_status) : "blocked",
    });
  };

  const migrateVendorToPaid = async (vendor: Vendor) => {
    await updateVendor(vendor.id, {
      is_active: true,
      subscription_status: "active",
      plan_type: "monthly",
      trial_ends_at: null,
    });
  };

  const eraseCustomers = async () => {
    setDangerLoading("customers");
    setDangerMessage("");
    try {
      const res = await fetch("/api/admin/data-erasure/customers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: dangerForm.vendor_id || undefined,
          admin_password: dangerForm.admin_password,
          confirmation: dangerForm.customer_confirmation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDangerMessage(data.error || "Nao foi possivel apagar dados de clientes.");
        return;
      }
      setDangerMessage(`${data.deleted_customers} clientes e ${data.deleted_orders} pedidos apagados.`);
      await loadVendors();
      await loadPlatformReport();
    } catch {
      setDangerMessage("Erro de rede ao apagar dados de clientes.");
    } finally {
      setDangerLoading(null);
    }
  };

  const eraseKiosk = async () => {
    if (!dangerForm.vendor_id) {
      setDangerMessage("Selecione um quiosque antes de apagar.");
      return;
    }
    setDangerLoading("kiosk");
    setDangerMessage("");
    try {
      const res = await fetch(`/api/vendors/${dangerForm.vendor_id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_password: dangerForm.admin_password,
          confirmation: dangerForm.kiosk_confirmation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDangerMessage(data.error || "Nao foi possivel apagar o quiosque.");
        return;
      }
      setDangerMessage(`Quiosque apagado. ${data.deleted_storage_files || 0} arquivos removidos do Storage.`);
      setDangerForm({ vendor_id: "", admin_password: "", customer_confirmation: "", kiosk_confirmation: "" });
      await loadVendors();
      await loadPlatformReport();
    } catch {
      setDangerMessage("Erro de rede ao apagar o quiosque.");
    } finally {
      setDangerLoading(null);
    }
  };

  // Register vendor
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasDocument = regForm.cpf.replace(/\D/g, "") || regForm.cnpj.replace(/\D/g, "");
    if (!regForm.name || !regForm.owner_name || !regForm.owner_phone || !regForm.owner_email || !regForm.beach_name || !regForm.city || !regForm.state || !hasDocument) {
      setRegError("Preencha telefone, email, CPF ou CNPJ, nome do quiosque, responsavel, praia, cidade e estado.");
      return;
    }
    if (!regForm.password || regForm.password.length < 8) {
      setRegError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (regForm.password !== regForm.password_confirm) {
      setRegError("A senha e a confirmacao nao conferem.");
      return;
    }
    if (!regForm.terms_accepted) {
      setRegError("Confirme que o responsavel leu e concordou com os Termos de Uso.");
      return;
    }

    try {
      setRegError("");
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(prev => [{
          id: data.id,
          name: regForm.name,
          owner_name: regForm.owner_name,
          owner_phone: regForm.owner_phone,
          owner_email: regForm.owner_email || null,
          city: regForm.city || null,
          state: regForm.state || null,
          cnpj: regForm.cnpj || null,
          cpf: regForm.cpf || null,
          beach_name: regForm.beach_name || null,
          subscription_status: "trial",
          plan_type: "trial",
          trial_ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
          plan_expires_at: null,
          is_active: true,
          max_umbrellas: 50,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setRegSuccess(true);
        setRegForm({ name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false });
      } else {
        const data = await res.json().catch(() => ({}));
        setRegError(data.error || "Nao foi possivel cadastrar o quiosque.");
      }
    } catch (err) {
      console.error("Register error:", err);
      setRegError("Falha de conexao ao cadastrar o quiosque.");
    }
  };

  // Filtered vendors
  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.owner_name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.city && v.city.toLowerCase().includes(vendorSearch.toLowerCase()))
  );

  // Derived stats
  const activeCount = vendors.filter(v => v.subscription_status === "active" && v.is_active).length;
  const trialCount = vendors.filter(v => v.subscription_status === "trial").length;
  const overdueCount = vendors.filter(v => v.subscription_status === "overdue").length;
  const blockedCount = vendors.filter(v => v.subscription_status === "blocked" || !v.is_active).length;
  const totalBar = Math.max(activeCount + trialCount + overdueCount + blockedCount, 1);

  // Alerts
  const trialExpiring = vendors.filter(v => {
    if (v.subscription_status !== "trial" || !v.trial_ends_at) return false;
    const daysLeft = (new Date(v.trial_ends_at).getTime() - Date.now()) / 86400000;
    return daysLeft <= 3 && daysLeft > 0;
  });

  // If not authenticated, show login
  if (!isAuthenticated) {
    return (
    <div className="admin-ops-shell min-h-app bg-gray-900 flex items-center justify-center p-4 pt-safe">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full border border-gray-700 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <ShieldCheck size={32} className="text-blue-500" />
            <h1 className="text-2xl font-display font-bold text-white">Admin</h1>
          </div>
          <p className="text-gray-400 text-center mb-6 text-sm">Acesso restrito. Informe a senha de administrador.</p>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              placeholder="Senha do admin"
              className="w-full bg-gray-700 border-2 border-gray-600 rounded-xl p-4 text-white placeholder:text-gray-500 focus:border-blue-500 outline-none"
            />
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button type="submit" className="tap-target w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-ops-shell min-h-app bg-gray-900 flex flex-col lg:flex-row text-white font-sans">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 bg-gray-950 flex flex-col border-r border-gray-800 shrink-0 transition-transform lg:static lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display font-bold text-xl flex items-center gap-2"><ShieldCheck className="text-blue-500" /> God Mode</h1>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 lg:hidden" aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(tab => (
            <button
              key={tab.id} onClick={() => { setActiveTab(tab.id); setRegSuccess(false); setSidebarOpen(false); }}
              className={cn("tap-target w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-colors", activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white")}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-auto bg-gray-900 p-4 pb-[calc(100px+env(safe-area-inset-bottom))] pt-safe sm:p-6 sm:pb-[calc(104px+env(safe-area-inset-bottom))] lg:p-8 lg:pb-8">
        <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-3 border-b border-gray-800 bg-gray-900/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <button type="button" onClick={() => setSidebarOpen(true)} className="tap-target rounded-xl bg-gray-800 p-3 text-gray-200 lg:hidden" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <h2 className="min-w-0 truncate text-2xl sm:text-3xl font-display font-bold capitalize">{TABS.find(t => t.id === activeTab)?.label}</h2>
        </div>

        {adminDataError && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-sm font-bold text-red-200">
            {adminDataError}
          </div>
        )}

        {/* ========== OVERVIEW ========== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Receita Total</p>
                <p className="text-3xl font-display font-bold text-blue-400">
                  {platformReport ? formatCurrency(platformReport!.gmv) : "..."}
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Quiosques Ativos</p>
                <p className="text-3xl font-display font-bold text-green-400">{activeCount}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Em Trial</p>
                <p className="text-3xl font-display font-bold text-amber-400">{trialCount}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Inadimplentes</p>
                <p className="text-3xl font-display font-bold text-red-400">{overdueCount}</p>
              </div>
            </div>

            {/* Subscription bar */}
            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <h3 className="font-bold text-gray-300 mb-4">Distribuição de Assinaturas</h3>
              <div className="w-full h-6 bg-gray-700 rounded-full flex overflow-hidden">
                <div className="bg-green-500 h-full transition-all" style={{ width: `${(activeCount / totalBar) * 100}%` }} />
                <div className="bg-amber-500 h-full transition-all" style={{ width: `${(trialCount / totalBar) * 100}%` }} />
                <div className="bg-orange-500 h-full transition-all" style={{ width: `${(overdueCount / totalBar) * 100}%` }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: `${(blockedCount / totalBar) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 text-sm">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500" />Ativos ({activeCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500" />Trial ({trialCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-500" />Inadimplentes ({overdueCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500" />Bloqueados ({blockedCount})</span>
              </div>
            </div>

            {/* Billing KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Recebido Mensal</p>
                <p className="text-3xl font-display font-bold text-green-400">
                  {platformReport ? formatCurrency(platformReport!.monthly_received) : '...'}
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">A receber no próximo ciclo</p>
                <p className="text-3xl font-display font-bold text-blue-400">
                  {platformReport ? formatCurrency(platformReport!.next_cycle_receivable) : '...'}
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Valor de inadimplência</p>
                <p className="text-3xl font-display font-bold text-red-400">
                  {platformReport ? formatCurrency(platformReport!.overdue_amount) : '...'}
                </p>
              </div>
            </div>

            {/* Alerts */}
            {(trialExpiring.length > 0 || overdueCount > 0) && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-300 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" />Alertas</h3>
                {trialExpiring.map(v => (
                  <div key={v.id} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-amber-400" />
                      <div>
                        <p className="font-bold text-amber-300">{v.name}</p>
                        <p className="text-sm text-amber-300/60">Trial expira em {Math.ceil((new Date(v.trial_ends_at!).getTime() - Date.now()) / 86400000)} dias</p>
                      </div>
                    </div>
                    <a href={`https://wa.me/55${v.owner_phone}`} target="_blank" className="text-amber-400 font-bold text-sm hover:underline flex items-center gap-1">
                      <Phone size={14} />Contato
                    </a>
                  </div>
                ))}
                {vendors.filter(v => v.subscription_status === "overdue").map(v => (
                  <div key={v.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign size={18} className="text-red-400" />
                      <div>
                        <p className="font-bold text-red-300">{v.name}</p>
                        <p className="text-sm text-red-300/60">Pagamento em atraso</p>
                      </div>
                    </div>
                    <a href={`https://wa.me/55${v.owner_phone}`} target="_blank" className="text-red-400 font-bold text-sm hover:underline flex items-center gap-1">
                      <Phone size={14} />Contato
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========== QUIOSQUES ========== */}
        {activeTab === "vendors" && (
          <div className="space-y-6">
            {/* Search */}
            <div className="relative max-w-md w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nome, responsável ou cidade..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Vendors table */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-x-auto">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Quiosque</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Cidade</th>
                    <th className="p-4">Plano</th>
                    <th className="p-4">Assinatura</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map(v => {
                    const monthlyAmount = getVendorMonthlyAmount(v);
                    const billingSummary = getVendorBillingSummary(v);
                    return (
                    <tr key={v.id} className="border-t border-gray-700 hover:bg-gray-750 transition-colors">
                      <td className="p-4">
                        <p className="font-bold">{v.name}</p>
                        <p className="text-xs text-gray-500">{v.cnpj || v.cpf || "—"}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-gray-300">{v.owner_name}</p>
                        <p className="text-xs text-gray-500">{v.owner_phone}</p>
                      </td>
                      <td className="p-4 text-gray-300">{v.city ? `${v.city}/${v.state}` : "—"}</td>
                      <td className="p-4">
                        <span className={cn("text-xs font-bold px-2 py-1 rounded capitalize", {
                          "bg-green-500/20 text-green-400": v.plan_type === "monthly" || isAnnualPlan(v.plan_type),
                          "bg-amber-500/20 text-amber-400": v.plan_type === "trial",
                          "bg-gray-500/20 text-gray-400": !v.plan_type,
                        })}>
                          {getVendorPlanLabel(v)}
                        </span>
                        {v.plan_expires_at && isAnnualPlan(v.plan_type) && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Vigente ate {new Date(v.plan_expires_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-green-400">{monthlyAmount > 0 ? `${formatCurrency(monthlyAmount)}/mes` : "R$ 0,00"}</p>
                        <p className="mt-1 text-xs text-gray-500">{billingSummary}</p>
                      </td>
                      <td className="p-4">
                        {v.subscription_status === "active" && v.is_active ? (
                          <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold">ATIVO</span>
                        ) : v.subscription_status === "trial" ? (
                          <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-bold">TRIAL</span>
                        ) : v.subscription_status === "overdue" ? (
                          <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs font-bold">INADIMPLENTE</span>
                        ) : (
                          <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs font-bold">BLOQUEADO</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedVendor(v)}
                            className="text-gray-400 hover:text-white transition-colors bg-gray-700 p-2 rounded-lg hover:bg-gray-600"
                            title="Ver detalhes"
                          >
                            <Eye size={16} />
                          </button>
                          {v.subscription_status === "trial" && (
                            <button
                              onClick={() => migrateVendorToPaid(v)}
                              disabled={vendorActionLoading === v.id}
                              className="text-gray-400 hover:text-green-400 transition-colors bg-gray-700 p-2 rounded-lg hover:bg-green-500/10 disabled:opacity-40"
                              title="Migrar para plano pago"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => toggleVendor(v)}
                            disabled={vendorActionLoading === v.id}
                            className={cn("transition-colors p-2 rounded-lg disabled:opacity-40", v.is_active ? "text-gray-400 hover:text-red-400 bg-gray-700 hover:bg-red-500/10" : "text-gray-400 hover:text-green-400 bg-gray-700 hover:bg-green-500/10")}
                            title={v.is_active ? "Bloquear" : "Ativar"}
                          >
                            {v.is_active ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                          </button>
                          <a
                            href={`https://wa.me/55${v.owner_phone}`}
                            target="_blank"
                            className="text-gray-400 hover:text-green-400 transition-colors bg-gray-700 p-2 rounded-lg hover:bg-green-500/10"
                            title="WhatsApp"
                          >
                            <Phone size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== ANALYTICS ========== */}
        {activeTab === "analytics" && platformReport && false && (
          <div className="space-y-6">
            {/* Platform KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">GMV do Mês</p>
                <p className="text-3xl font-display font-bold text-blue-400">{formatCurrency(platformReport!.gmv)}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Total de Pedidos</p>
                <p className="text-3xl font-display font-bold text-green-400">{platformReport!.total_orders.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Clientes Únicos</p>
                <p className="text-3xl font-display font-bold text-purple-400">{platformReport!.total_customers.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Ticket Médio</p>
                <p className="text-3xl font-display font-bold text-amber-400">{formatCurrency(platformReport!.avg_ticket)}</p>
              </div>
            </div>

            {/* Retention + top vendors */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Taxa de Retenção</h3>
                <div className="flex items-center justify-center py-8">
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-700" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className="text-blue-500" strokeDasharray={`${platformReport!.retention_rate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-display font-bold text-white">{platformReport!.retention_rate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Ranking de Quiosques</h3>
                <div className="space-y-3">
                  {platformReport!.top_vendors.map((v, i) => {
                    const maxRev = Math.max(...platformReport!.top_vendors.map(x => x.revenue));
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm", i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-gray-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-gray-700 text-gray-400")}>
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm">{v.name}</span>
                            <span className="text-xs text-gray-400">{v.city} · {formatCurrency(v.revenue)}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(v.revenue / maxRev) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && platformReport && (
          <div className="space-y-6">
            <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
              <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
                <select
                  value={analyticsFilters.vendor_id}
                  onChange={e => setAnalyticsFilters(p => ({ ...p, vendor_id: e.target.value }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="">Todos os quiosques</option>
                  {platformReport!.filter_options.vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <select
                  value={analyticsFilters.city}
                  onChange={e => setAnalyticsFilters(p => ({ ...p, city: e.target.value }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="">Todas as cidades</option>
                  {platformReport!.filter_options.cities.map(cityName => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
                <select
                  value={analyticsFilters.beach}
                  onChange={e => setAnalyticsFilters(p => ({ ...p, beach: e.target.value }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="">Todas as praias</option>
                  {platformReport!.filter_options.beaches.map(beachName => (
                    <option key={beachName} value={beachName}>{beachName}</option>
                  ))}
                </select>
                <input
                  value={analyticsFilters.product}
                  onChange={e => setAnalyticsFilters(p => ({ ...p, product: e.target.value }))}
                  placeholder="Produto ou categoria"
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-blue-500"
                />
                <input
                  type="date"
                  value={analyticsFilters.from}
                  onChange={e => setAnalyticsFilters(p => ({ ...p, from: e.target.value }))}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => loadPlatformReport()}
                  disabled={analyticsLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl p-3 text-sm font-bold"
                >
                  {analyticsLoading ? "Filtrando..." : "Aplicar filtros"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">GMV</p>
                <p className="text-3xl font-display font-bold text-blue-400">{formatCurrency(platformReport!.gmv)}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Pedidos</p>
                <p className="text-3xl font-display font-bold text-green-400">{platformReport!.total_orders.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Visitantes</p>
                <p className="text-3xl font-display font-bold text-purple-400">{platformReport!.total_visitors.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Itens Vendidos</p>
                <p className="text-3xl font-display font-bold text-cyan-400">{platformReport!.total_products_sold.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Pico de Venda</p>
                <p className="text-3xl font-display font-bold text-amber-400">{String(platformReport!.peak_hour.hour).padStart(2, "0")}h</p>
              </div>
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Produtos mais vendidos</h3>
                <div className="space-y-3">
                  {platformReport!.top_products.map((product, i) => {
                    const max = Math.max(...platformReport!.top_products.map(p => p.quantity), 1);
                    return (
                      <div key={product.product_id} className="space-y-1">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="font-bold">{i + 1}. {product.name}</span>
                          <span className="text-gray-400">{product.quantity} un - {formatCurrency(product.revenue)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${(product.quantity / max) * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                    );
                  })}
                  {platformReport!.top_products.length === 0 && <p className="text-sm text-gray-500">Sem produtos vendidos neste filtro.</p>}
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Praias/localizacoes por faturamento</h3>
                <div className="space-y-3">
                  {platformReport!.top_beaches.map((beachItem, i) => (
                    <div key={`${beachItem.city}-${beachItem.beach}`} className="flex items-center justify-between gap-4 border-b border-gray-700 pb-3 last:border-0">
                      <div>
                        <p className="font-bold text-sm">{i + 1}. {beachItem.beach}</p>
                        <p className="text-xs text-gray-500">{beachItem.city} - {beachItem.quantity} itens</p>
                      </div>
                      <p className="font-bold text-green-400">{formatCurrency(beachItem.revenue)}</p>
                    </div>
                  ))}
                  {platformReport!.top_beaches.length === 0 && <p className="text-sm text-gray-500">Sem dados por praia neste filtro.</p>}
                </div>
              </div>
            </div>

            <div className="grid xl:grid-cols-3 gap-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Cidades</h3>
                <div className="space-y-3">
                  {platformReport!.top_cities.map(cityItem => (
                    <div key={cityItem.city} className="flex justify-between text-sm">
                      <span>{cityItem.city}</span>
                      <span className="font-bold text-green-400">{formatCurrency(cityItem.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Categorias</h3>
                <div className="space-y-3">
                  {platformReport!.top_categories.map(category => (
                    <div key={category.category} className="flex justify-between text-sm">
                      <span>{category.category}</span>
                      <span className="font-bold text-cyan-400">{category.quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Horario mais forte por produto</h3>
                <div className="space-y-3">
                  {platformReport!.peak_product_hours.map((item, i) => (
                    <div key={`${item.product}-${item.hour}-${i}`} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{item.product}</span>
                      <span className="font-bold text-amber-400">{String(item.hour).padStart(2, "0")}h - {item.quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <h3 className="font-bold text-gray-300 mb-4">Ranking de quiosques</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {platformReport!.top_vendors.map((vendor, i) => (
                  <div key={`${vendor.name}-${i}`} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{i + 1}. {vendor.name}</p>
                        <p className="text-xs text-gray-500">{vendor.city} - {vendor.beach}</p>
                      </div>
                      <p className="text-lg font-display font-bold text-green-400">{formatCurrency(vendor.revenue)}</p>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-gray-400">
                      <span>{vendor.orders} pedidos</span>
                      <span>{vendor.visitors} visitantes</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========== NOVO QUIOSQUE ========== */}
        {activeTab === "new" && (
          <div className="max-w-2xl w-full">
            {regSuccess ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
                <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-display font-bold text-green-400 mb-2">Quiosque cadastrado!</h3>
                <p className="text-gray-400 mb-6">O quiosque foi criado com <strong>3 dias grátis</strong> de avaliação.</p>
                <button
                  onClick={() => { setRegSuccess(false); setActiveTab("vendors"); }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700"
                >
                  Ver Quiosques
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-4">
                  <h3 className="font-bold text-lg text-gray-200 mb-2">Dados do Quiosque</h3>
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1">Nome do Quiosque *</label>
                    <input
                      type="text" required
                      value={regForm.name} onChange={e => setRegForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                      placeholder="Ex: Quiosque do Sol"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1">Praia *</label>
                    <input
                      type="text" required
                      value={regForm.beach_name} onChange={e => setRegForm(p => ({ ...p, beach_name: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                      placeholder="Praia das Pitangueiras"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Cidade *</label>
                      <input
                        type="text" required
                        value={regForm.city} onChange={e => setRegForm(p => ({ ...p, city: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="Santos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Estado *</label>
                      <input
                        type="text" required maxLength={2}
                        value={regForm.state} onChange={e => setRegForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="SP"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 space-y-4">
                  <h3 className="font-bold text-lg text-gray-200 mb-2">Dados do Responsável</h3>
                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-1">Nome Completo *</label>
                    <input
                      type="text" required
                      value={regForm.owner_name} onChange={e => setRegForm(p => ({ ...p, owner_name: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                      placeholder="João Silva"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">WhatsApp *</label>
                      <input
                        type="tel" required
                        value={regForm.owner_phone} onChange={e => setRegForm(p => ({ ...p, owner_phone: e.target.value.replace(/\D/g, '') }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="11999999999"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Email *</label>
                      <input
                        type="email" required
                        value={regForm.owner_email} onChange={e => setRegForm(p => ({ ...p, owner_email: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">CPF</label>
                      <input
                        type="text"
                        value={regForm.cpf} onChange={e => setRegForm(p => ({ ...p, cpf: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="123.456.789-00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">CNPJ</label>
                      <input
                        type="text"
                        value={regForm.cnpj} onChange={e => setRegForm(p => ({ ...p, cnpj: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="12.345.678/0001-90"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Senha *</label>
                      <input
                        type="password" required minLength={8}
                        value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="Min. 8 caracteres"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Confirmar Senha *</label>
                      <input
                        type="password" required minLength={8}
                        value={regForm.password_confirm} onChange={e => setRegForm(p => ({ ...p, password_confirm: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                  <label className="flex gap-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm font-bold text-gray-300">
                    <input
                      type="checkbox"
                      required
                      checked={regForm.terms_accepted}
                      onChange={e => setRegForm(p => ({ ...p, terms_accepted: e.target.checked }))}
                      className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span>
                      O responsavel leu e concordou com os{" "}
                      <Link href="/termos-de-uso" target="_blank" className="text-blue-400 underline underline-offset-2">
                        Termos de Uso do SandExpress
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                {regError && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                    {regError}
                  </div>
                )}

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 active:scale-95 transition-all">
                  Cadastrar Quiosque (3 dias grátis)
                </button>
              </form>
            )}
          </div>
        )}

        {/* ========== RISCO ========== */}
        {activeTab === "danger" && (
          <div className="max-w-3xl space-y-6">
            <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 shrink-0 text-red-300" size={24} />
                <div>
                  <h3 className="text-xl font-display font-bold text-red-200">Acoes destrutivas</h3>
                  <p className="mt-2 text-sm text-red-100/80">
                    Estas operacoes apagam dados reais do Supabase e arquivos relacionados no Storage quando aplicavel.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 space-y-4">
              <label className="block text-sm font-bold text-gray-400">Quiosque</label>
              <select
                value={dangerForm.vendor_id}
                onChange={e => setDangerForm(p => ({ ...p, vendor_id: e.target.value }))}
                className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-blue-500"
              >
                <option value="">Todos os quiosques apenas para apagar clientes</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>

              <label className="block text-sm font-bold text-gray-400">Senha do admin</label>
              <input
                type="password"
                value={dangerForm.admin_password}
                onChange={e => setDangerForm(p => ({ ...p, admin_password: e.target.value }))}
                className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-blue-500"
                placeholder="Confirme a senha do admin"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 space-y-4">
                <h3 className="text-lg font-display font-bold text-white">Apagar clientes</h3>
                <p className="text-sm text-gray-400">
                  Apaga clientes, pedidos e itens de pedido. Com quiosque selecionado, tambem remove arquivos arquivados daquele quiosque no Storage.
                </p>
                <input
                  type="text"
                  value={dangerForm.customer_confirmation}
                  onChange={e => setDangerForm(p => ({ ...p, customer_confirmation: e.target.value }))}
                  className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-red-400"
                  placeholder="APAGAR CLIENTES"
                />
                <button
                  type="button"
                  disabled={dangerLoading !== null}
                  onClick={eraseCustomers}
                  className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <Trash2 size={18} /> {dangerLoading === "customers" ? "Apagando..." : "Apagar clientes"}
                </button>
              </div>

              <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 space-y-4">
                <h3 className="text-lg font-display font-bold text-white">Apagar quiosque completo</h3>
                <p className="text-sm text-gray-400">
                  Apaga o tenant/quiosque e todos os dados vinculados por cascata, incluindo clientes, pedidos, produtos, guarda-sois e arquivos do Storage.
                </p>
                <input
                  type="text"
                  value={dangerForm.kiosk_confirmation}
                  onChange={e => setDangerForm(p => ({ ...p, kiosk_confirmation: e.target.value }))}
                  className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-red-400"
                  placeholder="APAGAR QUIOSQUE"
                />
                <button
                  type="button"
                  disabled={dangerLoading !== null || !dangerForm.vendor_id}
                  onClick={eraseKiosk}
                  className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  <Trash2 size={18} /> {dangerLoading === "kiosk" ? "Apagando..." : "Apagar quiosque"}
                </button>
              </div>
            </div>

            {dangerMessage && (
              <div className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-bold text-gray-100">
                {dangerMessage}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-800 bg-gray-950/95 px-3 pt-2 app-bottom-safe shadow-[0_-12px_32px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setRegSuccess(false); setSidebarOpen(false); }}
              className={cn(
                "tap-target flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-black",
                activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400"
              )}
            >
              <tab.icon size={19} />
              <span className="mt-0.5 max-w-full truncate">{tab.label === "Novo Quiosque" ? "Novo" : tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ========== VENDOR DETAIL MODAL ========== */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVendor(null)}>
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-display font-bold">{selectedVendor.name}</h3>
              <button onClick={() => setSelectedVendor(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Responsável</p>
                  <p className="font-bold">{selectedVendor.owner_name}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Telefone</p>
                  <p className="font-bold">{selectedVendor.owner_phone}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Email</p>
                  <p className="font-bold">{selectedVendor.owner_email || "—"}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Localização</p>
                  <p className="font-bold">{selectedVendor.city ? `${selectedVendor.city}/${selectedVendor.state}` : "—"}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">CPF</p>
                  <p className="font-bold">{selectedVendor.cpf || "—"}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">CNPJ</p>
                  <p className="font-bold">{selectedVendor.cnpj || "—"}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Status</p>
                  <p className={cn("font-bold capitalize", {
                    "text-green-400": selectedVendor.subscription_status === "active",
                    "text-amber-400": selectedVendor.subscription_status === "trial",
                    "text-orange-400": selectedVendor.subscription_status === "overdue",
                    "text-red-400": selectedVendor.subscription_status === "blocked",
                  })}>{selectedVendor.subscription_status}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Assinatura mensal</p>
                  <p className="font-bold text-green-400">
                    {getVendorMonthlyAmount(selectedVendor) > 0 ? `${formatCurrency(getVendorMonthlyAmount(selectedVendor))}/mes` : "R$ 0,00"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{getVendorBillingSummary(selectedVendor)}</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-xl">
                  <p className="text-xs text-gray-400 font-bold mb-1">Máx. Guarda-Sóis</p>
                  <p className="font-bold">{selectedVendor.max_umbrellas}</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Cadastrado em {new Date(selectedVendor.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <a
                href={`https://wa.me/55${selectedVendor.owner_phone}`}
                target="_blank"
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-center hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Phone size={18} /> WhatsApp
              </a>
              {selectedVendor.owner_email && (
                <a
                  href={`mailto:${selectedVendor.owner_email}`}
                  className="flex-1 py-3 bg-gray-700 text-white rounded-xl font-bold text-center hover:bg-gray-600 flex items-center justify-center gap-2"
                >
                  <Mail size={18} /> Email
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
