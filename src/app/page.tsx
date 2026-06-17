"use client";

import { useState } from "react";
import {
  UtensilsCrossed, Smartphone, Zap, QrCode, TrendingUp, CheckCircle2,
  Camera, Gift, FileText, X, ChevronRight, Menu,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PLAN_PRICE_LABELS, PLAN_UMBRELLA_LIMIT, TRIAL_DAYS } from "@/lib/plans";

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regCredentials, setRegCredentials] = useState<{ login: string; emailSent?: boolean; verificationUrl?: string } | null>(null);
  const [form, setForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasDocument = form.cpf.replace(/\D/g, "") || form.cnpj.replace(/\D/g, "");
    if (!form.name || !form.owner_name || !form.owner_phone || !form.owner_email || !form.beach_name || !form.city || !form.state || !hasDocument) {
      setRegisterError("Preencha telefone, email, CPF ou CNPJ, nome do quiosque, responsavel, praia, cidade e estado.");
      return;
    }
    if (!form.password || form.password.length < 8) {
      setRegisterError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setRegisterError("A senha e a confirmacao nao conferem.");
      return;
    }
    if (!form.terms_accepted) {
      setRegisterError("Marque que voce leu e concorda com os Termos de Uso para concluir o cadastro.");
      return;
    }
    setLoading(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setRegCredentials({
          login: data.document_login || form.cnpj || form.cpf || form.owner_phone,
          emailSent: Boolean(data.email_verification?.sent),
          verificationUrl: data.email_verification?.verification_url,
        });
        setRegSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setRegisterError(data.error || "Nao foi possivel finalizar o cadastro. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      setRegisterError("Falha de conexao ao criar cadastro. Confira a internet e tente novamente.");
    }
    setLoading(false);
  };

  const openModal = () => { setShowModal(true); setRegSuccess(false); setRegCredentials(null); setRegisterError(""); };

  return (
    <div className="min-h-screen bg-[#fff8f6] font-sans text-[#261812] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-[#fff8f6]/85 backdrop-blur-md z-50 border-b border-[#e2bfb0]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-3 text-[#FF6B00]">
              <Image src="/sandexpress-logo.svg" alt="SandExpress" width={42} height={42} priority className="drop-shadow-sm" />
              <span className="font-display font-bold text-xl sm:text-2xl text-[#261812]">SandExpress</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <button onClick={openModal} className="bg-[#FF6B00] text-white px-4 sm:px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-[#E56000] transition-all active:scale-95 text-xs sm:text-sm whitespace-nowrap">
                Cadastrar gratis
             </button>
             <button
               type="button"
               onClick={() => setMenuOpen(true)}
               className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e2bfb0] bg-white text-[#572000] shadow-sm hover:border-[#FF6B00]"
               aria-label="Abrir menu"
             >
               <Menu size={20} />
             </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setMenuOpen(false)}>
          <aside className="ml-auto flex h-full w-[min(84vw,320px)] flex-col bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#e2bfb0] p-5">
              <span className="font-display text-xl font-bold text-[#261812]">Menu</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar menu">
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-2 p-5 text-sm font-black text-gray-700">
              <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#fff1eb] hover:text-[#FF6B00]">Como funciona</a>
              <a href="#beneficios" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#fff1eb] hover:text-[#FF6B00]">Beneficios</a>
              <a href="#planos" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#fff1eb] hover:text-[#FF6B00]">Planos</a>
              <Link href="/vendor/login" className="rounded-xl px-4 py-3 hover:bg-[#fff1eb] hover:text-[#FF6B00]">Painel do quiosque</Link>
              <Link href="/admin" className="rounded-xl px-4 py-3 hover:bg-[#fff1eb] hover:text-[#FF6B00]">Admin</Link>
            </nav>
          </aside>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 bg-[#fff1eb] text-center text-[#261812] relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-br from-[#ff6b00] via-[#ffb693] to-[#fff8f6]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/sand.png')] opacity-10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto relative z-10 pt-10 sm:pt-16">
          <Image src="/sandexpress-logo.svg" alt="" width={96} height={96} priority className="mx-auto mb-6 drop-shadow-xl" />
          <span className="bg-white/45 text-[#572000] px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-md uppercase mb-8 inline-block shadow-sm">Para Quiosques e Barracas</span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1]">
            Seu quiosque vendendo mais, sem esforço.
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-[#572000] mb-10 sm:mb-12 max-w-2xl mx-auto font-sans leading-relaxed">
            Elimine filas, reduza erros de pedidos e deixe seus clientes pedirem direto do guarda-sol usando apenas um QR Code.
          </p>
          <div className="flex items-center justify-center">
            <button onClick={openModal} className="w-full sm:w-auto bg-white text-[#FF6B00] px-8 py-4 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all active:scale-95">
              Cadastrar gratis
            </button>
          </div>
        </div>
        
        {/* App Mockup in Hero */}
        <div className="mt-14 sm:mt-20 max-w-3xl mx-auto brand-card rounded-t-[32px] sm:rounded-t-[40px] p-3 sm:p-4 overflow-hidden relative" style={{height: 250}}>
           <div className="w-full h-full bg-[#fff8f6] rounded-[32px] border border-[#e2bfb0] flex items-center justify-center">
              <span className="font-display font-bold text-[#a04100] text-2xl sm:text-3xl">Pedidos por QR</span>
           </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#fff8f6] border-b border-[#e2bfb0]/70">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Em 4 passos simples</h2>
               <p className="text-xl text-gray-500">O fluxo perfeito para o seu cliente pedir sem complicação.</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
               {[
                 { i: QrCode, t: "O cliente escaneia", d: "Ele aponta o celular para o QR Code no guarda-sol." },
                 { i: Smartphone, t: "Abre o Cardápio", d: "Sem baixar nada, vê os produtos com fotos e preços." },
                 { i: UtensilsCrossed, t: "Faz o pedido", d: "Escolhe os itens, observa a conta e envia o pedido." },
                 { i: Zap, t: "Você recebe na hora", d: "O pedido apita direto no seu painel ou celular." },
               ].map((step, idx) => (
                 <div key={idx} className="brand-card p-8 rounded-[40px] text-center relative z-10 transition-transform hover:-translate-y-2">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#FF6B00] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                      {idx + 1}
                    </div>
                    <div className="w-16 h-16 bg-[#ffeae1] rounded-2xl flex items-center justify-center mx-auto mb-6 mt-2">
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
      <section id="beneficios" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Tudo que você precisa</h2>
            <p className="text-xl text-gray-500">Funcionalidades pensadas para maximizar suas vendas na praia.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {[
              { icon: Camera, title: "Cardápio Digital com Fotos", desc: "Seus clientes veem os produtos com fotos profissionais, descrições e preços. Tudo atualizado em tempo real." },
              { icon: Zap, title: "Pedidos em Tempo Real", desc: "Receba pedidos instantaneamente no seu painel. Sem erros, sem anotações. Kanban visual para gerenciar." },
              { icon: QrCode, title: "QR Code por Guarda-Sol", desc: "Cada guarda-sol tem um QR único. Gere, baixe e imprima direto do painel." },
              { icon: FileText, title: "Conta Acumulada", desc: "O cliente pode pedir várias vezes e pagar tudo junto no final. Total acumulado sempre visível." },
              { icon: TrendingUp, title: "Relatórios Completos", desc: "Faturamento, ticket médio, produtos mais vendidos, melhores clientes. Tudo em um clique." },
              { icon: Gift, title: "Promoções e Combos", desc: "Crie combos, preços promocionais e destaque itens especiais para aumentar o ticket médio." },
            ].map((b, idx) => (
              <div key={idx} className="bg-[#fff8f6] p-8 rounded-[40px] border border-[#e2bfb0]/70 transition-all hover:shadow-lg hover:border-[#FF6B00]/30 hover:-translate-y-1 group">
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
      <section id="planos" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#fff1eb]">
        <div className="max-w-5xl mx-auto text-center">
           <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Planos que cabem no seu bolso</h2>
           <p className="text-xl text-gray-500 mb-16">Comece com {TRIAL_DAYS} dias grátis. Todos os planos incluem até {PLAN_UMBRELLA_LIMIT} guarda-sóis.</p>
           
           <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
              {/* Trial */}
              <div className="border border-[#e2bfb0] p-8 rounded-[40px] bg-white">
                 <h3 className="text-2xl font-bold mb-2">Trial</h3>
                 <p className="text-gray-500 mb-6 font-semibold">Para conhecer a plataforma</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold text-gray-900">R$0</span><span className="text-gray-500 font-bold">/{TRIAL_DAYS} dias</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {PLAN_UMBRELLA_LIMIT} guarda-sóis</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Todas as funcionalidades</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Cadastrar gratis</button>
              </div>

              {/* Mensal */}
              <div className="border border-[#e2bfb0] p-8 rounded-[40px] bg-white">
                 <h3 className="text-2xl font-bold mb-2">Mensal</h3>
                 <p className="text-gray-500 mb-6 font-semibold">Ideal para testar a temporada</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold text-gray-900">{PLAN_PRICE_LABELS.monthly}</span><span className="text-gray-500 font-bold">/mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {PLAN_UMBRELLA_LIMIT} guarda-sóis</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-600"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Relatórios completos</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Cadastrar gratis</button>
              </div>

              {/* Anual */}
              <div className="bg-[#3d1a0a] p-8 rounded-[40px] text-white relative shadow-2xl scale-105">
                 <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#FF6B00] text-white px-4 py-1 rounded-full text-sm font-bold uppercase">Mais Escolhido</div>
                 <h3 className="text-2xl font-bold mb-2">Anual</h3>
                 <p className="text-gray-400 mb-6 font-semibold">Para quem quer faturar o ano todo</p>
                 <div className="mb-6"><span className="text-5xl font-display font-bold">{PLAN_PRICE_LABELS.annualMonthly}</span><span className="text-gray-400 font-bold">/mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {PLAN_UMBRELLA_LIMIT} guarda-sóis</li>
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-gray-300"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> QR codes personalizados</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 bg-[#FF6B00] text-white rounded-xl font-bold shadow-md hover:bg-[#E56000] transition-colors">Cadastrar gratis</button>
              </div>
           </div>
        </div>
      </section>

      {/* CTA Secundário */}
      <section className="bg-gradient-to-r from-[#3D1A0A] to-gray-900 py-16 sm:py-20 px-4 sm:px-6 text-center text-white">
        <h2 className="text-4xl font-display font-bold mb-6">Pronto para transformar seu atendimento?</h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">Comece agora com {TRIAL_DAYS} dias grátis. Não precisa cartão de crédito.</p>
        <button onClick={openModal} className="bg-[#FF6B00] text-white px-10 py-5 rounded-full font-bold text-xl shadow-xl hover:bg-[#E56000] active:scale-95 transition-all">
           Cadastrar gratis
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
                <p className="text-gray-500 mb-6">Seu quiosque foi criado com {TRIAL_DAYS} dias grátis. Acesse o painel para configurar seu cardápio.</p>
                {regCredentials && (
                  <div className="mb-6 rounded-xl border border-[#e2bfb0] bg-[#fff8f6] p-4 text-left">
                    <p className="text-sm font-black text-[#572000]">Dados de acesso do quiosque</p>
                    <p className="mt-2 text-sm text-gray-700">Usuario: <strong>{regCredentials.login}</strong></p>
                    <p className="text-sm text-gray-700">Senha: <strong>a senha que voce acabou de criar</strong></p>
                    <p className="mt-3 text-sm text-gray-700">
                      {regCredentials.emailSent
                        ? "Enviamos um email para validar o cadastro."
                        : "Email de validacao nao enviado. Configure RESEND_API_KEY para disparos reais."}
                    </p>
                    {regCredentials.verificationUrl && (
                      <p className="mt-2 break-words text-xs font-bold text-[#FF6B00]">Link local de verificacao: {regCredentials.verificationUrl}</p>
                    )}
                  </div>
                )}
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
                    <h3 className="text-xl font-display font-bold text-gray-900">Teste Grátis {TRIAL_DAYS} dias</h3>
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
                    <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp *</label>
                    <input
                      type="tel" required
                      value={form.owner_phone} onChange={e => setForm(p => ({ ...p, owner_phone: e.target.value.replace(/\D/g, '') }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email de Recuperacao *</label>
                    <input
                      type="email" required
                      value={form.owner_email} onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="voce@email.com"
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
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Praia *</label>
                    <input
                      type="text" required
                      value={form.beach_name} onChange={e => setForm(p => ({ ...p, beach_name: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                      placeholder="Ex: Praia das Pitangueiras"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Cidade</label>
                      <input
                        type="text" required
                        value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="Santos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Estado</label>
                      <input
                        type="text" required maxLength={2}
                        value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value.toUpperCase() }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="SP"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Senha *</label>
                      <input
                        type="password" required minLength={8}
                        value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="Min. 8 caracteres"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar Senha *</label>
                      <input
                        type="password" required minLength={8}
                        value={form.password_confirm} onChange={e => setForm(p => ({ ...p, password_confirm: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-[#FF6B00] outline-none"
                        placeholder="Repita a senha"
                      />
                    </div>
                  </div>
                  <label className="flex gap-3 rounded-xl border border-[#e2bfb0] bg-[#fff8f6] p-4 text-sm font-bold text-gray-700">
                    <input
                      type="checkbox"
                      required
                      checked={form.terms_accepted}
                      onChange={e => setForm(p => ({ ...p, terms_accepted: e.target.checked }))}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#FF6B00]"
                    />
                    <span>
                      Li e concordo com os{" "}
                      <Link href="/termos-de-uso" target="_blank" className="text-[#FF6B00] underline underline-offset-2">
                        Termos de Uso do SandExpress
                      </Link>
                      , incluindo o uso dos dados do cadastro para operacao, pedidos, relatorios e suporte.
                    </span>
                  </label>
                  {registerError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      {registerError}
                    </div>
                  )}

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
