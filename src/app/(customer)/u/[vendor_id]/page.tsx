"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import { Bell, Home, ListOrdered, Minus, Plus, ShoppingCart, Star, UtensilsCrossed } from "lucide-react";
import { extractUmbrellaIdFromRouteSegment } from "@/lib/public-url";
import { formatCurrency } from "@/lib/utils";
import { isValidBrazilPhoneWithDdd, normalizeBrazilPhoneWithDdd } from "@/lib/phone";
import {
  CUSTOMER_MENU_CATEGORIES,
  CustomerMenuCategory,
  filterCustomerMenuProducts,
  getCustomerMenuThumbnail,
} from "@/lib/customer-menu";

type Product = {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  description: string | null;
  image_url?: string | null;
  price: number;
  promotional_price: number | null;
  is_combo?: boolean | null;
  option_group_name?: string | null;
  option_values?: string[] | null;
  menu_highlight?: boolean | null;
  promotion_starts_at?: string | null;
  promotion_ends_at?: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
  option?: string | null;
};

type ProductOptionGroup = { name: string; options: string[] };

function getProductOptionGroups(product: Product): ProductOptionGroup[] {
  const values = Array.isArray(product.option_values) ? product.option_values.map(String).filter(Boolean) : [];
  if (values.length === 0) return [];
  if (!values.some(value => value.includes('::'))) return [{ name: product.option_group_name || 'Opcao', options: values }];
  const groups = new Map<string, string[]>();
  values.forEach(value => {
    const [rawGroup, ...parts] = value.split('::');
    const group = rawGroup.trim() || 'Opcao';
    const option = parts.join('::').trim();
    if (option) groups.set(group, [...(groups.get(group) || []), option]);
  });
  return Array.from(groups, ([name, options]) => ({ name, options: Array.from(new Set(options)) }));
}

type UpsellRule = { trigger_product_id: string; suggested_product_ids: string[]; message: string };
type FlexiblePromotion = { id: string; titulo: string; descricao?: string | null; desconto_tipo: string; desconto_valor: number; promocao_itens?: Array<{ product_id: string; quantidade: number; products?: { name?: string } }> };

type PromotionPreview = {
  subtotal: number | null;
  discount_total: number;
  total: number | null;
  applied_promotions: Array<{
    promocao_id?: string;
    titulo?: string;
    tipo?: string;
    desconto_tipo?: string;
    conjuntos_aplicados?: number;
    desconto?: number;
  }>;
  unavailable?: boolean;
};

type Order = {
  id: string;
  account_id?: string;
  sequence?: number;
  total: number;
  account_total?: number;
  status: string;
  account_status?: string;
  created_at: string;
};

type CustomerVendor = {
  id: string;
  name: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  button_color?: string | null;
  button_text_color?: string | null;
  logo_url?: string | null;
};

type FeatureFlags = Record<string, boolean>;

const ORDER_STATUS_LABELS: Record<string, string> = {
  offline_pending: "Aguardando internet",
  received: "Pedido recebido",
  preparing: "Em preparo",
  delivering: "Saiu para entrega",
  completed: "Entregue",
  closing_requested: "Conta solicitada",
  cancelled: "Cancelado",
};

const BILLABLE_STATUSES = new Set(["completed", "closing_requested"]);

type CustomerOfflineOrder = {
  id: string;
  body: { vendor_id: string; customer_id: string; umbrella_id: string; items: Array<{ product_id: string; quantity: number }>; notes: string; idempotency_key: string };
  total: number;
  created_at: string;
};

function customerCacheKey(vendorId: string, umbrellaId: string) { return `sandexpress_customer_cache_${vendorId}_${umbrellaId}`; }
function customerQueueKey(vendorId: string, umbrellaId: string) { return `sandexpress_customer_queue_${vendorId}_${umbrellaId}`; }
function readCustomerQueue(vendorId: string, umbrellaId: string): CustomerOfflineOrder[] { try { return JSON.parse(localStorage.getItem(customerQueueKey(vendorId, umbrellaId)) || "[]"); } catch { return []; } }
function writeCustomerQueue(vendorId: string, umbrellaId: string, queue: CustomerOfflineOrder[]) { localStorage.setItem(customerQueueKey(vendorId, umbrellaId), JSON.stringify(queue)); }

