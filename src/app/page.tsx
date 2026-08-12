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
  const [regCredentials, setRegCredentials] = useState<{ login: string; emailSent?: boolean; verificationUrl?: string } | null>(null);
  const [form, setForm] = useState({
    name: "", owner_name: "", owner_phone: "", owner_email: "", cpf: "", cnpj: "", beach_name: "", city: "", state: "", password: "", password_confirm: "", terms_accepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
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
    if (!otpVerified || !otpChallengeId) {
      setRegisterError("Valide o WhatsApp do responsavel antes de concluir o cadastro.");
      return;
    }
    setLoading(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, otp_challenge_id: otpChallengeId }),
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

  const sendRegisterOtp = async () => {
    if (!form.owner_phone || form.owner_phone.replace(/\D/g, "").length < 10) {
      setRegisterError("Informe um WhatsApp valido para enviar o codigo.");
      return;
    }
    setLoading(true);
    setRegisterError("");
    setOtpMessage("");
    setOtpVerified(false);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.owner_phone,
          purpose: "vendor_register",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterError(data.error || "Nao foi possivel enviar o codigo.");
        return;
      }
      setOtpChallengeId(data.challenge_id || "");
      setOtpMessage("Codigo enviado pelo WhatsApp.");
    } catch {
      setRegisterError("Erro de rede ao enviar codigo.");
    } finally {
      setLoading(false);
    }
  };

  const verifyRegisterOtp = async () => {
    if (!otpChallengeId || otpCode.replace(/\D/g, "").length !== 6) {
      setRegisterError("Informe o codigo de 6 digitos recebido no WhatsApp.");
      return;
    }
    setLoading(true);
    setRegisterError("");
    setOtpMessage("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge_id: otpChallengeId,
          code: otpCode.replace(/\D/g, ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegisterError(data.error || "Codigo invalido.");
        return;
      }
      setOtpVerified(true);
      setOtpMessage("WhatsApp validado.");
    } catch {
      setRegisterError("Erro de rede ao validar codigo.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setShowModal(true);
    setRegSuccess(false);
    setRegCredentials(null);
    setRegisterError("");
    setOtpCode("");
    setOtpChallengeId("");
    setOtpVerified(false);
    setOtpMessage("");
  };

  return (
    <div className="min-h-screen bg-[#fff8f6] font-sans text-[#261812] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full bg-[#fff8f6]/85 backdrop-blur-md z-50 border-b border-[#e2bfb0]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-3 text-[#FF6B00]">
              <Image src="/logo-sandexpress.png" alt="SandExpress" width={104} height={59} priority className="h-12 w-auto object-contain sm:h-14" />
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
          <Image src="/logo-sandexpress.png" alt="" width={220} height={124} priority className="mx-auto mb-6 h-28 w-auto object-contain sm:h-36" />
          <span className="bg-white/45 text-[#572000] px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-md uppercase mb-8 inline-block shadow-sm">Para Quiosques e Barracas</span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-[1.1]">
            Seu quiosque vendendo mais, sem esfor√ßo.
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
        
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="py-16 sm:py-24 px-4 sm:px-6 bg-[#fff8f6] border-b border-[#e2bfb0]/70">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Em 4 passos simples</h2>
               <p className="text-xl text-gray-500">O fluxo perfeito para o seu cliente pedir sem complica√ß√£o.</p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
               {[
                 { i: QrCode, t: "O cliente escaneia", d: "Ele aponta o celular para o QR Code no guarda-sol." },
                 { i: Smartphone, t: "Abre o Card√°pio", d: "Sem baixar nada, v√™ os produtos com fotos e pre√ßos." },
                 { i: UtensilsCrossed, t: "Faz o pedido", d: "Escolhe os itens, observa a conta e envia o pedido." },
                 { i: Zap, t: "Voc√™ recebe na hora", d: "O pedido apita direto no seu painel ou celular." },
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

      {/* Benef√≠cios */}
      <section id="beneficios" className="py-16 sm:py-24 px-4 sm:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-gray-900 mb-4">Tudo que voc√™ precisa</h2>
            <p className="text-xl text-gray-500">Funcionalidades pensadas para maximizar suas vendas na praia.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {[
              { icon: Camera, title: "Card√°pio Digital com Fotos", desc: "Seus clientes veem os produtos com fotos profissionais, descri√ß√µes e pre√ßos. Tudo atualizado em tempo real." },
              { icon: Zap, title: "Pedidos em Tempo Real", desc: "Receba pedidos instantaneamente no seu painel. Sem erros, sem anota√ß√µes. Kanban visual para gerenciar." },
              { icon: QrCode, title: "QR Code por Guarda-Sol", desc: "Cada guarda-sol tem um QR √∫nico. Gere, baixe e imprima direto do painel." },
              { icon: FileText, title: "Conta Acumulada", desc: "O cliente pode pedir v√°rias vezes e pagar tudo junto no final. Total acumulado sempre vis√≠vel." },
              { icon: TrendingUp, title: "Relat√≥rios Completos", desc: "Faturamento, ticket m√©dio, produtos mais vendidos, melhores clientes. Tudo em um clique." },
              { icon: Gift, title: "Promo√ß√µes e Combos", desc: "Crie combos, pre√ßos promocionais e destaque itens especiais para aumentar o ticket m√©dio." },
            ].map((b, idx) => (
              <div key={idx} className="bg-[#fff8f6] p-8 rounded-[40px] border border-[#e2bfb0]/70 transition-all hover:shadow-lg hover:border-[#FF6B00]/30 hover:-translate-y-1 group">
                <div className="w-14 h-14 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#FF6B00] group-hover:text-white transition-all">
                  <b.icon size={28} className="text-[#FF6B00] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{b.title}</h3>
                <p className="◊oz∂âûÀk∫wµÁx4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ’∞Åç±ÖÕÕ9ÖµîÙâÕ¡Öçîµ‰¥ÃÅµà¥‡à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±§Åç±ÖÕÕ9ÖµîÙâô±ï‡ÅùÖ¿¥»Å—ï·–µù…Ö‰¥Ã¿¿à¯Ò°ïç≠•…ç±î»Åç±ÖÕÕ9ÖµîÙâ—ï·–µlçŸ¿¡tÅÕ°…•π¨¥¿àº¯Å”§ÅÌ¡±ÖπMï——•πùÃπµÖ·}’µâ…ï±±ÖÕÙÅù’Ö…ëÑµœÕ•ÃΩ±§¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±§Åç±ÖÕÕ9ÖµîÙâô±ï‡ÅùÖ¿¥»Å—ï·–µù…Ö‰¥Ã¿¿à¯Ò°ïç≠•…ç±î»Åç±ÖÕÕ9ÖµîÙâ—ï·–µlçŸ¿¡tÅÕ°…•π¨¥¿àº¯ÅAïë•ëΩÃÅ•±•µ•—ÖëΩÃΩ±§¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±§Åç±ÖÕÕ9ÖµîÙâô±ï‡ÅùÖ¿¥»Å—ï·–µù…Ö‰¥Ã¿¿à¯Ò°ïç≠•…ç±î»Åç±ÖÕÕ9ÖµîÙâ—ï·–µlçŸ¿¡tÅÕ°…•π¨¥¿àº¯ÅEHÅçΩëïÃÅ¡ï…ÕΩπÖ±•ÈÖëΩÃΩ±§¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ’∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏ÅΩπ±•ç¨ıÌΩ¡ïπ5ΩëÖ±ÙÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞Å¡‰¥–ÅâúµlçŸ¿¡tÅ—ï·–µ›°•—îÅ…Ω’πëïêµ·∞ÅôΩπ–µâΩ±êÅÕ°ÖëΩ‹µµêÅ°ΩŸï»Èâúµlç‘ÿ¿¿¡tÅ—…ÖπÕ•—•Ω∏µçΩ±Ω…Ãà˘ÖëÖÕ—…Ö»Åù…Ö—•ÃΩâ’——Ω∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄΩÕïç—•Ω∏¯4(4(ÄÄÄÄÄÅÏº®ÅQÅMïç’πìÖ…•ºÄ®ΩÙ4(ÄÄÄÄÄÄÒÕïç—•Ω∏Åç±ÖÕÕ9ÖµîÙââúµù…Öë•ïπ–µ—ºµ»Åô…Ω¥µlåÕ≈¡tÅ—ºµù…Ö‰¥‰¿¿Å¡‰¥ƒÿÅÕ¥È¡‰¥»¿Å¡‡¥–ÅÕ¥È¡‡¥ÿÅ—ï·–µçïπ—ï»Å—ï·–µ›°•—îà¯4(ÄÄÄÄÄÄÄÄÒ†»Åç±ÖÕÕ9ÖµîÙâ—ï·–¥—·∞ÅôΩπ–µë•Õ¡±Ö‰ÅôΩπ–µâΩ±êÅµà¥ÿà˘A…Ωπ—ºÅ¡Ö…ÑÅ—…ÖπÕôΩ…µÖ»ÅÕï‘ÅÖ—ïπë•µïπ—º¸Ω†»¯4(ÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ—ï·–µ·∞Å—ï·–µù…Ö‰¥–¿¿Åµà¥ƒ¿ÅµÖ‡µ‹¥…·∞Åµ‡µÖ’—ºà˘ΩµïçîÅÖùΩ…ÑÅçΩ¥ÅÌ¡±ÖπMï——•πùÃπ—…•Ö±}ëÖÂÕÙÅë•ÖÃÅùÀÖ—•Ã∏Å;çºÅ¡…ïç•ÕÑÅçÖ…”çºÅëîÅçÀ•ë•—º∏Ω¿¯4(ÄÄÄÄÄÄÄÄÒâ’——Ω∏ÅΩπ±•ç¨ıÌΩ¡ïπ5ΩëÖ±ÙÅç±ÖÕÕ9ÖµîÙââúµlçŸ¿¡tÅ—ï·–µ›°•—îÅ¡‡¥ƒ¿Å¡‰¥‘Å…Ω’πëïêµô’±∞ÅôΩπ–µâΩ±êÅ—ï·–µ·∞ÅÕ°ÖëΩ‹µ·∞Å°ΩŸï»Èâúµlç‘ÿ¿¿¡tÅÖç—•ŸîÈÕçÖ±î¥‰‘Å—…ÖπÕ•—•Ω∏µÖ±∞à¯4(ÄÄÄÄÄÄÄÄÄÄÅÖëÖÕ—…Ö»Åù…Ö—•Ã4(ÄÄÄÄÄÄÄÄΩâ’——Ω∏¯4(ÄÄÄÄÄÄΩÕïç—•Ω∏¯4(4(ÄÄÄÄÄÄÒôΩΩ—ï»Åç±ÖÕÕ9ÖµîÙââúµù…Ö‰¥‘¿Å¡‰¥ƒ»Å—ï·–µçïπ—ï»Å—ï·–µù…Ö‰¥‘¿¿Å—ï·–µÕ¥ÅôΩπ–µÕïµ•âΩ±êÅâΩ…ëï»µ–ÅâΩ…ëï»µù…Ö‰¥»¿¿à¯4(ÄÄÄÄÄÄÄÄÄÒ¿˚
§ÅÌπï‹ÅÖ—î†§πùï—’±±eïÖ»†•ÙÅMÖπë·¡…ïÕÃ∏ÅQΩëΩÃÅΩÃÅë•…ï•—ΩÃÅ…ïÕï…ŸÖëΩÃ∏Ω¿¯4(ÄÄÄÄÄÄΩôΩΩ—ï»¯4(4(ÄÄÄÄÄÅÏº®ÄÙÙÙÙÙÙÙÙÙÙÅ5=0ÅÅMQI<ÄÙÙÙÙÙÙÙÙÙÙÄ®ΩÙ4(ÄÄÄÄÄÅÌÕ°Ω›5ΩëÖ∞ÄòòÄ†4(ÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâô•·ïêÅ•πÕï–¥¿Åâúµâ±Öç¨º‘¿ÅËµlƒ¿¡tÅô±ï‡Å•—ïµÃµçïπ—ï»Å©’Õ—•ô‰µçïπ—ï»Å¿¥–àÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—M°Ω›5ΩëÖ∞°ôÖ±Õî•Ù¯4(ÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙââúµ›°•—îÅ…Ω’πëïê¥…·∞ÅµÖ‡µ‹µµêÅ‹µô’±∞ÅµÖ‡µ†µl‰¡Ÿ°tÅΩŸï…ô±Ω‹µ‰µÖ’—ºÅÕ°ÖëΩ‹¥…·∞àÅΩπ±•ç¨ıÌîÄÙ¯ÅîπÕ—Ω¡A…Ω¡ÖùÖ—•Ω∏†•Ù¯4(ÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïùM’ççïÕÃÄ¸Ä†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ¿¥‡Å—ï·–µçïπ—ï»à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ‹¥ƒÿÅ†¥ƒÿÅâúµù…ïï∏¥ƒ¿¿Å…Ω’πëïêµô’±∞Åô±ï‡Å•—ïµÃµçïπ—ï»Å©’Õ—•ô‰µçïπ—ï»Åµ‡µÖ’—ºÅµà¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ°ïç≠•…ç±î»ÅÕ•ÈîıÏÃ…ÙÅç±ÖÕÕ9ÖµîÙâ—ï·–µù…ïï∏¥ÿ¿¿àÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ†ÃÅç±ÖÕÕ9ÖµîÙâ—ï·–¥…·∞ÅôΩπ–µë•Õ¡±Ö‰ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‰¿¿Åµà¥»à˘ÖëÖÕ—…ºÅ…ïÖ±•ÈÖëºÑΩ†Ã¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ—ï·–µù…Ö‰¥‘¿¿Åµà¥ÿà˘Mï‘Å≈’•ΩÕ≈’îÅôΩ§Åç…•ÖëºÅçΩ¥ÅÌ¡±ÖπMï——•πùÃπ—…•Ö±}ëÖÂÕÙÅë•ÖÃÅùÀÖ—•Ã∏ÅçïÕÕîÅºÅ¡Ö•πï∞Å¡Ö…ÑÅçΩπô•ù’…Ö»ÅÕï‘ÅçÖ…ìÖ¡•º∏Ω¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïù…ïëïπ—•Ö±ÃÄòòÄ†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâµà¥ÿÅ…Ω’πëïêµ·∞ÅâΩ…ëï»ÅâΩ…ëï»µlçî…âôà¡tÅâúµlçôôò·òŸtÅ¿¥–Å—ï·–µ±ïô–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ—ï·–µÕ¥ÅôΩπ–µâ±Öç¨Å—ï·–µlå‘‹»¿¿¡tà˘ÖëΩÃÅëîÅÖçïÕÕºÅëºÅ≈’•ΩÕ≈’îΩ¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâµ–¥»Å—ï·–µÕ¥Å—ï·–µù…Ö‰¥‹¿¿à˘UÕ’Ö…•ºËÄÒÕ—…Ωπú˘Ì…ïù…ïëïπ—•Ö±Ãπ±Ωù•πÙΩÕ—…Ωπú¯Ω¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ—ï·–µÕ¥Å—ï·–µù…Ö‰¥‹¿¿à˘Mïπ°ÑËÄÒÕ—…Ωπú˘ÑÅÕïπ°ÑÅ≈’îÅŸΩçîÅÖçÖâΩ‘ÅëîÅç…•Ö»ΩÕ—…Ωπú¯Ω¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâµ–¥ÃÅ—ï·–µÕ¥Å—ï·–µù…Ö‰¥‹¿¿à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïù…ïëïπ—•Ö±ÃπïµÖ•±Mïπ–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¸ÄâπŸ•ÖµΩÃÅ’¥ÅïµÖ•∞Å¡Ö…ÑÅŸÖ±•ëÖ»ÅºÅçÖëÖÕ—…º∏à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄËÄâµÖ•∞ÅëîÅŸÖ±•ëÖçÖºÅπÖºÅïπŸ•Öëº∏ÅΩπô•ù’…îÅIM9}A%}-dÅ¡Ö…ÑÅë•Õ¡Ö…ΩÃÅ…ïÖ•Ã∏âÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïù…ïëïπ—•Ö±ÃπŸï…•ô•çÖ—•ΩπU…∞ÄòòÄ†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâµ–¥»Åâ…ïÖ¨µ›Ω…ëÃÅ—ï·–µ·ÃÅôΩπ–µâΩ±êÅ—ï·–µlçŸ¿¡tà˘1•π¨Å±ΩçÖ∞ÅëîÅŸï…•ô•çÖçÖºËÅÌ…ïù…ïëïπ—•Ö±ÃπŸï…•ô•çÖ—•ΩπU…±ÙΩ¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ1•π¨4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ°…ïòÙàΩŸïπëΩ»Ω±Ωù•∏à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ•π±•πîµô±ï‡Å•—ïµÃµçïπ—ï»ÅùÖ¿¥»ÅâúµlçŸ¿¡tÅ—ï·–µ›°•—îÅ¡‡¥‡Å¡‰¥–Å…Ω’πëïêµô’±∞ÅôΩπ–µâΩ±êÅ—ï·–µ±úÅÕ°ÖëΩ‹µµêÅ°ΩŸï»Èâúµlç‘ÿ¿¿¡tÅÖç—•ŸîÈÕçÖ±î¥‰‘Å—…ÖπÕ•—•Ω∏µÖ±∞à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅçïÕÕÖ»ÅAÖ•πï∞ÄÒ°ïŸ…ΩπI•ù°–ÅÕ•ÈîıÏ»¡ÙÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ1•π¨¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄ§ÄËÄ†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâô±ï‡Å©’Õ—•ô‰µâï—›ïï∏Å•—ïµÃµçïπ—ï»Å¿¥ÿÅâΩ…ëï»µàÅâΩ…ëï»µù…Ö‰¥ƒ¿¿à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ†ÃÅç±ÖÕÕ9ÖµîÙâ—ï·–µ·∞ÅôΩπ–µë•Õ¡±Ö‰ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‰¿¿à˘QïÕ—îÅÀÖ—•ÃÅÌ¡±ÖπMï——•πùÃπ—…•Ö±}ëÖÂÕÙÅë•ÖÃΩ†Ã¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ¿Åç±ÖÕÕ9ÖµîÙâ—ï·–µÕ¥Å—ï·–µù…Ö‰¥‘¿¿à˘Mï¥ÅçÖ…”çºÅëîÅçÀ•ë•—ºΩ¿¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏ÅΩπ±•ç¨ıÏ†§ÄÙ¯ÅÕï—M°Ω›5ΩëÖ∞°ôÖ±Õî•ÙÅç±ÖÕÕ9ÖµîÙâ—ï·–µù…Ö‰¥–¿¿Å°ΩŸï»È—ï·–µù…Ö‰¥ÿ¿¿à¯Ò`ÅÕ•ÈîıÏ»—ÙÄº¯Ωâ’——Ω∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒôΩ…¥ÅΩπM’âµ•–ıÌ°Öπë±ïIïù•Õ—ï…ÙÅç±ÖÕÕ9ÖµîÙâ¿¥ÿÅÕ¡Öçîµ‰¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘9ΩµîÅëºÅIïÕ¡ΩπœÖŸï∞Ä®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πΩ›πï…}πÖµïÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅΩ›πï…}πÖµîËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâMï‘ÅπΩµîÅçΩµ¡±ï—ºà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘]°Ö—Õ¡¿Ä®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï∞àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πΩ›πï…}¡°ΩπïÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÏ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅΩ›πï…}¡°ΩπîËÅîπ—Ö…ùï–πŸÖ±’îπ…ï¡±Öçî†ΩqΩú∞Äúú§ÅÙ§§Ï4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÕï—=—¡°Ö±±ïπùï%ê†àà§Ï4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÕï—=—¡Yï…•ô•ïê°ôÖ±Õî§Ï4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÕï—=—¡5ïÕÕÖùî†àà§Ï4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅıÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùà†ƒƒ§Ä‰‰‰‰‰¥‰‰‰‰à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ…Ω’πëïêµ·∞ÅâΩ…ëï»ÅâΩ…ëï»µlçî…âôà¡tÅâúµlçôôò·òŸtÅ¿¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥»à˘YÖ±•ëÖçÖºÅ]°Ö—Õ¡¿Ä®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâù…•êÅù…•êµçΩ±Ã¥ƒÅÕ¥Èù…•êµçΩ±Ãµl≈ô…}Ö’—ΩtÅùÖ¿¥»à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ•π¡’—5ΩëîÙâπ’µï…•åà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌΩ—¡ΩëïÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—=—¡Ωëî°îπ—Ö…ùï–πŸÖ±’îπ…ï¡±Öçî†ΩqΩú∞Äúú§πÕ±•çî†¿∞Äÿ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîÅâúµ›°•—îà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâΩë•ùºÅëîÄÿÅë•ù•—ΩÃà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙââ’——Ω∏à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅë•ÕÖâ±ïêıÌ±ΩÖë•πùÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ±•ç¨ıÌÕïπëIïù•Õ—ï…=—¡Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ…Ω’πëïêµ·∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µlçŸ¿¡tÅ¡‡¥–Å¡‰¥ÃÅ—ï·–µÕ¥ÅôΩπ–µâ±Öç¨Å—ï·–µlçŸ¿¡tÅë•ÕÖâ±ïêÈΩ¡Öç•—‰¥‘¿à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅπŸ•Ö»4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩâ’——Ω∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙââ’——Ω∏à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅë•ÕÖâ±ïêıÌ±ΩÖë•πúÅÒÄÖΩ—¡°Ö±±ïπùï%ëÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ±•ç¨ıÌŸï…•ôÂIïù•Õ—ï…=—¡Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâµ–¥»Å‹µô’±∞Å…Ω’πëïêµ·∞ÅâúµlåÕê≈Ñ¡ÖtÅ¡‡¥–Å¡‰¥ÃÅ—ï·–µÕ¥ÅôΩπ–µâ±Öç¨Å—ï·–µ›°•—îÅë•ÕÖâ±ïêÈΩ¡Öç•—‰¥‘¿à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌΩ—¡Yï…•ô•ïêÄ¸Äâ]°Ö—Õ¡¿ÅŸÖ±•ëÖëºàÄËÄâYÖ±•ëÖ»ÅçΩë•ùºâÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩâ’——Ω∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌΩ—¡5ïÕÕÖùîÄòòÄÒ¿Åç±ÖÕÕ9ÖµîÙâµ–¥»Å—ï·–µ·ÃÅôΩπ–µâΩ±êÅ—ï·–µlå‘‹»¿¿¡tà˘ÌΩ—¡5ïÕÕÖùïÙΩ¿˘Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘µÖ•∞ÅëîÅIïç’¡ï…ÖçÖºÄ®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâïµÖ•∞àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πΩ›πï…}ïµÖ•±ÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅΩ›πï…}ïµÖ•∞ËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâŸΩçïïµÖ•∞πçΩ¥à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘9ΩµîÅëºÅE’•ΩÕ≈’îÄ®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥ππÖµïÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅπÖµîËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùâ‡ËÅE’•ΩÕ≈’îÅëºÅMΩ∞à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘A…Ö•ÑÄ®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πâïÖç°}πÖµïÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅâïÖç°}πÖµîËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùâ‡ËÅA…Ö•ÑÅëÖÃÅA•—Öπù’ï•…ÖÃà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâù…•êÅù…•êµçΩ±Ã¥ƒÅÕ¥Èù…•êµçΩ±Ã¥»ÅùÖ¿¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘AΩ±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πç¡ôÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Åç¡òËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùà¿¿¿∏¿¿¿∏¿¿¿¥¿¿à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘9A(Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πçπ¡©ÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Åçπ¡®ËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùà¿¿∏¿¿¿∏¿¿¿º¿¿¿ƒ¥¿¿à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâù…•êÅù…•êµçΩ±Ã¥ƒÅÕ¥Èù…•êµçΩ±Ã¥»ÅùÖ¿¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘•ëÖëîΩ±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–àÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πç•—ÂÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Åç•—‰ËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâMÖπ—ΩÃà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘Õ—ÖëºΩ±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ—ï·–àÅ…ï≈’•…ïêÅµÖ·1ïπù—†ıÏ…Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥πÕ—Ö—ïÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞ÅÕ—Ö—îËÅîπ—Ö…ùï–πŸÖ±’îπ—ΩU¡¡ï…ÖÕî†§ÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâM@à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâù…•êÅù…•êµçΩ±Ã¥ƒÅÕ¥Èù…•êµçΩ±Ã¥»ÅùÖ¿¥–à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘Mïπ°ÑÄ®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ¡ÖÕÕ›Ω…êàÅ…ï≈’•…ïêÅµ•π1ïπù—†ıÏ·Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥π¡ÖÕÕ›Ω…ëÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Å¡ÖÕÕ›Ω…êËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»Ùâ5•∏∏Ä‡ÅçÖ…Öç—ï…ïÃà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙââ±Ωç¨Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿Åµà¥ƒà˘Ωπô•…µÖ»ÅMïπ°ÑÄ®Ω±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâ¡ÖÕÕ›Ω…êàÅ…ï≈’•…ïêÅµ•π1ïπù—†ıÏ·Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅŸÖ±’îıÌôΩ…¥π¡ÖÕÕ›Ω…ë}çΩπô•…µÙÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Å¡ÖÕÕ›Ω…ë}çΩπô•…¥ËÅîπ—Ö…ùï–πŸÖ±’îÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâΩ…ëï»¥»ÅâΩ…ëï»µù…Ö‰¥»¿¿Å…Ω’πëïêµ·∞Å¿¥ÃÅôΩç’ÃÈâΩ…ëï»µlçŸ¿¡tÅΩ’—±•πîµπΩπîà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ¡±Öçï°Ω±ëï»ÙâIï¡•—ÑÅÑÅÕïπ°Ñà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ±Öâï∞Åç±ÖÕÕ9ÖµîÙâô±ï‡ÅùÖ¿¥ÃÅ…Ω’πëïêµ·∞ÅâΩ…ëï»ÅâΩ…ëï»µlçî…âôà¡tÅâúµlçôôò·òŸtÅ¿¥–Å—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µù…Ö‰¥‹¿¿à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ•π¡’–4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâç°ïç≠âΩ‡à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ…ï≈’•…ïê4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç°ïç≠ïêıÌôΩ…¥π—ï…µÕ}Öççï¡—ïëÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅΩπ°ÖπùîıÌîÄÙ¯ÅÕï—Ω…¥°¿ÄÙ¯Ä°ÏÄ∏∏π¿∞Å—ï…µÕ}Öççï¡—ïêËÅîπ—Ö…ùï–πç°ïç≠ïêÅÙ§•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâµ–¥ƒÅ†¥–Å‹¥–ÅÕ°…•π¨¥¿ÅÖççïπ–µlçŸ¿¡tà4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒÕ¡Ö∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ1§ÅîÅÖçï•—ºÅΩÕÏàÄâÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒ1•π¨Å°…ïòÙàΩ—ï…µΩÃµëîµ’ÕºàÅ—Ö…ùï–Ùâ}â±Öπ¨àÅç±ÖÕÕ9ÖµîÙâ—ï·–µlçŸ¿¡tÅ’πëï…±•πîÅ’πëï…±•πîµΩôôÕï–¥»à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅQï…µΩÃÅëîÅUÕºÅîÅÑÅAΩ±•—•çÑÅëîÅA…•ŸÖç•ëÖëîÅëºÅMÖπë·¡…ïÕÃ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ1•π¨¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ∞Å•πç±’•πëºÅºÅ…ïù•Õ—…ºÅëºÅÖçï•—îÅçΩ¥ÅëÖ—ÑÅîÅ°Ω…ÑÅîÅºÅ’ÕºÅëΩÃÅëÖëΩÃÅëºÅçÖëÖÕ—…ºÅ¡Ö…ÑÅΩ¡ï…ÖçÖº∞Å¡ïë•ëΩÃ∞Å…ï±Ö—Ω…•ΩÃÅîÅÕ’¡Ω…—î∏4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩÕ¡Ö∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩ±Öâï∞¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïù•Õ—ï………Ω»ÄòòÄ†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ…Ω’πëïêµ·∞ÅâΩ…ëï»ÅâΩ…ëï»µ…ïê¥»¿¿Åâúµ…ïê¥‘¿Å¡‡¥–Å¡‰¥ÃÅ—ï·–µÕ¥ÅôΩπ–µâΩ±êÅ—ï·–µ…ïê¥‹¿¿à¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ…ïù•Õ—ï………Ω…Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ•Ù4(4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒâ’——Ω∏4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅ—Â¡îÙâÕ’âµ•–à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅë•ÕÖâ±ïêıÌ±ΩÖë•πùÙ4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅç±ÖÕÕ9ÖµîÙâ‹µô’±∞ÅâúµlçŸ¿¡tÅ—ï·–µ›°•—îÅôΩπ–µâΩ±êÅ¡‰¥–Å…Ω’πëïêµ·∞Å—ï·–µ±úÅÕ°ÖëΩ‹µµêÅÖç—•ŸîÈÕçÖ±î¥‰‘Å—…ÖπÕ•—•Ω∏µÖ±∞Å°ΩŸï»Èâúµlç‘ÿ¿¿¡tÅë•ÕÖâ±ïêÈΩ¡Öç•—‰¥‘¿Åô±ï‡Å•—ïµÃµçïπ—ï»Å©’Õ—•ô‰µçïπ—ï»ÅùÖ¿¥»à4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÅÌ±ΩÖë•πúÄ¸Ä†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÒë•ÿÅç±ÖÕÕ9ÖµîÙâ‹¥‘Å†¥‘ÅâΩ…ëï»¥»ÅâΩ…ëï»µ›°•—îÅâΩ…ëï»µ–µ—…ÖπÕ¡Ö…ïπ–Å…Ω’πëïêµô’±∞ÅÖπ•µÖ—îµÕ¡•∏àÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ§ÄËÄ†4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ˘…•Ö»ÅΩπ—ÑÅÀÖ—•ÃÄÒ°ïŸ…ΩπI•ù°–ÅÕ•ÈîıÏ»¡ÙÄº¯º¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ•Ù4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩâ’——Ω∏¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄΩôΩ…¥¯4(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄº¯4(ÄÄÄÄÄÄÄÄÄÄÄÄ•Ù4(ÄÄÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄÄÄΩë•ÿ¯4(ÄÄÄÄÄÄ•Ù4(ÄÄÄÄΩë•ÿ¯4(ÄÄ§Ï4)Ù4(