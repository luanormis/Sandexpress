'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Search, Trash2 } from 'lucide-react';
import { KioskPrinter, PrinterRoute, normalizePrinters } from '@/lib/printer-routing';

const ROUTES: Array<{ id: PrinterRoute; label: string; help: string }> = [
  { id: 'food', label: 'Alimentos / cozinha', help: 'Porções, pastéis e demais alimentos.' },
  { id: 'beverage', label: 'Bebidas / bar', help: 'Bebidas, cervejas, drinks e doses.' },
  { id: 'cashier', label: 'Caixa (consolidado)', help: 'Recebe todos os itens do pedido.' },
];

export default function PrinterManager({ vendorId }: { vendorId: string }) {
  const [printers, setPrinters] = useState<KioskPrinter[]>([]);
  const [name, setName] = useState('');
  const [route, setRoute] = useState<PrinterRoute>('food');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/printer-settings?vendor_id=${vendorId}`, { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => setPrinters(normalizePrinters(data.printers)))
      .catch(error => setMessage(error instanceof Error ? error.message : 'Erro ao buscar impressoras.'));
  }, [vendorId]);

  const visible = useMemo(() => printers.filter(printer => printer.name.toLowerCase().includes(search.toLowerCase())), [printers, search]);
  const persist = async (next: KioskPrinter[]) => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/printer-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, printers: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar.');
      setPrinters(normalizePrinters(data.printers)); setMessage('Configuração salva.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };
  const add = () => {
    const safeName = name.trim();
    if (!safeName) return setMessage('Informe o nome exibido pela impressora no computador ou tablet.');
    void persist([...printers, { id: crypto.randomUUID(), name: safeName.slice(0, 80), route, active: true }]);
    setName('');
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
      <p className="font-black">Como funciona a impressão</p>
      <p className="mt-1 text-sm font-bold leading-6">Cadastre o mesmo nome mostrado pelo sistema. Ao imprimir uma comanda, o navegador abrirá a janela de impressão: selecione essa impressora. Por segurança, navegadores não permitem detectar nem selecionar uma impressora automaticamente.</p>
    </section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-black text-gray-950"><Printer /> Impressoras do quiosque</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px_auto]">
        <input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Ex.: EPSON Cozinha" className="min-h-12 rounded-xl border-2 border-gray-200 px-4 font-bold outline-none focus:border-[#FF6B00]" />
        <select value={route} onChange={event => setRoute(event.target.value as PrinterRoute)} className="min-h-12 rounded-xl border-2 border-gray-200 bg-white px-3 font-bold outline-none focus:border-[#FF6B00]">{ROUTES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <button disabled={saving} onClick={add} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-5 font-black text-white disabled:opacity-50"><Plus size={18}/> Adicionar</button>
      </div>
      <div className="relative mt-5"><Search className="absolute left-3 top-3.5 text-gray-400" size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar impressora cadastrada" className="min-h-12 w-full rounded-xl border-2 border-gray-200 pl-10 pr-4 font-bold outline-none focus:border-[#FF6B00]" /></div>
      <div className="mt-4 space-y-2">{visible.map(printer => { const target = ROUTES.find(item => item.id === printer.route)!; return <article key={printer.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-gray-950">{printer.name}</p><p className="text-sm font-bold text-gray-600">{target.label} · {target.help}</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={printer.active} onChange={event => void persist(printers.map(item => item.id === printer.id ? { ...item, active: event.target.checked } : item))} /> Ativa</label><button aria-label={`Excluir ${printer.name}`} onClick={() => void persist(printers.filter(item => item.id !== printer.id))} className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={18}/></button></div></article>; })}{visible.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">Nenhuma impressora encontrada.</p>}</div>
      {message && <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-black text-[#8A3E22]">{message}</p>}
    </section>
  </div>;
}
