"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, MapPin, Search, ShoppingBag, ShoppingCart, UserRound, UtensilsCrossed, ChevronRight, Plus, Minus, Home, ListOrdered, Utensils } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Mock Data para modo Demo
const MOCK_PRODUCTS = [
  { id: "1", name: "Cerveja Heineken", category: "Bebidas", price: 15.0, promotional_price: 12.0, description: "Garatia 600ml estupidamente gelada", image_url: "" },
  { id: "2", name: "Porção de Fritas", category: "Petiscos", price: 35.0, description: "Porção bem servida para 2 pessoas com molho especial", image_url: "" },
  { id: "3", name: "Isca de Peixe", category: "Petiscos", price: 65.0, description: "Peixe fresco empanado no capricho", image_url: "" },
  { id: "4", name: "Água de Coco", category: "Bebidas", price: 10.0, promotional_price: 8.0, description: "Coco verde natural", image_url: "" },
];

export default function CustomerApp() {
  const params = useParams();
  const umbrella_id = params.umbrella_id as string;

  // Estados principais
  const [step, setStep] = useState<"welcome" | "login" | "menu" | "cart" | "orders">("welcome");
  const [customer, setCustomer] = useState<{ name: string; phone: string } | null>(null);
  
  // Estados do Menu / Carrinho
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  // Formulário de Login
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Categorias vindas dos produtos
  const categories = ["Todos", ...Array.from(new Set(products.map(p => p.category)))];
  const [activeCategory, setActiveCategory] = useState("Todos");

  // Verifica Sessão (Simples e funcional)
  useEffect(() => {
    const saved = sessionStorage.getItem(`sandexpress_user_${umbrella_id}`);
    if (saved) {
      setCustomer(JSON.parse(saved));
      setStep("menu");
    }
  }, [umbrella_id]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.length < 3 || phone.length < 10) return alert("Preencha corretamente!");
    const user = { name, phone };
    setCustomer(user);
    sessionStorage.setItem(`sandexpress_user_${umbrella_id}`, JSON.stringify(user));
    setStep("menu");
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.promotional_price || item.product.price) * item.quantity, 0);

  const checkout = () => {
    if (cart.length === 0) return;
    const newOrder = {
      id: Math.random().toString(36).substr(2, 9),
      items: cart,
      total: cartTotal,
      status: "received",
      created_at: new Date().toISOString(),
    };
    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setStep("orders");
    alert("Pedido enviado para a barraca!");
  };

  // ----------------------------------------------------
  // TELAS
  // ----------------------------------------------------

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FF6B00] to-[#E56000] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl">
          <UtensilsCrossed size={48} className="text-[#FF6B00]" />
        </div>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2">SandExpress</h1>
        <p className="text-[#F5E1C0] text-lg font-sans mb-12">Seu pedido na areia, sem filas.</p>
        
        <div className="bg-white/10 p-4 rounded-xl mb-12 border border-white/20 backdrop-blur-sm">
          <MapPin size={24} className="inline-block mb-2" />
          <h2 className="text-xl font-bold font-sans">Guarda-Sol #{umbrella_id.slice(0,4).toUpperCase()}</h2>
        </div>

        <button 
          onClick={() => setStep("login")}
          className="w-full max-w-sm bg-white text-[#FF6B00] font-bold py-4 rounded-full text-xl shadow-lg active:scale-95 transition-transform"
        >
          Começar a Pedir
        </button>
      </div>
    );
  }

  if (step === "login") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-6">
        <div className="flex-1 mt-12 max-w-md w-full mx-auto">
          <h2 className="text-3xl font-display font-bold text-gray-900 mb-2">Quem é você?</h2>
          <p className="text-gray-500 mb-8 font-sans">Precisamos saber seu nome para o garçom lhe encontrar com facilidade.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
              <input 
                type="text" 
                required
                value={name} onChange={e => setName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-[#FF6B00] focus:ring-0 outline-none transition-colors"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Celular / WhatsApp</label>
              <input 
                type="tel" 
                required
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-lg focus:border-[#FF6B00] focus:ring-0 outline-none transition-colors"
                placeholder="(11) 99999-9999"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md hover:bg-[#E56000] active:scale-95 transition-all mt-4 inline-flex items-center justify-center gap-2"
            >
              Ver Cardápio <ChevronRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28 font-sans">
      {/* Header Fixo */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-gray-900">Quiosque Teste</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1 font-semibold">
              <MapPin size={14} className="text-[#FF6B00]" /> Barraca {umbrella_id.slice(0,3).toUpperCase()}
            </p>
          </div>
          <button className="bg-red-50 text-red-600 px-4 py-2 rounded-full font-bold text-sm border border-red-100 flex items-center gap-1 shadow-sm active:bg-red-100">
            <UserRound size={16} /> Chamar Garçom
          </button>
        </div>
      </header>

      {/* Roteador Interno */}
      {step === "menu" && (
        <main>
          {/* Categorias */}
          <div className="flex overflow-x-auto p-4 gap-2 hide-scrollbar bg-white">
            {categories.map(c => (
              <button 
                key={c} 
                onClick={() => setActiveCategory(c)}
                className={cn(
                  "px-5 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all shadow-sm border",
                  activeCategory === c ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "bg-gray-50 text-gray-600 border-gray-200"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Produtos */}
          <div className="p-4 space-y-4">
            {products.filter(p => activeCategory === "Todos" || p.category === activeCategory).map(p => {
              const inCart = cart.find(i => i.product.id === p.id);
              const price = p.promotional_price || p.price;
              
              return (
                <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-gray-300">
                    <Utensils size={32} />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight">{p.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                         {p.promotional_price && (
                           <span className="text-xs text-gray-400 line-through block">{formatCurrency(p.price)}</span>
                         )}
                         <span className="font-bold text-[#FF6B00] text-lg leading-none">{formatCurrency(price)}</span>
                      </div>
                      
                      {!inCart ? (
                        <button onClick={() => addToCart(p)} className="bg-[#FF6B00] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm active:scale-95">
                          <Plus size={20} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-full border border-gray-200">
                          <button onClick={() => removeFromCart(p.id)} className="w-6 h-6 flex items-center justify-center text-[#FF6B00]"><Minus size={16}/></button>
                          <span className="font-bold text-sm w-4 text-center">{inCart.quantity}</span>
                          <button onClick={() => addToCart(p)} className="w-6 h-6 flex items-center justify-center text-[#FF6B00]"><Plus size={16}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {step === "cart" && (
        <main className="p-4">
          <h2 className="text-2xl font-display font-bold mb-6 text-gray-900">Seu Pedido</h2>
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
              <p>Seu carrinho está vazio.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="font-bold text-gray-900 min-w-0 pr-2">
                    <span className="text-[#FF6B00]">{item.quantity}x</span> <span className="truncate">{item.product.name}</span>
                  </div>
                  <div className="font-bold text-gray-700 whitespace-nowrap">
                    {formatCurrency((item.product.promotional_price || item.product.price) * item.quantity)}
                  </div>
                </div>
              ))}
              
              <div className="pt-4">
                <textarea 
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Alguma observação? (ex: sem gelo, ponto da carne...)"
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-[#FF6B00] outline-none"
                  rows={2}
                />
              </div>

              <div className="bg-[#F5E1C0]/30 border border-[#F5E1C0] rounded-xl p-4 mt-6">
                 <div className="flex justify-between items-center font-bold text-xl text-gray-900">
                    <span>Total</span>
                    <span>{formatCurrency(cartTotal)}</span>
                 </div>
              </div>

              <button 
                onClick={checkout}
                className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all w-full"
              >
                Confirmar e Pedir
              </button>
            </div>
          )}
        </main>
      )}

      {step === "orders" && (
        <main className="p-4">
           <h2 className="text-2xl font-display font-bold mb-6 text-gray-900">Acompanhamento</h2>
           
           <div className="bg-[#FF6B00] text-white rounded-2xl p-6 shadow-lg mb-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <UtensilsCrossed size={120} />
              </div>
              <p className="text-white/80 font-semibold mb-1 text-sm">TOTAL DA CONTA ACUMULADA</p>
              <p className="text-4xl font-display font-bold mb-2">
                 {formatCurrency(orders.reduce((acc, order) => acc + order.total, 0))}
              </p>
              <p className="text-sm bg-black/20 self-start inline-block px-3 py-1 rounded-full backdrop-blur-sm mt-2">
                Pague ao garçom no encerramento
              </p>
           </div>

           <h3 className="font-bold text-gray-500 uppercase tracking-widest text-xs mb-4">Seus Pedidos Hoje</h3>
           <div className="space-y-4">
             {orders.map((order, i) => (
                <div key={order.id} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
                   <div className="flex justify-between items-center mb-3">
                     <span className="font-bold text-gray-900">Pedido #{order.id}</span>
                     <span className="text-xs bg-[#F5E1C0] text-[#3D1A0A] font-bold px-2 py-1 rounded-md uppercase">
                       {order.status === "received" ? "Recebido" : "Preparando"}
                     </span>
                   </div>
                   <div className="space-y-1">
                     {order.items.map((item: any) => (
                        <div key={item.product.id} className="text-sm text-gray-600 flex justify-between">
                           <span>{item.quantity}x {item.product.name}</span>
                           <span className="font-semibold">{formatCurrency((item.product.promotional_price || item.product.price) * item.quantity)}</span>
                        </div>
                     ))}
                   </div>
                </div>
             ))}
           </div>
        </main>
      )}

      {/* Floating Bottom Nav */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 pb-safe">
        <div className="flex justify-around items-center p-3">
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
