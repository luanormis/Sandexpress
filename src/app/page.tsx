"use client";

import { useState } from "react";
import {
  UtensilsCrossed, Smartphone, Zap, QrCode, TrendingUp, CheckCircle2,
  Camera, Clock, Gift, FileText, X, ChevronRight,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [form, setForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", city: "", state: "",
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.owner_name || !form.owner_phone || !form.owner_email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setRegSuccess(true);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const openModal = () => { setShowModal(true); setRegSuccess(false); };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#FF6B00]">
            <UtensilsCrossed size={32} />
            <span className="font-display font-bold text-2xl tracking-tighter text-gray-900">SandExpress</span>
          </div>
          <div className="hidden md:flex gap-8 font-bold text-sm text-gray-600">
             <a href="#como-funciona" className="hover:text-[#FF6B00] transition-colors">Como funciona</a>
             <a href="#beneficios" className="hover:text-[#FF6B00] transition-colors">Benefícios</a>
             <a href="#planos" className="hover:text-[#FF6B00] transition-colors">Planos</a>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/vendor/login" className="font-bold text-sm text-gray-600 hover:text-gray-900 hidden md:block">Login Lojista</Link>
             <button onClick={openModal} className="bg-[#FF6B00] text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-[#E56000] transition-all active:scale-95 text-sm">
                Teste Grátis 7 dias
             </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-[#FF6B00] to-[#E56000] text-center text-white relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/sand.png')] opacity-10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto relative z-10 pt-16">
          <span className="bg-white/20 text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-widest backdrop-blur-md uppercase mb-8 inline-block shadow-sm">Para Quiosques e Barracas</span>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1]">
            Seu quiosque vendendo mais, sem esforço.
          </h1>
          <p className="text-xl md:text-2xl text-[#F5E1C0] mb-12 max-w-2xl mx-auto font-sans leading-relaxed">
            Elimine filas, reduza erros de pedidos e deixe seus clientes pedirem direto do guarda-sol usando apenas um QR Code.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={openModal} className="w-full sm:w-auto bg-white text-[#FF6B00] px-8 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all active:scale-95">
              Criar minha conta grátis
            </button>
            <a href="#como-funciona" className="w-full sm:w-auto bg-transparent border-2 border-white/30 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition-all">
              Ver demonstração
            </a>
          </div>
        </div>
        
        {/* App Mockup in Hero */}
        <div className="mt-20 max-w-3xl mx-auto bg-white rounded-t-3xl shadow-2xl p-4 overflow-hidden relative" style={{height: 250}}>
           <div className="w-full h-full bg-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center">
              <span className="font-display font-bold text-gray-300 text-3xl">App Preview</span>
           </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-24 px-6 bg-gray-50 border-b border-gray-100">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Em 4 passos simples</h2>
               <p className="text-xl text-gray-500">O fluxo perfeito para o seu cliente pedir sem complicação.</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
               {[
                 { i: QrCode, t: "O cliente escaneia", d: "Ele aponta o celular para o QR Code no guarda-sol." },
                 { i: Smartphone, t: "Abre o Cardápio", d: "Sem baixar nada, vê os produtos com fotos e preços." },
                 { i: UtensilsCrossed, t: "Faz o pedido", d: "Escolhe os itens, observa a conta e envia o pedido." },
                 { i: Zap, t: "Você recebe na hora", d: "O pedido apita direto no seu painel ou celular." },
               ].map((step, idx) => (
                 <div key={idx} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center relative z-10 transition-transform hover:-translate-y-2">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#FF6B00] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                      {idx + 1}
                    </div>
                    <div className="w-16 h-16 bg-[#F5E1C0] rounded-2xl flex items-center justify-center mx-auto mb-6 mt-2">
                      <step.i size={32} className="text-[#FF6B00]" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">{step.t}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{step.d}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Tudo que você precisa</h2>
            <p className="text-xl text-gray-500">Funcionalidades pensadas para maximizar suas vendas na praia.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Camera, title: "Cardápio Digital com Fotos", desc: "Seus clientes veem os produtos com fotos profissionais, descrições e preços. Tudo atualizado em tempo real." },
              { icon: Zap, title: "Pedidos em Tempo Real", desc: "Receba pedidos instantaneamente no seu painel. Sem erros, sem anotações. Kanban visual para gerenciar." },
              { icon: QrCode, title: "QR Code por Guarda-Sol", desc: "Cada guarda-sol tem um QR único. Gere, baixe e imprima direto do painel." },
              { icon: FileText, title: "Conta Acumulada", desc: "O cliente pode pedir várias vezes e pagar tudo junto no final. Total acumulado sempre visível." },
              { icon: TrendingUp, title: "Relatórios Completos", desc: "Faturamento, ticket médio, produtos mais vendidos, melhores clientes. Tudo em um clique." },
              { icon: Gift, title: "Promoções e Combos", desc: "Crie combos, preços promocionais e destaque itens especiais para aumentar o ticket médio." },
            ].map((b, idx) => (
              <div key={idx} className="bg-gray-50 p-8 rounded-3xl border border-gray-100 transition-all hover:shadow-lg hover:border-[#FF6B00]/20 hover:-translate-y-1 group">
                <div className="w-14 h-14 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#FF6B00] group-hover:text-white transition-all">
                  <b.icon size={28} className="text-[#FF6B00] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{b.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
           <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Planos que cabem no seu bolso</h2>
           <p className="text-xl text-gray-500 mb-16">Comece com 7 dias grátis. Sem surpresas.</p>
           
           <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              {/* Trial */}
              <div className="border border-gray-200 p-8 rounded-3xl bg-white">
                 <h3 className="text-2xl font-bold mb-2">Trial</h3>
                 <p className="text-gray-500 mb-6 font-semibold">Para conhecer a plataforma</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold text-gray-900">R$0</span><span className="text-gray-500 font-bold">/7 dias</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até 5 guarda-sóis</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Todas as funcionalidades</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Começar Grátis</button>
              </div>

              {/* Mensal */}
              <div className="border border-gray-200 p-8 rounded-3xl bg-white">
                 <h3 className="text-2xl font-bold mb-2">Mensal</h3>
                 <p className="text-gray-500 mb-6 font-semibold">Ideal para testar a temporada</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold text-gray-900">R$149</span><span className="text-gray-500 font-bold">/mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até 50 guarda-sóis</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Relatórios completos</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Assinar Mensal</button>
              </div>

              {/* Anual */}
              <div className="bg-gray-900 p-8 rounded-3xl text-white relative shadow-2xl scale-105">
                 <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#FF6B00] text-white px-4 py-1 rounded-full text-sm font-bold uppercase">Mais Escolhido</div>
                 <h3 className="text-2xl font-bold mb-2">Anual</h3>
                 <p className="text-gray-400 mb-6 font-semibold">Para quem quer faturar o ano todo</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold">R$99</span><span className="text-gray-400 font-bold">/mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até 100 guarda-sóis</li>
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> QR codes personalizados</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 bg-[#FF6B00] text-white rounded-xl font-bold shadow-md hover:bg-[#E56000] transition-colors">Assinar Anual</button>
              </div>
           </div>
        </div>
      </section>

      {/* CTA Secundário */}
      <section className="bg-gradient-to-r from-[#3D1A0A] to-gray-900 py-20 px-6 text-center text-white">
        <h2 className="text-4xl font-display font-bold mb-6">Pronto para transformar seu atendimento?</h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">Comece agora com 7 dias grátis. Não precisa cartão de crédito.</p>
        <button onClick={openModal} className="bg-[#FF6B00] text-white px-10 py-5 rounded-full font-bold text-xl shadow-xl hover:bg-[#E56000] active:scale-95 transition-all">
           Seja nosso cliente
        </button>
      </section>

      <footer className="bg-gray-50 py-12 text-center text-gray-500 text-sm font-semibold border-t border-gray-200">
         <p>© {new Date().getFullYear()} SandExpress. Todos os direitos reservados.</p>
      </footer>

      {/* ========== MODAL DE CADASTRO ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {regSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-2">Cadastro realizado!</h3>
                <p className="text-gray-500 mb-6">Seu quiosque foi criado com 7 dias grátis. Acesse o painel para configurar seu cardápio.</p>
                <Link
                  href="/vendor/login"
                  className="inline-flex items-center gap-2 bg-[#FF6B00] text-white px-8 py-4 rounded-full font-bold text-lg shadow-md hover:bg-[#E56000] active:scale-95 transition-all"
                >
                  Acessar Painel <ChevronRight size={20} />
                </Link>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                  <div>
                    <h3 className="text-xl font-display font-bold text-gray-900">Teste Grátis 7 dias</h3>
                    <p className="text-sm text-gray-500">Sem cartão de crédito</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <form onSubmit={handleRegister} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Responsável *</label>
                    <input
                      type="text" required
                      value={form.owner_name} onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email *</label>
                    <input
                      type="email" required
                      value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp *</label>
                    <input
                      type="tel" required
                      value={form.owner_phone} onChange={e => setForm(p => ({ ...p, owner_phone: e.target.value.replace(/\D/g, '') }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Quiosque *</label>
                    <input
                      type="text" required
                      value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="Ex: Quiosque do Sol"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">CPF</label>
                      <input
                        type="text"
                        value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">CNPJ</label>
                      <input
                        type="text"
                        value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="Santos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Estado</label>
                      <input
                        type="text" maxLength={2}
                        value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="SP"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all hover:bg-[#E56000] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Criar Conta Grátis <ChevronRight size={20} /></>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
