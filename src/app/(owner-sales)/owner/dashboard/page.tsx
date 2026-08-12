'use client';

import { AlertTriangle, LogOut, Package, RefreshCw, ShoppingBag, Target, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

type Dashboard = {
  vendor: { name: string; owner_name: string };
  updated_at: string;
  sales: { revenue: number; orders: number; open_orders: number; average_ticket: number; daily_goal: number; goal_progress: number };
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  inventory: { active_products: number; low_stock_count: number; low_stock: Array<{ id: string; name: string; quantity: number }> };
};

export default function OwnerSalesDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/owner-sales/dashboard', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) return router.replace('/owner/login');
      if (!response.ok) throw new Error(result.error || 'Erro ao carregar painel.');
      setData(result);
      setGoal(String(result.sales.daily_goal || ''));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Erro ao carregar painel.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function saveGoal() {
    const response = await fetch('/api/owner-sales/dashboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daily_goal: Number(goal) }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error || 'Erro ao salvar meta.');
    await load();
  }

  async function logout() {
    await fetch('/api/auth/owner-sales', { method: 'DELETE' });
    router.replace('/owner/login');
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-gray-50 font-black">Carregando vendas reais...</main>;
  return <main className="min-h-screen bg-gray-50 p-4 text-gray-950 sm:p-7">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-sm font-black uppercase tracking-wider text-[#FF6B00]">Painel do proprietário</p><h1 className="text-3xl font-black">{data?.vendor.name || 'Quiosque'}</h1><p className="text-sm text-gray-500">Atualização automática a cada minuto.</p></div>
        <div className="flex gap-2"><button onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 font-bold"><RefreshCw size={18} /> Atualizar</button><button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 font-bold text-white"><LogOut size={18} /> Sair</button></div>
      </header>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p>}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Vendas hoje', value: formatCurrency(data?.sales.revenue || 0), icon: TrendingUp },
          { label: 'Pedidos pagos', value: String(data?.sales.orders || 0), icon: ShoppingBag },
          { label: 'Pedidos abertos', value: String(data?.sales.open_orders || 0), icon: RefreshCw },
          { label: 'Ticket médio', value: formatCurrency(data?.sales.average_ticket || 0), icon: Target },
        ].map(card => <article key={card.label} className="rounded-2xl border bg-white p-5 shadow-sm"><card.icon className="text-[#FF6B00]" /><p className="mt-4 text-sm font-bold text-gray-500">{card.label}</p><p className="mt-1 text-2xl font-black">{card.value}</p></article>)}
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">Meta de vendas do dia</h2><p className="text-sm text-gray-500">{(data?.sales.goal_progress || 0).toFixed(0)}% alcançada</p></div><div className="flex gap-2"><input type="number" min="0" step="10" value={goal} onChange={event => setGoal(event.target.value)} placeholder="Meta em R$" className="min-h-11 w-40 rounded-xl border-2 px-3" /><button onClick={saveGoal} className="rounded-xl bg-[#FF6B00] px-4 font-black text-white">Salvar meta</button></div></div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, data?.sales.goal_progress || 0)}%` }} /></div>
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><Package className="text-[#FF6B00]" /> Produtos mais vendidos</h2><div className="mt-4 divide-y">{data?.top_products.length ? data.top_products.map((product, index) => <div key={product.name} className="flex justify-between py-3"><span className="font-bold">{index + 1}. {product.name}</span><span>{product.quantity} un. · {formatCurrency(product.revenue)}</span></div>) : <p className="py-5 text-gray-500">Nenhuma venda paga hoje.</p>}</div></section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black"><AlertTriangle className="text-amber-500" /> Estoque baixo</h2><p className="mt-1 text-sm text-gray-500">{data?.inventory.active_products || 0} produtos ativos</p><div className="mt-4 divide-y">{data?.inventory.low_stock.length ? data.inventory.low_stock.map(product => <div key={product.id} className="flex justify-between py-3"><span className="font-bold">{product.name}</span><span className="font-black text-red-600">{product.quantity} un.</span></div>) : <p className="py-5 text-green-700">Nenhum produto com estoque baixo.</p>}</div></section>
      </div>
    </div>
  </main>;
}
