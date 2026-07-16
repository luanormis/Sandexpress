"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserRound } from "lucide-react";

export default function WaiterLoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/waiter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nao foi possivel entrar.");
      sessionStorage.setItem("waiter_vendor_id", data.vendor_id);
      sessionStorage.setItem("waiter_name", data.waiter_name);
      sessionStorage.setItem("waiter_id", data.waiter_id);
      sessionStorage.setItem("vendor_id", data.vendor_id);
      router.push("/garcom");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de acesso.");
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[#fff8f3] px-4 py-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
    <div className="mb-6 flex justify-center"><Image src="/sandexpress-logo-fluid.png" alt="SandExpress" width={110} height={106} priority /></div>
    <form onSubmit={submit} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-xl sm:p-8">
      <div className="mb-6 text-center"><UserRound className="mx-auto mb-3 text-[#FF6B00]" size={36} /><h1 className="text-2xl font-black text-gray-950">Atendimento do garcom</h1><p className="mt-2 text-sm font-semibold text-gray-600">Use o login criado em Equipe pelo quiosque.</p></div>
      <label className="block text-sm font-black text-gray-800">Login<input autoFocus required value={login} onChange={e => setLogin(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-4 text-gray-950 outline-none focus:border-[#FF6B00]" placeholder="Seu login" /></label>
      <label className="mt-4 block text-sm font-black text-gray-800">Senha<input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-4 text-gray-950 outline-none focus:border-[#FF6B00]" placeholder="Sua senha" /></label>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] font-black text-white shadow-lg disabled:opacity-50"><LogIn size={20} />{loading ? "Entrando..." : "Entrar no atendimento"}</button>
      <Link href="/vendor/login" className="mt-5 block text-center text-sm font-bold text-gray-500 hover:text-[#FF6B00]">Voltar ao painel do quiosque</Link>
    </form>
  </div></main>;
}
