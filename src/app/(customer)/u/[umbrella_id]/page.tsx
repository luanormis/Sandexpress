"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  MapPin,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  UtensilsCrossed,
  Home,
  ListOrdered,
  Utensils,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  promotional_price?: number | null;
  description: string | null;
  image_url: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type PublicContext = {
  umbrella: { id: string; number: number; label: string | null };
  vendor: {
    id: string;
    name: string;
    primary_color: string;
    secondary_color: string;
    logo_url: string | null;
  };
  products: Product[];
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
};

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  order_items?: { quantity: number; products?: { name: string } | null }[];
};

export default function CustomerApp() {
  const params = useParams();
  const umbrella_id = params.umbrella_id as string;

  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<PublicContext | null>(null);

  const [step, setStep] = useState<"welcome" | "login" | "verify" | "menu" | "cart" | "orders">("welcome");
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notes, setNotes] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpDevHint, setOtpDevHint] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");

  const [waiterCalled, setWaiterCalled] = useState(false);
  const timeouts = useRef<number[]>([]);

  const primary = ctx?.vendor.primary_color || "#FF6B00";
  const secondary = ctx?.vendor.secondary_color || "#394E59";

  const categories = ["Todos", ...Array.from(new Set(products.map((p) => p.category)))];
  const [activeCategory, setActiveCategory] = useState("Todos");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/umbrella/${umbrella_id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Guarda-sol indisponível.");
        if (cancelled) return;
        setCtx(data);
        setProducts(data.products || []);
        setLoadState("ready");
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Erro ao carregar.");
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [umbrella_id]);

  useEffect(() => {
    return () => {
      timeouts.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const refreshOrders = async (customerId: string) => {
    const res = await fetch(`/api/customers/${customerId}/orders`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!customer?.id) return;
    refreshOrders(customer.id);
    const t = window.setInterval(() => refreshOrders(customer.id), 15000);
    return () => clearInterval(t);
  }, [customer?.id]);

  const sendWhatsAppCode = async () => {
    setLoginError("");
    if (name.trim().length < 3 || phone.replace(/\D/g, "").length < 10) {
      setLoginError("Informe nome e celular válidos.");
      return;
    }
    if (!ctx) return;
    const res = await fetch("/api/customers/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, vendor_id: ctx.vendor.id }),
    });
    const data = await res.json();
    if (data.dev_hint) setOtpDevHint(String(data.dev_hint));
    else setOtpDevHint(null);
    setStep("verify");
    setOtpInput("");
  };

  const confirmVerification = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    if (!ctx) return;

    const res = await fetch("/api/customers/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        vendor_id: ctx.vendor.id,
        otp_code: otpInput.replace(/\D/g, ""),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || "Falha ao entrar.");
      return;
    }
    setCustomer({ id: data.id, name: data.name, phone: data.phone });
    setStep("menu");
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.product.promotional_price || item.product.price) * item.quantity,
    0
  );

  const createOrder = async () => {
    if (!ctx || !customer || cart.length === 0) return;
    setOrderBusy(true);
    try {
      const items = cart.map((c) => {
        const unit = Number(c.product.promotional_price ?? c.product.price);
        return {
          product_id: c.product.id,
          quantity: c.quantity,
          unit_price: unit,
        };
      });
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_id: ctx.vendor.id,
          customer_id: customer.id,
          umbrella_id: ctx.umbrella.id,
          items,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pedido falhou.");
      setCart([]);
      setNotes("");
      await refreshOrders(customer.id);
      setStep("orders");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao enviar pedido.");
    } finally {
      setOrderBusy(false);
    }
  };

  const closeAccountAtCashier = async () => {
    if (!ctx || !customer) return;
    setCloseBusy(true);
    try {
      const res = await fetch("/api/close-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vendor_id: ctx.vendor.id,
          umbrella_id: ctx.umbrella.id,
          customer_phone: customer.phone,
          payment_method: "cash",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível encerrar.");
      alert(data.message || "Dirija-se ao caixa para pagamento.");
      await refreshOrders(customer.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao encerrar conta.");
    } finally {
      setCloseBusy(false);
    }
  };

  const callWaiter = () => {
    setWaiterCalled(true);
    const timeoutId = window.setTimeout(() => setWaiterCalled(false), 5000);
    timeouts.current.push(timeoutId);
  };

  const totalOwed =
    orders.reduce((sum, order) => sum + Number(order.total), 0) + cartTotal;

  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      received: "Recebido",
      preparing: "Em preparo",
      delivering: "A caminho",
      completed: "Entregue",
      cancelled: "Cancelado",
    };
    return m[s] || s;
  };

  if (loadState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  if (loadState === "error" || !ctx) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <p className="text-red-600 font-semibold">{loadError || "Indisponível."}</p>
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-white text-center"
        style={{
          background: `linear-gradient(to bottom, ${primary}, ${secondary})`,
        }}
      >
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl">
          <UtensilsCrossed size={48} style={{ color: primary }} />
        </div>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2">{ctx.vendor.name}</h1>
        <p className="text-white/90 text-lg font-sans mb-12">Leia o QR e inicie seu pedido.</p>
        <div className="bg-white/10 p-4 rounded-xl mb-12 border border-white/20 backdrop-blur-sm">
          <MapPin size={24} className="inline-block mb-2" />
          <h2 className="text-xl font-bold font-sans">
            Guarda-sol #{ctx.umbrella.number}
            {ctx.umbrella.label ? ` · ${ctx.umbrella.label}` : ""}
          </h2>
          <p className="text-sm mt-1 text-white/80">Entre com seu WhatsApp para começar.</p>
        </div>
        <button
          onClick={() => setStep("login")}
          className="w-full max-w-sm bg-white font-bold py-4 rounded-full text-xl shadow-lg active:scale-95 transition-transform"
          style={{ color: primary }}
        >
          Começar pedido
        </button>
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-6">
        <div className="flex-1 mt-12 max-w-md w-full mx-auto">
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">Digite seu nome e WhatsApp</h2>
          <p className="text-gray-500 mb-8">
            Enviaremos um código de verificação. Configure o envio real em{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">docs/EXTERNAL_INTEGRATIONS.md</code>.
          </p>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg outline-none transition-colors"
                style={{ accentColor: primary }}
                placeholder="João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Celular / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg outline-none transition-colors"
                placeholder="11999999999"
              />
            </div>
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            <button
              type="button"
              onClick={sendWhatsAppCode}
              className="w-full text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: primary }}
            >
              Enviar código <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-6">
        <div className="flex-1 mt-12 max-w-md w-full mx-auto">
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">Código de verificação</h2>
          <p className="text-gray-500 mb-4">
            Digite o código recebido. Em desenvolvimento (<code>CUSTOMER_OTP_MODE=dev</code>) use{" "}
            <strong>000000</strong>.
          </p>
          {otpDevHint ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 mb-4">
              Dica dev: {otpDevHint}
            </div>
          ) : null}
          <form onSubmit={confirmVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Código</label>
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg outline-none"
                placeholder="000000"
              />
            </div>
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            <button
              type="submit"
              className="w-full text-white font-bold py-4 rounded-xl text-lg shadow-md transition-all"
              style={{ backgroundColor: primary }}
            >
              Confirmar e entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Guarda-sol</p>
              <h1 className="font-display font-bold text-xl text-gray-900">{customer?.name || "Cliente"}</h1>
              <p className="text-xs text-gray-400">{ctx.vendor.name}</p>
            </div>
            <button
              onClick={callWaiter}
              className="text-white px-4 py-2 rounded-full font-semibold text-sm shadow-md transition-colors flex items-center gap-2"
              style={{ backgroundColor: primary }}
            >
              <UserRound size={16} /> Chamar garçom
            </button>
          </div>
          {waiterCalled && (
            <div className="rounded-3xl bg-[#FFF7EB] border border-[#F5E6D5] p-3 text-sm text-[#8A5D12]">
              Garçom chamado! Ele chegará em instantes.
            </div>
          )}
        </div>
      </header>

      {step === "menu" && (
        <main className="p-4 space-y-4">
          <section
            className="text-white rounded-3xl p-6 shadow-lg"
            style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-80">Total da conta</p>
                <h2 className="text-3xl font-bold">{formatCurrency(totalOwed)}</h2>
              </div>
              <span className="text-sm text-white/80">#{ctx.umbrella.number}</span>
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-all",
                    activeCategory === category ? "text-white" : "bg-gray-100 text-gray-700"
                  )}
                  style={activeCategory === category ? { backgroundColor: primary } : undefined}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {products
                .filter((product) => activeCategory === "Todos" || product.category === activeCategory)
                .map((product) => {
                  const inCart = cart.find((item) => item.product.id === product.id);
                  const price = product.promotional_price || product.price;
                  return (
                    <div
                      key={product.id}
                      className="rounded-3xl border border-gray-100 p-4 flex gap-4 items-center bg-white shadow-sm"
                    >
                      <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl text-white shrink-0"
                        style={{ backgroundColor: `${secondary}33`, color: primary }}
                      >
                        <Utensils size={28} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{product.name}</h3>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {product.promotional_price ? (
                              <p className="text-xs line-through text-gray-400">{formatCurrency(product.price)}</p>
                            ) : null}
                            <p className="text-lg font-bold" style={{ color: primary }}>
                              {formatCurrency(price)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => addToCart(product)}
                            className="rounded-full px-4 py-2 text-white font-semibold shadow-sm transition"
                            style={{ backgroundColor: primary }}
                          >
                            Adicionar
                          </button>
                          {inCart ? <span className="text-sm text-gray-500">{inCart.quantity} no carrinho</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </main>
      )}

      {step === "cart" && (
        <main className="p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Carrinho</p>
                <h2 className="text-2xl font-bold text-gray-900">Revisão do pedido</h2>
              </div>
              <span className="text-sm text-gray-500">{cart.reduce((t, i) => t + i.quantity, 0)} itens</span>
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                <p>O carrinho está vazio.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between gap-4 bg-gray-50 rounded-3xl p-4 border border-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-sm text-gray-500">Quantidade: {item.quantity}</p>
                    </div>
                    <div className="text-gray-900 font-semibold">
                      {formatCurrency((item.product.promotional_price || item.product.price) * item.quantity)}
                    </div>
                  </div>
                ))}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações para a cozinha"
                  className="w-full rounded-3xl border border-gray-200 p-4 text-sm outline-none"
                  rows={3}
                />
                <div className="flex items-center justify-between text-gray-900 font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={createOrder}
                  disabled={orderBusy}
                  className="w-full rounded-3xl py-4 text-white font-bold text-lg shadow-md disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                >
                  {orderBusy ? "Enviando…" : "Confirmar e enviar"}
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {step === "orders" && (
        <main className="p-4">
          <div className="space-y-4">
            <div
              className="text-white rounded-3xl p-6 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <p className="text-xs uppercase tracking-[0.2em] opacity-80">Total acumulado</p>
              <p className="text-4xl font-display font-bold mt-3">{formatCurrency(totalOwed)}</p>
              <p className="mt-2 text-sm opacity-90">Pague ao garçom ou encerre a conta no caixa.</p>
              <button
                type="button"
                onClick={closeAccountAtCashier}
                disabled={closeBusy}
                className="mt-4 w-full bg-white/20 hover:bg-white/30 border border-white/40 rounded-2xl py-3 font-bold disabled:opacity-50"
              >
                {closeBusy ? "Processando…" : "Encerrar conta (ir ao caixa)"}
              </button>
            </div>
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center text-gray-500 shadow-sm">
                  <p>Nenhum pedido ainda.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Pedido</p>
                        <p className="text-lg font-bold text-gray-900">
                          {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold uppercase bg-blue-100 text-blue-700"
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      {(order.order_items || []).map((line, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {line.quantity}x {line.products?.name || "Item"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 font-bold text-gray-900">{formatCurrency(Number(order.total))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center p-3 max-w-4xl mx-auto">
          <button
            onClick={() => setStep("menu")}
            className={cn("flex flex-col items-center gap-1", step === "menu" ? "" : "text-gray-400")}
            style={step === "menu" ? { color: primary } : undefined}
          >
            <Home size={24} />
            <span className="text-[10px] font-bold">Cardápio</span>
          </button>
          <button
            onClick={() => setStep("cart")}
            className={cn("flex flex-col items-center gap-1 relative", step === "cart" ? "" : "text-gray-400")}
            style={step === "cart" ? { color: primary } : undefined}
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                {cart.length}
              </span>
            )}
            <span className="text-[10px] font-bold">Carrinho</span>
          </button>
          <button
            onClick={() => setStep("orders")}
            className={cn("flex flex-col items-center gap-1 relative", step === "orders" ? "" : "text-gray-400")}
            style={step === "orders" ? { color: primary } : undefined}
          >
            <ListOrdered size={24} />
            {orders.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-green-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white" />
            )}
            <span className="text-[10px] font-bold">Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
