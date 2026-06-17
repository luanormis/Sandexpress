"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";
import { Bell, Home, ListOrdered, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { InstallShortcutButton } from "@/components/pwa/InstallShortcutButton";
import { formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  image_url?: string | null;
  price: number;
  promotional_price: number | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type CustomerVendor = {
  id: string;
  name: string;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
};

type FeatureFlags = Record<string, boolean>;

const ORDER_STATUS_LABELS: Record<string, string> = {
  received: "Pedido recebido",
  preparing: "Em preparo",
  delivering: "Saiu para entrega",
  completed: "Entregue",
  closing_requested: "Conta solicitada",
  cancelled: "Cancelado",
};

const BILLABLE_STATUSES = new Set(["completed", "closing_requested"]);

export default function CustomerApp() {
  const params = useParams();
  const umbrellaId = String(params.umbrella_id || params.vendor_id || "");
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
  const [partySize, setPartySize] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState("");
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true);
  const [splitMode, setSplitMode] = useState<"full" | "partial" | "split">("full");
  const [splitPeople, setSplitPeople] = useState(2);
  const [partialAmount, setPartialAmount] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [features, setFeatures] = useState<FeatureFlags>({});

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.promotional_price ?? item.product.price) * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const ordersTotal = orders
    .filter((order) => BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrdersTotal = orders
    .filter((order) => !BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const openTotal = ordersTotal + pendingOrdersTotal + cartTotal;
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
    primary: "#ff6b00",
    secondary: "#82533f",
    logo: vendor?.logo_url || "/sandexpress-logo.svg",
  };
  const customerThemeVars = {
    "--customer-primary": theme.primary,
    "--customer-secondary": theme.secondary,
  } as CSSProperties;
  const sandExpressMark = (
    <div className="customer-brand-watermark">
      <span>SandExpress</span>
    </div>
  );
  const featureEnabled = (key: string) => features[key] !== false;

  function resetExpiredCustomerSession(message = "Sua sessao expirou. Abra a comanda novamente para enviar pedidos.") {
    sessionStorage.removeItem(`sandexpress_user_${umbrellaId}`);
    setCustomerId("");
    setCurrentOrderId("");
    setCustomerName("");
    setOrders([]);
    setCart([]);
    setError(message);
    setStep("login");
  }

  async function loadCustomerOrders(nextCustomerId: string, nextVendorId: string) {
    if (!nextCustomerId || !nextVendorId) return;
    const res = await fetch(`/api/customers/${encodeURIComponent(nextCustomerId)}/orders?vendor_id=${encodeURIComponent(nextVendorId)}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => []);
    if (res.status === 401 || res.status === 403) {
      resetExpiredCustomerSession();
      return;
    }
    if (!res.ok) return;
    const mapped = (Array.isArray(data) ? data : []).map((order) => ({
      id: order.id,
      total: Number(order.total || 0),
      status: order.status || "received",
      created_at: order.created_at || new Date().toISOString(),
    }));
    setOrders(mapped);
    if (mapped[0]?.id) setCurrentOrderId(mapped[0].id);
  }

  useEffect(() => {
    async function loadQrData() {
      try {
        if (!routeVendorId) {
          setError("QR antigo invalido. Gere um novo QR Code no painel do quiosque.");
          return;
        }
        const vendorQuery = routeVendorId ? `?vendor_id=${encodeURIComponent(routeVendorId)}` : "";
        const res = await fetch(`/api/public/umbrella/${umbrellaId}${vendorQuery}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erro ao carregar cardapio.");
          return;
        }
        setUmbrella(data.umbrella);
        setVendor(data.vendor);
        setProducts(data.products || []);
        setFeatures(data.features || {});

        const saved = sessionStorage.getItem(`sandexpress_user_${umbrellaId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCustomerId(parsed.customer_id || "");
          setCustomerName(parsed.name || "");
          setStep("menu");
          loadCustomerOrders(parsed.customer_id || "", data.vendor?.id || routeVendorId);
        }
      } catch {
        setError("Erro de rede ao carregar o cardapio.");
      }
    }

    if (umbrellaId) loadQrData();
  }, [umbrellaId, routeVendorId]);

  useEffect(() => {
    if (!customerId || !vendor?.id) return;
    const timer = window.setInterval(() => {
      loadCustomerOrders(customerId, vendor.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [customerId, vendor?.id]);

  async function startTab() {
    if (!vendor) return;
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 10) {
      setError("Informe nome e celular validos.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customers/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone.replace(/\D/g, ""),
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
      sessionStorage.setItem(`sandexpress_user_${umbrellaId}`, JSON.stringify({
        customer_id: data.id || data.customer_id,
        name: data.name || name,
        phone: data.phone || phone,
        party_size: data.party_size || partySize,
      }));
      await loadCustomerOrders(data.id || data.customer_id, vendor.id);
      setStep("menu");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => prev
      .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  async function createOrder() {
    if (!vendor || !customerId || cart.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendor.id,
          customer_id: customerId,
          umbrella_id: umbrellaId,
          items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
          notes,
        }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        resetExpiredCustomerSession(data.error || "Sessao expirada. Abra a comanda novamente para enviar o pedido.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Erro ao enviar pedido.");
        return;
      }
      setOrders((prev) => {
        const nextOrder = {
          id: data.id,
          total: Number(data.total ?? cartTotal),
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
      setCart([]);
      setNotes("");
      setStep("orders");
    } finally {
      setLoading(false);
    }
  }

  async function requestCloseAccount() {
    if (!vendor) return;
    if (openTotal <= 0) {
      setError("Ainda nao ha valor em aberto para pedir a conta.");
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
        resetExpiredCustomerSession(data.error || "Sessao expirada. Abra a comanda novamente para pedir a conta.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Nao ha conta aberta para fechar.");
        return;
      }
      setOrders((prev) => prev.map((order) => order.id === data.order?.id ? { ...order, status: "closing_requested" } : order));
      if (!orders.some((order) => order.id === data.order?.id) && data.order?.id) {
        setOrders([{ id: data.order.id, total: Number(data.order.total || ordersTotal), status: "closing_requested", created_at: data.order.created_at || new Date().toISOString() }]);
      }
      alert("Pedido de conta enviado ao quiosque.");
    } finally {
      setLoading(false);
    }
  }

  async function requestService(requestType: "waiter_call" | "cleaning_request" | "umbrella_transfer") {
    if (!vendor || !customerId) {
      setError("Abra a comanda antes de solicitar atendimento.");
      return;
    }
    if (!featureEnabled(requestType)) {
      setError("Este modulo esta desativado para este quiosque.");
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
        resetExpiredCustomerSession(data.error || "Sessao expirada. Abra a comanda novamente para solicitar atendimento.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Nao foi possivel solicitar atendimento.");
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
          <InstallShortcutButton context="customer" className="customer-action" />
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
          <div className="customer-form">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="customer-input" />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Celular" className="customer-input" />
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
            <button onClick={requestCloseAccount} disabled={loading} className="customer-icon-button customer-icon-button--secondary">
              Fechar conta
            </button>
            {featureEnabled("waiter_call") && (
              <button onClick={callWaiter} className="customer-icon-button">
                <Bell size="1.125rem" /> Atendente
              </button>
            )}
          </div>
        </div>
        <div className="customer-service-actions" aria-label="Solicitacoes do guarda-sol">
          {featureEnabled("cleaning_request") && (
            <button type="button" onClick={() => requestService("cleaning_request")}>
              Limpeza
            </button>
          )}
          {featureEnabled("umbrella_transfer") && (
            <button type="button" onClick={() => requestService("umbrella_transfer")}>
              Trocar guarda-sol
            </button>
          )}
        </div>
        {waiterCalled && <p className="customer-feedback">Solicitacao enviada ao quiosque.</p>}
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

      {step === "menu" && (
        <section className="customer-content">
          <div className="customer-category-rail">
            {categories.map((category) => (
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
            {products.filter((p) => activeCategory === "Todos" || p.category === activeCategory).map((product) => (
              <article key={product.id} className="customer-product-row">
                {product.image_url && (
                  <div className="customer-product-media">
                    <img src={product.image_url} alt={product.name} />
                  </div>
                )}
                <div className="customer-product-info">
                  <h2 className="customer-product-name">{product.name}</h2>
                  {product.description && <p className="customer-product-description">{product.description}</p>}
                </div>
                <div className="customer-product-side">
                  <span className="customer-price">{formatCurrency(Number(product.promotional_price ?? product.price))}</span>
                  <button onClick={() => addToCart(product)} className="customer-add-button">Adicionar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === "cart" && (
        <section className="customer-content">
          <div className="customer-list">
            {cart.length === 0 ? <p className="customer-empty">Carrinho vazio.</p> : cart.map((item) => (
              <article key={item.product.id} className="customer-cart-row">
                <div className="customer-cart-info">
                  <h2 className="customer-cart-name">{item.product.name}</h2>
                  <p className="customer-cart-meta">{formatCurrency(Number(item.product.promotional_price ?? item.product.price) * item.quantity)}</p>
                </div>
                <div className="customer-qty">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="customer-qty-button" aria-label={`Remover ${item.product.name}`}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="customer-qty-button" aria-label={`Adicionar ${item.product.name}`}>+</button>
                </div>
              </article>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes do pedido" rows={3} className="customer-textarea" />
          <button onClick={createOrder} disabled={loading || cart.length === 0} className="customer-primary-button">Enviar pedido</button>
        </section>
      )}

      {step === "orders" && (
        <section className="customer-content">
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
              <span>Incluir 10% do garcom</span>
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
                    aria-label="Diminuir pessoas para divisao"
                  >
                    -
                  </button>
                  <input
                    value={splitPeople}
                    inputMode="numeric"
                    onChange={(event) => setSplitPeople(Math.max(1, Math.min(50, Number(event.target.value.replace(/\D/g, "")) || 1)))}
                    className="customer-stepper__input"
                    aria-label="Quantidade de pessoas para divisao"
                  />
                  <button
                    type="button"
                    onClick={() => setSplitPeople((value) => Math.min(50, value + 1))}
                    className="customer-stepper__button"
                    aria-label="Aumentar pessoas para divisao"
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
                  <h2 className="customer-order-title">Pedido #{order.id.slice(0, 8)}</h2>
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

      <nav className="customer-tabbar" aria-label="Navegacao do pedido">
        <button onClick={() => setStep("menu")} className={`customer-tab${step === "menu" ? " is-active" : ""}`}>
          <Home size="1.5rem" />
          Cardapio
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
