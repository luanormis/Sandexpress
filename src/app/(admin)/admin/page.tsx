"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Store, TrendingUp, Plus, ShieldCheck, Ban, CheckCircle2,
  X, Search, Eye, AlertTriangle, DollarSign, Phone, Mail, Clock, Menu, Trash2, Star, Save,
  Upload, ImageIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { ADMIN_UMBRELLA_LIMIT, DEFAULT_PLATFORM_PLAN_SETTINGS, formatPlanPriceLabel, PLAN_PRICES, PlatformPlanSettings } from "@/lib/plans";

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
  logo_url?: string | null;
  subscription_status: string;
  plan_type: string | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  plan_monthly_price?: number | null;
  plan_quarterly_price?: number | null;
  plan_semester_price?: number | null;
  plan_annual_monthly_price?: number | null;
  is_active: boolean;
  max_umbrellas: number;
  waiter_service_enabled: boolean;
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
  beer_brand_share?: { brand: string; quantity: number; revenue: number; orders: number; share_quantity: number; share_revenue: number }[];
  beer_price_elasticity?: { brand: string; product: string; avg_price: number; quantity: number; revenue: number; orders: number; quantity_per_order: number }[];
  climate_consumption?: { status: string; message: string };
  cross_sell_patterns?: { portion: string; beverage: string; brand: string; orders: number; beverage_quantity: number; beverage_revenue: number }[];
  ddd_brand_preferences?: { ddd: string; segment: string; brand: string; quantity: number; revenue: number; orders: number; share_quantity: number }[];
  monthly_received: number;
  next_cycle_receivable: number;
  overdue_amount: number;
  filter_options: {
    vendors: { id: string; name: string }[];
    cities: string[];
    beaches: string[];
  };
}

interface CatalogImage {
  id: string;
  category: string;
  title?: string | null;
  name: string;
  image_url: string;
  description?: string | null;
  plan_type: "free" | "plus";
  tags?: string[];
  active?: boolean;
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "vendors", label: "Quiosques", icon: Store },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "catalog", label: "CatÃ¡logo", icon: ImageIcon },
  { id: "plans", label: "Planos", icon: DollarSign },
  { id: "new", label: "Novo Quiosque", icon: Plus },
  { id: "danger", label: "Risco", icon: Trash2 },
];

const KIOSK_MODULES = [
  { key: 'crm_customers', label: 'CRM de clientes', help: 'Historico, recorrencia e relacionamento com clientes.' },
  { key: 'crm_promotions', label: 'CRM de promocoes', help: 'Campanhas, ofertas e sugestoes de venda.' },
  { key: 'loyalty', label: 'Fidelidade', help: 'Programa de fidelidade do quiosque.' },
  { key: 'cashback', label: 'Cashback', help: 'Beneficios financeiros para clientes recorrentes.' },
  { key: 'menu_management', label: 'Cardapio', help: 'Cadastro e manutencao do cardapio.' },
  { key: 'team_management', label: 'Equipe', help: 'Usuarios, garcons e comissoes.' },
  { key: 'branding', label: 'Personalizacao', help: 'Cores, logo e identidade do quiosque.' },
  { key: 'printer_management', label: 'Impressoras', help: 'Rotas de cozinha, bebidas e caixa.' },
  { key: 'owner_master_dashboard', label: 'Dashboard Master', help: 'Indicadores exclusivos do proprietario.' },
] as const;

const ANNUAL_PLAN_TYPES = new Set(["annual", "12months"]);

function isAnnualPlan(planType: string | null) {
  return ANNUAL_PLAN_TYPES.has(planType || "");
}

function getVendorPlanLabel(vendor: Vendor) {
  if (isAnnualPlan(vendor.plan_type)) return "Anual";
  if (vendor.plan_type === "quarterly") return "Trimestral";
  if (vendor.plan_type === "semester") return "Semestral";
  if (vendor.plan_type === "monthly") return "Trimestral";
  if (vendor.plan_type === "trial" || vendor.subscription_status === "trial") return "Teste";
  return vendor.plan_type || "Sem plano";
}

