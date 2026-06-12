"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, Home, ListOrdered, Minus, Plus, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { InstallShortcutButton } from "@/components/pwa/InstallShortcutButton";
import { cn, formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
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
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [includeServiceFee, setIncludeServiceFee] = useState(true);
  const [paymentMode, setPaymentMode] = useState<"full" | "split" | "custom">("full");
  const [customPaymentAmount, setCustomPaymentAmount] = useState("");

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.promotional_price ?? item.product.price) * item.quantity, 0);
  const ordersTotal = orders
    .filter((order) => BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrdersTotal = orders
    .filter((order) => !BILLABLE_STATUSES.has(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const openTotal = ordersTotal + cartTotal;
  const serviceFee = includeServiceFee ? ordersTotal * 0.1 : 0;
  const billTotal = ordersTotal + serviceFee;
  const splitPeople = Math.max(1, partySize);
  const splitAmount = billTotal / splitPeople;
  const customAmount = Number(customPaymentAmount.replace(",", "."));
  const requestedPaymentAmount = paymentMode === "split"
    ? splitAmount
    : paymentMode === "custom" && Number.isFinite(customAmount) && customAmount > 0
      ? Math.min(customAmount, billTotal)
      : billTotal;
  const remainingAfterPayment = Math.max(billTotal - requestedPaymentAmount, 0);
  const latestOrder = orders[0];
  const theme = {
    primary: vendor?.primary_color || "#ff6b00",
    secondary: vendor?.secondary_color || "#82533f",
    logo: vendor?.logo_url || "/sandexpress-logo.svg",
  };
  const sandExpressMark = (
    <div className="fixed bottom-3 left-1/2 right-auto z-30 flex w-full max-w-md -translate-x-1/2 justify-center pointer-events-none">
      <div className="rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[11px] font-black shadow-sm" style={{ color: theme.secondary }}>
        SandExpress
      </div>
    </div>
  );

  async function loadCustomerOrders(nextCustomerId: string, nextVendorId: string) {
    if (!nextCustomerId || !nextVendorId) return;
    const res = await fetch(`/api/customers/${encodeURIComponent(nextCustomerId)}/orders?vendor_id=${encodeURIComponent(nextVendorId)}`);
    const data = await res.json().catch(() => []);
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
    if (ordersTotal <= 0) {
      setError("A conta ainda nao tem itens entregues para fechar.");
      setStep("orders");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/close-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendor.id,
          umbrella_id: umbrellaId,
          request_only: true,
          notes: "Fechamento solicitado pelo cliente",
          payment_amount: requestedPaymentAmount,
          service_fee_amount: serviceFee,
          service_fee_enabled: includeServiceFee,
          split_people: splitPeople,
          split_mode: paymentMode,
        }),
      });
      const data = await res.json();
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

  function callWaiter() {
    setWaiterCalled(true);
    window.setTimeout(() => setWaiterCalled(false), 5000);
  }

  if (step === "welcome") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center text-white shadow-2xl" style={{ backgroundColor: theme.primary }}>
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-xl overflow-hidden" style={{ color: theme.primary }}>
          {theme.logo ? (
            <img src={theme.logo} alt="Logo do quiosque" className="h-full w-full object-contain p-3" />
          ) : (
            <UtensilsCrossed size={46} />
          )}
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-wide text-white/70">SandExpress</p>
        <h1 className="mt-2 max-w-sm text-4xl font-black leading-tight sm:text-5xl">{vendor?.name || "Carregando quiosque..."}</h1>
        {error && <p className="mt-4 rounded-lg bg-white/15 px-4 py-3 text-sm">{error}</p>}
        <button onClick={() => setStep("login")} className="mt-10 w-full max-w-sm rounded-full bg-white py-4 font-black shadow-lg" style={{ color: theme.primary }}>
          Comecar pedido
        </button>
        <InstallShortcutButton context="customer" className="mt-4 w-full max-w-sm text-[#1F2933]" />
        {sandExpressMark}
      </main>
    );
  }

  if (step === "login") {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-[#fff8f6] p-5 shadow-2xl">
        <section className="mx-auto mt-10 max-w-md rounded-lg bg-white p-6 shadow-sm border border-[#E7DCCB]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-[#E7DCCB] bg-white">
              <img src={theme.logo} alt="Logo do quiosque" className="h-full w-full object-contain p-2" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: theme.secondary }}>SandExpress</p>
              <h1 className="text-2xl font-black sm:text-3xl">{vendor?.name || "Quiosque"}</h1>
              <p className="text-sm font-bold" style={{ color: theme.secondary }}>Abrir comanda</p>
            </div>
          </div>
          <p className="mt-2" style={{ color: theme.secondary }}>Informe os dados para iniciar.</p>
          <div className="mt-6 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none" style={{ borderColor: "#E7DCCB" }} />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Celular" className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none" />
            <div className="rounded-lg border border-[#E7DCCB] bg-white p-3">
              <p className="mb-2 text-sm font-bold" style={{ color: theme.secondary }}>Quantidade de pessoas</p>
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.max(1, value - 1))}
                  disabled={partySize <= 1}
                  className="h-11 rounded-lg border border-[#E7DCCB] bg-[#fff8f6] text-2xl font-black disabled:opacity-40"
                  style={{ color: theme.primary }}
                  aria-label="Diminuir quantidade de pessoas"
                >
                  -
                </button>
                <div className="h-11 rounded-lg bg-[#FFF8F0] px-3 text-center text-2xl font-black leading-[44px] text-[#1F2933]">
                  {partySize}
                </div>
                <button
                  type="button"
                  onClick={() => setPartySize((value) => Math.min(50, value + 1))}
                  disabled={partySize >= 50}
                  className="h-11 rounded-lg border border-[#E7DCCB] bg-[#fff8f6] text-2xl font-black disabled:opacity-40"
                  style={{ color: theme.primary }}
                  aria-label="Aumentar quantidade de pessoas"
                >
                  +
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} onClick={startTab} className="w-full rounded-lg py-4 font-black text-white disabled:opacity-60" style={{ backgroundColor: theme.primary }}>
              {loading ? "Abrindo..." : "Abrir comanda"}
            </button>
          </div>
        </section>
        {sandExpressMark}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#fff8f6] pb-28 text-[#1F2933] shadow-2xl">
      <header className="sticky top-0 z-20 border-b border-[#E7DCCB] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E7DCCB] bg-white">
              <img src={theme.logo} alt="Logo do quiosque" className="h-full w-full object-contain p-1.5" />
            </div>
            <div className="min-w-0">
            <p className="text-xs uppercase font-bold" style={{ color: theme.secondary }}>Guarda-sol {umbrella?.number || ""}</p>
            <h1 className="text-xl font-black">{customerName || "Cliente"}</h1>
            {currentOrderId && <p className="text-[11px] font-bold" style={{ color: theme.secondary }}>Pedido #{currentOrderId.slice(0, 8)}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep("orders")} disabled={loading} className="rounded-lg px-4 py-3 text-sm font-black text-white" style={{ backgroundColor: theme.secondary }}>
              Conta
            </button>
            <button onClick={callWaiter} className="inline-flex items-center gap-1 rounded-lg px-4 py-3 text-sm font-black text-white" style={{ backgroundColor: theme.primary }}>
              <Bell size={16} /> Garcom
            </button>
          </div>
        </div>
        {waiterCalled && <p className="mt-3 rounded-lg bg-[#FFF2E5] px-3 py-2 text-sm font-semibold" style={{ color: theme.secondary }}>Garcom chamado.</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-3 rounded-lg border border-[#E7DCCB] bg-[#FFF8F0] px-3 py-2">
          <p className="text-xs font-bold uppercase" style={{ color: theme.secondary }}>Total da conta</p>
          <p className="text-3xl font-black" style={{ color: theme.primary }}>{formatCurrency(openTotal)}</p>
          {pendingOrdersTotal > 0 && (
            <p className="text-[11px] font-bold" style={{ color: theme.secondary }}>
              {formatCurrency(pendingOrdersTotal)} aguardando entrega
            </p>
          )}
        </div>
        {latestOrder && (
          <div className="mt-3 rounded-lg border border-[#E7DCCB] bg-white px-3 py-2">
            <p className="text-xs font-bold uppercase" style={{ color: theme.secondary }}>Status do pedido</p>
            <p className="text-sm font-black" style={{ color: theme.primary }}>
              Pedido #{latestOrder.id.slice(0, 8)} - {ORDER_STATUS_LABELS[latestOrder.status] || latestOrder.status}
            </p>
          </div>
        )}
      </header>

      {step === "menu" && (
        <section className="space-y-4 p-4">
          <div className="rounded-lg bg-white p-4 border border-[#E7DCCB]">
            <p className="text-sm" style={{ color: theme.secondary }}>Total em aberto</p>
            <p className="text-4xl font-black" style={{ color: theme.primary }}>{formatCurrency(openTotal)}</p>
            {pendingOrdersTotal > 0 && (
              <p className="mt-1 text-xs font-bold" style={{ color: theme.secondary }}>
                Pedidos em preparo/entrega entram na conta quando forem entregues.
              </p>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn("shrink-0 rounded-full px-5 py-3 text-base font-black shadow-sm", activeCategory === category ? "text-white" : "bg-white")}
                style={activeCategory === category ? { backgroundColor: theme.primary } : { color: theme.secondary }}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {products.filter((p) => activeCategory === "Todos" || p.category === activeCategory).map((product) => (
              <article key={product.id} className="rounded-xl border border-[#E7DCCB] bg-white p-4 shadow-sm">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-black leading-tight">{product.name}</h2>
                    <p className="mt-2 text-base leading-snug" style={{ color: theme.secondary }}>{product.description}</p>
                  </div>
                  <p className="shrink-0 text-lg font-black" style={{ color: theme.primary }}>{formatCurrency(Number(product.promotional_price ?? product.price))}</p>
                </div>
                <button onClick={() => addToCart(product)} className="mt-4 w-full rounded-xl px-4 py-4 text-base font-black text-white" style={{ backgroundColor: theme.primary }}>Adicionar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === "cart" && (
        <section className="p-4 space-y-4">
          {cart.length === 0 ? <p className="rounded-lg bg-white p-6 text-center" style={{ color: theme.secondary }}>Carrinho vazio.</p> : cart.map((item) => (
            <article key={item.product.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#E7DCCB] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black">{item.product.name}</h2>
                <p className="text-base font-bold" style={{ color: theme.secondary }}>{formatCurrency(Number(item.product.promotional_price ?? item.product.price) * item.quantity)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="grid h-11 w-11 place-items-center rounded-full bg-[#fff8f6] font-black" style={{ color: theme.primary }}><Minus size={20} /></button>
                <span className="min-w-8 text-center text-2xl font-black">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="grid h-11 w-11 place-items-center rounded-full bg-[#fff8f6] font-black" style={{ color: theme.primary }}><Plus size={20} /></button>
              </div>
            </article>
          ))}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes do pedido" rows={3} className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none" />
          <button onClick={createOrder} disabled={loading || cart.length === 0} className="w-full rounded-xl py-5 text-lg font-black text-white disabled:opacity-60" style={{ backgroundColor: theme.primary }}>Enviar pedido</button>
        </section>
      )}

      {step === "orders" && (
        <section className="space-y-4 p-4">
          <div className="rounded-2xl border border-[#E7DCCB] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase" style={{ color: theme.secondary }}>Conta do guarda-sol</p>
                <h2 className="text-3xl font-black leading-tight" style={{ color: theme.primary }}>{formatCurrency(billTotal)}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIncludeServiceFee((value) => !value)}
                className={cn("rounded-full px-4 py-2 text-sm font-black", includeServiceFee ? "text-white" : "bg-[#fff8f6]")}
                style={includeServiceFee ? { backgroundColor: theme.primary } : { color: theme.secondary }}
              >
                10% garcom
              </button>
            </div>
            <div className="mt-4 space-y-2 text-base font-bold" style={{ color: theme.secondary }}>
              <div className="flex justify-between"><span>Produtos entregues</span><span>{formatCurrency(ordersTotal)}</span></div>
              <div className="flex justify-between"><span>Servico 10%</span><span>{includeServiceFee ? formatCurrency(serviceFee) : "Nao incluido"}</span></div>
              {pendingOrdersTotal > 0 && <p className="rounded-lg bg-[#fff8f6] p-3 text-sm">Ainda ha {formatCurrency(pendingOrdersTotal)} em preparo/entrega.</p>}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { id: "full", label: "Tudo" },
                { id: "split", label: "Dividir" },
                { id: "custom", label: "Parcial" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentMode(option.id as "full" | "split" | "custom")}
                  className={cn("rounded-xl border px-3 py-3 text-sm font-black", paymentMode === option.id ? "text-white" : "border-[#E7DCCB] bg-white")}
                  style={paymentMode === option.id ? { backgroundColor: theme.secondary, borderColor: theme.secondary } : { color: theme.secondary }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {paymentMode === "split" && (
              <div className="mt-4 rounded-xl bg-[#fff8f6] p-4">
                <p className="text-sm font-black" style={{ color: theme.secondary }}>Dividir por pessoas</p>
                <div className="mt-3 grid grid-cols-[48px_1fr_48px] items-center gap-3">
                  <button type="button" onClick={() => setPartySize((value) => Math.max(1, value - 1))} className="grid h-12 place-items-center rounded-xl bg-white font-black" style={{ color: theme.primary }}><Minus size={20} /></button>
                  <div className="rounded-xl bg-white px-3 py-3 text-center text-2xl font-black">{splitPeople}</div>
                  <button type="button" onClick={() => setPartySize((value) => Math.min(50, value + 1))} className="grid h-12 place-items-center rounded-xl bg-white font-black" style={{ color: theme.primary }}><Plus size={20} /></button>
                </div>
              </div>
            )}

            {paymentMode === "custom" && (
              <label className="mt-4 block rounded-xl bg-[#fff8f6] p-4">
                <span className="text-sm font-black" style={{ color: theme.secondary }}>Valor que deseja pagar agora</span>
                <input
                  inputMode="decimal"
                  value={customPaymentAmount}
                  onChange={(e) => setCustomPaymentAmount(e.target.value.replace(/[^\d,.]/g, ""))}
                  placeholder="Ex: 50,00"
                  className="mt-2 w-full rounded-xl border border-[#E7DCCB] bg-white p-4 text-2xl font-black outline-none"
                />
              </label>
            )}

            <div className="mt-5 rounded-xl border border-[#E7DCCB] bg-[#FFF8F0] p-4">
              <p className="text-sm font-black uppercase" style={{ color: theme.secondary }}>Valor solicitado</p>
              <p className="text-4xl font-black" style={{ color: theme.primary }}>{formatCurrency(requestedPaymentAmount)}</p>
              {remainingAfterPayment > 0 && <p className="mt-1 text-sm font-bold" style={{ color: theme.secondary }}>Saldo restante: {formatCurrency(remainingAfterPayment)}</p>}
            </div>

            <button onClick={requestCloseAccount} disabled={loading || ordersTotal <= 0} className="mt-4 w-full rounded-xl py-5 text-lg font-black text-white disabled:opacity-50" style={{ backgroundColor: theme.primary }}>
              {loading ? "Enviando..." : "Solicitar fechamento"}
            </button>
          </div>

          {orders.length === 0 ? <p className="rounded-lg bg-white p-6 text-center" style={{ color: theme.secondary }}>Nenhum pedido ainda.</p> : orders.map((order) => (
            <article key={order.id} className="rounded-xl border border-[#E7DCCB] bg-white p-4 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Pedido #{order.id.slice(0, 8)}</h2>
                  <p className="text-base font-bold" style={{ color: theme.secondary }}>
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </p>
                  {BILLABLE_STATUSES.has(order.status) && (
                    <p className="mt-1 text-[11px] font-black" style={{ color: theme.primary }}>Contabilizado na conta</p>
                  )}
                </div>
                <p className="text-lg font-black" style={{ color: theme.primary }}>{formatCurrency(Number(order.total || 0))}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <nav className="fixed bottom-0 left-1/2 right-auto w-full max-w-md -translate-x-1/2 border-t border-[#E7DCCB] bg-white p-3 shadow-[0_-12px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-md justify-around">
          <button onClick={() => setStep("menu")} className="flex min-w-20 flex-col items-center gap-1 text-sm font-black" style={{ color: step === "menu" ? theme.primary : theme.secondary }}><Home size={24} />Cardapio</button>
          <button onClick={() => setStep("cart")} className="flex min-w-20 flex-col items-center gap-1 text-sm font-black" style={{ color: step === "cart" ? theme.primary : theme.secondary }}><ShoppingCart size={24} />Carrinho</button>
          <button onClick={() => setStep("orders")} className="flex min-w-20 flex-col items-center gap-1 text-sm font-black" style={{ color: step === "orders" ? theme.primary : theme.secondary }}><ListOrdered size={24} />Conta</button>
        </div>
      </nav>
    </main>
  );
}
