'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerSalesLogin() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/owner-sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha no login.');
      router.replace('/owner/dashboard');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#fff8f6] p-6">
    <section className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-7 shadow-xl">
      <Image src="/logo-sandexpress.png" alt="SandExpress" width={180} height={90} className="mx-auto h-auto" priority />
      <h1 className="mt-5 text-center text-3xl font-black text-gray-950">Vendas do proprietário</h1>
      <p className="mt-2 text-center text-sm font-medium text-gray-500">Acesso exclusivo, somente com dados reais do seu quiosque.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-bold text-gray-700">CPF, CNPJ ou login de proprietário
          <input value={login} onChange={event => setLogin(event.target.value)} autoComplete="username" required className="mt-2 min-h-12 w-full rounded-xl border-2 border-gray-200 px-4 outline-none focus:border-[#FF6B00]" />
        </label>
        <label className="block text-sm font-bold text-gray-700">Senha
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 min-h-12 w-full rounded-xl border-2 border-gray-200 px-4 outline-none focus:border-[#FF6B00]" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button disabled={loading} className="min-h-12 w-full rounded-xl bg-[#FF6B00] px-5 font-black text-white disabled:opacity-50">{loading ? 'Entrando...' : 'Ver vendas do dia'}</button>
      </form>
    </section>
  </main>;
}
