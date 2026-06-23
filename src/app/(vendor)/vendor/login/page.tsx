"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { InstallShortcutButton } from "@/components/pwa/InstallShortcutButton";

export default function VendorLogin() {
  const [document_login, setDocumentLogin] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [error, setError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const verified = new URLSearchParams(window.location.search).get("verified");
    if (verified === "success") {
      setRecoveryMessage("Email validado com sucesso. Ja pode entrar no painel.");
    } else if (verified === "expired") {
      setError("Link de validacao expirado. Solicite suporte para reenviar a validacao.");
    } else if (verified === "invalid" || verified === "missing-token") {
      setError("Link de validacao invalido.");
    } else if (verified === "error") {
      setError("Nao foi possivel validar o email agora.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!document_login || !password) {
      setError('Informe CPF/CNPJ e senha.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_login, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Falha no login.');
        return;
      }

      if (result.must_change_password) {
        alert('Faça a alteração da senha padrão no primeiro acesso.');
      }

      sessionStorage.setItem('vendor_token', result.token);
      sessionStorage.setItem('vendor_id', result.vendor_id);
      localStorage.setItem('vendor_id', result.vendor_id);
      localStorage.setItem('vendor_name', result.vendor_name);
      router.push('/vendor/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro ao conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setRecoveryMessage("");
    if (!recoveryEmail) {
      setError("Informe o email cadastrado no quiosque.");
      return;
    }

    setIsRecovering(true);
    try {
      const response = await fetch("/api/auth/vendor/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_email: recoveryEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Nao foi possivel enviar a recuperacao.");
        if (result.reset_url) setRecoveryMessage(`Link local de recuperacao: ${result.reset_url}`);
        return;
      }
      setRecoveryMessage(result.message || "Se o email estiver cadastrado, enviaremos um link de recuperacao.");
    } catch {
      setError("Erro ao solicitar recuperacao.");
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-[32px] brand-card flex items-center justify-center mb-6">
        <Image src="/logo-sandexpress.png" alt="SandExpress" width={128} height={72} priority />
      </div>
      <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Painel do Quiosque</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Entre com seu CPF/CNPJ e senha para gerenciar seus pedidos em tempo real.</p>
      <InstallShortcutButton context="vendor" className="mb-5 w-full max-w-sm" />
      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div>
          <input
            type="text"
            placeholder="CPF ou CNPJ"
            value={document_login}
            onChange={e => setDocumentLogin(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all mt-4 hover:bg-[#E56000] disabled:opacity-50"
        >
          {isLoading ? 'Conectando...' : 'Entrar no Painel'}
        </button>
      </form>
      <form onSubmit={handleRecovery} className="mt-6 w-full max-w-sm rounded-2xl border border-[#e2bfb0] bg-white/70 p-4 text-left">
        <p className="mb-3 text-sm font-black text-[#572000]">Esqueci minha senha</p>
        <input
          type="email"
          placeholder="Email cadastrado"
          value={recoveryEmail}
          onChange={e => setRecoveryEmail(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl p-3 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
        />
        <button
          type="submit"
          disabled={isRecovering}
          className="mt-3 w-full rounded-xl border-2 border-[#FF6B00] py-3 text-sm font-black text-[#FF6B00] hover:bg-[#FF6B00] hover:text-white disabled:opacity-50"
        >
          {isRecovering ? "Enviando..." : "Enviar link por email"}
        </button>
        {recoveryMessage && <p className="mt-3 break-words text-xs font-bold text-green-700">{recoveryMessage}</p>}
      </form>
    </div>
  );
}