export default function CustomerApp() {
  const params = useParams();
  const rawUmbrellaSegment = String(params.umbrella_id || params.vendor_id || "");
  const umbrellaId = extractUmbrellaIdFromRouteSegment(rawUmbrellaSegment);
  const routeVendorId = params.umbrella_id && params.vendor_id ? String(params.vendor_id) : "";

  const [step, setStep] = useState<"welcome" | "login" | "menu" | "cart" | "orders">("welcome");
  const [vendor, setVendor] = useState<CustomerVendor | null>(null);
  const [umbrella, setUmbrella] = useState<{ id: string; number: number; label?: string | null } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [currentOrderId, setCurrentOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [optionMenuProduct, setOptionMenuProduct] = useState<Product | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState("");
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true);
  const [splitMode, setSplitMode] = useState<"full" | "partial" | "split">("full");
  const [splitPeople, setSplitPeople] = useState(2);
  const [partialAmount, setPartialAmount] = useState("");
  const [activeCategory, setActiveCategory] = useState<CustomerMenuCategory>("Bebidas");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [lastAddedProductId, setLastAddedProductId] = useState("");
  const [satisfactionOrderId, setSatisfactionOrderId] = useState("");
  const [satisfactionRating, setSatisfactionRating] = useState(0);
  const [satisfactionSent, setSatisfactionSent] = useState(false);
  const [satisfactionLoading, setSatisfactionLoading] = useState(false);
  const [features, setFeatures] = useState<FeatureFlags>({});
  const [promotionPreview, setPromotionPreview] = useState<PromotionPreview | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [flexiblePromotions, setFlexiblePromotions] = useState<FlexiblePromotion[]>([]);
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [offlineOrders, setOfflineOrders] = useState<CustomerOfflineOrder[]>([]);
  const [syncing, setSyncing] = useState(false);

  const visibleProducts = useMemo(() => {
    const now = Date.now();
    return filterCustomerMenuProducts(products, activeCategory).sort((a, b) => {
      const aActivePromo = Boolean(a.menu_highlight || a.is_combo || a.promotional_price) &&
        (!a.promotion_starts_at || new Date(a.promotion_starts_at).getTime() <= now) &&
        (!a.promotion_ends_at || new Date(a.promotion_ends_at).getTime() >= now);
      const bActivePromo = Boolean(b.menu_highlight || b.is_combo || b.promotional_price) &&
        (!b.promotion_starts_at || new Date(b.promotion_starts_at).getTime() <= now) &&
        (!b.promotion_ends_at || new Date(b.promotion_ends_at).getTime() >= now);
      if (aActivePromo !== bActivePromo) return aActivePromo ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [activeCategory, products]);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.promotional_price ?? item.product.price) * item.quantity, 0);
  const promotionDiscount = Math.max(0, Number(promotionPreview?.discount_total || 0));
  const discountedCartTotal = typeof promotionPreview?.total === "number" ? Number(promotionPreview.total) : cartTotal;
  const appliedPromotions = promotionPreview?.applied_promotions || [];
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const upsellSuggestions = useMemo(() => {
    const cartIds = new Set(cart.map(item => item.product.id));
    const rule = upsellRules.find(item => cartIds.has(item.trigger_product_id));
    if (!rule) return null;
    return { message: rule.message, products: rule.suggested_product_ids.filter(id => !cartIds.has(id)).map(id => products.find(product => product.id === id)).filter(Boolean) as Product[] };
  }, [cart, products, upsellRules]);
  const ordersTotal = orders
    .filter((order) => BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrdersTotal = orders
    .filter((order) => !BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const openTotal = ordersTotal + pendingOrdersTotal + discountedCartTotal;
  const serviceFeeAmount = serviceFeeEnabled ? Number((openTotal * 0.1).toFixed(2)) : 0;
  const billTotal = Number((openTotal + serviceFeeAmount).toFixed(2));
  const parsedPartialAmount = Math.max(0, Number(partialAmount.replace(",", ".")) || 0);
  const requestedPaymentAmount = splitMode === "partial"
    ? Math.min(parsedPartialAmount, billTotal)
    : splitMode === "split"
      ? Number((billTotal / Math.max(1, splitPeople)).toFixed(2))
      : billTotal;
  const remainingAfterPayment = Math.max(0, Number((billTotal - requestedPaymentAmount).toFixed(2)));
  const theme = {
    primary: vendor?.primary_color || "#ff6b00",
    secondary: vendor?.secondary_color || "#82533f",
    button: vendor?.button_color || vendor?.primary_color || "#ff6b00",
    buttonText: vendor?.button_text_color || "#ffffff",
    logo: vendor?.logo_url || "/sandexpress-logo-fluid.png",
  };
  const customerThemeVars = {
    "--customer-primary": theme.primary,
    "--customer-secondary": theme.secondary,
    "--customer-button": theme.button,
    "--customer-button-text": theme.buttonText,
  } as CSSProperties;
  const sandExpressMark = (
    <div className="customer-brand-watermark">
      <span>SandExpress</span>
    </div>
  );
  const featureEnabled = (key: string) => features[key] !== false;

  function resetExpiredCustomerSession(message = "Sua sessão expirou. Abra a comanda novamente para enviar pedidos.") {
    sessionStorage.removeItem(`sandexpress_user_${umbrellaId}`);
    setCustomerId("");
    setCurrentOrderId("");
    setCustomerName("");
    setOrders([]);
    setCart([]);
    setError(message);
    setStep("login");
  }

  function endCustomerSession(message = "Conta enviada ao quiosque. Para abrir outra comanda, faça login novamente.") {
    sessionStorage.removeItem(`sandexpress_user_${umbrellaId}`);
    setCustomerId("");
    setCurrentOrderId("");
    setCustomerName("");
    setName("");
    setPhone("");
    setOtpCode("");
    setOtpChallengeId("");
    setOtpVerified(false);
    setOtpMessage("");
    setOrders([]);
    setCart([]);
    setNotes("");
    setPartialAmount("");
    setSplitMode("full");
    setSatisfactionOrderId("");
    setSatisfactionRating(0);
    setSatisfactionSent(false);
    setWaiterCalled(false);
    setWelcomeMessage(message);
    setError("");
    setStep("login");
  }

  async function loadCustomerOrders(nextCustomerId: string, nextVendorId: string) {
    if (!nextCustomerId || !nextVendorId) return;
    let res: Response;
    try {
      res = await fetch(`/api/customers/${encodeURIComponent(nextCustomerId)}/orders?vendor_id=${encodeURIComponent(nextVendorId)}`, { credentials: "include" });
    } catch {
      setOnline(false);
      return;
    }
    const data = await res.json().catch(() => []);
    if (res.status === 401 || res.status === 403) {
      resetExpiredCustomerSession();
      return;
    }
    if (!res.ok) return;
    const mapped = (Array.isArray(data) ? data : []).map((order) => ({
      id: order.id,
      account_id: order.account_id,
      sequence: order.sequence,
      total: Number(order.total || 0),
      account_total: Number(order.account_total || order.total || 0),
      status: order.status || "received",
      account_status: order.account_status,
      created_at: order.created_at || new Date().toISOString(),
    }));
    const queued = readCustomerQueue(nextVendorId, umbrellaId);
    setOfflineOrders(queued);
    setPendingSync(queued.length);
    setOrders([
      ...queued.map((order) => ({ id: order.id, total: order.total, status: "offline_pending", created_at: order.created_at })),
      ...mapped,
    ]);
    if (mapped[0]?.account_id || mapped[0]?.id) setCurrentOrderId(mapped[0].account_id || mapped[0].id);
  }

  useEffect(() => {
    async function loadQrData() {
      try {
        if (!routeVendorId) {
          setError("QR antigo inválido. Gere um novo QR Code no painel do quiosque.");
          return;
        }
        const isUuidVendorRoute = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeVendorId);
        const vendorQuery = isUuidVendorRoute ? `?vendor_id=${encodeURIComponent(routeVendorId)}` : "";
        const res = await fetch(`/api/public/umbrella/${umbrellaId}${vendorQuery}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erro ao carregar cardápio.");
          return;
        }
        setUmbrella(data.umbrella);
        setVendor(data.vendor);
        setProducts(data.products || []);
        setFeatures(data.features || {});
        localStorage.setItem(customerCacheKey(data.vendor?.id || routeVendorId, umbrellaId), JSON.stringify({ umbrella: data.umbrella, vendor: data.vendor, products: data.products || [], features: data.features || {}, saved_at: new Date().toISOString() }));
        fetch(`/api/upsell-settings?vendor_id=${encodeURIComponent(data.vendor?.id || routeVendorId)}`)
          .then(response => response.json())
          .then(settings => setUpsellRules(settings.rules || []))
          .catch(() => undefined);
        fetch(`/api/promotions?vendor_id=${encodeURIComponent(data.vendor?.id || routeVendorId)}`)
          .then(response => response.ok ? response.json() : { promotions: [] })
          .then(result => setFlexiblePromotions(result.promotions || []))
          .catch(() => undefined);

        const saved = sessionStorage.getItem(`sandexpress_user_${umbrellaId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCustomerId(parsed.customer_id || "");
          setCustomerName(parsed.name || "");
          setStep("menu");
          loadCustomerOrders(parsed.customer_id || "", data.vendor?.id || routeVendorId);
        }
      } catch {
        const cacheKeys = [customerCacheKey(routeVendorId, umbrellaId), ...Object.keys(localStorage).filter(key => key.startsWith('sandexpress_customer_cache_') && key.endsWith(`_${umbrellaId}`))];
        const cachedText = cacheKeys.map(key => localStorage.getItem(key)).find(Boolean);
        if (cachedText) {
          try {
            const cached = JSON.parse(cachedText);
            setUmbrella(cached.umbrella); setVendor(cached.vendor); setProducts(cached.products || []); setFeatures(cached.features || {});
            setOnline(false); setWelcomeMessage("Internet indisponível. Cardápio salvo carregado no modo offline.");
            const saved = sessionStorage.getItem(`sandexpress_user_${umbrellaId}`);
            if (saved) { const parsed = JSON.parse(saved); setCustomerId(parsed.customer_id || ""); setCustomerName(parsed.name || ""); setStep("menu"); }
          } catch { setError("Não foi possível abrir o cardápio salvo."); }
        } else setError("Erro de rede ao carregar o cardápio. Conecte-se uma vez para salvá-lo neste aparelho.");
      }
    }

    if (umbrellaId) loadQrData();
  }, [umbrellaId, routeVendorId]);

  useEffect(() => {
    if (!vendor?.id) return;
    const vendorId = vendor.id;
    let cancelled = false;
    const refreshTheme = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const response = await fetch(`/api/public/theme/${encodeURIComponent(vendorId)}`, { cache: "no-store" });
      if (!response.ok) return;
      const nextTheme = await response.json();
      if (!cancelled) setVendor(current => current?.id === vendorId ? { ...current, ...nextTheme } : current);
    };
    const timer = window.setInterval(() => void refreshTheme(), 60000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshTheme(); };
    document.addEventListener("visibilitychange", onVisibility);
    void refreshTheme();
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [vendor?.id]);

  useEffect(() => {
    if (!vendor?.id || !umbrellaId || !customerId) return;
    const vendorId = vendor.id;
    const updatePending = () => {
      const queued = readCustomerQueue(vendorId, umbrellaId);
      setOfflineOrders(queued);
      setPendingSync(queued.length);
    };
    const syncQueue = async () => {
      if (!navigator.onLine) { setOnline(false); updatePending(); return; }
      setOnline(true);
      const remaining = [...readCustomerQueue(vendorId, umbrellaId)];
      if (remaining.length === 0) { setPendingSync(0); return; }
      setSyncing(true);
      while (remaining.length > 0) {
        const queued = remaining[0];
        try {
          const response = await fetch('/api/orders', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(queued.body) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) { setError(data.error || 'Um pedido offline precisa de revisão.'); break; }
          remaining.shift(); writeCustomerQueue(vendorId, umbrellaId, remaining); setOfflineOrders([...remaining]); setPendingSync(remaining.length);
        } catch { setOnline(false); break; }
      }
      setSyncing(false);
      if (remaining.length === 0) { setWelcomeMessage('Internet restabelecida. Pedidos sincronizados com o quiosque.'); await loadCustomerOrders(customerId, vendorId); }
    };
    const connected = () => { setOnline(true); void syncQueue(); };
    const disconnected = () => { setOnline(false); updatePending(); };
    setOnline(navigator.onLine); updatePending();
    if (navigator.onLine) void syncQueue();
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, [vendor?.id, umbrellaId, customerId]);

  useEffect(() => {
    if (!customerId || !vendor?.id) return;
    let loading = false;
    const refresh = async () => {
      if (loading || !navigator.onLine || document.visibilityState !== 'visible') return;
      loading = true;
      try { await loadCustomerOrders(customerId, vendor.id); } finally { loading = false; }
    };
    const timer = window.setInterval(() => void refresh(), 15000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [customerId, vendor?.id]);

  useEffect(() => {
    if (!customerId || !vendor?.id || !umbrellaId) return;

    const touchSession = () => {
      fetch("/api/kiosk-sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umbrella_id: umbrellaId }),
      }).catch(() => undefined);
    };

    touchSession();
    const timer = window.setInterval(touchSession, 60000);
    return () => window.clearInterval(timer);
  }, [customerId, vendor?.id, umbrellaId]);

  useEffect(() => {
    if (!vendor?.id || cart.length === 0 || !customerId) {
      setPromotionPreview(null);
      setPromotionLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPromotionLoading(true);
      try {
        const res = await fetch("/api/promotions/calculate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_id: vendor.id,
            items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data && !data.unavailable) {
          setPromotionPreview(data);
        }
        if (!cancelled && (!res.ok || data?.unavailable)) {
          setPromotionPreview(null);
        }
      } catch {
        if (!cancelled) setPromotionPreview(null);
      } finally {
        if (!cancelled) setPromotionLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cart, customerId, vendor?.id]);

  async function startTab() {
    if (!vendor) return;
    if (name.trim().length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!isValidBrazilPhoneWithDdd(phone)) {
      setError("Informe um telefone válido com DDD. Exemplo: 1196041957.");
      return;
    }
    const normalizedPhone = normalizeBrazilPhoneWithDdd(phone);
    setLoading(true);
    setError("");
    setWelcomeMessage("");
    try {
      const res = await fetch("/api/customers/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: normalizedPhone,
          vendor_id: vendor.id,
          umbrella_id: umbrellaId,
          party_size: partySize,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao abrir comanda.");
        return;
      }
      setCustomerId(data.id || data.customer_id);
      setCurrentOrderId(data.current_order_id || "");
      setCustomerName(data.name || name);
      setWelcomeMessage(data.message || "");
      sessionStorage.setItem(`sandexpress_user_${umbrellaId}`, JSON.stringify({
        customer_id: data.id || data.customer_id,
        name: data.name || name,
        phone: data.phone || normalizedPhone,
        party_size: data.party_size || partySize,
      }));
      await loadCustomerOrders(data.id || data.customer_id, vendor.id);
      setStep("menu");
    } finally {
      setLoading(false);
    }
  }

  async function sendCustomerOtp() {
    if (!vendor) return;
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10) {
      setError("Informe nome e celular válidos antes de validar.");
      return;
    }
    setError("");
    setOtpMessage("Envie pelo WhatsApp a frase: obter código de validação para o sandexpress. Depois digite o código recebido aqui.");
    setOtpVerified(false);
  }

  async function verifyCustomerOtp() {
    if (otpCode.replace(/\D/g, "").length !== 6) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    setLoading(true);
    setError("");
    setOtpMessage("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: otpChallengeId || undefined,
          phone,
          purpose: "customer_login",
          vendor_id: vendor?.id,
          code: otpCode.replace(/\D/g, ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Código inválido.");
        return;
      }
      setOtpVerified(true);
      setOtpChallengeId(data.challenge_id || otpChallengeId);
      setOtpMessage("WhatsApp validado.");
    } catch {
      setError("Erro de rede ao validar código.");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: Product) {
    const groups = getProductOptionGroups(product);
    const choices = groups.map(group => ({ name: group.name, value: selectedOptions[`${product.id}:${group.name}`] || group.options[0] })).filter(choice => choice.value);
    const option = choices.length > 0 ? choices.map(choice => `${choice.name}: ${choice.value}`).join(' | ') : null;
    setLastAddedProductId(product.id);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && (item.option || null) === option);
      if (existing) {
        return prev.map((item) => item.product.id === product.id && (item.option || null) === option ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, option }];
    });
    window.setTimeout(() => setLastAddedProductId((current) => current === product.id ? "" : current), 1400);
  }

  function addPromotionToCart(promotion: FlexiblePromotion) {
    let added = 0;
    (promotion.promocao_itens || []).forEach(item => {
      const product = products.find(current => current.id === item.product_id);
      if (!product) return;
      for (let index = 0; index < Math.max(1, Number(item.quantidade || 1)); index += 1) addToCart(product);
      added += Math.max(1, Number(item.quantidade || 1));
    });
    if (added > 0) setWelcomeMessage(`Oferta “${promotion.titulo}” adicionada. O desconto aparece no carrinho.`);
  }

  function updateQuantity(productId: string, delta: number, option?: string | null) {
    setCart((prev) => prev
      .map((item) => item.product.id === productId && (option === undefined || (item.option || null) === (option || null)) ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  function getCartQuantity(productId: string, option?: string | null) {
    return cart
      .filter((item) => item.product.id === productId && (option === undefined || (item.option || null) === (option || null)))
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  async function createOrder() {
    if (!vendor || !customerId || cart.length === 0) return;
    let offlineCandidate: CustomerOfflineOrder | null = null;
    setLoading(true);
    setError("");
    try {
      const optionNotes = cart
        .filter((item) => item.option)
        .map((item) => `${item.product.name}: ${item.option}`)
        .join("; ");
      const orderNotes = [notes.trim(), optionNotes ? `Opções escolhidas: ${optionNotes}` : ""].filter(Boolean).join("\n");
      const idempotencyKey = crypto.randomUUID();
      const orderBody = {
        vendor_id: vendor.id,
        customer_id: customerId,
        umbrella_id: umbrellaId,
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        notes: orderNotes,
        idempotency_key: idempotencyKey,
      };
      offlineCandidate = { id: idempotencyKey, body: orderBody, total: discountedCartTotal, created_at: new Date().toISOString() };
      const saveOffline = () => {
        const queued = offlineCandidate!;
        const queue = [...readCustomerQueue(vendor.id, umbrellaId), queued];
        writeCustomerQueue(vendor.id, umbrellaId, queue); setOfflineOrders(queue); setPendingSync(queue.length); setOnline(false);
        setOrders(prev => [{ id: idempotencyKey, total: discountedCartTotal, status: 'offline_pending', created_at: queued.created_at }, ...prev]);
        setPromotionPreview(null); setCart([]); setNotes(''); setWelcomeMessage('Pedido salvo neste aparelho. Ele será enviado automaticamente quando a internet voltar.'); setStep('orders');
      };
      if (!navigator.onLine) { saveOffline(); return; }
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderBody),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        resetExpiredCustomerSession(data.error || "Sessão expirada. Abra a comanda novamente para enviar o pedido.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Erro ao enviar pedido.");
        return;
      }
      setOrders((prev) => {
        const responsePromotion = data.promotion_preview as PromotionPreview | undefined;
        const responseTotal = typeof responsePromotion?.total === "number" ? responsePromotion.total : Number(data.total ?? discountedCartTotal);
        const nextOrder = {
          id: data.id,
          total: responseTotal,
          status: data.status || "received",
          created_at: data.created_at || new Date().toISOString(),
        };
        setCurrentOrderId(data.id || currentOrderId);
        const existing = prev.find((order) => order.id === data.id);
        if (existing) {
          return prev.map((order) => order.id === data.id ? nextOrder : order);
        }
        return [nextOrder, ...prev];
      });
      setPromotionPreview(null);
      setCart([]);
      setNotes("");
      setStep("orders");
    } catch (sendError) {
      if (sendError instanceof TypeError && vendor && offlineCandidate) {
        const queued = offlineCandidate;
        const queue = [...readCustomerQueue(vendor.id, umbrellaId), queued]; writeCustomerQueue(vendor.id, umbrellaId, queue); setOfflineOrders(queue); setPendingSync(queue.length); setOnline(false);
        setOrders(prev => [{ id: queued.id, total: queued.total, status: 'offline_pending', created_at: queued.created_at }, ...prev]); setCart([]); setNotes(''); setStep('orders'); setWelcomeMessage('Sinal caiu. Pedido protegido e aguardando sincronização.');
      } else setError(sendError instanceof Error ? sendError.message : 'Erro ao enviar pedido.');
    } finally {
      setLoading(false);
    }
  }

  async function requestCloseAccount() {
    if (!vendor) return;
    if (openTotal <= 0) {
      setError("Ainda não há valor em aberto para pedir a conta.");
      setStep("orders");
      return;
    }
    if (cart.length > 0) {
      setError("Envie ou remova os itens do carrinho antes de pedir a conta.");
      setStep("cart");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/close-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendor.id,
          umbrella_id: umbrellaId,
          request_only: true,
          notes: "Fechamento solicitado pelo cliente",
          payment_amount: requestedPaymentAmount,
          service_fee_amount: serviceFeeAmount,
          service_fee_enabled: serviceFeeEnabled,
          split_people: splitPeople,
          split_mode: splitMode === "partial" ? "custom" : splitMode,
        }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        resetExpiredCustomerSession(data.error || "Sessão expirada. Abra a comanda novamente para pedir a conta.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Não há conta aberta para fechar.");
        return;
      }
      const responseOrder = Array.isArray(data.order) ? data.order[0] : data.order;
      const orderIdForSurvey =
        responseOrder?.id ||
        data.order_id ||
        currentOrderId ||
        orders.find((order) => order.status !== "closing_requested")?.id ||
        orders[0]?.id ||
        "";

      if (orderIdForSurvey) {
        setSatisfactionOrderId(orderIdForSurvey);
        setSatisfactionRating(0);
        setSatisfactionSent(false);
        setCurrentOrderId(orderIdForSurvey);
        setOrders((prev) => prev.map((order) => order.id === orderIdForSurvey ? { ...order, status: "closing_requested" } : order));
      }

      setPartialAmount("");
      setError(data.message || "Conta enviada ao quiosque. Vote no que achou da experiência antes de sair.");
      setStep("orders");
    } finally {
      setLoading(false);
    }
  }

  async function submitSatisfaction(rating: number) {
    if (!satisfactionOrderId || rating < 1 || rating > 5) return;
    setSatisfactionLoading(true);
    setError("");
    setSatisfactionRating(rating);
    try {
      const res = await fetch("/api/satisfaction", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: satisfactionOrderId, rating }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        resetExpiredCustomerSession(data.error || "Sessão expirada. Abra a comanda novamente para avaliar.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Não foi possível enviar sua avaliação.");
        return;
      }
      setSatisfactionSent(true);
    } finally {
      setSatisfactionLoading(false);
    }
  }

  async function requestService(requestType: "waiter_call") {
    if (!vendor || !customerId) {
      setError("Abra a comanda antes de solicitar atendimento.");
      return;
    }
    if (!featureEnabled(requestType)) {
      setError("Este módulo está desativado para este quiosque.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waiter-call", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendor.id, customer_id: customerId, umbrella_id: umbrellaId, request_type: requestType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        resetExpiredCustomerSession(data.error || "Sessão expirada. Abra a comanda novamente para solicitar atendimento.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Não foi possível solicitar atendimento.");
        return;
      }
      setWaiterCalled(true);
      if (data.order?.id) {
        setCurrentOrderId(data.order.id);
        await loadCustomerOrders(customerId, vendor.id);
      }
      window.setTimeout(() => setWaiterCalled(false), 8000);
    } finally {
      setLoading(false);
    }
  }

  function callWaiter() {
    return requestService("waiter_call");
  }

  if (step === "welcome") {
    return (
      <main className="customer-app customer-welcome" style={customerThemeVars}>
        <section className="customer-welcome__content">
          <div className="customer-logo">
            {theme.logo ? (
              <img src={theme.logo} alt="Logo do quiosque" />
            ) : (
              <UtensilsCrossed size="2.875rem" />
            )}
          </div>
          <p className="customer-brand-label">SandExpress</p>
          <h1 className="customer-title">{vendor?.name || "Carregando quiosque..."}</h1>
          {error && <p className="customer-error">{error}</p>}
          <button onClick={() => setStep("login")} className="customer-action">
            Comecar pedido
          </button>
        </section>
        {sandExpressMark}
      </main>
    );
  }

  if (step === "login") {
    return (
      <main className="customer-app customer-login" style={customerThemeVars}>
        <section className="customer-login__panel">
          <div className="customer-login__brand">
            <div className="customer-logo customer-logo--small">
              <img src={theme.logo} alt="Logo do quiosque" />
            </div>
            <div className="customer-login__brand-text">
              <p className="customer-login__kicker">SandExpress</p>
              <h1 className="customer-login__title">{vendor?.name || "Quiosque"}</h1>
              <p className="customer-login__subtitle">Abrir comanda</p>
            </div>
          </div>
          <p className="customer-login__subtitle">Informe os dados para iniciar.</p>
          {welcomeMessage && <p className="customer-feedback">{welcomeMessage}</p>}
          <div className="customer-form">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" aria-label="Nome completo" className="customer-input" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+()\-\s]/g, "").slice(0, 20))}
              placeholder="Telefone com DDD. Ex: +55 11 9604-1957"
              aria-label="Telefone com DDD"
              inputMode="tel"
              className="customer-input"
            />
            <p className="customer-login__subtitle">Use DDD + telefone, somente numeros.</p>
            <div className="customer-stepper">
              <p className="customer-stepper__label">Quantidade de pessoas</p>
              <div className="customer-stepper__control">
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.max(1, value - 1))}
                  disabled={partySize <= 1}
                  className="customer-stepper__button"
                  aria-label="Diminuir quantidade de pessoas"
                >
                  -
                </button>
                <div className="customer-stepper__value">
                  {partySize}
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.min(50, value + 1))}
                  disabled={partySize >= 50}
                  className="customer-stepper__button"
                  aria-label="Aumentar quantidade de pessoas"
                >
                  +
                </button>
              </div>
            </div>
            {error && <p className="customer-error">{error}</p>}
            <button disabled={loading} onClick={startTab} className="customer-primary-button">
              {loading ? "Abrindo..." : "Abrir comanda"}
            </button>
          </div>
        </section>
        {sandExpressMark}
      </main>
    );
  }

  return (
    <main className="customer-app customer-shell" style={customerThemeVars}>
      <header className="customer-topbar">
        <div className="customer-topbar__main">
          <div className="customer-identity">
            <div className="customer-avatar">
              <img src={theme.logo} alt="Logo do quiosque" />
            </div>
            <div>
              <p className="customer-kicker">Guarda-sol {umbrella?.number || ""}</p>
              <h1 className="customer-name">{customerName || "Cliente"}</h1>
              {currentOrderId && <p className="customer-note">Pedido #{currentOrderId.slice(0, 8)}</p>}
            </div>
          </div>
          <div className="customer-actions">
            <button onClick={requestCloseAccount} disabled={loading || !online} title={!online ? 'A conta só pode ser solicitada com internet' : undefined} className="customer-icon-button customer-icon-button--secondary">
              Fechar conta
            </button>
            {featureEnabled("waiter_call") && (
              <button onClick={callWaiter} disabled={!online || waiterCalled} title={!online ? 'O chamado precisa de internet' : waiterCalled ? 'Chamado já enviado ao atendimento' : undefined} className="customer-icon-button">
                <Bell size="1.125rem" /> {waiterCalled ? 'Chamado enviado' : 'Atendente'}
              </button>
            )}
          </div>
        </div>
        {waiterCalled && <p className="customer-feedback">Solicitacao enviada ao quiosque.</p>}
        {welcomeMessage && <p className="customer-feedback">{welcomeMessage}</p>}
        {error && <p className="customer-error">{error}</p>}
        <div className="customer-total-card">
          <p className="customer-kicker">Total da conta</p>
          <strong>{formatCurrency(openTotal)}</strong>
          {pendingOrdersTotal > 0 && (
            <p className="customer-small">
              {formatCurrency(pendingOrdersTotal)} aguardando entrega
            </p>
          )}
        </div>
      </header>

      {(!online || pendingSync > 0 || syncing) && (
        <div className={`mx-4 mt-3 rounded-2xl border p-3 text-sm font-bold ${online ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`} role="status" aria-live="polite">
          <p className="font-black">{syncing ? 'Sincronizando pedidos...' : online ? 'Pedidos aguardando sincronização' : 'Modo offline ativo'}</p>
          <p className="mt-1">{pendingSync > 0 ? `${pendingSync} pedido(s) protegido(s) neste aparelho.` : 'O cardápio salvo continua disponível. Pedidos serão enviados quando o sinal voltar.'}</p>
          {offlineOrders.length > 0 && (
            <div className="mt-3 grid gap-2">
              {offlineOrders.map((order, index) => (
                <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-current/20 bg-white/70 px-3 py-2">
                  <div>
                    <p className="text-xs font-black">Pedido offline {index + 1}</p>
                    <p className="text-xs font-bold opacity-80">{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {order.body.items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</p>
                  </div>
                  <strong className="whitespace-nowrap">{formatCurrency(order.total)}</strong>
                </div>
              ))}
            </div>
          )}
          {pendingSync > 0 && !syncing && <button type="button" onClick={() => { if (!vendor || !confirm('Descartar os pedidos que ainda não foram enviados?')) return; writeCustomerQueue(vendor.id, umbrellaId, []); setOfflineOrders([]); setPendingSync(0); setOrders(current => current.filter(order => order.status !== 'offline_pending')); setWelcomeMessage('Pedidos offline descartados.'); }} className="mt-3 rounded-lg border border-current px-3 py-2 text-xs font-black">Descartar pendentes</button>}
        </div>
      )}

      {step === "menu" && (
        <section className="customer-content">
          {flexiblePromotions.length > 0 && <div className="customer-offers"><div className="customer-offers__title"><Star size="1.1rem" /><span>Ofertas do quiosque</span></div><div className="customer-offers__rail">{flexiblePromotions.map(promotion => { const freeProduct = promotion.descricao?.startsWith('[PRODUTO_GRATIS]'); const description = String(promotion.descricao || '').replace(/^\[(PRODUTO_GRATIS|COMBO)\]\s*/, ''); const benefit = freeProduct ? 'Produto grátis' : promotion.desconto_tipo === 'percentual' ? `${promotion.desconto_valor}% OFF` : promotion.desconto_tipo === 'preco_fechado' ? `Combo ${formatCurrency(Number(promotion.desconto_valor))}` : `Economize ${formatCurrency(Number(promotion.desconto_valor))}`; return <article key={promotion.id} className="customer-offer-card"><span>{benefit}</span><h2>{promotion.titulo}</h2>{description && <p>{description}</p>}<small>{promotion.promocao_itens?.map(item => `${item.quantidade || 1}x ${item.products?.name || 'item'}`).join(' + ')}</small><button type="button" onClick={() => addPromotionToCart(promotion)}><Plus size="1rem" /> Adicionar oferta</button></article>; })}</div></div>}
          <div className="customer-category-rail">
            {CUSTOMER_MENU_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`customer-chip${activeCategory === category ? " is-active" : ""}`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="customer-list">
            {visibleProducts.length === 0 ? (
              <p className="customer-empty">Nenhum produto nesta categoria.</p>
            ) : visibleProducts.map((product) => {
              const optionGroups = getProductOptionGroups(product);
              const selectedOption = optionGroups.length > 0 ? optionGroups.map(group => `${group.name}: ${selectedOptions[`${product.id}:${group.name}`] || group.options[0]}`).join(' | ') : null;
              const quantity = getCartQuantity(product.id, selectedOption);
              const highlighted = Boolean(product.menu_highlight || product.is_combo || product.promotional_price);
              return (
                <article key={product.id} className={`customer-product-row${lastAddedProductId === product.id ? " is-added" : ""}`}>
                  {product.image_url && (
                    <div className="customer-product-media">
                      <img src={getCustomerMenuThumbnail(product.image_url)} alt={product.name} loading="lazy" decoding="async" />
                    </div>
                  )}
                  <div className="customer-product-info">
                    <h2 className="customer-product-name">{product.name}</h2>
                    <p className="customer-product-description">{product.description || product.subcategory || product.category}</p>
                    {highlighted && (
                      <span className="customer-promo-pill">{product.is_combo ? "Combo" : "Promoção"}</span>
                    )}
                    {optionGroups.length > 0 && <button type="button" onClick={() => setOptionMenuProduct(product)} className="customer-options-trigger">Escolher opções</button>}
                    <span className="customer-price">{formatCurrency(Number(product.promotional_price ?? product.price))}</span>
                  </div>
                  <div className="customer-product-side">
                    {quantity > 0 ? (
                      <div className="customer-qty customer-qty--compact">
                        <button onClick={() => updateQuantity(product.id, -1, selectedOption)} className="customer-qty-button" aria-label={`Remover ${product.name}`}>
                          <Minus size="1rem" />
                        </button>
                        <span>{quantity}</span>
                        <button onClick={() => optionGroups.length > 0 ? setOptionMenuProduct(product) : addToCart(product)} className="customer-qty-button" aria-label={`Adicionar ${product.name}`}>
                          <Plus size="1rem" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => optionGroups.length > 0 ? setOptionMenuProduct(product) : addToCart(product)}
                        className="customer-add-button"
                        aria-label={`Adicionar ${product.name} ao carrinho`}
                      >
                        <Plus size="1.15rem" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {cartItemsCount > 0 && (
            <div className="customer-cart-dock" role="status" aria-live="polite">
              <div>
                <strong>{cartItemsCount} {cartItemsCount === 1 ? "item" : "itens"}</strong>
                <span>{formatCurrency(discountedCartTotal)}</span>
              </div>
              <button type="button" onClick={() => setStep("cart")}>
                Ver carrinho
              </button>
            </div>
          )}
        </section>
      )}

      {step === "cart" && (
        <section className="customer-content">
          <div className="customer-list">
            {cart.length === 0 ? <p className="customer-empty">Carrinho vazio.</p> : cart.map((item) => (
              <article key={`${item.product.id}-${item.option || "padrao"}`} className="customer-cart-row">
                <div className="customer-cart-info">
                  <h2 className="customer-cart-name">{item.product.name}</h2>
                  {item.option && <p className="customer-cart-option">{item.product.option_group_name || "Opcao"}: {item.option}</p>}
                  <p className="customer-cart-meta">{formatCurrency(Number(item.product.promotional_price ?? item.product.price) * item.quantity)}</p>
                </div>
                <div className="customer-qty">
                  <button onClick={() => updateQuantity(item.product.id, -1, item.option)} className="customer-qty-button" aria-label={`Remover ${item.product.name}`}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1, item.option)} className="customer-qty-button" aria-label={`Adicionar ${item.product.name}`}>+</button>
                </div>
              </article>
            ))}
          </div>
          {upsellSuggestions && upsellSuggestions.products.length > 0 && (
            <div className="customer-upsell-card">
              <p>{upsellSuggestions.message}</p>
              <div>{upsellSuggestions.products.map(product => <button key={product.id} type="button" onClick={() => addToCart(product)}><Plus size="1rem" /><span>{product.name}</span><strong>{formatCurrency(Number(product.promotional_price ?? product.price))}</strong></button>)}</div>
            </div>
          )}
          {cart.length > 0 && (
            <div className="customer-bill-panel">
              <div className="customer-bill-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
              {promotionLoading && (
                <p className="customer-small">Verificando promocoes do quiosque...</p>
              )}
              {promotionDiscount > 0 && (
                <>
                  <div className="customer-bill-row">
                    <span>Desconto promocional</span>
                    <strong>-{formatCurrency(promotionDiscount)}</strong>
                  </div>
                  {appliedPromotions.length > 0 && (
                    <div className="customer-bill-summary">
                      {appliedPromotions.map((promotion, index) => (
                        <small key={promotion.promocao_id || index}>
                          {promotion.titulo || "Promoção aplicada"}: -{formatCurrency(Number(promotion.desconto || 0))}
                        </small>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="customer-bill-total">
                <span>Total do pedido</span>
                <strong>{formatCurrency(discountedCartTotal)}</strong>
              </div>
            </div>
          )}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações do pedido" aria-label="Observações do pedido" rows={3} className="customer-textarea" />
          <button onClick={createOrder} disabled={loading || cart.length === 0} className="customer-primary-button">Enviar pedido</button>
        </section>
      )}

      {step === "orders" && (
        <section className="customer-content">
          {satisfactionOrderId && (
            <div className="customer-satisfaction-card">
              {satisfactionSent ? (
                <>
                  <p className="customer-satisfaction-eyebrow">Avaliação enviada</p>
                  <h2>Obrigado pelo retorno.</h2>
                  <p className="customer-small">Sua opinião ajuda o quiosque a melhorar o atendimento na praia.</p>
                </>
              ) : (
                <>
                  <p className="customer-satisfaction-eyebrow">Pedido de conta enviado</p>
                  <h2>Vote no que achou da experiência</h2>
                  <p className="customer-small">Antes de sair, toque em uma estrela para avaliar seu atendimento.</p>
                  <div className="customer-stars" aria-label="Avaliar experiência de 1 a 5 estrelas">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => submitSatisfaction(rating)}
                        disabled={satisfactionLoading}
                        className={`customer-star-button${satisfactionRating >= rating ? " is-active" : ""}`}
                        aria-label={`Avaliar com ${rating} estrela${rating > 1 ? "s" : ""}`}
                      >
                        <Star size="1.65rem" fill="currentColor" />
                      </button>
                    ))}
                  </div>
                  <p className="customer-small">Toque em uma estrela para enviar sua avaliação.</p>
                </>
              )}
            </div>
          )}

          <div className="customer-bill-panel">
            <div className="customer-bill-row">
              <span>Conta</span>
              <strong>{formatCurrency(openTotal)}</strong>
            </div>
            <label className="customer-fee-toggle">
              <input
                type="checkbox"
                checked={serviceFeeEnabled}
                onChange={(event) => setServiceFeeEnabled(event.target.checked)}
              />
              <span>Incluir 10% do garçom</span>
              <strong>{formatCurrency(serviceFeeAmount)}</strong>
            </label>
            <div className="customer-bill-total">
              <span>Total a pagar</span>
              <strong>{formatCurrency(billTotal)}</strong>
            </div>

            <div className="customer-pay-modes" aria-label="Modo de pagamento">
              <button type="button" onClick={() => setSplitMode("full")} className={splitMode === "full" ? "is-active" : ""}>
                Total
              </button>
              <button type="button" onClick={() => setSplitMode("partial")} className={splitMode === "partial" ? "is-active" : ""}>
                Parcial
              </button>
              <button type="button" onClick={() => setSplitMode("split")} className={splitMode === "split" ? "is-active" : ""}>
                Dividir
              </button>
            </div>

            {splitMode === "partial" && (
              <input
                value={partialAmount}
                inputMode="decimal"
                onChange={(event) => setPartialAmount(event.target.value.replace(/[^\d,\.]/g, ""))}
                placeholder="Valor parcial"
                className="customer-input customer-money-input"
              />
            )}

            {splitMode === "split" && (
              <div className="customer-stepper customer-split-stepper">
                <p className="customer-stepper__label">Pessoas no guarda-sol</p>
                <div className="customer-stepper__control">
                  <button
                    type="button"
                    onClick={() => setSplitPeople((value) => Math.max(1, value - 1))}
                    className="customer-stepper__button"
                    aria-label="Diminuir pessoas para divisão"
                  >
                    -
                  </button>
                  <input
                    value={splitPeople}
                    inputMode="numeric"
                    onChange={(event) => setSplitPeople(Math.max(1, Math.min(50, Number(event.target.value.replace(/\D/g, "")) || 1)))}
                    className="customer-stepper__input"
                    aria-label="Quantidade de pessoas para divisão"
                  />
                  <button
                    type="button"
                    onClick={() => setSplitPeople((value) => Math.min(50, value + 1))}
                    className="customer-stepper__button"
                    aria-label="Aumentar pessoas para divisão"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="customer-bill-summary">
              <span>{splitMode === "split" ? "Valor por pessoa" : splitMode === "partial" ? "Pagamento agora" : "Pagamento solicitado"}</span>
              <strong>{formatCurrency(requestedPaymentAmount)}</strong>
              {remainingAfterPayment > 0 && <small>Saldo restante: {formatCurrency(remainingAfterPayment)}</small>}
            </div>

            <button onClick={requestCloseAccount} disabled={loading || openTotal <= 0} className="customer-primary-button customer-close-button">
              {loading ? "Enviando..." : "Pedir conta"}
            </button>
          </div>

          <div className="customer-list">
            {orders.length === 0 ? <p className="customer-empty">Nenhum pedido ainda.</p> : orders.map((order) => (
              <article key={order.id} className="customer-order-row">
                <div className="customer-order-info">
                  <h2 className="customer-order-title">
                    {order.sequence ? `Pedido ${order.sequence}` : `Pedido #${order.id.slice(0, 8)}`}
                  </h2>
                  <p className="customer-order-meta">
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </p>
                  {BILLABLE_STATUSES.has(order.status) && (
                    <p className="customer-small">Contabilizado na conta</p>
                  )}
                </div>
                <p className="customer-order-price customer-price">{formatCurrency(Number(order.total || 0))}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {optionMenuProduct && (() => {
        const groups = getProductOptionGroups(optionMenuProduct);
        return <div className="customer-option-modal-backdrop" onClick={() => setOptionMenuProduct(null)}><div className="customer-option-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Opções de ${optionMenuProduct.name}`}><div className="customer-option-modal__header"><div><small>Monte do seu jeito</small><h2>{optionMenuProduct.name}</h2><p>Escolha uma opção em cada etapa.</p></div><button type="button" onClick={() => setOptionMenuProduct(null)} aria-label="Fechar opções">×</button></div><div className="customer-option-modal__groups">{groups.map(group => <div key={group.name} className="customer-option-group"><p>{group.name}</p><div>{group.options.map(option => <button key={option} type="button" onClick={() => setSelectedOptions(current => ({ ...current, [`${optionMenuProduct.id}:${group.name}`]: option }))} className={(selectedOptions[`${optionMenuProduct.id}:${group.name}`] || group.options[0]) === option ? 'is-selected' : ''}>{option}</button>)}</div></div>)}</div><div className="customer-option-modal__footer"><div><small>Preço</small><strong>{formatCurrency(Number(optionMenuProduct.promotional_price ?? optionMenuProduct.price))}</strong></div><button type="button" onClick={() => { addToCart(optionMenuProduct); setOptionMenuProduct(null); }}>Adicionar ao pedido</button></div></div></div>;
      })()}

      <nav className="customer-tabbar" aria-label="Navegação do pedido">
        <button onClick={() => setStep("menu")} className={`customer-tab${step === "menu" ? " is-active" : ""}`}>
          <Home size="1.5rem" />
          Cardápio
        </button>
        <button onClick={() => setStep("cart")} className={`customer-tab${step === "cart" ? " is-active" : ""}`}>
          <ShoppingCart size="1.5rem" />
          Carrinho
          {cartItemsCount > 0 && <span className="customer-badge">{cartItemsCount}</span>}
        </button>
        <button onClick={() => setStep("orders")} className={`customer-tab${step === "orders" ? " is-active" : ""}`}>
          <ListOrdered size="1.5rem" />
          Conta
        </button>
      </nav>
    </main>
  );
}