function getVendorMonthlyAmount(vendor: Vendor) {
  if (vendor.plan_type === "trial" || vendor.subscription_status === "trial") return 0;
  return isAnnualPlan(vendor.plan_type)
    ? Number(vendor.plan_annual_monthly_price ?? PLAN_PRICES.annualMonthly)
    : vendor.plan_type === "semester"
      ? Number(vendor.plan_semester_price ?? PLAN_PRICES.semester)
      : Number(vendor.plan_quarterly_price ?? vendor.plan_monthly_price ?? PLAN_PRICES.quarterly);
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
      : "Teste grÃ¡tis";
  }
  if (isAnnualPlan(vendor.plan_type)) {
    const remaining = getRemainingAnnualInstallments(vendor);
    const suffix = remaining === 1 ? "parcela restante" : "parcelas restantes";
    return `${remaining ?? 12} ${suffix}`;
  }
  return vendor.plan_type === "semester" ? "Cobranca semestral" : "Cobranca trimestral";
}

function convertImageToWebp(file: File, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/webp") {
      resolve(file);
      return;
    }
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas indisponivel para converter imagem."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          reject(new Error("NÃ£o foi possÃ­vel converter a imagem para WebP."));
          return;
        }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
      }, "image/webp", quality);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Imagem invalida."));
    };
    image.src = objectUrl;
  });
}

function fileNameToCatalogName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

