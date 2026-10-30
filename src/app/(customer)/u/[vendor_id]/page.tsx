"use client";

import { accountShare, registeredPeople } from "@/lib/account-share";
import { customerOrderView } from "@/lib/customer-order-view";
import { kioskLogoForCustomer } from "@/lib/kiosk-logo";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Bell, CheckCircle2, ChefHat, ChevronLeft, CircleX, Flame, HandCoins, ListOrdered, Minus, Plus, ReceiptText, Search, ShoppingBag, Star, UtensilsCrossed, WifiOff, X, Zap } from "lucide-react";
import { extractUmbrellaIdFromRouteSegment } from "@/lib/public-url";
import { formatCurrency } from "@/lib/utils";
import { isValidBrazilPhoneWithDdd, normalizeBrazilPhoneWithDdd } from "@/lib/phone";
import { InstallShortcutButton } from "@/components/pwa/InstallShortcutButton";
import { QrScannerButton } from "@/components/pwa/QrScannerButton";
import { getOrderOptionGroups, selectedOrderOptions } from "@/lib/order-options";
import {
  getAvailableCustomerCategories,
  CustomerMenuCategory,
  filterCustomerMenuProducts,
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
  note?: string;
};

type ItemDrawer = { product: Product; quantity: number; note: string };

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
  items?: Array<{ id: string; name: string; quantity: number; unit_price: number; subtotal: number; delivered_quantity: number; cancelled: boolean }>;
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

