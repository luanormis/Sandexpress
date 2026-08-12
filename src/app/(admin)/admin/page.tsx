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
  { id: "catalog", label: "Catálogo", icon: ImageIcon },
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
      : "Teste grátis";
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
          reject(new Error("Não foi possível converter a imagem para WebP."));
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
    setAuthError("Sessão expirada. Entre novamente para carregar os dados.");
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
        setAdminDataError(data.error || "Não foi possível carregar quiosques.");
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
        setAdminDataError(data.error || "Não foi possível carregar analytics.");
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
      quarterly_price: String(settings.quarterly_price),
      semester_price: String(settings.semester_price),
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
        setPlanMessage(data.error || "Não foi possível carregar valores dos planos.");
        return;
      }
      applyPlanSettings(data);
    } catch {
      setPlanMessage("Erro de rede ao carregar valores dos planos.");
    }
  };

  const loadCatalogImages = async (search = catalogSearch) => {
    try {
      setCatalogLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/catalog-images${params.toString() ? `?${params.toString()}` : ""}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        handleAdminSessionExpired();
        return;
      }
      if (!res.ok) {
        setCatalogMessage(data.error || "Não foi possível carregar o catálogo.");
        return;
      }
      setCatalogImages(Array.isArray(data.images) ? data.images : []);
    } catch {
      setCatalogMessage("Erro de rede ao carregar catálogo.");
    } finally {
      setCatalogLoading(false);
    }
  };

  const uploadCatalogImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length === 1 && !catalogForm.name.trim()) {
      setCatalogMessage("Informe o nome ou selecione várias imagens para usar o nome do arquivo.");
      return;
    }
    if (!catalogForm.category.trim()) {
      setCatalogMessage("Informe a categoria antes de subir a imagem.");
      return;
    }
    setCatalogSaving(true);
    setCatalogMessage("");
    try {
      const uploadedImages: CatalogImage[] = [];
      for (const file of files) {
        const catalogName = files.length === 1 && catalogForm.name.trim()
          ? catalogForm.name.trim()
          : fileNameToCatalogName(file.name);
        const webpFile = await convertImageToWebp(file);
        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("name", catalogName);
        formData.append("category", catalogForm.category);
        formData.append("tags", catalogForm.tags);
        formData.append("description", catalogForm.description || `Imagem criada a partir do arquivo ${file.name}.`);
        formData.append("plan_type", "free");
        const res = await fetch("/api/admin/catalog-images", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCatalogMessage(data.error || `Não foi possível salvar ${file.name}.`);
          return;
        }
        if (data.image) uploadedImages.push(data.image);
      }
      setCatalogImages(prev => [...uploadedImages, ...prev.filter((image) => !uploadedImages.some((uploaded) => uploaded.id === image.id))]);
      setCatalogMessage(
        uploadedImages.length === 1
          ? "Imagem convertida para WebP e adicionada ao catálogo global."
          : `${uploadedImages.length} imagens convertidas para WebP e adicionadas ao catálogo global.`
      );
    } catch (err) {
      setCatalogMessage(err instanceof Error ? err.message : "Erro ao converter imagem.");
    } finally {
      setCatalogSaving(false);
    }
  };

  const toggleCatalogImage = async (image: CatalogImage) => {
    const nextActive = !image.active;
    setCatalogMessage("");
    const res = await fetch("/api/admin/catalog-images", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: image.id, active: nextActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCatalogMessage(data.error || "Não foi possível atualizar imagem.");
      return;
    }
    setCatalogImages(prev => prev.map((item) => item.id === image.id ? data.image : item));
  };

  const replaceCatalogImage = async (image: CatalogImage, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCatalogSaving(true);
    setCatalogMessage("");
    try {
      const webpFile = await convertImageToWebp(file);
      const formData = new FormData();
      formData.append("id", image.id);
      formData.append("file", webpFile);
      formData.append("name", image.name);
      formData.append("category", image.category);
      const res = await fetch("/api/admin/catalog-images", {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCatalogMessage(data.error || "Não foi possível alterar a imagem.");
        return;
      }
      setCatalogImages(prev => prev.map((item) => item.id === image.id ? data.image : item));
      setCatalogMessage("Imagem alterada com sucesso.");
    } catch (err) {
      setCatalogMessage(err instanceof Error ? err.message : "Erro ao alterar imagem.");
    } finally {
      setCatalogSaving(false);
    }
  };

  const deleteCatalogImage = async (image: CatalogImage) => {
    const confirmed = confirm(`Excluir definitivamente a imagem "${image.name}" do catálogo global?`);
    if (!confirmed) return;

    setCatalogSaving(true);
    setCatalogMessage("");
    try {
      const res = await fetch(`/api/admin/catalog-images?id=${encodeURIComponent(image.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCatalogMessage(data.error || "Não foi possível excluir a imagem.");
        return;
      }
      setCatalogImages(prev => prev.filter((item) => item.id !== image.id));
      setCatalogMessage("Imagem excluída do catálogo global.");
    } catch {
      setCatalogMessage("Erro de rede ao excluir imagem.");
    } finally {
      setCatalogSaving(false);
    }
  };

  const uploadVendorLogo = async (vendor: Vendor, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoUploadingVendorId(vendor.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/vendors/${vendor.id}/theme/logo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Não foi possível subir a logo.");
        return;
      }
      setVendors(prev => prev.map((item) => item.id === vendor.id ? { ...item, logo_url: data.logo_url } : item));
      setSelectedVendor(prev => prev?.id === vendor.id ? { ...prev, logo_url: data.logo_url } : prev);
    } finally {
      setLogoUploadingVendorId(null);
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
          quarterly_price: planForm.quarterly_price,
          semester_price: planForm.semester_price,
          annual_monthly_price: planForm.annual_monthly_price,
          trial_days: planForm.trial_days,
          max_umbrellas: planForm.max_umbrellas,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlanMessage(data.error || "Não foi possível salvar valores dos planos.");
        return;
      }
      applyPlanSettings(data);
      setPlanMessage("Valores salvos. Eles serão usados somente nos proximos quiosques cadastrados.");
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
        alert(data.error || "Não foi possível atualizar o quiosque.");
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

  useEffect(() => {
    if (!selectedVendor) { setSelectedVendorFeatures({}); return; }
    fetch(`/api/features?vendor_id=${selectedVendor.id}`, { credentials: "include" })
      .then(async response => response.ok ? response.json() : null)
      .then(data => setSelectedVendorFeatures(data?.features || {}))
      .catch(() => setSelectedVendorFeatures({}));
  }, [selectedVendor?.id]);

  const toggleWaiterService = async (vendor: Vendor) => {
    const enabled = vendor.waiter_service_enabled !== true;
    setFeatureSavingVendorId(vendor.id);
    try {
      const response = await fetch('/api/features', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendor.id, feature_key: 'waiter_service', enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Nao foi possivel atualizar o modulo.');
        return;
      }
      setVendors(current =>
        current.map(item =>
          item.id === vendor.id ? { ...item, waiter_service_enabled: enabled } : item
        ),
      );
      setSelectedVendor(current =>
        current?.id === vendor.id ? { ...current, waiter_service_enabled: enabled } : current
      );
      if (selectedVendor?.id === vendor.id) {
        setSelectedVendorFeatures(current => ({ ...current, waiter_service: enabled }));
      }
    } catch {
      alert('Erro de rede ao atualizar o perfil de garcom.');
    } finally {
      setFeatureSavingVendorId(null);
    }
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
        setDangerMessage(data.error || "Não foi possível apagar dados de clientes.");
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
        setDangerMessage(data.error || "Não foi possível apagar o quiosque.");
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
      setRegError("Preencha telefone, email, CPF ou CNPJ, nome do quiosque, responsável, praia, cidade e estado.");
      return;
    }
    if (!regForm.password || regForm.password.length < 8) {
      setRegError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (regForm.password !== regForm.password_confirm) {
      setRegError("A senha e a confirmação não conferem.");
      return;
    }
    if (!regForm.terms_accepted) {
      setRegError("Confirme que o responsável leu e concordou com os Termos de Uso.");
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
          trial_ends_at: new Date(Date.now() + planSettings.trial_days * 86400000).toISOString(),
          plan_expires_at: null,
          plan_monthly_price: planSettings.quarterly_price,
          plan_quarterly_price: planSettings.quarterly_price,
          plan_semester_price: planSettings.semester_price,
          plan_annual_monthly_price: planSettings.annual_monthly_price,
          is_active: true,
          max_umbrellas: planSettings.max_umbrellas,
          waiter_service_enabled: false,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setRegSuccess(true);
        setRegForm({ name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false });
      } else {
        const data = await res.json().catch(() => ({}));
        setRegError(data.error || "Não foi possível cadastrar o quiosque.");
      }
    } catch (err) {
      console.error("Register error:", err);
      setRegError("Falha de conexão ao cadastrar o quiosque.");
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
              autoComplete="current-password"
              required
              placeholder="Senha do admin"
              className="w-full bg-gray-700 border-2 border-gray-600 rounded-xl p-4 text-white placeholder:text-gray-500 focus:border-blue-500 outline-none"
            />
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading}
              className="tap-target w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:cursor-wait disabled:opacity-60"
            >
              {authLoading ? "Validando..." : "Entrar"}
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
              <table className="min-w-[1060px] w-full text-left">
                <thead className="bg-gray-950 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="p-4">Quiosque</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Cidade</th>
                    <th className="p-4">Plano</th>
                    <th className="p-4">Assinatura</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Perfil garcom</th>
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
                        <button
                          type="button"
                          onClick={() => toggleWaiterService(v)}
                          disabled={featureSavingVendorId === v.id}
                          title={v.waiter_service_enabled ? "Bloquear perfil de garcom" : "Liberar perfil de garcom"}
                          className={`min-w-24 rounded-lg px-3 py-2 text-xs font-black text-white transition-colors disabled:cursor-wait disabled:opacity-60 ${v.waiter_service_enabled ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-500"}`}
                        >
                          {featureSavingVendorId === v.id ? "Salvando..." : v.waiter_service_enabled ? "Liberado" : "Bloqueado"}
                        </button>
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
                          <label
                            className="cursor-pointer text-gray-400 hover:text-amber-300 transition-colors bg-gray-700 p-2 rounded-lg hover:bg-amber-500/10"
                            title="Subir logo do quiosque"
                          >
                            <Upload size={16} className={logoUploadingVendorId === v.id ? "animate-pulse" : ""} />
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={logoUploadingVendorId === v.id}
                              onChange={(event) => uploadVendorLogo(v, event)}
                            />
                          </label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
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
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
                <p className="text-gray-400 font-bold text-sm mb-2">Satisfação</p>
                <p className="text-3xl font-display font-bold text-amber-400 flex items-center gap-2">
                  <Star size={24} fill="currentColor" />
                  {platformReport!.satisfaction_average || 0}
                </p>
                <p className="text-xs text-gray-500 font-bold">{platformReport!.satisfaction_total || 0} respostas</p>
              </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400">Dados agregados e anonimos</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-white">Inteligencia de marcas na praia</h3>
                  <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-gray-300">
                    Estes relatórios usam apenas vendas agregadas. Não exibem nome, telefone ou pedido individual de cliente.
                  </p>
                </div>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-300">
                  Baseado nas vendas filtradas
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-200">
                    <TrendingUp size={18} className="text-amber-400" />
                    Share of Wallet de cervejas
                  </h4>
                  <div className="space-y-3">
                    {(platformReport!.beer_brand_share || []).length === 0 ? (
                      <p className="text-sm font-bold text-gray-500">Sem cervejas identificadas neste filtro.</p>
                    ) : (platformReport!.beer_brand_share || []).map((brand) => (
                      <div key={brand.brand} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-black text-white">{brand.brand}</span>
                          <span className="font-bold text-amber-300">{brand.share_quantity}% das unidades</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, brand.share_quantity)}%` }} />
                        </div>
                        <p className="text-xs font-bold text-gray-400">
                          {brand.quantity} un - {formatCurrency(brand.revenue)} - {brand.share_revenue}% do faturamento de cervejas
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-200">
                    <DollarSign size={18} className="text-amber-400" />
                    Elasticidade de preço no litoral
                  </h4>
                  <div className="space-y-3">
                    {(platformReport!.beer_price_elasticity || []).length === 0 ? (
                      <p className="text-sm font-bold text-gray-500">Sem pontos de preço de cerveja neste filtro.</p>
                    ) : (platformReport!.beer_price_elasticity || []).slice(0, 6).map((item) => (
                      <div key={`${item.brand}-${item.product}-${item.avg_price}`} className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-black text-white">{item.product}</p>
                          <span className="shrink-0 text-sm font-black text-amber-300">{formatCurrency(item.avg_price)}</span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-gray-400">
                          {item.brand} - {item.quantity} un - {item.quantity_per_order} un/pedido
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-200">
                    <AlertTriangle size={18} className="text-amber-400" />
                    Clima vs. consumo
                  </h4>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-bold leading-6 text-amber-100">
                      {platformReport!.climate_consumption?.message || "Aguardando base de temperatura por dia, cidade e praia."}
                    </p>
                  </div>
                  <p className="mt-3 text-xs font-bold text-gray-500">
                    Proxima etapa: gravar temperatura diaria para medir o efeito acima de 32 graus por produto e categoria.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
                  <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-200">
                    <Store size={18} className="text-amber-400" />
                    Padroes de combo e cross-selling
                  </h4>
                  <div className="space-y-3">
                    {(platformReport!.cross_sell_patterns || []).length === 0 ? (
                      <p className="text-sm font-bold text-gray-500">Sem padroes de porcao + bebida neste filtro.</p>
                    ) : (platformReport!.cross_sell_patterns || []).slice(0, 6).map((pair) => (
                      <div key={`${pair.portion}-${pair.beverage}-${pair.brand}`} className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                        <p className="text-sm font-black text-white">{pair.portion}</p>
                        <p className="mt-1 text-xs font-bold text-gray-400">
                          Puxa {pair.beverage} ({pair.brand}) em {pair.orders} pedidos - {pair.beverage_quantity} bebidas
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-700 bg-gray-900 p-5">
                <h4 className="mb-4 flex items-center gap-2 font-bold text-gray-200">
                  <Phone size={18} className="text-amber-400" />
                  Turista vs. local por DDD
                </h4>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(platformReport!.ddd_brand_preferences || []).length === 0 ? (
                    <p className="text-sm font-bold text-gray-500">Sem DDD suficiente para comparar preferências.</p>
                  ) : (platformReport!.ddd_brand_preferences || []).slice(0, 9).map((row) => (
                    <div key={`${row.ddd}-${row.brand}`} className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">DDD {row.ddd}</p>
                        <span className="rounded-full bg-gray-700 px-2 py-1 text-[11px] font-black text-gray-300">{row.segment}</span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-amber-300">{row.brand}: {row.share_quantity}%</p>
                      <p className="mt-1 text-xs font-bold text-gray-400">{row.quantity} un - {formatCurrency(row.revenue)}</p>
                    </div>
                  ))}
                </div>
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
              <h3 className="font-bold text-gray-300 mb-4">Satisfação por quiosque</h3>
              <div className="grid lg:grid-cols-2 gap-4">
                {platformReport!.satisfaction_by_vendor.map((vendor, i) => (
                  <div key={`${vendor.name}-${vendor.city}-${i}`} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{i + 1}. {vendor.name}</p>
                        <p className="text-xs text-gray-500">{vendor.city} - {vendor.beach}</p>
                      </div>
                      <p className="text-lg font-display font-bold text-amber-400 flex items-center gap-1">
                        <Star size={18} fill="currentColor" />
                        {vendor.average_rating}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">{vendor.total_responses} respostas</p>
                  </div>
                ))}
                {platformReport!.satisfaction_by_vendor.length === 0 && (
                  <p className="text-sm text-gray-500">Sem avaliacoes neste filtro.</p>
                )}
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

        {/* ========== CATALOGO GLOBAL ========== */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-display font-bold">Catalogo global de imagens</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-gray-400">
                As imagens ficam no bucket catalogo-global, são convertidas para WebP antes do envio e aparecem para todos os quiosques no cadastro de produtos.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
                <h3 className="font-bold text-gray-200">Nova imagem global</h3>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-gray-400">Nome de referencia</span>
                    <input
                      value={catalogForm.name}
                      onChange={event => setCatalogForm(prev => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-amber-500"
                      placeholder="Opcional no lote. Ex: Porção de peixe"
                    />
                    <span className="mt-1 block text-xs font-bold text-gray-500">
                      No upload em lote, deixe em branco para usar o nome de cada arquivo.
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-gray-400">Categoria</span>
                    <input
                      value={catalogForm.category}
                      onChange={event => setCatalogForm(prev => ({ ...prev, category: event.target.value }))}
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-amber-500"
                      placeholder="Ex: bebidas, porcoes, pasteis"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-gray-400">Tags de busca</span>
                    <input
                      value={catalogForm.tags}
                      onChange={event => setCatalogForm(prev => ({ ...prev, tags: event.target.value }))}
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-amber-500"
                      placeholder="bebidas, petiscos, pasteis, peixe, batata"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold text-gray-400">Descrição curta</span>
                    <textarea
                      value={catalogForm.description}
                      onChange={event => setCatalogForm(prev => ({ ...prev, description: event.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 p-3 text-white outline-none focus:border-amber-500"
                      placeholder="Referencia para o admin identificar a imagem."
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-700">
                    <Upload size={18} />
                    {catalogSaving ? "Convertendo e enviando..." : "Selecionar imagem"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      disabled={catalogSaving}
                      onChange={uploadCatalogImage}
                    />
                  </label>
                  <p className="text-xs font-bold leading-5 text-gray-500">
                    Para subir em lote: preencha Categoria e Tags, clique em Selecionar imagem e marque várias imagens. O sistema converte para WebP, grava no bucket catalogo-global e usa o nome do arquivo como referência.
                  </p>
                  {catalogMessage && (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold leading-5 text-amber-100">
                      {catalogMessage}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="font-bold text-gray-200">Imagens cadastradas</h3>
                    <p className="text-sm font-bold text-gray-500">{catalogImages.length} imagens carregadas</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={catalogSearch}
                      onChange={event => setCatalogSearch(event.target.value)}
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-amber-500 md:w-64"
                      placeholder="Buscar por tag ou nome"
                    />
                    <button
                      type="button"
                      onClick={() => loadCatalogImages(catalogSearch)}
                      className="rounded-xl bg-gray-700 px-4 py-2 text-sm font-black text-white hover:bg-gray-600"
                    >
                      Buscar
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {catalogImages.map(image => (
                    <div key={image.id} className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-900">
                      <div className="aspect-[4/3] bg-gray-950">
                        <img src={image.image_url} alt={image.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{image.name}</p>
                            <p className="text-xs font-bold text-gray-500">{image.category}</p>
                          </div>
                          <span className={cn(
                            "rounded-full px-2 py-1 text-[11px] font-black",
                            image.active === false ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"
                          )}>
                            {image.active === false ? "Inativa" : "Ativa"}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs font-bold leading-5 text-gray-400">
                          {(image.tags || []).join(", ") || image.description || "Sem tags"}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleCatalogImage(image)}
                          className="w-full rounded-xl border border-gray-700 px-3 py-2 text-xs font-black text-gray-200 hover:bg-gray-800"
                        >
                          {image.active === false ? "Ativar imagem" : "Desativar imagem"}
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-500/10">
                            <Upload size={14} />
                            Alterar
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={catalogSaving}
                              onChange={(event) => replaceCatalogImage(image, event)}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={catalogSaving}
                            onClick={() => deleteCatalogImage(image)}
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!catalogLoading && catalogImages.length === 0 && (
                    <p className="text-sm font-bold text-gray-500">Nenhuma imagem encontrada.</p>
                  )}
                  {catalogLoading && (
                    <p className="text-sm font-bold text-gray-500">Carregando catálogo...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== PLANOS ========== */}
        {activeTab === "plans" && (
          <div className="max-w-3xl w-full space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold">Valores dos Planos</h2>
              <p className="text-gray-400 mt-1">
                Estes valores viram o padrão dos próximos quiosques cadastrados. Quiosques já cadastrados mantêm o valor contratado.
              </p>
            </div>

            <form onSubmit={savePlanSettings} className="bg-gray-800 rounded-2xl border border-gray-700 p-6 space-y-5">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Plano trimestral</label>
                  <div className="flex items-center rounded-xl border border-gray-600 bg-gray-700 px-3">
                    <span className="text-gray-400 font-bold">R$</span>
                    <input
                      value={planForm.quarterly_price}
                      onChange={e => setPlanForm(p => ({ ...p, quarterly_price: e.target.value.replace(/[^\d,.]/g, "") }))}
                      inputMode="decimal"
                      className="w-full bg-transparent p-3 text-white outline-none"
                      placeholder="499,99"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Plano semestral</label>
                  <div className="flex items-center rounded-xl border border-gray-600 bg-gray-700 px-3">
                    <span className="text-gray-400 font-bold">R$</span>
                    <input
                      value={planForm.semester_price}
                      onChange={e => setPlanForm(p => ({ ...p, semester_price: e.target.value.replace(/[^\d,.]/g, "") }))}
                      inputMode="decimal"
                      className="w-full bg-transparent p-3 text-white outline-none"
                      placeholder="399,99"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Plano anual, valor por mes</label>
                  <div className="flex items-center rounded-xl border border-gray-600 bg-gray-700 px-3">
                    <span className="text-gray-400 font-bold">R$</span>
                    <input
                      value={planForm.annual_monthly_price}
                      onChange={e => setPlanForm(p => ({ ...p, annual_monthly_price: e.target.value.replace(/[^\d,.]/g, "") }))}
                      inputMode="decimal"
                      className="w-full bg-transparent p-3 text-white outline-none"
                      placeholder="299,99"
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Dias de teste para novos quiosques</label>
                  <input
                    value={planForm.trial_days}
                    onChange={e => setPlanForm(p => ({ ...p, trial_days: e.target.value.replace(/\D/g, "") }))}
                    inputMode="numeric"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-1">Limite de guarda-sóis para novos quiosques</label>
                  <input
                    value={planForm.max_umbrellas}
                    onChange={e => setPlanForm(p => ({ ...p, max_umbrellas: e.target.value.replace(/\D/g, "") }))}
                    inputMode="numeric"
                    max={100}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Trimestral atual</p>
                  <p className="text-2xl font-display font-bold text-green-400">{formatPlanPriceLabel(planSettings.quarterly_price)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Semestral atual</p>
                  <p className="text-2xl font-display font-bold text-amber-400">{formatPlanPriceLabel(planSettings.semester_price)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-bold">Anual atual por mes</p>
                  <p className="text-2xl font-display font-bold text-cyan-400">{formatPlanPriceLabel(planSettings.annual_monthly_price)}</p>
                </div>
              </div>

              {planMessage && (
                <p className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-bold",
                  planMessage.startsWith("Valores salvos")
                    ? "border-green-500/40 bg-green-500/10 text-green-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                )}>
                  {planMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={planSaving}
                className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={18} />
                {planSaving ? "Salvando..." : "Salvar valores"}
              </button>
            </form>
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
                      O responsável leu e aceitou os{" "}
                      <Link href="/termos-de-uso" target="_blank" className="text-blue-400 underline underline-offset-2">
                        Termos de Uso e a Política de Privacidade do SandExpress
                      </Link>
                      , com registro do aceite em data e hora.
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
                  Apaga o tenant/quiosque e todos os dados vinculados por cascata, incluindo clientes, pedidos, produtos, guarda-sóis e arquivos do Storage.
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
                <div className="bg-gray-700/50 p-4 rounded-xl sm:col-span-2">
                  <label className="text-xs text-gray-300 font-bold mb-2 block">Limite autorizado de guarda-sóis</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={vendorUmbrellaLimit}
                      onChange={event => setVendorUmbrellaLimit(event.target.value.replace(/\D/g, ""))}
                      inputMode="numeric"
                      min={1}
                      max={ADMIN_UMBRELLA_LIMIT}
                      className="min-h-11 w-28 rounded-xl border border-gray-500 bg-gray-900 px-3 text-lg font-black text-white outline-none focus:border-orange-400"
                      aria-label="Limite autorizado de guarda-sois"
                    />
                    <button
                      type="button"
                      disabled={vendorActionLoading === selectedVendor.id}
                      onClick={() => {
                        const limit = Number(vendorUmbrellaLimit);
                        if (!Number.isInteger(limit) || limit < 1 || limit > ADMIN_UMBRELLA_LIMIT) {
                          alert(`Informe um limite entre 1 e ${ADMIN_UMBRELLA_LIMIT}.`);
                          return;
                        }
                        updateVendor(selectedVendor.id, { max_umbrellas: limit });
                      }}
                      className="min-h-11 rounded-xl bg-[#FF6B00] px-4 font-black text-white hover:bg-[#E56000] disabled:opacity-50"
                    >
                      Autorizar limite
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-gray-300">Padrão: 100. O administrador pode liberar individualmente até {ADMIN_UMBRELLA_LIMIT}.</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Cadastrado em {new Date(selectedVendor.created_at).toLocaleDateString("pt-BR")}
              </div>
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-blue-100">Modulo de atendimento do garcom</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-blue-200/80">Libera login exclusivo, mapa de mesas, abertura de comandas, lancamento de pedidos e chamados com som.</p>
                  </div>
                  <button onClick={() => toggleWaiterService(selectedVendor)} disabled={featureSavingVendorId === selectedVendor.id} className={`min-w-24 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-50 ${selectedVendorFeatures.waiter_service ? 'bg-green-600' : 'bg-gray-600'}`}>
                    {featureSavingVendorId === selectedVendor.id ? 'Salvando...' : selectedVendorFeatures.waiter_service ? 'Liberado' : 'Bloqueado'}
                  </button>
                </div>
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