// =========================================================
// MAIN COMPONENT
// =========================================================
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorUmbrellaLimit, setVendorUmbrellaLimit] = useState("100");
  const [selectedVendorFeatures, setSelectedVendorFeatures] = useState<Record<string, boolean>>({});
  const [featureSavingVendorId, setFeatureSavingVendorId] = useState<string | null>(null);
  const [platformReport, setPlatformReport] = useState<PlatformReport | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [adminDataError, setAdminDataError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vendorActionLoading, setVendorActionLoading] = useState<string | null>(null);
  const [dangerLoading, setDangerLoading] = useState<"customers" | "kiosk" | null>(null);
  const [planSettings, setPlanSettings] = useState<PlatformPlanSettings>(DEFAULT_PLATFORM_PLAN_SETTINGS);
  const [planForm, setPlanForm] = useState({
    quarterly_price: String(DEFAULT_PLATFORM_PLAN_SETTINGS.quarterly_price),
    semester_price: String(DEFAULT_PLATFORM_PLAN_SETTINGS.semester_price),
    annual_monthly_price: String(DEFAULT_PLATFORM_PLAN_SETTINGS.annual_monthly_price),
    trial_days: String(DEFAULT_PLATFORM_PLAN_SETTINGS.trial_days),
    max_umbrellas: String(DEFAULT_PLATFORM_PLAN_SETTINGS.max_umbrellas),
  });
  const [planSaving, setPlanSaving] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [catalogImages, setCatalogImages] = useState<CatalogImage[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogForm, setCatalogForm] = useState({
    name: "",
    category: "",
    tags: "",
    description: "",
  });
  const [logoUploadingVendorId, setLogoUploadingVendorId] = useState<string | null>(null);
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
    setAuthError("SessÃ£o expirada. Entre novamente para carregar os dados.");
  };

  useEffect(() => {
    if (selectedVendor) setVendorUmbrellaLimit(String(selectedVendor.max_umbrellas || 100));
  }, [selectedVendor]);

  useEffect(() => {
    if (isAuthenticated && (activeTab === "analytics" || activeTab === "overview")) {
      loadPlatformReport();
    }
    if (isAuthenticated && activeTab === "catalog") {
      loadCatalogImages();
    }
  }, [activeTab, isAuthenticated]);

  // Admin login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!adminPassword) {
      setAuthError("Informe a senha do administrador.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuthError(data.error || "Nao foi possivel entrar.");
        return;
      }
      const validation = await fetch("/api/auth/admin", { credentials: "include" });
      if (!validation.ok) {
        setAuthError("Login aceito, mas a sessao nao foi validada. Tente novamente.");
        return;
      }
      setIsAuthenticated(true);
      setAdminPassword("");
      setAdminDataError("");
      sessionStorage.setItem("admin_token", "authenticated");
      await loadVendors();
      await loadPlatformReport();
      await loadPlanSettings();
    } catch {
      setAuthError("Erro ao conectar.");
    } finally {
      setAuthLoading(false);
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
        setAdminDataError(data.error || "NÃ£o foi possÃ­vel carregar quiosques.");
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
      Object.entries(filters).forEach((ßM8êÚ$z{-®éÜj×ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#à¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓC#åV–÷7VSÂöÆ&VÃà¢Ç6VÆV7@¢fÇVS×¶FævW$f÷&ÒçfVæF÷%ö–GĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂfVæF÷%ö–C¢RçF&vWBçfÇVRÒ’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Ö&ÇVRÓS ¢à¢Æ÷F–öâfÇVSÒ"#åFöF÷2÷2V–÷7VW2Væ2&v"6Æ–VçFW3Âö÷F–öãà¢·fVæF÷'2æÖ‡fVæF÷"Óâ€¢Æ÷F–öâ¶W“×·fVæF÷"æ–GÒfÇVS×·fVæF÷"æ–GÓç·fVæF÷"ææÖWÓÂö÷F–öãà¢’—Ğ¢Â÷6VÆV7Cà ¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’ÓC#å6Væ†FòFÖ–ãÂöÆ&VÃà¢Æ–çW@¢G—SÒ'77v÷&B ¢fÇVS×¶FævW$f÷&ÒæFÖ–å÷77v÷&GĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂFÖ–å÷77v÷&C¢RçF&vWBçfÇVRÒ’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Ö&ÇVRÓS ¢Æ6V†öÆFW#Ò$6öæf—&ÖR6Væ†FòFÖ–â ¢óà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&w&–BvÓbÆs¦w&–BÖ6öÇ2Ó"#à¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#à¢Æƒ26Æ74æÖSÒ'FW‡BÖÆrföçBÖF—7Æ’föçBÖ&öÆBFW‡B×v†—FR#äv"6Æ–VçFW3Âöƒ3à¢Ç6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓC#à¢v6Æ–VçFW2ÂVF–F÷2R—FVç2FRVF–Fòâ6öÒV–÷7VR6VÆV6–öæFòÂFÖ&VÒ&VÖ÷fR'V—f÷2'V—fF÷2FVVÆRV–÷7VRæò7F÷&vRà¢Â÷à¢Æ–çW@¢G—SÒ'FW‡B ¢fÇVS×¶FævW$f÷&Òæ7W7FöÖW%ö6öæf—&ÖF–öçĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂ7W7FöÖW%ö6öæf—&ÖF–öã¢RçF&vWBçfÇVRÒ’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"×&VBÓC ¢Æ6V†öÆFW#Ò$t"4Ä”TåDU2 ¢óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶FævW$ÆöF–ærÓÒçVÆÇĞ¢öä6Æ–6³×¶W&6T7W7FöÖW'7Ğ¢6Æ74æÖSÒ'F×F&vWBfÆW‚rÖgVÆÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷VæFVB×†Â&r×&VBÓc‚ÓB’Ó2föçBÖ&öÆBFW‡B×v†—FR†÷fW#¦&r×&VBÓsF—6&ÆVC¦÷6—G’Óc ¢à¢ÅG&6ƒ"6—¦S×³‡Òóâ¶FævW$ÆöF–ærÓÓÒ&7W7FöÖW'2"ò$væFòâââ"¢$v"6Æ–VçFW2'Ğ¢Âö'WGFöãà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’ÓƒÓb76R×’ÓB#à¢Æƒ26Æ74æÖSÒ'FW‡BÖÆrföçBÖF—7Æ’föçBÖ&öÆBFW‡B×v†—FR#äv"V–÷7VR6ö×ÆWFóÂöƒ3à¢Ç6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓC#à¢vòFVæçB÷V–÷7VRRFöF÷2÷2FF÷2f–æ7VÆF÷2÷"666FÂ–æ6ÇV–æFò6Æ–VçFW2ÂVF–F÷2Â&öGWF÷2ÂwV&F×<;6—2R'V—f÷2Fò7F÷&vRà¢Â÷à¢Æ–çW@¢G—SÒ'FW‡B ¢fÇVS×¶FævW$f÷&Òæ¶–÷6µö6öæf—&ÖF–öçĞ¢öä6†ævS×¶RÓâ6WDFævW$f÷&Ò‡Óâ‡²ââçÂ¶–÷6µö6öæf—&ÖF–öã¢RçF&vWBçfÇVRÒ’—Ğ¢6Æ74æÖSÒ'rÖgVÆÂ&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’ÓsÓ2FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"×&VBÓC ¢Æ6V†öÆFW#Ò$t"T”õ5TR ¢óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×¶FævW$ÆöF–ærÓÒçVÆÂÇÂFævW$f÷&ÒçfVæF÷%ö–GĞ¢öä6Æ–6³×¶W&6T¶–÷6·Ğ¢6Æ74æÖSÒ'F×F&vWBfÆW‚rÖgVÆÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷VæFVB×†Â&r×&VBÓs‚ÓB’Ó2föçBÖ&öÆBFW‡B×v†—FR†÷fW#¦&r×&VBÓƒF—6&ÆVC¦÷6—G’Óc ¢à¢ÅG&6ƒ"6—¦S×³‡Òóâ¶FævW$ÆöF–ærÓÓÒ&¶–÷6²"ò$væFòâââ"¢$v"V–÷7VR'Ğ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà ¢¶FævW$ÖW76vRbb€¢ÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’Ós&rÖw&’Óƒ‚ÓB’Ó2FW‡B×6ÒföçBÖ&öÆBFW‡BÖw&’Ó#à¢¶FævW$ÖW76vWĞ¢ÂöF—cà¢—Ğ¢ÂöF—cà¢—Ğ¢ÂöÖ–ãà ¢Ææb6Æ74æÖSÒ&f—†VB–ç6WB×‚Ó&÷GFöÒÓ¢Ó3&÷&FW"×B&÷&FW"Öw&’Óƒ&rÖw&’Ó“Só“R‚Ó2BÓ"Ö&÷GFöÒ×6fR6†F÷rÕ³òÓ'…ó3'…÷&v&ƒÃÃÃã#‚•Ò&6¶G&÷Ö&ÇW"Æs¦†–FFVâ#à¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2ÓRvÓ"#à¢µD%2æÖ‡F"Óâ€¢Æ'WGFöà¢¶W“×·F"æ–GĞ¢öä6Æ–6³×²‚’Óâ²6WD7F—fUF"‡F"æ–B“²6WE&Vu7V66W72†fÇ6R“²6WE6–FV&$÷Vâ†fÇ6R“²×Ğ¢6Æ74æÖS×¶6â€¢'F×F&vWBfÆW‚fÆW‚Ö6öÂ—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"&÷VæFVBÓ'†Â‚Ó"’Ó"FW‡BÕ³…ÒföçBÖ&Æ6²"À¢7F—fUF"ÓÓÒF"æ–Bò&&rÖ&ÇVRÓcFW‡B×v†—FR"¢'FW‡BÖw&’ÓC ¢—Ğ¢à¢ÇF"æ–6öâ6—¦S×³—Òóà¢Ç7â6Æ74æÖSÒ&×BÓãRÖ‚×rÖgVÆÂG'Væ6FR#ç·F"æÆ&VÂÓÓÒ$æ÷fòV–÷7VR"ò$æ÷fò"¢F"æÆ&VÇÓÂ÷7ãà¢Âö'WGFöãà¢’—Ğ¢ÂöF—cà¢Âöæcà ¢²ò¢ÓÓÓÓÓÓÓÓÓÒdTäDõ"DUD”ÂÔôDÂÓÓÓÓÓÓÓÓÓÒ¢÷Ğ¢·6VÆV7FVEfVæF÷"bb€¢ÆF—b6Æ74æÖSÒ&f—†VB–ç6WBÓ&rÖ&Æ6²óc¢ÓSfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"ÓB"öä6Æ–6³×²‚’Óâ6WE6VÆV7FVEfVæF÷"†çVÆÂ—Óà¢ÆF—b6Æ74æÖSÒ&&rÖw&’Óƒ&÷VæFVBÓ'†ÂÖ‚×rÖÆrrÖgVÆÂÖ‚Ö‚Õ³“f…Ò÷fW&fÆ÷r×’ÖWFò&÷&FW"&÷&FW"Öw&’Ós6†F÷rÓ'†Â"öä6Æ–6³×¶RÓâRç7F÷&÷vF–öâ‚—Óà¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2Ö6VçFW"Ób&÷&FW"Ö"&÷&FW"Öw&’Ós#à¢Æƒ26Æ74æÖSÒ'FW‡B×†ÂföçBÖF—7Æ’föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"ææÖWÓÂöƒ3à¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WE6VÆV7FVEfVæF÷"†çVÆÂ—Ò6Æ74æÖSÒ'FW‡BÖw&’ÓC†÷fW#§FW‡B×v†—FR#ãÅ‚6—¦S×³#GÒóãÂö'WGFöãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'Ób76R×’ÓB#à¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓB#à¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#å&W7öç<:fVÃÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%öæÖWÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#åFVÆVföæSÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%÷†öæWÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#äVÖ–ÃÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–ÂÇÂ.(	B'ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#äÆö6Æ—¦:|:6óÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ6—G’òG·6VÆV7FVEfVæF÷"æ6—G—ÒòG·6VÆV7FVEfVæF÷"ç7FFWÖ¢.(	B'ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä5cÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ7bÇÂ.(	B'ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä4å£Â÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆB#ç·6VÆV7FVEfVæF÷"æ6ç¢ÇÂ.(	B'ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#å7FGW3Â÷à¢Ç6Æ74æÖS×¶6â‚&föçBÖ&öÆB6—FÆ—¦R"Â°¢'FW‡BÖw&VVâÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&7F—fR"À¢'FW‡BÖÖ&W"ÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ'G&–Â"À¢'FW‡BÖ÷&ævRÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&÷fW&GVR"À¢'FW‡B×&VBÓC#¢6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW2ÓÓÒ&&Æö6¶VB"À¢Ò—Óç·6VÆV7FVEfVæF÷"ç7V'67&—F–öå÷7FGW7ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â#à¢Ç6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’ÓCföçBÖ&öÆBÖ"Ó#ä76–æGW&ÖVç6ÃÂ÷à¢Ç6Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖw&VVâÓC#à¢¶vWEfVæF÷$ÖöçF†Ç”Ö÷VçB‡6VÆV7FVEfVæF÷"’âòG¶f÷&ÖD7W'&Væ7’†vWEfVæF÷$ÖöçF†Ç”Ö÷VçB‡6VÆV7FVEfVæF÷"’—ÒöÖW6¢%"BÃ'Ğ¢Â÷à¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2FW‡BÖw&’ÓS#ç¶vWEfVæF÷$&–ÆÆ–æu7VÖÖ'’‡6VÆV7FVEfVæF÷"—ÓÂ÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&rÖw&’ÓsóSÓB&÷VæFVB×†Â6Ó¦6öÂ×7âÓ"#à¢ÆÆ&VÂ6Æ74æÖSÒ'FW‡B×‡2FW‡BÖw&’Ó3föçBÖ&öÆBÖ"Ó"&Æö6²#äÆ–Ö—FRWF÷&—¦FòFRwV&F×<;6—3ÂöÆ&VÃà¢ÆF—b6Æ74æÖSÒ&fÆW‚fÆW‚×w&—FV×2Ö6VçFW"vÓ"#à¢Æ–çW@¢fÇVS×·fVæF÷%VÖ'&VÆÆÆ–Ö—GĞ¢öä6†ævS×¶WfVçBÓâ6WEfVæF÷%VÖ'&VÆÆÆ–Ö—B†WfVçBçF&vWBçfÇVRç&WÆ6R‚õÄBörÂ""’—Ğ¢–çWDÖöFSÒ&çVÖW&–2 ¢Ö–ã×³Ğ¢Öƒ×´DÔ”åõTÔ%$TÄÄôÄ”Ô•GĞ¢6Æ74æÖSÒ&Ö–âÖ‚ÓrÓ#‚&÷VæFVB×†Â&÷&FW"&÷&FW"Öw&’ÓS&rÖw&’Ó“‚Ó2FW‡BÖÆrföçBÖ&Æ6²FW‡B×v†—FR÷WFÆ–æRÖæöæRfö7W3¦&÷&FW"Ö÷&ævRÓC ¢&–ÖÆ&VÃÒ$Æ–Ö—FRWF÷&—¦FòFRwV&F×6ö—2 ¢óà¢Æ'WGFöà¢G—SÒ&'WGFöâ ¢F—6&ÆVC×·fVæF÷$7F–öäÆöF–ærÓÓÒ6VÆV7FVEfVæF÷"æ–GĞ¢öä6Æ–6³×²‚’Óâ°¢6öç7BÆ–Ö—BÒçVÖ&W"‡fVæF÷%VÖ'&VÆÆÆ–Ö—B“°¢–b‚çVÖ&W"æ—4–çFVvW"†Æ–Ö—B’ÇÂÆ–Ö—BÂÇÂÆ–Ö—BâDÔ”åõTÔ%$TÄÄôÄ”Ô•B’°¢ÆW'B†–æf÷&ÖRVÒÆ–Ö—FRVçG&RRG´DÔ”åõTÔ%$TÄÄôÄ”Ô•GÒæ“°¢&WGW&ã°¢Ğ¢WFFUfVæF÷"‡6VÆV7FVEfVæF÷"æ–BÂ²Ö…÷VÖ'&VÆÆ3¢Æ–Ö—BÒ“°¢×Ğ¢6Æ74æÖSÒ&Ö–âÖ‚Ó&÷VæFVB×†Â&rÕ²4dcd#Ò‚ÓBföçBÖ&Æ6²FW‡B×v†—FR†÷fW#¦&rÕ²4SScÒF—6&ÆVC¦÷6—G’ÓS ¢à¢WF÷&—¦"Æ–Ö—FP¢Âö'WGFöãà¢ÂöF—cà¢Ç6Æ74æÖSÒ&×BÓ"FW‡B×‡2föçB×6VÖ–&öÆBÆVF–ærÓRFW‡BÖw&’Ó3#åG,:6ó¢âòFÖ–æ—7G&F÷"öFRÆ–&W&"–æF—f–GVÆÖVçFRL:’´DÔ”åõTÔ%$TÄÄôÄ”Ô•GÒãÂ÷à¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒFW‡BÖw&’ÓS#à¢6F7G&FòVÒ¶æWrFFR‡6VÆV7FVEfVæF÷"æ7&VFVEöB’çFôÆö6ÆTFFU7G&–ær‚'BÔ%""—Ğ¢ÂöF—cà¢Ç6V7F–öâ6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Ö÷&ævRÓCó3&rÖ÷&ævRÓSóÓB#à¢Ç6Æ74æÖSÒ'FW‡B×‡2föçBÖ&Æ6²WW&66RG&6¶–ær×v–FRFW‡BÖ÷&ævRÓ3#åF—òFò6—7FVÖ÷"4å£Â÷à¢ÆƒB6Æ74æÖSÒ&×BÓFW‡BÖÆrföçBÖ&Æ6²FW‡B×v†—FR#ç·6VÆV7FVEfVæF÷$fVGW&W2ç7—7FVÕögVÆÂòt6ö×ÆWFòr¢t&6–6òò6'&–æ†òwÓÂöƒCà¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2föçBÖ&öÆBÆVF–ærÓRFW‡BÖ÷&ævRÓóƒ#ä&6–6òÆ–&W&&W'GW&RfV6†ÖVçFòFòF–ÂW7F÷VRRf–ææ6V—&òâ6ö×ÆWFòÆ–&W&÷W&6ò6öÒ¶æ&âRÖ²÷2ÖöGVÆ÷2&—†ò6öçF–çVÒ–æFWVæFVçFW2ãÂ÷à¢ÆF—b6Æ74æÖSÒ&×BÓBw&–Bw&–BÖ6öÇ2Ó"vÓ"#à¢Æ'WGFöâG—SÒ&'WGFöâ"F—6&ÆVC×¶fVGW&U6f–æufVæF÷$–BÓÓÒ6VÆV7FVEfVæF÷"æ–GÒöä6Æ–6³×²‚’ÓâWFFT¶–÷6´ÖöFR‡6VÆV7FVEfVæF÷"Âv&6–2r—Ò6Æ74æÖS×¶Ö–âÖ‚Ó"&÷VæFVB×†ÂföçBÖ&Æ6²G²6VÆV7FVEfVæF÷$fVGW&W2ç7—7FVÕögVÆÂòv&r×v†—FRFW‡BÖ÷&ævRÓsr¢v&rÖw&’ÓsFW‡BÖw&’Ó#wÖÓä&6–6óÂö'WGFöãà¢Æ'WGFöâG—SÒ&'WGFöâ"F—6&ÆVC×¶fVGW&U6f–æufVæF÷$–BÓÓÒ6VÆV7FVEfVæF÷"æ–GÒöä6Æ–6³×²‚’ÓâWFFT¶–÷6´ÖöFR‡6VÆV7FVEfVæF÷"Âv6ö×ÆWFRr—Ò6Æ74æÖS×¶Ö–âÖ‚Ó"&÷VæFVB×†ÂföçBÖ&Æ6²G·6VÆV7FVEfVæF÷$fVGW&W2ç7—7FVÕögVÆÂòv&rÕ²4dcd#ÒFW‡B×v†—FRr¢v&rÖw&’ÓsFW‡BÖw&’Ó#wÖÓä6ö×ÆWFóÂö'WGFöãà¢ÂöF—cà¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Öw&’Óc&rÖw&’Ó“óCÓB#à¢ÆF—cãÇ6Æ74æÖSÒ'FW‡B×‡2föçBÖ&Æ6²WW&66RG&6¶–ær×v–FRFW‡BÖw&’ÓC#äÖöGVÆ÷3Â÷ãÆƒB6Æ74æÖSÒ&×BÓFW‡BÖÆrföçBÖ&Æ6²FW‡B×v†—FR#äÆ–&W&6öW2–æF—f–GV—3ÂöƒCãÂöF—cà¢ÆF—b6Æ74æÖSÒ&×BÓB76R×’Ó"#ç´´”õ4µôÔôETÄU2æÖ†ÖöGVÆRÓâÆF—b¶W“×¶ÖöGVÆRæ¶W—Ò6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâvÓ2&÷VæFVB×†Â&rÖw&’ÓsócÓ2#ãÆF—cãÇ6Æ74æÖSÒ&föçBÖ&Æ6²FW‡B×v†—FR#ç¶ÖöGVÆRæÆ&VÇÓÂ÷ãÇ6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡BÖw&’ÓC#ç¶ÖöGVÆRæ†VÇÓÂ÷ãÂöF—cãÆ'WGFöâG—SÒ&'WGFöâ"F—6&ÆVC×¶fVGW&U6f–æufVæF÷$–BÓÓÒ6VÆV7FVEfVæF÷"æ–GÒöä6Æ–6³×²‚’ÓâFövvÆT¶–÷6´ÖöGVÆR‡6VÆV7FVEfVæF÷"ÂÖöGVÆRæ¶W’—Ò6Æ74æÖS×¶Ö–â×rÓ#B&÷VæFVB×†Â‚Ó2’Ó"FW‡B×‡2föçBÖ&Æ6²FW‡B×v†—FRG·6VÆV7FVEfVæF÷$fVGW&W5¶ÖöGVÆRæ¶W•Òòv&rÖw&VVâÓcr¢v&rÖw&’ÓcwÖÓç·6VÆV7FVEfVæF÷$fVGW&W5¶ÖöGVÆRæ¶W•ÒòtÆ–&W&Fòr¢t&Æ÷VVFòwÓÂö'WGFöããÂöF—câ—ÓÂöF—cà¢Â÷6V7F–öãà¢ÆF—b6Æ74æÖSÒ'&÷VæFVBÓ'†Â&÷&FW"&÷&FW"Ö&ÇVRÓSó3&rÖ&ÇVRÓSóÓB#à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâvÓB#à¢ÆF—cà¢Ç6Æ74æÖSÒ&föçBÖ&Æ6²FW‡BÖ&ÇVRÓ#äÖöGVÆòFRFVæF–ÖVçFòFòv&6öÓÂ÷à¢Ç6Æ74æÖSÒ&×BÓFW‡B×‡2föçBÖ&öÆBÆVF–ærÓRFW‡BÖ&ÇVRÓ#óƒ#äÆ–&W&Æöv–âW†6ÇW6—fòÂÖFRÖW62Â&W'GW&FR6öÖæF2ÂÆæ6ÖVçFòFRVF–F÷2R6†ÖF÷26öÒ6öÒãÂ÷à¢ÂöF—cà¢Æ'WGFöâöä6Æ–6³×²‚’ÓâFövvÆUv—FW%6W'f–6R‡6VÆV7FVEfVæF÷"—ÒF—6&ÆVC×¶fVGW&U6f–æufVæF÷$–BÓÓÒ6VÆV7FVEfVæF÷"æ–GÒ6Æ74æÖS×¶Ö–â×rÓ#B&÷VæFVB×†Â‚ÓB’Ó2FW‡B×6ÒföçBÖ&Æ6²FW‡B×v†—FRF—6&ÆVC¦÷6—G’ÓSG·6VÆV7FVEfVæF÷$fVGW&W2çv—FW%÷6W'f–6Ròv&rÖw&VVâÓcr¢v&rÖw&’ÓcwÖÓà¢¶fVGW&U6f–æufVæF÷$–BÓÓÒ6VÆV7FVEfVæF÷"æ–Bòu6ÇfæFòâââr¢6VÆV7FVEfVæF÷$fVGW&W2çv—FW%÷6W'f–6RòtÆ–&W&Fòr¢t&Æ÷VVFòwĞ¢Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'Ób&÷&FW"×B&÷&FW"Öw&’ÓsfÆW‚vÓ2#à¢Æ¢‡&Vc×¶‡GG3¢ò÷væÖRóSRG·6VÆV7FVEfVæF÷"æ÷væW%÷†öæWÖĞ¢F&vWCÒ%ö&Ææ² ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÖw&VVâÓcFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖ6VçFW"†÷fW#¦&rÖw&VVâÓsfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ" ¢à¢Å†öæR6—¦S×³‡Òóâv†G4 ¢Âöà¢·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–Âbb€¢Æ¢‡&Vc×¶Ö–ÇFó¢G·6VÆV7FVEfVæF÷"æ÷væW%öVÖ–ÇÖĞ¢6Æ74æÖSÒ&fÆW‚Ó’Ó2&rÖw&’ÓsFW‡B×v†—FR&÷VæFVB×†ÂföçBÖ&öÆBFW‡BÖ6VçFW"†÷fW#¦&rÖw&’ÓcfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ" ¢à¢ÄÖ–Â6—¦S×³‡ÒóâVÖ–À¢Âöà¢—Ğ¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢—Ğ¢ÂöF—cà¢“°§Ğ