function normalizeMenuText(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const CATEGORY_EMOJIS: Array<[RegExp, string]> = [
  [/cafe|manha/, "☕"],
  [/camarao|peixe|frutos do mar|lula|siri/, "🦐"],
  [/pastel|pasteis/, "🥟"],
  [/porc|petisco|fritas|batata/, "🍟"],
  [/lanche|combo|burguer|hamburguer|sanduiche/, "🍔"],
  [/salada|entrada/, "🥗"],
  [/prato|executivo|refeic/, "🍽️"],
  [/cerveja|chopp/, "🍺"],
  [/drink|caipi|coquetel|batida|gin/, "🍹"],
  [/dose|whisky|vodka|cachaca/, "🥃"],
  [/coco|suco|agua/, "🥥"],
  [/sobremesa|acai|sorvete|doce/, "🍨"],
  [/bebida|refrigerante/, "🥤"],
];

function categoryEmoji(category: string) {
  const text = normalizeMenuText(category);
  if (text === "todos") return "🍽️";
  return CATEGORY_EMOJIS.find(([pattern]) => pattern.test(text))?.[1] || "🍴";
}

function productEffectivePrice(product: Product) {
  return Number(product.promotional_price ?? product.price);
}

function productHasDiscount(product: Product) {
  return product.promotional_price != null && Number(product.promotional_price) < Number(product.price);
}

function productPromoActive(product: Product, now: number) {
  return Boolean(product.menu_highlight || product.is_combo || productHasDiscount(product)) &&
    (!product.promotion_starts_at || new Date(product.promotion_starts_at).getTime() <= now) &&
    (!product.promotion_ends_at || new Date(product.promotion_ends_at).getTime() >= now);
}

function productBadge(product: Product) {
  if (productHasDiscount(product)) {
    const percent = Math.round((1 - Number(product.promotional_price) / Number(product.price)) * 100);
    return percent > 0 ? `-${percent}% OFF` : "Promoção";
  }
  if (product.is_combo) return "Combo";
  if (product.menu_highlight) return "Destaque";
  return "";
}

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
  const [itemDrawer, setItemDrawer] = useState<ItemDrawer | null>(null);
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState("");
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true);
  const [separatePayment, setSeparatePayment] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CustomerMenuCategory>("Todos");
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
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [accountSummaryOpen, setAccountSummaryOpen] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState<Record<string, string>>({});
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (!customerId || !currentOrderId) return;
    try { setAccountPreferences(JSON.parse(sessionStorage.getItem(`account_preferences_${currentOrderId}`) || "{}")); }
    catch { setAccountPreferences({}); }
  }, [customerId, currentOrderId]);

  useEffect(() => {
    if (!welcomeMessage || step === "login") return;
    const timer = window.setTimeout(() => setWelcomeMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [welcomeMessage, step]);

  function changeAccountPreference(name: string, value: string) {
    const next = { ...accountPreferences, [name]: value };
    setAccountPreferences(next);
    if (currentOrderId) sessionStorage.setItem(`account_preferences_${currentOrderId}`, JSON.stringify(next));
  }

  const menuCategories = useMemo(() => getAvailableCustomerCategories(products), [products]);
  const categorySections = useMemo(() => menuCategories
    .filter(category => category !== "Todos" && (activeCategory === "Todos" || category === activeCategory))
    .map(category => ({ category, products: filterCustomerMenuProducts(products, category) }))
    .filter(section => section.products.length > 0), [activeCategory, menuCategories, products]);
  const searchResults = useMemo(() => {
    const terms = normalizeMenuText(search).trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return null;
    return products.filter(product => {
      const text = normalizeMenuText(`${product.name} ${product.description || ""} ${product.category} ${product.subcategory || ""}`);
      return terms.every(term => text.includes(term));
    });
  }, [products, search]);
  const promoProducts = useMemo(() => {
    const now = Date.now();
    return products.filter(product => productPromoActive(product, now)).slice(0, 8);
  }, [products]);
  const cartTotal = cart.reduce((sum, item) => sum + productEffectivePrice(item.product) * item.quantity, 0);
  const promotionDiscount = Math.max(0, Number(promotionPreview?.discount_total || 0));
  const discountedCartTotal = typeof promotionPreview?.total === "number" ? Number(promotionPreview.total) : cartTotal;
  const appliedPromotions = promotionPreview?.applied_promotions || [];
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const accountItems = useMemo(() => orders.flatMap(order => (order.items || []).map(item => ({ ...item, orderId: order.id, sequence: order.sequence }))), [orders]);
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
  const openTotal = ordersTotal + pendingOrdersTotal;
  const serviceFeeAmount = serviceFeeEnabled ? Number((openTotal * 0.1).toFixed(2)) : 0;
  const billTotal = Number((openTotal + serviceFeeAmount).toFixed(2));
  const kioskLogo = kioskLogoForCustomer(vendor?.logo_url);
  const umbrellaLabel = umbrella?.number != null ? `Guarda-sol ${umbrella.number}` : "Guarda-sol";
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
    const mapped: Order[] = (Array.isArray(data) ? data : []).map(order => customerOrderView(order));
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
          .then(settings => setUpsellRules(settings.enabled === false ? [] : settings.rules || []))
          .catch(() => undefined);
        fetch(`/api/promotions?vendor_id=${encodeURIComponent(data.vendor?.id || routeVendorId)}`)
          .then(response => response.ok ? response.json() : { promotions: [] })
          .then(result => setFlexiblePromotions(result.promotions || []))
          .catch(() => undefined);

        let restoredFromServer = false;
        try {
          const sessionResponse = await fetch(`/api/customers/session?umbrella_id=${encodeURIComponent(umbrellaId)}&vendor_id=${encodeURIComponent(data.vendor?.id || routeVendorId)}`, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (sessionResponse.ok) {
            const restored = await sessionResponse.json();
            const restoredCustomerId = restored.id || restored.customer_id;
            if (restoredCustomerId) {
              setCustomerId(restoredCustomerId);
              setCurrentOrderId(restored.current_order_id || '');
              setCustomerName(restored.name || '');
              setPartySize(registeredPeople(restored.party_size));
              setStep('menu');
              sessionStorage.setItem(`sandexpress_user_${umbrellaId}`, JSON.stringify({
                customer_id: restoredCustomerId,
                name: restored.name || '',
                party_size: restored.party_size || 1,
              }));
              await loadCustomerOrders(restoredCustomerId, data.vendor?.id || routeVendorId);
              restoredFromServer = true;
            }
          }
        } catch {
          // Keep the saved browser session as a compatibility fallback when offline.
        }

        if (restoredFromServer) return;
        const saved = sessionStorage.getItem(`sandexpress_user_${umbrellaId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCustomerId(parsed.customer_id || ""); setPartySize(registeredPeople(parsed.party_size));
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
            if (saved) { const parsed = JSON.parse(saved); setCustomerId(parsed.customer_id || ""); setPartySize(registeredPeople(parsed.party_size)); setCustomerName(parsed.name || ""); setStep("menu"); }
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
      const response = await fetch(`/api/public/theme/${encodeURIComponent(vendorId)}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;
      const nextTheme = await response.json();
      if (!cancelled) setVendor(current => current?.id === vendorId ? { ...current, ...nextTheme } : current);
    };
    const timer = window.setInterval(() => void refreshTheme().catch(() => undefined), 15000);
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshTheme().catch(() => undefined); };
    document.addEventListener("visibilitychange", onVisibility);
    void refreshTheme().catch(() => undefined);
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

  function addToCart(product: Product, quantity = 1, note = "") {
    const choices = selectedOrderOptions(product, selectedOptions, product.id);
    const option = choices.length > 0 ? choices.map(choice => `${choice.name}: ${choice.value}`).join(' | ') : null;
    const cleanNote = note.trim();
    const sameLine = (item: CartItem) => item.product.id === product.id && (item.option || null) === option && (item.note || "") === cleanNote;
    setLastAddedProductId(product.id);
    setCart((prev) => {
      if (prev.some(sameLine)) {
        return prev.map((item) => sameLine(item) ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { product, quantity, option, note: cleanNote }];
    });
    window.setTimeout(() => setLastAddedProductId((current) => current === product.id ? "" : current), 1400);
  }

  function quickAdd(product: Product) {
    if (getOrderOptionGroups(product).length > 0) openItemDrawer(product);
    else addToCart(product);
  }

  function openItemDrawer(product: Product) {
    setItemDrawer({ product, quantity: 1, note: "" });
  }

  function confirmItemDrawer() {
    if (!itemDrawer) return;
    addToCart(itemDrawer.product, itemDrawer.quantity, itemDrawer.note);
    setItemDrawer(null);
  }

  function changeCartLine(index: number, delta: number) {
    setCart((prev) => prev
      .map((item, current) => current === index ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
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
      const itemNotes = cart
        .filter((item) => item.note)
        .map((item) => `${item.quantity}x ${item.product.name}: ${item.note}`)
        .join("; ");
      const preferences = Object.entries(accountPreferences).filter(([, value]) => value && value !== "Sem alteração").map(([name, value]) => `${name}: ${value}`).join("; ");
      const orderNotes = [notes.trim(), itemNotes ? `Obs. dos itens: ${itemNotes}` : "", preferences ? `Preferências da conta: ${preferences}` : "", optionNotes ? `Opções escolhidas: ${optionNotes}` : ""].filter(Boolean).join("\n");
      const idempotencyKey = crypto.randomUUID();
      const orderBody = {
        vendor_id: vendor.id,
        customer_id: customerId,
        umbrella_id: umbrellaId,
        items: Array.from(cart.reduce((totals, item) => totals.set(item.product.id, (totals.get(item.product.id) || 0) + item.quantity), new Map<string, number>()))
          .map(([product_id, quantity]) => ({ product_id, quantity })),
        notes: orderNotes,
        idempotency_key: idempotencyKey,
      };
      offlineCandidate = { id: idempotencyKey, body: orderBody, total: discountedCartTotal, created_at: new Date().toISOString() };
      const saveOffline = () => {
        const queued = offlineCandidate!;
        const queue = [...readCustomerQueue(vendor.id, umbrellaId), queued];
        writeCustomerQueue(vendor.id, umbrellaId, queue); setOfflineOrders(queue); setPendingSync(queue.length); setOnline(false);
        setOrders(prev => [{ id: idempotencyKey, total: discountedCartTotal, status: 'offline_pending', created_at: queued.created_at }, ...prev]);
        setPromotionPreview(null); setCart([]); setNotes(''); setWelcomeMessage('Agradecemos seu pedido! Logo ele será entregue. Ele será enviado automaticamente quando a internet voltar.'); setStep('orders');
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
      setWelcomeMessage("Agradecemos seu pedido! Logo ele será entregue. Acompanhe o status na sua conta.");
      setStep("orders");
      await loadCustomerOrders(customerId, vendor.id);
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
          payment_amount: separatePayment ? accountShare(billTotal, billTotal, partySize) : billTotal,
          service_fee_amount: serviceFeeAmount,
          service_fee_enabled: serviceFeeEnabled,
          split_people: registeredPeople(partySize),
          split_mode: separatePayment ? "split" : "full",
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


  const kioskAvatar = (size: string) => (
    <div className={`${size} shrink-0 overflow-hidden rounded-full border border-borda bg-areia-50 flex items-center justify-center shadow-sm`}>
      {kioskLogo ? <img src={kioskLogo} alt={`Logo ${vendor?.name || "do quiosque"}`} className="h-full w-full object-contain" /> : <UtensilsCrossed className="h-1/2 w-1/2 text-bordo" />}
    </div>
  );

  const toast = (tone: "info" | "error", text: ReactNode) => (
    <p role="status" className={`rounded-2xl border px-4 py-3 text-sm font-bold ${tone === "error" ? "border-bordo/30 bg-bordo/10 text-bordo" : "border-emerald-700/20 bg-emerald-50 text-emerald-900"}`}>{text}</p>
  );

  if (step === "welcome" || step === "login") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-10 pt-10">
        <div className="flex flex-col items-center text-center">
          {kioskAvatar("h-24 w-24")}
          <h1 className="mt-4 text-[26px] font-extrabold leading-tight text-bordo">{vendor?.name || "Carregando quiosque..."}</h1>
          <p className="mt-1 text-sm font-semibold text-tinta-suave">Atendimento na areia, direto no seu guarda-sol</p>
          {umbrella?.number != null && (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-tropical px-4 py-2 text-sm font-extrabold text-white shadow-[0_3px_10px_rgba(255,103,0,0.32)]">
              <span aria-hidden="true">🏖️</span> {umbrellaLabel}
            </span>
          )}
        </div>

        {step === "welcome" ? (
          <section className="mt-10 space-y-3">
            {error && toast("error", error)}
            <button onClick={() => setStep("login")} disabled={!vendor} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tropical text-base font-extrabold text-white shadow-[0_6px_20px_rgba(255,103,0,0.4)] transition-transform active:scale-[0.98] disabled:opacity-50">
              Ver cardápio e pedir <ArrowRight className="h-5 w-5" />
            </button>
            <InstallShortcutButton context="customer" className="w-full" />
            <QrScannerButton />
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-borda bg-areia-50 p-5 shadow-[0_4px_16px_rgba(42,26,18,0.06)]">
            <h2 className="text-lg font-extrabold text-bordo">Abrir comanda</h2>
            <p className="mt-1 text-xs font-semibold text-tinta-suave">Seus pedidos ficam na conta do guarda-sol. O pagamento é feito com o atendente.</p>
            {welcomeMessage && <div className="mt-3">{toast("info", welcomeMessage)}</div>}
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-bordo">Seu nome</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" autoComplete="name" className="h-12 w-full rounded-xl border border-borda bg-areia-100 px-3.5 text-[15px] font-medium text-tinta placeholder:text-tinta-suave/70 focus:border-bordo focus:outline-none focus:ring-1 focus:ring-bordo" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-bordo">Celular com DDD</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+()\-\s]/g, "").slice(0, 20))} placeholder="Ex: 11 96041-9570" inputMode="tel" autoComplete="tel" className="h-12 w-full rounded-xl border border-borda bg-areia-100 px-3.5 text-[15px] font-medium text-tinta placeholder:text-tinta-suave/70 focus:border-bordo focus:outline-none focus:ring-1 focus:ring-bordo" />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-borda bg-areia-200/60 p-3">
                <span className="text-sm font-bold text-tinta">Pessoas no guarda-sol</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setPartySize((value) => Math.max(1, value - 1))} disabled={partySize <= 1} aria-label="Diminuir quantidade de pessoas" className="flex h-9 w-9 items-center justify-center rounded-full border border-borda bg-areia-50 text-tinta active:scale-90 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-[20px] text-center text-base font-extrabold text-bordo">{partySize}</span>
                  <button type="button" onClick={() => setPartySize((value) => Math.min(50, value + 1))} disabled={partySize >= 50} aria-label="Aumentar quantidade de pessoas" className="flex h-9 w-9 items-center justify-center rounded-full bg-tropical text-white shadow-sm active:scale-90 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              {error && toast("error", error)}
              <button disabled={loading} onClick={startTab} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tropical text-base font-extrabold text-white shadow-[0_6px_20px_rgba(255,103,0,0.4)] transition-transform active:scale-[0.98] disabled:opacity-60">
                {loading ? "Abrindo..." : "Abrir comanda e ver cardápio"}
              </button>
            </div>
          </section>
        )}
      </main>
    );
  }

  const renderProductCard = (product: Product) => {
    const optionGroups = getOrderOptionGroups(product);
    const quantity = getCartQuantity(product.id);
    const badge = productBadge(product);
    return (
      <article key={product.id} onClick={() => openItemDrawer(product)} className={`relative flex cursor-pointer gap-3 rounded-2xl border bg-areia-50 p-3 shadow-[0_2px_10px_rgba(42,26,18,0.04)] transition-all active:scale-[0.99] ${lastAddedProductId === product.id ? "border-tropical ring-2 ring-tropical/30" : "border-borda"}`}>
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-areia-200">
          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl" aria-hidden="true">{categoryEmoji(product.category)}</div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col pr-12">
          {(badge || product.subcategory || optionGroups.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {badge && <span className="rounded-md bg-tropical/15 px-2 py-0.5 text-[10px] font-extrabold text-tropical-dark">{badge}</span>}
              {product.subcategory && <span className="rounded-md bg-areia-200 px-1.5 py-0.5 text-[10px] font-bold text-tinta">{product.subcategory}</span>}
              {optionGroups.length > 0 && <span className="rounded-md bg-areia-200 px-1.5 py-0.5 text-[10px] font-bold text-tinta">Com opções</span>}
            </div>
          )}
          <h3 className="mt-1 text-base font-extrabold leading-snug text-bordo">{product.name}</h3>
          {product.description && <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">{product.description}</p>}
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[17px] font-extrabold text-bordo">{formatCurrency(productEffectivePrice(product))}</span>
            {productHasDiscount(product) && <span className="text-xs font-bold text-tinta-suave line-through">{formatCurrency(Number(product.price))}</span>}
          </div>
        </div>
        <div className="absolute bottom-3 right-3" onClick={(event) => event.stopPropagation()}>
          <button onClick={() => quickAdd(product)} aria-label={`Adicionar ${product.name}`} className="relative flex h-12 w-12 items-center justify-center rounded-full bg-tropical text-white shadow-[0_4px_14px_rgba(255,103,0,0.35)] transition-transform active:scale-90">
            <Plus className="h-6 w-6" />
            {quantity > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bordo px-1 text-[11px] font-extrabold text-white">{quantity}</span>}
          </button>
        </div>
      </article>
    );
  };

  const drawerGroups = itemDrawer ? getOrderOptionGroups(itemDrawer.product) : [];
  const emptyState = (text: string) => <p className="rounded-2xl border border-dashed border-borda p-6 text-center text-sm font-semibold text-tinta-suave">{text}</p>;

  return (
    <main className="min-h-dvh pb-32">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-borda bg-areia/95 shadow-[0_2px_12px_rgba(42,26,18,0.04)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {kioskAvatar("h-10 w-10")}
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[17px] font-extrabold leading-tight text-bordo">{vendor?.name || "Quiosque"}</h1>
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${online ? "animate-pulse bg-emerald-600" : "bg-amber-500"}`} title={online ? "Online" : "Sem internet"} />
              </div>
              <span className="truncate text-[11px] font-semibold text-tinta-suave">{customerName ? `Olá, ${customerName.split(" ")[0]}` : "Atendimento beira-mar"}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-tropical px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_3px_10px_rgba(255,103,0,0.32)]">
              <span className="text-[14px] leading-none" aria-hidden="true">🏖️</span>
              <span className="hidden min-[420px]:inline">{umbrellaLabel}</span>
              <span className="min-[420px]:hidden" aria-label={umbrellaLabel}>Nº {umbrella?.number ?? ""}</span>
            </span>
            <button onClick={() => setStep("cart")} aria-label="Abrir pedido" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-borda bg-areia-200 text-bordo transition-transform active:scale-90">
              <ShoppingBag className="h-5 w-5" />
              {cartItemsCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tropical px-0.5 text-[10px] font-extrabold text-white shadow-sm">{cartItemsCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg pt-[72px]">
        <div className="space-y-2 px-4 empty:hidden">
          {waiterCalled && toast("info", "Atendente chamado! Ele já está a caminho do seu guarda-sol.")}
          {welcomeMessage && toast("info", welcomeMessage)}
          {error && step !== "cart" && toast("error", error)}
          {(!online || pendingSync > 0 || syncing) && (
            <div role="status" aria-live="polite" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
              <p className="flex items-center gap-1.5 font-extrabold"><WifiOff className="h-4 w-4" />{syncing ? "Sincronizando pedidos..." : online ? "Pedidos aguardando sincronização" : "Modo offline ativo"}</p>
              <p className="mt-1">{pendingSync > 0 ? `${pendingSync} pedido(s) protegido(s) neste aparelho.` : "O cardápio salvo continua disponível. Pedidos serão enviados quando o sinal voltar."}</p>
              {offlineOrders.map((order, index) => (
                <div key={order.id} className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-white/70 px-3 py-2">
                  <span className="text-xs font-extrabold">Pedido offline {index + 1} · {order.body.items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</span>
                  <strong className="whitespace-nowrap">{formatCurrency(order.total)}</strong>
                </div>
              ))}
              {pendingSync > 0 && !syncing && <button type="button" onClick={() => { if (!vendor || !confirm("Descartar os pedidos que ainda não foram enviados?")) return; writeCustomerQueue(vendor.id, umbrellaId, []); setOfflineOrders([]); setPendingSync(0); setOrders(current => current.filter(order => order.status !== "offline_pending")); setWelcomeMessage("Pedidos offline descartados."); }} className="mt-3 rounded-lg border border-amber-700 px-3 py-2 text-xs font-extrabold">Descartar pendentes</button>}
            </div>
          )}
        </div>

        {step === "orders" ? (
          <section className="space-y-4 px-4 pt-3">
            <button onClick={() => setStep("menu")} className="flex items-center gap-1 text-sm font-extrabold text-bordo"><ChevronLeft className="h-5 w-5" /> Voltar ao cardápio</button>

            {satisfactionOrderId && (
              <div className="rounded-2xl border border-borda bg-areia-50 p-4 text-center shadow-sm">
                {satisfactionSent ? (
                  <>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-tropical-dark">Avaliação enviada</p>
                    <h2 className="mt-1 text-lg font-extrabold text-bordo">Obrigado pelo retorno!</h2>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-tropical-dark">Conta solicitada</p>
                    <h2 className="mt-1 text-lg font-extrabold text-bordo">Como foi sua experiência?</h2>
                    <div className="mt-3 flex justify-center gap-2" aria-label="Avaliar experiência de 1 a 5 estrelas">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button key={rating} type="button" onClick={() => submitSatisfaction(rating)} disabled={satisfactionLoading} aria-label={`Avaliar com ${rating} estrela${rating > 1 ? "s" : ""}`} className={`transition-transform active:scale-90 ${satisfactionRating >= rating ? "text-tropical" : "text-areia-300"}`}>
                          <Star className="h-9 w-9" fill="currentColor" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-borda bg-areia-50 shadow-[0_4px_16px_rgba(42,26,18,0.06)]">
              <div className="bg-bordo px-5 py-4 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-areia-300">Minha conta · {umbrellaLabel}</p>
                <p className="mt-1 text-3xl font-extrabold">{formatCurrency(openTotal)}</p>
                {pendingOrdersTotal > 0 && <p className="mt-0.5 text-xs font-semibold text-areia-300">{formatCurrency(pendingOrdersTotal)} ainda em preparo ou entrega</p>}
              </div>
              <div className="space-y-3 p-4 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-tinta"><input type="checkbox" checked={serviceFeeEnabled} onChange={(event) => setServiceFeeEnabled(event.target.checked)} className="h-4 w-4 accent-tropical" />Taxa de serviço (10%)</span>
                  <strong className="text-tinta">{formatCurrency(serviceFeeAmount)}</strong>
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-semibold text-tinta"><input type="checkbox" checked={separatePayment} onChange={(event) => setSeparatePayment(event.target.checked)} className="h-4 w-4 accent-tropical" />Dividir entre {registeredPeople(partySize)} pessoa(s)</span>
                  {separatePayment && <strong className="text-tinta">{formatCurrency(accountShare(billTotal, billTotal, partySize))} cada</strong>}
                </label>
                <div className="flex items-center justify-between border-t border-borda pt-3">
                  <span className="font-extrabold text-bordo">Total a pagar</span>
                  <span className="text-xl font-extrabold text-tropical-dark">{formatCurrency(billTotal)}</span>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-areia-200/70 p-3 text-xs font-semibold text-tinta">
                  <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-bordo" />
                  <span>Não há pagamento pelo app. Ao pedir a conta, o atendente vai até o seu guarda-sol para cobrar (Pix, cartão ou dinheiro).</span>
                </div>
                <button onClick={requestCloseAccount} disabled={loading || !online || openTotal <= 0} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tropical text-base font-extrabold text-white shadow-[0_6px_20px_rgba(255,103,0,0.4)] transition-transform active:scale-[0.98] disabled:opacity-50">
                  <ReceiptText className="h-5 w-5" />{loading ? "Enviando..." : "Pedir a conta ao atendente"}
                </button>
                {featureEnabled("waiter_call") && (
                  <button onClick={callWaiter} disabled={!online || waiterCalled || loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-bordo text-sm font-extrabold text-bordo transition-transform active:scale-[0.98] disabled:opacity-50">
                    <Bell className="h-4 w-4" />{waiterCalled ? "Atendente a caminho" : "Chamar atendente"}
                  </button>
                )}
                <button type="button" onClick={() => setAccountSummaryOpen(true)} disabled={accountItems.length === 0} className="flex w-full items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-bordo disabled:opacity-40">
                  <ListOrdered className="h-4 w-4" /> Ver todos os itens da conta
                </button>
              </div>
            </div>

            <details className="rounded-2xl border border-borda bg-areia-50 p-4">
              <summary className="cursor-pointer text-sm font-extrabold text-bordo">Preferências para os próximos pedidos</summary>
              <div className="mt-3 space-y-2">
                {[
                  { name: "Gelo", values: ["Sem alteração", "Com gelo", "Sem gelo"] },
                  { name: "Limão", values: ["Sem alteração", "Com limão", "Sem limão"] },
                  { name: "Açúcar", values: ["Sem alteração", "Com açúcar", "Sem açúcar"] },
                ].map(({ name: preference, values }) => (
                  <label key={preference} className="flex items-center justify-between gap-3 text-sm font-semibold text-tinta">
                    <span>{preference}</span>
                    <select aria-label={preference} value={accountPreferences[preference] || "Sem alteração"} onChange={event => changeAccountPreference(preference, event.target.value)} className="rounded-lg border border-borda bg-areia-100 p-2 text-sm">
                      {values.map(value => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </details>

            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-bordo">Seus pedidos</h2>
              {orders.length === 0 ? emptyState("Nenhum pedido ainda.") : orders.map((order) => {
                const expanded = expandedOrderIds.has(order.id);
                return (
                  <article key={order.id} className="rounded-2xl border border-borda bg-areia-50 p-4 shadow-[0_2px_10px_rgba(42,26,18,0.04)]">
                    <button type="button" aria-expanded={expanded} onClick={() => setExpandedOrderIds(current => { const next = new Set(current); if (next.has(order.id)) next.delete(order.id); else next.add(order.id); return next; })} className="flex w-full items-center justify-between gap-3 text-left">
                      <span>
                        <strong className="block text-base font-extrabold text-bordo">{order.sequence ? `Pedido ${order.sequence}` : `Pedido #${order.id.slice(0, 8)}`}</strong>
                        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${order.status === "completed" ? "bg-emerald-100 text-emerald-900" : order.status === "cancelled" ? "bg-bordo/10 text-bordo" : "bg-tropical/15 text-tropical-dark"}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                      </span>
                      <span className="text-right">
                        <strong className="block text-base font-extrabold text-tinta">{formatCurrency(Number(order.total || 0))}</strong>
                        <small className="text-[11px] font-bold text-tinta-suave">{expanded ? "Ocultar itens" : "Ver itens"}</small>
                      </span>
                    </button>
                    {expanded && (
                      <ul className="mt-3 divide-y divide-borda border-t border-borda">
                        {(order.items || []).map(item => {
                          const delivered = !item.cancelled && item.delivered_quantity >= item.quantity;
                          return (
                            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                              <div>
                                <strong className="font-bold text-tinta">{item.quantity}× {item.name}</strong>
                                <p className="text-xs text-tinta-suave">{formatCurrency(item.unit_price)} cada · {formatCurrency(item.subtotal)}</p>
                              </div>
                              {item.cancelled ? (
                                <span className="flex items-center gap-1 text-xs font-extrabold text-bordo"><CircleX className="h-4 w-4" />Cancelado</span>
                              ) : delivered ? (
                                <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Entregue</span>
                              ) : (
                                <span className="text-xs font-extrabold text-tropical-dark">{item.delivered_quantity} de {item.quantity} entregue</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <section className="px-4 pb-2 pt-2.5">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-5 w-5 text-tinta-suave" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar porções, drinks, pastéis..." className="h-12 w-full rounded-2xl border border-borda bg-areia-50 pl-11 pr-10 text-[15px] font-medium text-tinta shadow-sm placeholder:text-tinta-suave/70 focus:border-bordo focus:outline-none focus:ring-1 focus:ring-bordo [&::-webkit-search-cancel-button]:hidden" />
                {search && <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 rounded-full p-1 text-tinta-suave"><X className="h-4 w-4" /></button>}
              </div>
              {!searchResults && (
                <nav aria-label="Categorias do cardápio" className="sx-no-scrollbar -mx-4 mt-1 flex items-center gap-2 overflow-x-auto px-4 py-3">
                  {menuCategories.map((category) => (
                    <button key={category} onClick={() => { setActiveCategory(category); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs transition-all active:scale-95 ${activeCategory === category ? "bg-bordo font-bold text-white shadow-sm" : "border border-borda bg-areia-50 font-semibold text-tinta"}`}>
                      <span aria-hidden="true">{categoryEmoji(category)}</span> {category}
                    </button>
                  ))}
                </nav>
              )}
            </section>

            {!searchResults && (
              <div className="grid grid-cols-2 gap-2.5 px-4 pb-2">
                {featureEnabled("waiter_call") ? (
                  <button onClick={callWaiter} disabled={!online || waiterCalled || loading} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-borda bg-areia-50 text-sm font-extrabold text-bordo shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60">
                    <Bell className="h-4 w-4 text-tropical" />{waiterCalled ? "A caminho!" : "Chamar atendente"}
                  </button>
                ) : <span />}
                <button onClick={() => setStep("orders")} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-borda bg-areia-50 text-sm font-extrabold text-bordo shadow-sm transition-transform active:scale-[0.98]">
                  <ReceiptText className="h-4 w-4 text-tropical" />Conta {openTotal > 0 ? formatCurrency(openTotal) : ""}
                </button>
              </div>
            )}

            {searchResults ? (
              <section className="space-y-3 px-4 pt-2">
                <p className="text-sm font-bold text-tinta-suave">{searchResults.length} resultado(s) para “{search.trim()}”</p>
                {searchResults.length === 0 ? emptyState("Nada encontrado. Tente outro nome.") : searchResults.map(renderProductCard)}
              </section>
            ) : (
              <>
                {activeCategory === "Todos" && (promoProducts.length > 0 || flexiblePromotions.length > 0) && (
                  <section className="mt-2">
                    <div className="mb-2.5 flex items-center justify-between px-4">
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-5 w-5 fill-tropical text-tropical" />
                        <h2 className="text-lg font-extrabold tracking-tight text-bordo">Promoções do dia</h2>
                      </div>
                      <span className="rounded-full bg-tropical/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-tropical-dark">Destaques</span>
                    </div>
                    <div className="sx-no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-3">
                      {flexiblePromotions.map(promotion => {
                        const freeProduct = promotion.descricao?.startsWith("[PRODUTO_GRATIS]");
                        const description = String(promotion.descricao || "").replace(/^\[(PRODUTO_GRATIS|COMBO)\]\s*/, "");
                        const benefit = freeProduct ? "Produto grátis" : promotion.desconto_tipo === "percentual" ? `${promotion.desconto_valor}% OFF` : promotion.desconto_tipo === "preco_fechado" ? `Combo ${formatCurrency(Number(promotion.desconto_valor))}` : `Economize ${formatCurrency(Number(promotion.desconto_valor))}`;
                        return (
                          <article key={promotion.id} className="flex w-[78vw] min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-borda bg-bordo p-4 text-white shadow-[0_4px_16px_rgba(42,26,18,0.12)]">
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-tropical px-2.5 py-1 text-[11px] font-extrabold"><Zap className="h-3 w-3 fill-white" />{benefit}</span>
                              <h3 className="mt-2 text-base font-extrabold leading-tight">{promotion.titulo}</h3>
                              {description && <p className="mt-1 line-clamp-2 text-xs text-areia-300">{description}</p>}
                              <p className="mt-1 text-[11px] font-semibold text-areia-300">{promotion.promocao_itens?.map(item => `${item.quantidade || 1}x ${item.products?.name || "item"}`).join(" + ")}</p>
                            </div>
                            <button type="button" onClick={() => addPromotionToCart(promotion)} className="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-tropical text-sm font-extrabold text-white active:scale-95"><Plus className="h-4 w-4" />Adicionar oferta</button>
                          </article>
                        );
                      })}
                      {promoProducts.map(product => (
                        <article key={product.id} onClick={() => openItemDrawer(product)} className="flex w-[78vw] min-w-[260px] max-w-[320px] shrink-0 cursor-pointer snap-start flex-col justify-between overflow-hidden rounded-2xl border border-borda bg-areia-50 shadow-[0_4px_16px_rgba(42,26,18,0.06)]">
                          <div className="relative h-36 w-full overflow-hidden bg-areia-200">
                            {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-5xl" aria-hidden="true">{categoryEmoji(product.category)}</div>}
                            <span className="absolute left-2.5 top-2.5 flex items-center gap-0.5 rounded-full bg-tropical px-2.5 py-1 text-[11px] font-extrabold text-white shadow"><Zap className="h-3 w-3 fill-white" />{productBadge(product) || "Destaque"}</span>
                            <span className="absolute bottom-2 right-2 rounded bg-bordo px-2 py-0.5 text-[10px] font-bold text-white shadow">{product.category}</span>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-3.5">
                            <div>
                              <h3 className="text-base font-extrabold leading-tight text-bordo">{product.name}</h3>
                              {product.description && <p className="mt-1 line-clamp-2 text-xs text-tinta-suave">{product.description}</p>}
                            </div>
                            <div className="mt-1 flex items-center justify-between border-t border-borda/60 pt-3">
                              <div className="flex flex-col">
                                {productHasDiscount(product) && <span className="text-[11px] font-bold text-tinta-suave line-through">{formatCurrency(Number(product.price))}</span>}
                                <span className="text-xl font-extrabold leading-none text-tropical-dark">{formatCurrency(productEffectivePrice(product))}</span>
                              </div>
                              <button onClick={(event) => { event.stopPropagation(); quickAdd(product); }} aria-label={`Adicionar ${product.name}`} className="flex h-12 w-12 items-center justify-center rounded-full bg-tropical text-white shadow-[0_4px_12px_rgba(255,103,0,0.35)] transition-transform active:scale-90"><Plus className="h-6 w-6" /></button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-4 space-y-6 px-4">
                  {categorySections.map(({ category, products: sectionProducts }) => (
                    <section key={category} ref={node => { categoryRefs.current[category] = node; }} aria-labelledby={`category-${category}`}>
                      <div className="mb-2.5 flex items-baseline justify-between border-b border-borda pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" aria-hidden="true">{categoryEmoji(category)}</span>
                          <h2 id={`category-${category}`} className="text-lg font-extrabold text-bordo">{category}</h2>
                        </div>
                        <span className="text-xs font-semibold text-tinta-suave">{sectionProducts.length} {sectionProducts.length === 1 ? "item" : "itens"}</span>
                      </div>
                      <div className="space-y-3">{sectionProducts.map(renderProductCard)}</div>
                    </section>
                  ))}
                  {categorySections.length === 0 && emptyState("Nenhum produto disponível agora.")}
                </div>
              </>
            )}

            <footer className="mt-12 flex flex-col items-center border-t border-borda px-4 pb-8 pt-6 text-center">
              <img src="/sandexpress-logo.svg" alt="SandExpress" className="h-9 w-auto" />
              <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-tropical-dark">Entrega na areia · {vendor?.name}</p>
              <p className="mt-2 max-w-[280px] text-[11px] text-tinta-suave">Pagamento direto com o atendente no seu guarda-sol: Pix, cartão ou dinheiro.</p>
            </footer>
          </>
        )}
      </div>

      {(cartItemsCount > 0 || (step !== "orders" && openTotal > 0)) && step !== "cart" && (
        <aside aria-label="Resumo do pedido" className="fixed inset-x-3 bottom-2.5 z-40 mx-auto max-w-md">
          <button onClick={() => setStep(cartItemsCount > 0 ? "cart" : "orders")} className="flex w-full items-center justify-between gap-3 rounded-full border border-bordo-light bg-bordo px-4 py-3 text-white shadow-[0_10px_28px_rgba(88,4,18,0.45)] transition-transform active:scale-[0.98]">
            <span className="flex items-center gap-3">
              <span className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tropical text-white shadow-md">{cartItemsCount > 0 ? <ShoppingBag className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}</span>
                {cartItemsCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-extrabold text-bordo shadow">{cartItemsCount}</span>}
              </span>
              <span className="flex min-w-0 flex-col whitespace-nowrap text-left">
                <span className="text-[15px] font-extrabold leading-tight">{cartItemsCount > 0 ? "Ver pedido" : "Minha conta"}</span>
                <span className="truncate text-[11px] font-medium leading-tight text-areia-300">{cartItemsCount > 0 ? <>{cartItemsCount} {cartItemsCount === 1 ? "item" : "itens"} · <b className="text-white">{umbrellaLabel}</b></> : "Pedir a conta ou atendente"}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap text-lg font-extrabold text-tropical-light">{formatCurrency(cartItemsCount > 0 ? discountedCartTotal : openTotal)}</span>
              <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 min-[400px]:flex"><ArrowRight className="h-4 w-4" /></span>
            </span>
          </button>
        </aside>
      )}

      {step === "cart" && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Seu pedido">
          <div className="sx-backdrop absolute inset-0 bg-tinta/65 backdrop-blur-sm" onClick={() => setStep("menu")} />
          <div className="sx-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] max-w-lg flex-col rounded-t-3xl border-t border-borda bg-areia-50 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-borda p-4">
              <div className="flex items-center gap-2">
                {kioskAvatar("h-10 w-10")}
                <div>
                  <h2 className="text-[17px] font-extrabold leading-tight text-bordo">Seu pedido na areia</h2>
                  <p className="text-[11px] text-tinta-suave">Entrega direto no seu guarda-sol</p>
                </div>
              </div>
              <button onClick={() => setStep("menu")} aria-label="Fechar pedido" className="flex h-8 w-8 items-center justify-center rounded-full bg-areia-200 text-tinta"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-1.5 border-b border-borda bg-areia-200/70 px-4 py-2.5 text-xs font-bold text-tinta">
              <span aria-hidden="true">🏖️</span> Ponto de entrega: <span className="font-extrabold text-tropical-dark underline">{umbrellaLabel}</span>
            </div>
            <div className="flex-1 divide-y divide-borda/60 overflow-y-auto px-4 py-2">
              {cart.length === 0 ? (
                <div className="py-10 text-center">
                  <ShoppingBag className="mx-auto h-10 w-10 text-areia-300" />
                  <p className="mt-2 text-sm font-bold text-tinta-suave">Seu pedido está vazio.</p>
                  <button onClick={() => setStep("menu")} className="mt-3 text-sm font-extrabold text-bordo underline">Ver cardápio</button>
                </div>
              ) : cart.map((item, index) => (
                <div key={`${item.product.id}-${item.option || ""}-${item.note || ""}`} className="flex items-start justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold leading-tight text-bordo">{item.product.name}</h4>
                    {item.option && <p className="mt-0.5 text-[11px] font-semibold text-tinta-suave">{item.option}</p>}
                    {item.note && <p className="mt-0.5 text-[11px] font-medium text-tropical-dark">Obs: {item.note}</p>}
                    <div className="mt-1 text-sm font-extrabold text-tinta">{formatCurrency(productEffectivePrice(item.product) * item.quantity)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => changeCartLine(index, -1)} aria-label={`Remover ${item.product.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-areia-200 text-tinta active:scale-90"><Minus className="h-4 w-4" /></button>
                    <span className="min-w-[16px] text-center text-sm font-extrabold text-bordo">{item.quantity}</span>
                    <button onClick={() => changeCartLine(index, 1)} aria-label={`Adicionar ${item.product.name}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-tropical text-white active:scale-90"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {upsellSuggestions && upsellSuggestions.products.length > 0 && (
                <div className="py-3">
                  <p className="text-xs font-extrabold text-bordo">{upsellSuggestions.message}</p>
                  <div className="sx-no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                    {upsellSuggestions.products.map(product => (
                      <button key={product.id} type="button" onClick={() => addToCart(product)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-borda bg-areia-100 px-3 py-2 text-xs font-bold text-tinta active:scale-95">
                        <Plus className="h-3.5 w-3.5 text-tropical" />{product.name} · {formatCurrency(productEffectivePrice(product))}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {cart.length > 0 && (
                <div className="py-3">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação geral do pedido (opcional)" aria-label="Observação geral do pedido" rows={2} className="w-full rounded-xl border border-borda bg-areia-100 p-3 text-sm text-tinta placeholder:text-tinta-suave/70 focus:border-bordo focus:outline-none focus:ring-1 focus:ring-bordo" />
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="shrink-0 space-y-3 border-t border-borda bg-areia-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="space-y-1.5 text-xs text-tinta-suave">
                  <div className="flex justify-between"><span>Subtotal dos itens</span><span className="font-bold text-tinta">{formatCurrency(cartTotal)}</span></div>
                  {promotionLoading && <p>Verificando promoções...</p>}
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between text-emerald-800"><span>{appliedPromotions.map(promotion => promotion.titulo).filter(Boolean).join(", ") || "Desconto promocional"}</span><span className="font-bold">-{formatCurrency(promotionDiscount)}</span></div>
                  )}
                  <div className="flex justify-between border-t border-borda pt-1.5 text-sm font-extrabold text-bordo"><span>Total do pedido</span><span className="text-lg text-tropical-dark">{formatCurrency(discountedCartTotal)}</span></div>
                </div>
                {error && toast("error", error)}
                <button onClick={createOrder} disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tropical text-base font-extrabold tracking-wide text-white shadow-[0_6px_20px_rgba(255,103,0,0.4)] transition-transform hover:bg-tropical-dark active:scale-[0.98] disabled:opacity-60">
                  <ChefHat className="h-5 w-5" />{loading ? "Enviando..." : "Enviar pedido para a cozinha"}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-tinta-suave"><HandCoins className="h-3.5 w-3.5 text-bordo" />O pedido vai para a sua conta. Você paga ao atendente no guarda-sol.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {itemDrawer && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={itemDrawer.product.name}>
          <div className="sx-backdrop absolute inset-0 bg-tinta/60 backdrop-blur-sm" onClick={() => setItemDrawer(null)} />
          <div className="sx-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-lg flex-col overflow-y-auto rounded-t-3xl border-t border-borda bg-areia-50 p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-areia-300" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <span className="rounded-md bg-tropical/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-tropical-dark">{productBadge(itemDrawer.product) || itemDrawer.product.category}</span>
                <h3 className="mt-1 text-xl font-extrabold leading-tight text-bordo">{itemDrawer.product.name}</h3>
                {itemDrawer.product.description && <p className="mt-1 text-xs leading-relaxed text-tinta-suave">{itemDrawer.product.description}</p>}
              </div>
              <button onClick={() => setItemDrawer(null)} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-areia-200 text-tinta"><X className="h-5 w-5" /></button>
            </div>
            {itemDrawer.product.image_url && (
              <div className="my-4 h-44 w-full shrink-0 overflow-hidden rounded-xl bg-areia-200">
                <img src={itemDrawer.product.image_url} alt={itemDrawer.product.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="mt-2 space-y-4">
              {drawerGroups.map(group => (
                <div key={group.name}>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-bordo">{group.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map(option => {
                      const selected = (selectedOptions[`${itemDrawer.product.id}:${group.name}`] || group.options[0]) === option;
                      return <button key={option} type="button" onClick={() => setSelectedOptions(current => ({ ...current, [`${itemDrawer.product.id}:${group.name}`]: option }))} className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${selected ? "bg-bordo text-white" : "border border-borda bg-areia-100 text-tinta"}`}>{option}</button>;
                    })}
                  </div>
                </div>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-bordo">Instruções para a cozinha / bar</span>
                <input type="text" value={itemDrawer.note} onChange={(event) => setItemDrawer(current => current ? { ...current, note: event.target.value.slice(0, 140) } : current)} placeholder="Ex: sem cebola, limão à parte, gelo extra..." className="h-11 w-full rounded-xl border border-borda bg-areia-100 px-3.5 text-sm text-tinta placeholder:text-tinta-suave/70 focus:border-bordo focus:outline-none focus:ring-1 focus:ring-bordo" />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-borda bg-areia-200/60 p-3">
                <span className="text-sm font-bold text-tinta">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setItemDrawer(current => current ? { ...current, quantity: Math.max(1, current.quantity - 1) } : current)} aria-label="Diminuir quantidade" className="flex h-9 w-9 items-center justify-center rounded-full border border-borda bg-areia-50 text-tinta active:scale-90"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-[20px] text-center text-base font-extrabold text-bordo">{itemDrawer.quantity}</span>
                  <button onClick={() => setItemDrawer(current => current ? { ...current, quantity: Math.min(50, current.quantity + 1) } : current)} aria-label="Aumentar quantidade" className="flex h-9 w-9 items-center justify-center rounded-full bg-tropical text-white shadow-sm active:scale-90"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-borda pt-3">
              <button onClick={confirmItemDrawer} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tropical text-[15px] font-extrabold text-white shadow-[0_4px_16px_rgba(255,103,0,0.38)] transition-all active:scale-95">
                Adicionar ao pedido · {formatCurrency(productEffectivePrice(itemDrawer.product) * itemDrawer.quantity)}
              </button>
            </div>
          </div>
        </div>
      )}

      {accountSummaryOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Resumo da conta">
          <div className="sx-backdrop absolute inset-0 bg-tinta/60 backdrop-blur-sm" onClick={() => setAccountSummaryOpen(false)} />
          <section className="sx-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-3xl border-t border-borda bg-areia-50 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-tropical-dark">Conferência da conta</p>
                <h2 className="text-lg font-extrabold text-bordo">Todos os itens pedidos</h2>
              </div>
              <button onClick={() => setAccountSummaryOpen(false)} aria-label="Fechar resumo" className="flex h-9 w-9 items-center justify-center rounded-full bg-areia-200 text-tinta"><X className="h-5 w-5" /></button>
            </div>
            <ul className="mt-3 flex-1 divide-y divide-borda overflow-y-auto">
              {accountItems.map(item => (
                <li key={`${item.orderId}-${item.id}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <strong className="font-bold text-tinta">{item.quantity}× {item.name}</strong>
                    <p className="text-xs text-tinta-suave">{item.sequence ? `Pedido ${item.sequence} · ` : ""}{formatCurrency(item.unit_price)} cada</p>
                  </div>
                  <strong className={item.cancelled ? "text-bordo" : "text-tinta"}>{item.cancelled ? "Cancelado" : formatCurrency(item.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-borda pt-3">
              <span className="font-extrabold text-bordo">Total da conta</span>
              <span className="text-xl font-extrabold text-tropical-dark">{formatCurrency(openTotal)}</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
