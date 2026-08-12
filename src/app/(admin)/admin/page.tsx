"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Store, TrendingUp, Plus, ShieldCheck, Ban, CheckCircle2,
  X, Search, Eye, AlertTriangle, DollarSign, Phone, Mail, Clock, Menu, Trash2, Star, Save,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { DEFAULT_PLATFORM_PLAN_SETTINGS, formatPlanPriceLabel, PLAN_PRICES, PlatformPlanSettings } from "@/lib/plans";

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
  plan_monthly_price?: number | null;
  plan_annual_monthly_price?: number | null;
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
  satisfaction_average: number;
  satisfaction_total: number;
  active_vendors: number;
  trial_vendors: number;
  overdue_vendors: number;
  blocked_vendors: number;
  retention_rate: number;
  top_vendors: { name: string; city: string; beach: string; revenue: number; orders: number; visitors: number }[];
  satisfaction_by_vendor: { name: string; city: string; beach: string; average_rating: number; total_responses: number }[];
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
  { id: "plans", label: "Planos", icon: DollarSign },
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
  return isAnnualPlan(vendor.plan_type)
    ? Number(vendor.plan_annual_monthly_price ?? PLAN_PRICES.annualMonthly)
    : Number(vendor.plan_monthly_price ?? PLAN_PRICES.monthly);
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
  const [beachOperationsByVendor, setBeachOperationsByVendor] = useState<Record<string, boolean>>({});
  const [featureMessage, setFeatureMessage] = useState("");
  const [dangerLoading, setDangerLoading] = useState<"customers" | "kiosk" | null>(null);
  const [planSettings, setPlanSettings] = useState<PlatformPlanSettings>(DEFAULT_PLATFORM_PLAN_SETTINGS);
  const [planForm, setPlanForm] = useState({
    monthly_price: String(DEFAULT_PLATFORM_PLAN_SETTINGS.monthly_price),
    annual_monthly_price: String(DEFAULT_PLATFORM_PLAN_SETTINGS.annual_monthly_price),
    trial_days: String(DEFAULT_PLATFORM_PLAN_SETTINGS.trial_days),
    max_umbrellas: String(DEFAULT_PLATFORM_PLAN_SETTINGS.max_umbrellas),
  });
  const [planSaving, setPlanSaving] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
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

  const openVendorDetails = async (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFeatureMessage("");
    try {
      const response = await fetch(`/api/admin/vendor-features?vendor_id=${vendor.id}`, { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setBeachOperationsByVendor(current => ({ ...current, [vendor.id]: Boolean(data.features?.beach_operations) }));
    } catch {
      setFeatureMessage("NÃ£o foi possÃ­vel consultar os mÃ³dulos deste quiosque.");
    }
  };

  const toggleBeachOperations = async (vendor: Vendor) => {
    const enabled = !beachOperationsByVendor[vendor.id];
    setVendorActionLoading(vendor.id);
    setFeatureMessage("");
    try {
      const response = await fetch("/api/admin/vendor-features", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_id: vendor.id, feature_key: "beach_operations", enabled }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao liberar mÃ³dulo.");
      setBeachOperationsByVendor(current => ({ ...current, [vendor.id]: enabled }));
      setFeatureMessage(enabled ? "OperaÃ§Ã£o simplificada liberada." : "OperaÃ§Ã£o simplificada bloqueada.");
    } catch (reason) {
      setFeatureMessage(reason instanceof Error ? reason.message : "Erro ao salvar mÃ³dulo.");
    } finally {
      setVendorActionLoading(null);
    }
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
        await loadPlanSettings();
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
      await loadPlanSettings();
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

  const applyPlanSettings = (settings: PlatformPlanSettings) => {
    setPlanSettings(settings);
    setPlanForm({
      monthly_price: String(settings.monthly_price),
      annual_monthly_price: String(settings.annual_monthly_price),
      trial_days: String(settings.trial_days),
      max_umbrellas: String(settings.max_umbrellas),
    });
  };

  const loadPlanSettings = async () => {
    try {
      const res = await fetch("/api/platform-settings/plans", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        handleAdminSessionExpired();
        return;
      }
      if (!res.ok) {
        setPlanMessage(data.error || "Nao foi possivel carregar valores dos planos.");
        return;
      }
      applyPlanSettings(data);
    } catch {
      setPlanMessage("Erro de rede ao carregar valores dos planos.");
    }
  };

  const savePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanSaving(true);
    setPlanMessage("");
    try {
      const res = await fetch("/api/platform-settings/plans", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_price: planForm.monthly_price,
          annual_monthly_price: planForm.annual_monthly_price,
          trial_days: planForm.trial_days,
          max_umbrellas: planForm.max_umbrellas,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlanMessage(data.error || "Nao foi possivel salvar valores dos planos.");
        return;
      }
      applyPlanSettings(data);
      setPlanMessage("Valores salvos. Eles serao usados somente nos proximos quiosques cadastrados.");
    } catch {
      setPlanMessage("Erro de rede ao salvar valores dos planos.");
    } finally {
      setPlanSaving(false);
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

  const toggleVendor = async (vendor: Vendo×¾øÚÚ$z{-®éÜj×¢ÂöF—càĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓB#àĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓCÖ"Ó#å6Væ†£ÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ'77v÷&B"&WV—&VBÖ–äÆVæwFƒ×³‡ĞĞ¢fÇVS×·&Vtf÷&Òç77v÷&GÒöä6†ævS×¶RÓâ6WE&Vtf÷&Ò‡Óâ‡²ââçÂ77v÷&C¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&rÖw&’Ós&÷&FW"&÷&FW"Öw&’Óc&÷VæFVB×†ÂÓ2FW‡B×v†—FRfö7W3¦&÷&FW"Ö&ÇVRÓS÷WFÆ–æRÖæöæR Ğ¢Æ6V†öÆFW#Ò$Ö–ââ‚6&7FW&W2 Ğ¢óàĞ¢ÂöF—càĞ¢ÆF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓCÖ"Ó#ä6öæf—&Ö"6Væ†£ÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ'77v÷&B"&WV—&VBÖ–äÆVæwFƒ×³‡ĞĞ¢fÇVS×·&Vtf÷&Òç77v÷&Eö6öæf—&×Òöä6†ævS×¶RÓâ6WE&Vtf÷&Ò‡Óâ‡²ââçÂ77v÷&Eö6öæf—&Ó¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&rÖw&’Ós&÷&FW"&÷&FW"Öw&’Óc&÷VæFVB×†ÂÓ2FW‡B×v†—FRfö7W3¦&÷&FW"Ö&ÇVRÓS÷WFÆ–æRÖæöæR Ğ¢Æ6V†öÆFW#Ò%&W—F6Væ† Ğ¢óàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚vÓ2&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’Ó“ócÓBFW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ó3#àĞ¢Æ–çW@Ğ¢G—SÒ&6†V6¶&÷‚ Ğ¢&WV—&V@Ğ¢6†V6¶VC×·&Vtf÷&ÒçFW&×5ö66WFVGĞĞ¢öä6†ævS×¶RÓâ6WE&Vtf÷&Ò‡Óâ‡²ââçÂFW&×5ö66WFVC¢RçF&vWBæ6†V6¶VBÒ’—ĞĞ¢6Æ74æÖSÒ&×BÓ‚ÓBrÓB6‡&–æ²Ó66VçBÖ&ÇVRÓc Ğ¢óàĞ¢Ç7ãàĞ¢ò&W7öç6fVÂÆWRR6V—F÷R÷7²"'ĞĞ¢ÄÆ–æ²‡&VcÒ"÷FW&Ö÷2ÖFR×W6ò"F&vWCÒ%ö&Ææ²"6Æ74æÖSÒ'FW‡BÖ&ÇVRÓCVæFW&Æ–æRVæFW&Æ–æRÖöfg6WBÓ"#àĞ¢FW&Ö÷2FRW6òRöÆ—F–6FR&—f6–FFRFò6æDW‡&W70Ğ¢ÂôÆ–æ³àĞ¢Â6öÒ&Vv—7G&òFò6V—FRVÒFFR†÷&àĞ¢Â÷7ãàĞ¢ÂöÆ&VÃàĞ¢ÂöF—càĞ Ğ¢·&VtW'&÷"bb€Ğ¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"×&VBÓSóC&r×&VBÓSó‚ÓB’Ó2FW‡B×6ÒföçBÖ&öÆBFW‡B×&VBÓ3#àĞ¢·&VtW'&÷'ĞĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢Æ'WGFöâG—SÒ'7V&Ö—B"6Æ74æÖSÒ'rÖgVÆÂ&rÖ&ÇVRÓcFW‡B×v†—FRföçBÖ&öÆB’ÓB&÷VæFVB×†ÂFW‡BÖÆr†÷fW#¦&rÖ&ÇVRÓs7F—fS§66ÆRÓ“RG&ç6—F–öâÖÆÂ#àĞ¢6F7G&"V–÷7VRƒ2F–2w,:F—2Ğ¢Âö'WGFöãàĞ¢Âöf÷&ÓàĞ¢—ĞĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢²ò¢ÓÓÓÓÓÓÓÓÓÒ$•44òÓÓÓÓÓÓÓÓÓÒ¢÷ĞĞ¢¶7F—fUF"ÓÓÒ&FævW""bb€Ğ¢ÆF—b6Æ74æÖSÒ&Ö‚×rÓ7†Â76R×’Ób#àĞ¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"×&VBÓSóC&r×&VBÓ“Só3Ób#àĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2×7F'BvÓ2#àĞ¢ÄÆW'EG&–ævÆR6Æ74æÖSÒ&×BÓ6‡&–æ²ÓFW‡B×&VBÓ3"6—¦S×³#GÒóàĞ¢ÆF—càĞ¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆBFW‡B×&VBÓ##ä6öW2FW7G'WF—f3Âöƒ3àĞ¢Ç6Æ74æÖSÒ&×BÓ"FW‡B×6ÒFW‡B×&VBÓóƒ#àĞ¢W7F2÷W&6öW2vÒFF÷2&V—2Fò7W&6RR'V—f÷2&VÆ6–öæF÷2æò7F÷&vRVæFòÆ–6fVÂàĞ¢Â÷àĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#àĞ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓC#åV–÷7VSÂöÆ&VÃàĞ¢Ç6VÆV7@Ğ¢fÇVS×¶FævW$f÷&ÒçfVæF÷%ö–GĞĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂfVæF÷%ö–C¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Ö&ÇVRÓS Ğ¢àĞ¢Æ÷F–öâfÇVSÒ"#åFöF÷2÷2V–÷7VW2Væ2&v"6Æ–VçFW3Âö÷F–öãàĞ¢·fVæF÷'2æÖ‡fVæF÷"Óâ€Ğ¢Æ÷F–öâ¶W“×·fVæF÷"æ–GÒfÇVS×·fVæF÷"æ–GÓç·fVæF÷"ææÖWÓÂö÷F–öãàĞ¢’—ĞĞ¢Â÷6VÆV7CàĞ Ğ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓC#å6Væ†FòFÖ–ãÂöÆ&VÃàĞ¢Æ–çW@Ğ¢G—SÒ'77v÷&B Ğ¢fÇVS×¶FævW$f÷&ÒæFÖ–å÷77v÷&GĞĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂFÖ–å÷77v÷&C¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Ö&ÇVRÓS Ğ¢Æ6V†öÆFW#Ò$6öæf—&ÖR6Væ†FòFÖ–â Ğ¢óàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ&w&–BvÓbÆs¦w&–BÖ6öÇ2Ó"#àĞ¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#àĞ¢Æƒ26Æ74æÖSÒ'FW‡BÖÆrföçBÖF—7Æ’föçBÖ&öÆBFW‡B×v†—FR#äv"6Æ–VçFW3Âöƒ3àĞ¢Ç6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓC#àĞ¢v6Æ–VçFW2ÂVF–F÷2R—FVç2FRVF–Fòâ6öÒV–÷7VR6VÆV6–öæFòÂFÖ&VÒ&VÖ÷fR'V—f÷2'V—fF÷2FVVÆRV–÷7VRæò7F÷&vRàĞ¢Â÷àĞ¢Æ–çW@Ğ¢G—SÒ'FW‡B Ğ¢fÇVS×¶FævW$f÷&Òæ7W7FöÖW%ö6öæf—&ÖF–öçĞĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂ7W7FöÖW%ö6öæf—&ÖF–öã¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"×&VBÓC Ğ¢Æ6V†öÆFW#Ò$t"4Ä”TåDU2 Ğ¢óàĞ¢Æ'WGFöàĞ¢G—SÒ&'WGFöâ Ğ¢F—6&ÆVC×¶FævW$ÆöF–ærÓÒçVÆÇĞĞ¢öä6Æ–6³×¶W&6T7W7FöÖW'7ĞĞ¢6Æ74æÖSÒ'F×F&vWBfÆW‚rÖgVÆÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷VæFVB×†Â&r×&VBÓc‚ÓB’Ó2föçBÖ&öÆBFW‡B×v†—FR†÷fW#¦&r×&VBÓsF—6&ÆVC¦÷6—G’Óc Ğ¢àĞ¢ÅG&6ƒ"6—¦S×³‡Òóâ¶FævW$ÆöF–ærÓÓÒ&7W7FöÖW'2"ò$væFòâââ"¢$v"6Æ–VçFW2'ĞĞ¢Âö'WGFöãàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#àĞ¢Æƒ26Æ74æÖSÒ'FW‡BÖÆrföçBÖF—7Æ’föçBÖ&öÆBFW‡B×v†—FR#äv"V–÷7VR6ö×ÆWFóÂöƒ3àĞ¢Ç6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓC#àĞ¢vòFVæçB÷V–÷7VRRFöF÷2÷2FF÷2f–æ7VÆF÷2÷"666FÂ–æ6ÇV–æFò6Æ–VçFW2ÂVF–F÷2Â&öGWF÷2ÂwV&F×6ö—2R'V—f÷2Fò7F÷&vRàĞ¢Â÷àĞ¢Æ–çW@Ğ¢G—SÒ'FW‡B Ğ¢fÇVS×¶FævW$f÷&Òæ¶–÷6µö6öæf—&ÖF–öçĞĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂ¶–÷6µö6öæf—&ÖF–öã¢RçF&vWBçfÇVRÒ’—ĞĞ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"×&VBÓC Ğ¢Æ6V†öÆFW#Ò$t"T”õ5TR Ğ¢óàĞ¢Æ'WGFöàĞ¢G—SÒ&'WGFöâ Ğ¢F—6&ÆVC×¶FævW$ÆöF–ærÓÒçVÆÂÇÂFævW$f÷&ÒçfVæF÷%ö–GĞĞ¢öä6Æ–6³×¶W&6T¶–÷6·ĞĞ¢6Æ74æÖSÒ'F×F&vWBfÆW‚rÖgVÆÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷VæFVB×†Â&r×&VBÓs‚ÓB’Ó2föçBÖ&öÆBFW‡B×v†—FR†÷fW#¦&r×&VBÓƒF—6&ÆVC¦÷6—G’Óc Ğ¢àĞ¢ÅG&6ƒ"6—¦S×³‡Òóâ¶FævW$ÆöF–ærÓÓÒ&¶–÷6²"ò$væFòâââ"¢$v"V–÷7VR'ĞĞ¢Âö'WGFöãàĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢¶FævW$ÖW76vRbb€Ğ¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’Óƒ‚ÓB’Ó2FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ó#àĞ¢¶FævW$ÖW76vWĞĞ¢ÂöF—càĞ¢—ĞĞ¢ÂöF—càĞ¢—ĞĞ¢ÂöÖ–ãàĞ Ğ¢Ææb6Æ74æÖSÒ&f—†VB–ç6WB×‚Ó&÷GFöÒÓ¢Ó3&÷&FW"×B&÷&FW"Öw&’Óƒ&rÖw&’Ó“Só“R‚Ó2BÓ"Ö&÷GFöÒ×6fR6†F÷rÕ³òÓ'…ó3'…÷&v&ƒÃÃÃã#‚•Ò&6¶G&÷Ö&ÇW"Æs¦†–FFVâ#àĞ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2ÓRvÓ"#àĞ¢µD%2æÖ‡F"Óâ€Ğ¢Æ'WGFöàĞ¢¶W“×·F"æ–GĞĞ¢öä6Æ–6³×²‚’Óâ²6WD7F—fUF"‡F"æ–B“²6WE&Vu7V66W72†fÇ6R“²6WE6–FV&$÷Vâ†fÇ6R“²×ĞĞ¢6Æ74æÖS×¶6â€Ğ¢'F×F&vWBfÆW‚fÆW‚Ö6öÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷VæFVBÓ'†Â‚Ó"’Ó"FW‡BÕ³…ÒföçBÖ&Æ6²"ÀĞ¢7F—fUF"ÓÓÒF"æ–Bò&&rÖ&ÇVRÓcFW‡B×v†—FR"¢'FW‡BÖw&’ÓC Ğ¢—ĞĞ¢àĞ¢ÇF"æ–6öâ6—¦S×³—ÒóàĞ¢Ç7â6Æ74æÖSÒ&×BÓãRÖ‚×rÖgVÆÂG'Væ6FR#ç·F"æÆ&VÂÓÓÒ$æ÷fòV–÷7VR"ò$æ÷fò"¢F"æÆ&VÇÓÂ÷7ãàĞ¢Âö'WGFöãàĞ¢’—ĞĞ¢ÂöF—càĞ¢ÂöæcàĞ Ğ¢²ò¢ÓÓÓÓÓÓÓÓÓÒdTäDõ"DUD”ÂÔôDÂÓÓÓÓÓÓÓÓÓÒ¢÷ĞĞ¢·6VÆV7FVEfVæF÷"bb€Ğ¢ÆF—b6Æ74æÖSÒ&f—†VB–ç6WBÓ&rÖ&Æ6²óc¢ÓSfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"ÓB"öä6Æ–6³×²‚’Óâ6WE6VÆV7FVEfVæF÷"†çVÆÂ—ÓàĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’Óƒ&÷VæFVBÓ'†ÂÖ‚×rÖÆrrÖgVÆÂÖ‚Ö‚Õ³“f…Ò÷fW&fÆ÷r×’ÖWFò&÷&FW"&÷&FW"Öw&’Ós6†F÷rÓ'†Â"öä6Æ–6³×¶RÓâRç7F÷&÷vF–öâ‚—ÓàĞ¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2Ö6VçFW"Ób&÷&FW"Ö"&÷&FW"Öw&’Ós#àĞ¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"ææÖWÓÂöƒ3àĞ¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WE6VÆV7FVEfVæF÷"†çVÆÂ—Ò6Æ74æÖSÒ'FW‡BÖw&’ÓC†÷fW#§FW‡B×v†—FR#ãÅ‚6—¦S×³#GÒóãÂö'WGFöãàĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'Ób76R×’ÓB#àĞ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓB#àĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#å&W7öç<:fVÃÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%öæÖWÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åFVÆVföæSÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%÷†öæWÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#äVÖ–ÃÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–ÂÇÂ.(	B'ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#äÆö6Æ—¦:|:6óÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ6—G’òG·6VÆV7FVEfVæF÷"æ6—G—ÒòG·6VÆV7FVEfVæF÷"ç7FFWÖ¢.(	B'ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä5cÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ7bÇÂ.(	B'ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä4å£Â÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ6ç¢ÇÂ.(	B'ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#å7FGW3Â÷àĞ¢Ç6Æ74æÖS×¶6â‚&föçBÖ&öÆB6—FÆ—¦R"Â°Ğ¢'FW‡BÖw&VVâÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&7F—fR"ÀĞ¢'FW‡BÖÖ&W"ÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ'G&–Â"ÀĞ¢'FW‡BÖ÷&ævRÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&÷fW&GVR"ÀĞ¢'FW‡B×&VBÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&&Æö6¶VB"ÀĞ¢Ò—Óç·6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW7ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä76–æGW&ÖVç6ÃÂ÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&VVâÓC#àĞ¢¶vWEfVæF÷$ÖöçF†Ç”Ö÷VçB‡6VÆV7FVEfVæF÷"’âòG¶f÷&ÖD7W'&Væ7’†vWEfVæF÷$ÖöçF†Ç”Ö÷VçB‡6VÆV7FVEfVæF÷"’—ÒöÖW6¢%"BÃ'ĞĞ¢Â÷àĞ¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2FW‡BÖw&’ÓS#ç¶vWEfVæF÷$&–ÆÆ–æu7VÖÖ'’‡6VÆV7FVEfVæF÷"—ÓÂ÷àĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#àĞ¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#äÜ:‚âwV&FÕ<;6—3Â÷àĞ¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æÖ…÷VÖ'&VÆÆ7ÓÂ÷àĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓS#à¢6F7G&FòVÒ¶æWrFFR‡6VÆV7FVEfVæF÷"æ7&VFVEöB’çFôÆö6ÆTFFU7G&–ær‚'BÔ%""—Ğ¢ÂöF—cà¢Ç6V7F–öâ6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Ö÷&ævRÓCó3&rÖ÷&ævRÓSóÓB#à¢Ç6Æ74æÖSÒ&föçBÖ&Æ6²FW‡BÖ÷&ævRÓ##åfW'<:6ò6–×Æ–f–6F&&'&6Â÷à¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2föçBÖ&öÆBÆVF–ærÓRFW‡BÖ÷&ævRÓós#äÆ–&W&6öÖVçFR¶æ&âFRVF–F÷2ÂW7F÷VRÂfV6†ÖVçFò÷&VÆL;7&–÷2R–×&W76÷&2VÒÆ6öFSâ÷fVæF÷"ö÷W&F–öç3Âö6öFSâãÂ÷à¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×·fVæF÷$7F–öäÆöF–ærÓÓÒ6VÆV7FVEfVæF÷"æ–GĞ¢öä6Æ–6³×²‚’Óâfö–BFövvÆT&V6„÷W&F–öç2‡6VÆV7FVEfVæF÷"—Ğ¢6Æ74æÖS×¶6â‚&×BÓ2Ö–âÖ‚ÓrÖgVÆÂ&÷VæFVB×†Â‚ÓBföçBÖ&Æ6²FW‡B×v†—FRF—6&ÆVC¦÷6—G’ÓS"Â&V6„÷W&F–öç4'•fVæF÷%·6VÆV7FVEfVæF÷"æ–EÒò&&r×&VBÓc†÷fW#¦&r×&VBÓs"¢&&rÖw&VVâÓc†÷fW#¦&rÖw&VVâÓs"—Ğ¢à¢¶&V6„÷W&F–öç4'•fVæF÷%·6VÆV7FVEfVæF÷"æ–EÒò$&Æ÷VV"fW'<:6ò6–×Æ–f–6F"¢$Æ–&W&"fW'<:6ò6–×Æ–f–6F'Ğ¢Âö'WGFöãà¢¶fVGW&TÖW76vRbbÇ&öÆSÒ'7FGW2"6Æ74æÖSÒ&×BÓ2FW‡B×‡2föçBÖ&öÆBFW‡B×v†—FR#ç¶fVGW&TÖW76vWÓÂ÷çĞ¢Â÷6V7F–öãà¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’ÓsfÆW‚vÓ2#àĞ¢ÆĞ¢‡&Vc×¶‡GG3¢ò÷væÖRóSRG·6VÆV7FVEfVæF÷"æ÷væW%÷†öæWÖĞĞ¢F&vWCÒ%ö&Ææ² Ğ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÖw&VVâÓcFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖ6VçFW"†÷fW#¦&rÖw&VVâÓsfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ" Ğ¢àĞ¢Å†öæR6—¦S×³‡Òóâv†G4 Ğ¢ÂöàĞ¢·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–Âbb€Ğ¢ÆĞ¢‡&Vc×¶Ö–ÇFó¢G·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–ÇÖĞĞ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÖw&’ÓsFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖ6VçFW"†÷fW#¦&rÖw&’ÓcfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ" Ğ¢àĞ¢ÄÖ–Â6—¦S×³‡ÒóâVÖ–ÀĞ¢ÂöàĞ¢—ĞĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÂöF—càĞ¢—ĞĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