"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Smartphone, Zap, QrCode, TrendingUp, CheckCircle2,
  Camera, Gift, FileText, X, ChevronRight, Menu,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_PLATFORM_PLAN_SETTINGS, formatPlanPriceLabel } from "@/lib/plans";

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regCredentials, setRegCredentials] = useState<{ login: string; emailSent?: boolean } | null>(null);
  const [form, setForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [planSettings, setPlanSettings] = useState(DEFAULT_PLATFORM_PLAN_SETTINGS);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch("/api/public/plans");
        const data = await res.json().catch(() => null);
        if (res.ok && data) setPlanSettings(data);
      } catch {
        // Keep bundled defaults when pricing cannot be loaded.
      }
    }
    loadPlans();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasDocument = form.cpf.replace(/\D/g, "") || form.cnpj.replace(/\D/g, "");
    if (!form.name || !form.owner_name || !form.owner_phone || !form.owner_email || !form.beach_name || !form.city || !form.state || !hasDocument) {
      setRegisterError("Preencha telefone, email, CPF ou CNPJ, nome do quiosque, responsável, praia, cidade e estado.");
      return;
    }
    if (!form.password || form.password.length < 8) {
      setRegisterError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setRegisterError("A senha e a confirmação não conferem.");
      return;
    }
    if (!form.terms_accepted) {
      setRegisterError("Marque que você leu e concorda com os Termos de Uso para concluir o cadastro.");
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
          emailSent: Boolean(data.email_confirmation?.sent),
        });
        setRegSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setRegisterError(data.error || "Não foi possível finalizar o cadastro. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      setRegisterError("Falha de conexão ao criar cadastro. Confira a internet e tente novamente.");
    }
    setLoading(false);
  };

  const openModal = () => {
    setShowModal(true);
    setRegSuccess(false);
    setRegCredentials(null);
    setRegisterError("");
  };

  return (
    <div className="landing-shell relative isolate min-h-screen bg-[#2d1b14] font-sans text-[#fff8f6] overflow-x-hidden">
      <div className="landing-beach-carousel" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-[#2d1b14]/78 backdrop-blur-xl z-50 border-b border-[#ff8a2b]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-3 text-[#FF6B00]">
              <Image src="/sandexpress-logo-fluid.png" alt="SandExpress" width={72} height={69} priority className="h-11 w-auto object-contain sm:h-12" />
              <span className="hidden font-display text-2xl font-black text-[#fff8f6] sm:inline">
                Sand<span className="text-[#ff7a18]">Express</span>
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-7 text-xs font-black text-[#ffe7dc] lg:flex">
            <a href="#como-funciona" className="hover:text-[#ff8a2b]">Como funciona</a>
            <a href="#beneficios" className="hover:text-[#ff8a2b]">Recursos</a>
            <a href="#planos" className="hover:text-[#ff8a2b]">Planos</a>
            <Link href="/vendor/login" className="hover:text-[#ff8a2b]">Entrar</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <button onClick={openModal} className="bg-[#FF6B00] text-white px-4 sm:px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-[#E56000] transition-all active:scale-95 text-xs sm:text-sm whitespace-nowrap">
                Cadastrar grátis
             </button>
             <button
               type="button"
               onClick={() => setMenuOpen(true)}
               className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ff8a2b]/45 bg-[#4b2a1e] text-[#fff8f6] shadow-sm hover:border-[#FF6B00] lg:hidden"
               aria-label="Abrir menu"
             >
               <Menu size={20} />
             </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setMenuOpen(false)}>
          <aside className="ml-auto flex h-full w-[min(84vw,320px)] flex-col bg-[#301107] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#ff6b00]/30 p-5">
              <span className="font-display text-xl font-bold text-[#fff8f6]">Menu</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-full p-2 text-[#f4d6c8] hover:bg-[#451704]" aria-label="Fechar menu">
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-2 p-5 text-sm font-black text-[#f4d6c8]">
              <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#451704] hover:text-[#FF6B00]">Como funciona</a>
              <a href="#beneficios" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#451704] hover:text-[#FF6B00]">Benefícios</a>
              <a href="#planos" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 hover:bg-[#451704] hover:text-[#FF6B00]">Planos</a>
              <Link href="/vendor/login" className="rounded-xl px-4 py-3 hover:bg-[#451704] hover:text-[#FF6B00]">Painel do quiosque</Link>
              <Link href="/admin" className="rounded-xl px-4 py-3 hover:bg-[#451704] hover:text-[#FF6B00]">Admin</Link>
            </nav>
          </aside>
        </div>
      )}

      {/* Hero Section */}
      <section className="landing-hero relative overflow-hidden px-4 pb-12 pt-20 text-white sm:px-6 sm:pb-16 sm:pt-24">
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-[#3a2118] via-[#2d1b14] to-[#3a2118]" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 pt-4 sm:pt-6 lg:min-h-[610px] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl text-left">
          <p className="mb-5 inline-flex rounded-full border border-[#ff8a2b]/35 bg-[#fff2e8]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#ffd8c5]">
            Sistema de pedidos para quiosques de praia
          </p>
          <h1 className="mb-6 font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
            Mais controle.<br />
            Mais lucro.<br />
            <span className="text-[#ff7a18]">Mais eficiência.</span>
          </h1>
          <h2 className="sr-only">
            Tudo o que seu quiosque precisa para vender mais todos os dias.
          </h2>
          <p className="mb-8 max-w-xl font-sans text-lg leading-relaxed text-[#ffe7dc] sm:text-xl">
            Organize pedidos, acompanhe suas vendas em tempo real, evite perdas e agilize o atendimento. Tudo o que seu quiosque precisa para vender mais todos os dias.
          </p>
          <p className="sr-only">
            Elimine filas, reduza erros de pedidos e deixe seus clientes pedirem direto do guarda-sol usando apenas um QR Code.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={openModal} className="bg-[#FF6B00] px-8 py-4 text-base font-black text-white shadow-xl transition-all hover:bg-[#E56000] hover:shadow-2xl active:scale-95 rounded-xl">
              Cadastrar grátis
            </button>
            <a href="#planos" className="inline-flex items-center justify-center rounded-xl border-2 border-[#ff8a2b] px-8 py-4 text-base font-black text-[#fff8f6] hover:bg-[#ff8a2b] hover:text-[#2d1b14]">
              Ver planos
            </a>
          </div>
          <div className="mt-8 hidden gap-3 text-xs font-black text-[#ffe7dc] sm:grid sm:max-w-xl sm:grid-cols-3">
            <span className="rounded-2xl border border-[#ff8a2b]/25 bg-white/8 p-3">3 dias grátis</span>
            <span className="rounded-2xl border border-[#ff8a2b]/25 bg-white/8 p-3">Até {planSettings.max_umbrellas} guarda-sóis</span>
            <span className="rounded-2xl border border-[#ff8a2b]/25 bg-white/8 p-3">Pedidos em tempo real</span>
          </div>
        </div>
          <div className="landing-hero-media relative z-10">
            <Image
              src="/sandexpress-beach-hero.png"
              alt="Tablet com painel SandExpress em uma mesa de quiosque na praia"
              width={1200}
              height={760}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#3a2118] border-y border-[#ff8a2b]/18">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-display font-bold text-white mb-4">Em 4 passos simples</h2>
               <p className="text-xl text-white/85">O fluxo perfeito para o seu cliente pedir sem complicação.</p>
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
                    <div className="w-16 h-16 bg-[#fff0e4] border border-[#ff8a2b]/35 rounded-2xl flex items-center justify-center mx-auto mb-6 mt-2">
                      <step.i size={32} className="text-[#FF6B00]" />
                    </div>
                    <h3 className="font-bold text-xl mb-2">{step.t}</h3>
                    <p className="text-[#f4d6c8] text-sm leading-relaxed">{step.d}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#f9e2cf] text-[#2d1b14]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-[#2d1b14] mb-4">Tudo que você precisa</h2>
            <p className="text-xl text-[#6b3a28]">Funcionalidades pensadas para maximizar suas vendas na praia.</p>
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
              <div key={idx} className="bg-[#fff8f3] p-8 rounded-[32px] border border-[#dfb799] shadow-[0_18px_45px_rgba(93,45,25,0.12)] transition-all hover:shadow-lg hover:border-[#FF6B00] hover:-translate-y-1 group">
                <div className="w-14 h-14 bg-[#ffe6d2] rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#FF6B00] group-hover:text-white transition-all">
                  <b.icon size={28} className="text-[#FF6B00] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-[#2d1b14]">{b.title}</h3>
                <p className="text-[#6b3a28] text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="landing-pricing py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">
           <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#ff6b00]">Planos SandExpress</p>
           <h2 className="text-4xl font-display font-bold text-[#FFF8F6] mb-4">Escolha seu ponto de partida</h2>
           <p className="text-xl text-[#f4d6c8] mb-16">Comece com {planSettings.trial_days} dias grátis. Todos os planos incluem até {planSettings.max_umbrellas} guarda-sóis.</p>
           
           <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto text-left">
              {/* Trial */}
              <div className="landing-plan-card p-7 sm:p-8 rounded-[40px]">
                 <h3 className="text-2xl font-bold mb-2 text-[#fff8f6]">Trial</h3>
                 <p className="text-[#f4d6c8] mb-6 font-semibold">Para conhecer a plataforma</p>
                 <div className="landing-price-row mb-6"><span className="landing-price-value font-display text-[#FF6B00]">R$0</span><span className="landing-price-unit text-[#fff8f6]">/{planSettings.trial_days} dias</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {planSettings.max_umbrellas} guarda-sóis</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Todas as funcionalidades</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Cadastrar grátis</button>
              </div>

              {/* Trimestral */}
              <div className="landing-plan-card landing-plan-card--featured p-7 sm:p-8 rounded-[40px]">
                 <h3 className="text-2xl font-bold mb-2">Trimestral</h3>
                 <p className="mb-6 font-black">Ideal para testar a temporada</p>
                 <div className="landing-price-row mb-6"><span className="landing-price-value font-display text-white">{formatPlanPriceLabel(planSettings.quarterly_price)}</span><span className="landing-price-unit text-[#201411]">/Mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2"><CheckCircle2 className="shrink-0"/> Até {planSettings.max_umbrellas} guarda-sóis</li>
                   <li className="flex gap-2"><CheckCircle2 className="shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2"><CheckCircle2 className="shrink-0"/> Relatórios completos</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold bg-[#451704] text-white hover:bg-[#301107] transition-colors">Cadastrar grátis</button>
              </div>

              {/* Semestral */}
              <div className="landing-plan-card p-7 sm:p-8 rounded-[40px]">
                 <h3 className="text-2xl font-bold mb-2 text-[#fff8f6]">Semestral</h3>
                 <p className="text-[#f4d6c8] mb-6 font-semibold">Para garantir sua temporada</p>
                 <div className="landing-price-row mb-6"><span className="landing-price-value font-display text-[#FF6B00]">{formatPlanPriceLabel(planSettings.semester_price)}</span><span className="landing-price-unit text-[#fff8f6]">/Mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {planSettings.max_umbrellas} guarda-sóis</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Relatórios completos</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 rounded-xl font-bold border-2 border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white transition-colors">Cadastrar grátis</button>
              </div>

              {/* Anual */}
              <div className="landing-plan-card landing-plan-card--dark p-7 sm:p-8 rounded-[40px] text-[#fff8f6] relative scale-105">
                 <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#FF6B00] text-white px-4 py-1 rounded-full text-sm font-bold uppercase">Mais Escolhido</div>
                 <h3 className="text-2xl font-bold mb-2">Anual</h3>
                 <p className="text-[#ff9b50] mb-6 font-semibold">Para quem quer faturar o ano todo</p>
                 <div className="landing-price-row mb-6"><span className="landing-price-value font-display text-[#fff8f6]">{formatPlanPriceLabel(planSettings.annual_monthly_price)}</span><span className="landing-price-unit text-[#fff8f6]">/Mês</span></div>
                 <ul className="space-y-3 mb-8">
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Até {planSettings.max_umbrellas} guarda-sóis</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> Pedidos ilimitados</li>
                   <li className="flex gap-2 text-[#fff8f6]"><CheckCircle2 className="text-[#FF6B00] shrink-0"/> QR codes personalizados</li>
                 </ul>
                 <button onClick={openModal} className="w-full py-4 bg-[#FF6B00] text-white rounded-xl font-bold shadow-md hover:bg-[#d85a00] transition-colors">Cadastrar grátis</button>
              </div>
           </div>
        </div>
      </section>

      {/* CTA Secundário */}
      <section className="bg-gradient-to-r from-[#5d3323] via-[#3a2118] to-[#2d1b14] py-16 sm:py-20 px-4 sm:px-6 text-center text-white">
        <h2 className="text-4xl font-display font-bold mb-6">Pronto para transformar seu atendimento?</h2>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">Comece agora com {planSettings.trial_days} dias grátis. Não precisa cartão de crédito.</p>
        <button onClick={openModal} className="bg-[#FF6B00] text-white px-10 py-5 rounded-full font-bold text-xl shadow-xl hover:bg-[#E56000] active:scale-95 transition-all">
           Cadastrar grátis
        </button>
      </section>

      <footer className="bg-[#231916] py-12 text-center text-[#FFDBCB] text-sm font-semibold border-t border-[#3D1A0A]">
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
                <p className="text-gray-500 mb-6">Seu quiosque foi criado com {planSettings.trial_days} dias grátis. Acesse o painel para configurar seu cardápio.</p>
                {regCredentials && (
                  <div className="mb-6 rounded-xl border border-[#e2bfb0] bg-[#fff8f6] p-4 text-left">
                    <p className="text-sm font-black text-[#572000]">Dados de acesso do quiosque</p>
                    <p className="mt-2 text-sm text-gray-700">Usuário: <strong>{regCredentials.login}</strong></p>
                    <p className="text-sm text-gray-700">Senha: <strong>a senha que você acabou de criar</strong></p>
                    <p className="mt-3 text-sm text-gray-700">
                      {regCredentials.emailSent
                        ? "Enviamos um email confirmando o cadastro."
                        : "Email de confirmação não enviado. Configure RESEND_API_KEY para disparos reais."}
                    </p>
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
                    <h3 className="text-xl font-display font-bold text-gray-900">Teste Grátis {planSettings.trial_days} dias</h3>
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
                      placeholder="você@email.com"
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
                      Li e aceito os{" "}
                      <Link href="/termos-de-uso" target="_blank" className="text-[#FF6B00] underline underline-offset-2">
                        Termos de Uso e a Política de Privacidade do SandExpress
                      </Link>
                      , incluindo o registro do aceite com data e hora e o uso dos dados do cadastro para operação, pedidos, relatórios e suporte.
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
