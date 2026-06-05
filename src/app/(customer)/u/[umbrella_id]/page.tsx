"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, Home, ListOrdered, ShoppingCart, UtensilsCrossed } from "lucide-react";
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

export default function CustomerApp() {
  const params = useParams();
  const umbrellaId = String(params.umbrella_id || "");

  const [step, setStep] = useState<"welcome" | "login" | "menu" | "cart" | "orders">("welcome");
  const [vendor, setVendor] = useState<{ id: string; name: string } | null>(null);
  const [umbrella, setUmbrella] = useState<{ id: string; number: number; label?: string | null } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
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

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.product.promotional_price ?? item.product.price) * item.quantity, 0);
  const ordersTotal = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  useEffect(() => {
    async function loadQrData() {
      try {
        const res = await fetch(`/api/public/umbrella/${umbrellaId}`);
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
        }
      } catch {
        setError("Erro de rede ao carregar o cardapio.");
      }
    }

    if (umbrellaId) loadQrData();
  }, [umbrellaId]);

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
      setCustomerName(data.name || name);
      sessionStorage.setItem(`sandexpress_user_${umbrellaId}`, JSON.stringify({
        customer_id: data.id || data.customer_id,
        name: data.name || name,
        phone: data.phone || phone,
        party_size: data.party_size || partySize,
      }));
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
      setOrders((prev) => [{ id: data.id, total: cartTotal, status: data.status || "received", created_at: data.created_at || new Date().toISOString() }, ...prev]);
      setCart([]);
      setNotes("");
      setStep("orders");
    } finally {
      setLoading(false);
    }
  }

  async function requestCloseAccount() {
    if (!vendor) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/close-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendor.id, umbrella_id: umbrellaId, request_only: true, notes: "Fechamento solicitado pelo cliente" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nao ha conta aberta para fechar.");
        return;
      }
      setOrders((prev) => prev.map((order) => order.id === data.order?.id ? { ...order, status: "closing_requested" } : order));
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
      <main className="min-h-screen bg-[#FF6B00] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-white text-[#FF6B00] flex items-center justify-center shadow-xl">
          <UtensilsCrossed size={46} />
        </div>
        <h1 className="mt-6 text-4xl font-black">SandExpress</h1>
        <p className="mt-2 text-white/80">{vendor?.name || "Carregando quiosque..."}</p>
        {error && <p className="mt-4 rounded-lg bg-white/15 px-4 py-3 text-sm">{error}</p>}
        <button onClick={() => setStep("login")} className="mt-10 w-full max-w-sm rounded-full bg-white py-4 font-black text-[#FF6B00] shadow-lg">
          Comecar pedido
        </button>
      </main>
    );
  }

  if (step === "login") {
    return (
      <main className="min-h-screen bg-[#F7F3EA] p-6">
        <section className="mx-auto mt-10 max-w-md rounded-lg bg-white p-6 shadow-sm border border-[#E7DCCB]">
          <h1 className="text-3xl font-black">Abrir comanda</h1>
          <p className="mt-2 text-[#82533F]">Sem validacao por WhatsApp no MVP. Informe os dados para iniciar.</p>
          <div className="mt-6 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none focus:border-[#FF6B00]" />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="Celular" className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none focus:border-[#FF6B00]" />
            <input type="number" min={1} max={50} value={partySize} onChange={(e) => setPartySize(Math.max(1, Math.min(50, Number(e.target.value || 1))))} className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none focus:border-[#FF6B00]" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} onClick={startTab} className="w-full rounded-lg bg-[#FF6B00] py-4 font-black text-white disabled:opacity-60">
              {loading ? "Abrindo..." : "Abrir comanda"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F3EA] pb-24 text-[#1F2933]">
      <header className="sticky top-0 z-20 bg-white border-b border-[#E7DCCB] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase font-bold text-[#82533F]">Guarda-sol {umbrella?.number || ""}</p>
            <h1 className="text-xl font-black">{customerName || "Cliente"}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={requestCloseAccount} disabled={loading} className="rounded-lg bg-[#394E59] px-3 py-2 text-sm font-bold text-white">
              Fechar conta
            </button>
            <button onClick={callWaiter} className="rounded-lg bg-[#FF6B00] px-3 py-2 text-sm font-bold text-white inline-flex items-center gap-1">
              <Bell size={16} /> Garcom
            </button>
          </div>
        </div>
        {waiterCalled && <p className="mt-3 rounded-lg bg-[#FFF2E5] px-3 py-2 text-sm font-semibold text-[#82533F]">Garcom chamado.</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </header>

      {step === "menu" && (
        <section className="p-4 space-y-4">
          <div className="rounded-lg bg-white p-4 border border-[#E7DCCB]">
            <p className="text-sm text-[#82533F]">Total em aberto</p>
            <p className="text-3xl font-black text-[#FF6B00]">{formatCurrency(cartTotal + ordersTotal)}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button key={category} onClick={() => setActiveCategory(category)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-bold", activeCategory === category ? "bg-[#FF6B00] text-white" : "bg-white text-[#82533F]")}>{category}</button>
            ))}
          </div>
          <div className="space-y-3">
            {products.filter((p) => activeCategory === "Todos" || p.category === activeCategory).map((product) => (
              <article key={product.id} className="rounded-lg bg-white border border-[#E7DCCB] p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="font-black">{product.name}</h2>
                    <p className="mt-1 text-sm text-[#82533F]">{product.description}</p>
                  </div>
                  <p className="font-black text-[#FF6B00]">{formatCurrency(Number(product.promotional_price ?? product.price))}</p>
                </div>
                <button onClick={() => addToCart(product)} className="mt-4 rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-black text-white">Adicionar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === "cart" && (
        <section className="p-4 space-y-4">
          {cart.length === 0 ? <p className="rounded-lg bg-white p-6 text-center text-[#82533F]">Carrinho vazio.</p> : cart.map((item) => (
            <article key={item.product.id} className="rounded-lg bg-white border border-[#E7DCCB] p-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-black">{item.product.name}</h2>
                <p className="text-sm text-[#82533F]">{formatCurrency(Number(item.product.promotional_price ?? item.product.price) * item.quantity)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => updateQuantity(item.product.id, -1)} className="rounded-full bg-[#F7F3EA] px-3 py-1 font-black">-</button>
                <span className="font-black">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, 1)} className="rounded-full bg-[#F7F3EA] px-3 py-1 font-black">+</button>
              </div>
            </article>
          ))}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observacoes do pedido" rows={3} className="w-full rounded-lg border border-[#E7DCCB] p-4 outline-none focus:border-[#FF6B00]" />
          <button onClick={createOrder} disabled={loading || cart.length === 0} className="w-full rounded-lg bg-[#FF6B00] py-4 font-black text-white disabled:opacity-60">Enviar pedido</button>
        </section>
      )}

      {step === "orders" && (
        <section className="p-4 space-y-3">
          {orders.length === 0 ? <p className="rounded-lg bg-white p-6 text-center text-[#82533F]">Nenhum pedido ainda.</p> : orders.map((order) => (
            <article key={order.id} className="rounded-lg bg-white border border-[#E7DCCB] p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-black">Pedido #{order.id.slice(0, 8)}</h2>
                  <p className="text-sm text-[#82533F]">{order.status}</p>
                </div>
                <p className="font-black text-[#FF6B00]">{formatCurrency(Number(order.total || 0))}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E7DCCB] p-3">
        <div className="mx-auto flex max-w-md justify-around">
          <button onClick={() => setStep("menu")} className={cn("flex flex-col items-center text-xs font-bold", step === "menu" ? "text-[#FF6B00]" : "text-[#82533F]")}><Home size={22} />Cardapio</button>
          <button onClick={() => setStep("cart")} className={cn("flex flex-col items-center text-xs font-bold", step === "cart" ? "text-[#FF6B00]" : "text-[#82533F]")}><ShoppingCart size={22} />Carrinho</button>
          <button onClick={() => setStep("orders")} className={cn("flex flex-col items-center text-xs font-bold", step === "orders" ? "text-[#FF6B00]" : "text-[#82533F]")}><ListOrdered size={22} />Conta</button>
        </div>
      </nav>
    </main>
  );
}
