"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard, Store, TrendingUp, Plus, ShieldCheck, Ban, CheckCircle2,
  X, Search, Eye, AlertTriangle, DollarSign, Users, ShoppingBag, Phone,
  Mail, MapPin, Clock, ExternalLink, ChevronDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// ---------- TYPES ----------
interface Vendor {
  id: string;
  name: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string | null;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  cpf: string | null;
  subscription_status: string;
  plan_type: string | null;
  trial_ends_at: string | null;
  is_active: boolean;
  max_umbrellas: number;
  created_at: string;
}

interface PlatformReport {
  gmv: number;
  total_orders: number;
  total_customers: number;
  avg_ticket: number;
  active_vendors: number;
  trial_vendors: number;
  overdue_vendors: number;
  blocked_vendors: number;
  retention_rate: number;
  top_vendors: { name: string; city: string; revenue: number }[];
  monthly_received: number;
  next_cycle_receivable: number;
  overdue_amount: number;
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vendors", label: "Quiosques", icon: Store },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "new", label: "Novo Quiosque", icon: Plus },
];

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

  // Registration form
  const [regForm, setRegForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", city: "", state: "",
  });
  const [regSuccess, setRegSuccess] = useState(false);

  // Load platform report
  useEffect(() => {
    if (activeTab === "analytics" || activeTab === "overview") {
      fetch("/api/reports/platform")
        .then(r => r.json())
        .then(d => setPlatformReport(d))
        .catch(console.error);
    }
  }, [activeTab]);

  // Admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("admin_token", "authenticated");
      } else {
        setAuthError("Senha incorreta.");
      }
    } catch {
      setAuthError("Erro ao conectar.");
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("admin_token")) {
      setIsAuthenticated(true);
      loadVendors();
      loadPlatformReport();
    }
  }, []);

  const loadVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadPlatformReport = async () => {
    try {
      const res = await fetch('/api/reports/platform');
      if (res.ok) {
        const data = await res.json();
        setPlatformReport(data);
      }
    } catch (err) {
      console.error('Failed to load platform report:', err);
    }
  };

  // Toggle vendor status
  const toggleVendor = (id: string) => {
    setVendors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const newActive = !v.is_active;
      return {
        ...v,
        is_active: newActive,
        subscription_status: newActive ? (v.subscription_status === "blocked" ? "active" : v.subscription_status) : "blocked",
      };
    }));
  };

  // Register vendor
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.owner_name || !regForm.owner_phone) return;

    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(prev => [{
          id: data.id,
          ...regForm,
          owner_email: regForm.owner_email || null,
          city: regForm.city || null,
          state: regForm.state || null,
          cnpj: regForm.cnpj || null,
          cpf: regForm.cpf || null,
          subscription_status: "trial",
          plan_type: "trial",
          trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          is_active: true,
          max_umbrellas: 5,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setRegSuccess(true);
        setRegForm({ name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", city: "", state: "" });
      }
    } catch (err) {
      console.error("Register error:", err);
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
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
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 flex flex-col border-r border-gray-800 shrink-0">
        <div className="p-6 border-b border-gray-800">
          <h1 className="font-display font-bold text-xl flex items-center gap-2"><ShieldCheck className="text-blue-500" /> God Mode</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map(tab => (
            <button
              key={tab.id} onClick={() => { setActiveTab(tab.id); setRegSuccess(false); }}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold text-sm transition-colors", activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white")}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8 bg-gray-900">
        <h2 className="text-3xl font-display font-bold mb-8 capitalize">{TABS.find(t => t.id === activeTab)?.label}</h2>

        {/* ========== OVERVIEW ========== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Receita Total</p>
                <p className="text-3xl font-display font-bold text-blue-400">
                  {platformReport ? formatCurrency(platformReport.gmv) : "..."}
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
              <div className="flex gap-6 mt-3 text-sm">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500" />Ativos ({activeCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500" />Trial ({trialCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-500" />Inadimplentes ({overdueCount})</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500" />Bloqueados ({blockedCount})</span>
              </div>
            </div>

            {/* Billing KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Recebido Mensal</p>
                <p className="text-3xl font-display font-bold text-green-400">
                  {platformReport ? formatCurrency(platformReport.monthly_received) : '...'}
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">A receber no próximo ciclo</p>
                <p className="text-3xl font-display font-bold text-blue-400">
                  {platformReport ? formatCurrency(platformReport.next_cycle_receivable) : '...'}
                </p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Valor de inadimplência</p>
                <p className="text-3xl font-display font-bold text-red-400">
                  {platformReport ? formatCurrency(platformReport.overdue_amount) : '...'}
                </p>
              </div>
            </div>

            {/* Alerts */}
            {(trialExpiring.length > 0 || overdueCount > 0) && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-300 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" />Alertas</h3>
                {trialExpiring.map(v => (
                  <div key={v.id} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
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
                  <div key={v.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
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
            <div className="relative max-w-md">
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
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Quiosque</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Cidade</th>
                    <th className="p-4">Plano</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map(v => (
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
                          "bg-green-500/20 text-green-400": v.plan_type === "monthly" || v.plan_type === "12months",
                          "bg-amber-500/20 text-amber-400": v.plan_type === "trial",
                          "bg-gray-500/20 text-gray-400": !v.plan_type,
                        })}>
                          {v.plan_type === "12months" ? "Anual" : v.plan_type === "monthly" ? "Mensal" : v.plan_type || "—"}
                        </span>
                        {v.trial_ends_at && (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Trial até {new Date(v.trial_ends_at).toLocaleDateString("pt-BR")}
                          </p>
                        )}
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
                          <button
                            onClick={() => toggleVendor(v.id)}
                            className={cn("transition-colors p-2 rounded-lg", v.is_active ? "text-gray-400 hover:text-red-400 bg-gray-700 hover:bg-red-500/10" : "text-gray-400 hover:text-green-400 bg-gray-700 hover:bg-green-500/10")}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== ANALYTICS ========== */}
        {activeTab === "analytics" && platformReport && (
          <div className="space-y-6">
            {/* Platform KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">GMV do Mês</p>
                <p className="text-3xl font-display font-bold text-blue-400">{formatCurrency(platformReport.gmv)}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Total de Pedidos</p>
                <p className="text-3xl font-display font-bold text-green-400">{platformReport.total_orders.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Clientes Únicos</p>
                <p className="text-3xl font-display font-bold text-purple-400">{platformReport.total_customers.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Ticket Médio</p>
                <p className="text-3xl font-display font-bold text-amber-400">{formatCurrency(platformReport.avg_ticket)}</p>
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
                      <path className="text-blue-500" strokeDasharray={`${platformReport.retention_rate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-display font-bold text-white">{platformReport.retention_rate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <h3 className="font-bold text-gray-300 mb-4">Ranking de Quiosques</h3>
                <div className="space-y-3">
                  {platformReport.top_vendors.map((v, i) => {
                    const maxRev = Math.max(...platformReport.top_vendors.map(x => x.revenue));
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

        {/* ========== NOVO QUIOSQUE ========== */}
        {activeTab === "new" && (
          <div className="max-w-2xl">
            {regSuccess ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
                <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-display font-bold text-green-400 mb-2">Quiosque cadastrado!</h3>
                <p className="text-gray-400 mb-6">O quiosque foi criado com <strong>7 dias grátis</strong> de avaliação.</p>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={regForm.city} onChange={e => setRegForm(p => ({ ...p, city: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="Santos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-1">Estado</label>
                      <input
                        type="text" maxLength={2}
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
                  <div className="grid grid-cols-2 gap-4">
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
                      <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={regForm.owner_email} onChange={e => setRegForm(p => ({ ...p, owner_email: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-blue-700 active:scale-95 transition-all">
                  Cadastrar Quiosque (7 dias grátis)
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* ========== VENDOR DETAIL MODAL ========== */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVendor(null)}>
          <div className="bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-display font-bold">{selectedVendor.name}</h3>
              <button onClick={() => setSelectedVendor(null)} className="text-gray-400 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
