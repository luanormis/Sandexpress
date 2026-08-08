'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Banknote, PackageCheck, ShoppingBag, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type MasterData = {
  today: { revenue: number; orders: number; customers: number; avg_ticket: number; items_sold: number; estimated_profit: number };
  week: { revenue: number; estimated_profit: number };
  low_stock: Array<{ name: string; quantity: number }>;
  goal: { daily: number; achieved_percent: number; remaining: number };
};

export default function OwnerMasterDashboard() {
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const vendorId = sessionStorage.getItem('vendor_id') || '';
    const role = sessionStorage.getItem('user_role');
    if (!vendorId || role !== 'owner') { window.location.replace('/vendor/login'); return; }
    fetch(`/api/owner-dashboard?vendor_id=${vendorId}`, { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; }).then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'Erro ao carregar.'));
  }, []);
  const cards = data ? [
    { label: 'Vendas hoje', value: formatCurrency(data.today.revenue), icon: Banknote, tone: 'bg-orange-50 text-orange-800' },
    { label: 'Pedidos', value: String(data.today.orders), icon: ShoppingBag, tone: 'bg-blue-50 text-blue-800' },
    { label: 'Pessoas', value: String(data.today.customers), icon: Users, tone: 'bg-green-50 text-green-800' },
    { label: 'Itens vendidos', value: String(data.today.items_sold), icon: PackageCheck, tone: 'bg-violet-50 text-violet-800' },
  ] : [];
  return <main className="min-h-screen bg-[#f7f7f5] p-4 sm:p-8"><div className="mx-auto max-w-6xl"><header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#C65300]">Perfil Master</p><h1 className="mt-1 text-3xl font-black text-gray-950">Visao do proprietario</h1><p className="mt-1 font-bold text-gray-500">Vendas, pessoas, pedidos e estoque em uma tela limpa.</p></div><a href="/vendor/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 font-black text-white">Abrir operacao <ArrowRight size={18}/></a></header>{error && <p className="mt-6 rounded-xl bg-red-50 p-4 font-black text-red-700">{error}</p>}{!data && !error ? <p className="mt-10 font-bold text-gray-500">Carregando indicadores...</p> : data && <><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(card => <article key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className={`inline-flex rounded-xl p-3 ${card.tone}`}><card.icon size={22}/></div><p className="mt-5 text-sm font-black text-gray-500">{card.label}</p><p className="mt-1 text-3xl font-black text-gray-950">{card.value}</p></article>)}</section><section className="mt-6 grid gap-6 lg:grid-cols-2"><article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-gray-950">Financeiro</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-black text-gray-500">SEMANA</p><p className="mt-1 text-xl font-black">{formatCurrency(data.week.revenue)}</p></div><div className="rounded-xl bg-green-50 p-4"><p className="text-xs font-black text-green-700">LUCRO ESTIMADO HOJE</p><p className="mt-1 text-xl font-black text-green-900">{formatCurrency(data.today.estimated_profit)}</p></div></div><div className="mt-4"><div className="flex justify-between text-sm font-black"><span>Meta diaria</span><span>{data.goal.achieved_percent}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-orange-100"><div className="h-full rounded-full bg-[#FF6B00]" style={{ width: `${data.goal.achieved_percent}%` }}/></div></div></article><article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-gray-950">Estoque baixo</h2><div className="mt-4 space-y-2">{data.low_stock.length ? data.low_stock.slice(0, 6).map(item => <div key={item.name} className="flex justify-between rounded-xl bg-red-50 p-3 font-bold"><span>{item.name}</span><span className="text-red-700">{item.quantity} un.</span></div>) : <p className="rounded-xl bg-green-50 p-4 font-bold text-green-800">Estoque controlado sem alertas.</p>}</div></article></section></>}</div></main>;
}
