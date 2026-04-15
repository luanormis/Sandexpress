"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import { MapPin, ShoppingBag, ShoppingCart, UserRound, UtensilsCrossed, Plus, Minus, Home, ListOrdered, Utensils, ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  promotional_price?: number;
  description: string;
  image_url: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Order = {
  id: string;
  items: CartItem[];
  total: number;
  status: "received" | "preparing" | "delivering" | "delivered";
  created_at: string;
};

type Customer = {
  name: string;
  phone: string;
};

export default function CustomerApp() {
  const params = useParams();
  const umbrella_id = params.umbrella_id as string;

  const [step, setStep] = useState<"welcome" | "login" | "verify" | "menu" | "cart" | "orders">("welcome");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [umbrella, setUmbrella] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [otpModeHint, setOtpModeHint] = useState<string | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);

  const categories = ["Todos", ...Array.from(new Set(products.map((product) => product.category)))];
  const [activeCategory, setActiveCategory] = useState("Todos");
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    // Load umbrella and products
    const loadData = async () => {
      try {
        const umbrellaRes = await fetch(`/api/umbrellas/${umbrella_id}`);
        if (!umbrellaRes.ok) {
          const errorBody = await umbrellaRes.json().catch(() => null);
          setLoadError(errorBody?.error || 'Erro ao carregar guarda-sol.');
          return;
        }

        const umbrellaData = await umbrellaRes.json();
        setUmbrella(umbrellaData);
        setVendorId(umbrellaData.vendor_id);

        const productsRes = await fetch(`/api/products?vendor_id=${umbrellaData.vendor_id}`);
        if (!productsRes.ok) {
          const errorBody = await productsRes.json().catch(() => null);
          setLoadError(errorBody?.error || 'Erro ao carregar produtos.');
          return;
        }

        const productsData = await productsRes.json();
        setProducts(productsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setLoadError('Erro de rede ao carregar dados do quiosque.');
      }
    };

    loadData();

    const saved = sessionStorage.getItem(`sandexpress_user_${umbrella_id}`);
    if (saved) {
      setCustomer(JSON.parse(saved));
      setStep("menu");
    }
    return () => {
      timeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [umbrella_id]);

  const sendWhatsAppCode = async () => {
    if (!vendorId) {
      return alert('Quiosque não identificado. Atualize a página e tente novamente.');
    }
    if (name.trim().length < 3 || phone.trim().length < 10) {
      return alert("Informe nome e celular válidos antes de enviar o código.");
    }

    setRequestingOtp(true);
    setLoadError(null);
    setOtpModeHint(null);

    try {
      const res = await fetch('/api/customers/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), vendor_id: vendorId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setLoadError(result.error || 'Erro ao solicitar código.');
        return;
      }
      setOtpSent(true);
      setOtpInput('');
      setOtpModeHint(result.dev_hint || null);
      setStep('verify');
    } catch (err) {
      console.error('OTP request error:', err);
      setLoadError('Erro de rede ao solicitar código.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const confirmVerification = async (event: FormEvent) => {
    event.preventDefault();
    if (!vendorId) {
      return alert('Quiosque não identificado. Atualize a página e tente novamente.');
    }
    if (!otpInput.trim()) {
      return alert('Informe o código de verificação.');
    }

    setVerifyingOtp(true);
    setLoadError(null);

    try {
      const response = await fetch('/api/customers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: phone.replace(/\D/g, ''), vendor_id: vendorId, otp_code: otpInput }),
      });
      const result = await response.json();
      if (!response.ok) {
        setLoadError(result.error || 'Código inválido.');
        return;
      }
      const user: Customer = { name: result.name || name, phone: result.phone || phone };
      setCustomer(user);
      setCustomerId(result.id || result.customer_id || null);
      sessionStorage.setItem(`sandexpress_user_${umbrella_id}`, JSON.stringify(user));
      setStep('menu');
    } catch (err) {
      console.error('Verification error:', err);
      setLoadError('Erro de rede ao verificar código.');
    } finally {
      setVerifyingOtp(false);
    }
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
    if (!vendorId || !customerId || !umbrella_id) {
      return alert('Dados incompletos. Atualize a página e tente novamente.');
    }
    if (cart.length === 0) {
      return alert('Adicione ao menos um item ao carrinho.');
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          customer_id: customerId,
          umbrella_id,
          items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        return alert(result.error || 'Erro ao criar pedido.');
      }

      const order: Order = {
        id: result.id,
        items: cart,
        total: cartTotal,
        status: 'received',
        created_at: result.created_at || new Date().toISOString(),
      };
      setOrders((prev) => [order, ...prev]);
      setCart([]);
      setNotes("");
      setStep("orders");
    } catch (err) {
      console.error('Create order error:', err);
      alert('Erro de rede ao enviar pedido.');
    }
  };

  const callWaiter = () => {
    setWaiterCalled(true);
    const timeoutId = window.setTimeout(() => setWaiterCalled(false), 5000);
    timeouts.current.push(timeoutId);
  };

  const totalOwed = orders.reduce((sum, order) => sum + order.total, 0) + cartTotal;

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FF6B00] to-[#E56000] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl">
          <UtensilsCrossed size={48} className="text-[#FF6B00]" />
        </div>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2">SandExpress</h1>
        <p className="text-[#F5E1C0] text-lg font-sans mb-12">Leia o QR e inicie sua conta do guarda-sol.</p>
        <div className="bg-white/10 p-4 rounded-xl mb-12 border border-white/20 backdrop-blur-sm">
          <MapPin size={24} className="inline-block mb-2" />
          <h2 className="text-xl font-bold font-sans">Guarda-Sol #{umbrella_id.toUpperCase()}</h2>
          <p className="text-sm mt-1 text-white/80">Entre com seu WhatsApp para começar.</p>
        </div>
        <button
          onClick={() => setStep("login")}
          className="w-full max-w-sm bg-white text-[#FF6B00] font-bold py-4 rounded-full text-xl shadow-lg active:scale-95 transition-transform"
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
          <p className="text-gray-500 mb-8">Esse número será usado para a conta do guarda-sol e para receber o código de validação.</p>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-[#FF6B00] focus:ring-0 outline-none transition-colors"
                placeholder="João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Celular / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-[#FF6B00] focus:ring-0 outline-none transition-colors"
                placeholder="11999999999"
              />
            </div>
            <button
              type="button"
              onClick={sendWhatsAppCode}
              className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md hover:bg-[#E56000] active:scale-95 transition-all inline-flex items-center justify-center gap-2"
            >
              Validar pelo WhatsApp <ChevronRight size={18} />
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
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">Código enviado</h2>
          <p className="text-gray-500 mb-8">Digite o código recebido no WhatsApp para liberar o pedido.</p>
          <div className="bg-white rounded-3xl border border-gray-200 p-5 mb-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Código gerado para teste</p>
            <p className="text-3xl font-bold text-[#FF6B00]">{otpCode}</p>
            <p className="text-sm text-gray-500 mt-2">Em produção, este código será enviado ao WhatsApp.</p>
          </div>
          <form onSubmit={confirmVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Código</label>
              <input
                type="text"
                value={otpInput}
                onChange={(event) => setOtpInput(event.target.value.replace(/\D/g, ""))}
                maxLength={6}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-[#FF6B00] focus:ring-0 outline-none transition-colors"
                placeholder="123456"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md hover:bg-[#E56000] active:scale-95 transition-all"
            >
              Confirmar código
            </button>
          </form>
          <button
            type="button"
            onClick={sendWhatsAppCode}
            className="mt-4 w-full text-[#FF6B00] border border-[#FF6B00] rounded-xl py-4 font-semibold hover:bg-[#FF6B00]/10 transition"
          >
            Reenviar código
          </button>
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
            </div>
            <button
              onClick={callWaiter}
              className="bg-[#FF6B00] text-white px-4 py-2 rounded-full font-semibold text-sm shadow-md hover:bg-[#E56000] transition-colors flex items-center gap-2"
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
          <section className="bg-gradient-to-r from-[#FF6B00] to-[#E56000] text-white rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] opacity-80">Saldo do quiosque</p>
                <h2 className="text-3xl font-bold">{formatCurrency(totalOwed)}</h2>
              </div>
              <span className="text-sm text-white/80">Guarda-sol {umbrella_id.toUpperCase()}</span>
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
                    activeCategory === category
                      ? "bg-[#FF6B00] text-white"
                      : "bg-gray-100 text-gray-700"
                  )}
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
                    <div key={product.id} className="rounded-3xl border border-gray-100 p-4 flex gap-4 items-center bg-white shadow-sm">
                      <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center text-[#FF6B00] text-3xl">
                        <Utensils size={28} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{product.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                          </div>
                          <div className="text-right">
                            {product.promotional_price ? (
                              <p className="text-xs line-through text-gray-400">{formatCurrency(product.price)}</p>
                            ) : null}
                            <p className="text-lg font-bold text-[#FF6B00]">{formatCurrency(price)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => addToCart(product)}
                            className="rounded-full bg-[#FF6B00] px-4 py-2 text-white font-semibold shadow-sm hover:bg-[#E56000] transition"
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
              <span className="text-sm text-gray-500">{cart.reduce((total, item) => total + item.quantity, 0)} itens</span>
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                <p>O carrinho está vazio. Adicione um item ao pedido.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between gap-4 bg-gray-50 rounded-3xl p-4 border border-gray-100">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                      <p className="text-sm text-gray-500">Quantidade: {item.quantity}</p>
                    </div>
                    <div className="text-gray-900 font-semibold">{formatCurrency((item.product.promotional_price || item.product.price) * item.quantity)}</div>
                  </div>
                ))}
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observação para a cozinha (ex: sem cebola, pouco sal...)"
                  className="w-full rounded-3xl border border-gray-200 p-4 text-sm focus:border-[#FF6B00] outline-none"
                  rows={3}
                />
                <div className="rounded-3xl bg-[#FFF7EB] border border-[#F5E6D5] p-4 text-sm text-[#8A5D12]">
                  Seu pedido será enviado imediatamente ao quiosque. Você pode acompanhar o andamento na aba Conta.
                </div>
                <div className="flex items-center justify-between text-gray-900 font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                <button
                  onClick={createOrder}
                  className="w-full rounded-3xl bg-[#FF6B00] py-4 text-white font-bold text-lg shadow-md hover:bg-[#E56000] transition"
                >
                  Confirmar e enviar
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {step === "orders" && (
        <main className="p-4">
          <div className="space-y-4">
            <div className="bg-[#FF6B00] text-white rounded-3xl p-6 shadow-lg">
              <p className="text-xs uppercase tracking-[0.2em] opacity-80">Total acumulado</p>
              <p className="text-4xl font-display font-bold mt-3">{formatCurrency(totalOwed)}</p>
              <p className="mt-2 text-sm opacity-90">Pague ao garçom no final da visita.</p>
            </div>
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center text-gray-500 shadow-sm">
                  <p>Nenhum pedido ainda. Vá ao cardápio e confirme o primeiro item.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Pedido #{order.id}</p>
                        <p className="text-lg font-bold text-gray-900">{new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <span className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold uppercase",
                        order.status === "delivered"
                          ? "bg-green-100 text-green-700"
                          : order.status === "delivering"
                          ? "bg-orange-100 text-orange-700"
                          : order.status === "preparing"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {order.status === "received" ? "Recebido" : order.status === "preparing" ? "Em preparo" : order.status === "delivering" ? "A caminho" : "Entregue"}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      {order.items.map((item) => (
                        <div key={item.product.id} className="flex justify-between">
                          <span>{item.quantity}x {item.product.name}</span>
                          <span>{formatCurrency((item.product.promotional_price || item.product.price) * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center p-3 max-w-4xl mx-auto">
          <button onClick={() => setStep("menu")} className={cn("flex flex-col items-center gap-1", step === "menu" ? "text-[#FF6B00]" : "text-gray-400")}>
            <Home size={24} />
            <span className="text-[10px] font-bold">Cardápio</span>
          </button>
          <button onClick={() => setStep("cart")} className={cn("flex flex-col items-center gap-1 relative", step === "cart" ? "text-[#FF6B00]" : "text-gray-400")}>
            <ShoppingCart size={24} />
            {cart.length > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}
            <span className="text-[10px] font-bold">Carrinho</span>
          </button>
          <button onClick={() => setStep("orders")} className={cn("flex flex-col items-center gap-1 relative", step === "orders" ? "text-[#FF6B00]" : "text-gray-400")}>
            <ListOrdered size={24} />
            {orders.length > 0 && <span className="absolute -top-1 -right-2 bg-green-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white"></span>}
            <span className="text-[10px] font-bold">Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
}
