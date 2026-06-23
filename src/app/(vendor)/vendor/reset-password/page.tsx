"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Link de recuperacao invalido.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas nao conferem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/vendor/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset_token: token, new_password: password, password_confirm: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Nao foi possivel alterar a senha.");
        return;
      }
      setMessage("Senha alterada com sucesso. Redirecionando para o login...");
      setTimeout(() => router.push("/vendor/login"), 1200);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <input
        type="password"
        placeholder="Nova senha"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
        required
      />
      <input
        type="password"
        placeholder="Confirmar nova senha"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
        required
      />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      {message && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">{message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all hover:bg-[#E56000] disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Criar nova senha"}
      </button>
    </form>
  );
}

export default function VendorResetPassword() {
  return (
    <div className="min-h-screen bg-[#fff8f6] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-[32px] brand-card flex items-center justify-center mb-6">
        <Image src="/logo-sandexpress.png" alt="SandExpress" width={128} height={72} priority />
      </div>
      <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Recuperar senha</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Crie uma nova senha para acessar o painel do quiosque.</p>
      <Suspense fallback={<p className="text-sm text-gray-500">Carregando...</p>}>
        <ResetPasswordForm />
      </Suspense>
      <Link href="/vendor/login" className="mt-6 text-sm font-bold text-[#FF6B00] hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
