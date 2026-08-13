'use client';

import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PrintableOrderItem, buildPrintJobs, normalizePrinters } from '@/lib/printer-routing';

type PrintOrder = { umbrella: number; customer: string; time: string; total: number; notes?: string; items: PrintableOrderItem[]; active_request?: { sequence?: number } | null };
const routeTitle = (route: string) => route === 'cashier' ? 'CAIXA · PEDIDO COMPLETO' : route === 'food' ? 'COZINHA · ALIMENTOS' : 'BAR · BEBIDAS';
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
const wrapText = (value: unknown, columns: number) => String(value ?? '').split(/\s+/).reduce<string[]>((lines, word) => { const current = lines.at(-1) || ''; if (!current) return [word.slice(0, columns)]; if (`${current} ${word}`.length <= columns) return [...lines.slice(0, -1), `${current} ${word}`]; return [...lines, word.slice(0, columns)]; }, []).join('\n');

export default function OrderPrintButton({ vendorId, order }: { vendorId: string; order: PrintOrder }) {
  const [printers, setPrinters] = useState<ReturnType<typeof normalizePrinters>>([]);
  const [loadingError, setLoadingError] = useState('');
  useEffect(() => {
    fetch(`/api/printer-settings?vendor_id=${vendorId}`, { cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => setPrinters(normalizePrinters(data.printers).filter(item => item.active)))
      .catch(error => setLoadingError(error instanceof Error ? error.message : 'Não foi possível buscar as impressoras.'));
  }, [vendorId]);

  const print = () => {
    if (loadingError) return alert(loadingError);
    if (!printers.length) return alert('Cadastre uma impressora na aba Impressoras.');
    const jobs = buildPrintJobs(printers, order.items);
    if (!jobs.length) return alert('Nenhuma impressora ativa atende aos itens deste pedido.');
    jobs.forEach(({ printer, route, items }, index) => {
      const columns = printer.columns || (printer.paperWidth === 58 ? 32 : 42);
      if (printer.connection === 'network' && printer.host) {
        const text = ['SAND EXPRESS', wrapText(routeTitle(route), columns), `GUARDA-SOL: ${order.umbrella}`, `PEDIDO: ${order.active_request?.sequence || '-'}`, wrapText(`CLIENTE: ${order.customer}`, columns), `HORARIO: ${order.time}`, '-'.repeat(columns), ...items.map(item => wrapText(`${item.q}x ${item.n}${route === 'cashier' ? `  ${money(Number(item.subtotal || 0))}` : ''}`, columns)), route === 'cashier' ? wrapText(`TOTAL: ${money(order.total)}`, columns) : '', order.notes ? wrapText(`OBSERVACOES: ${order.notes}`, columns) : '', '\n\n\n'].filter(Boolean).join('\n');
        void fetch('http://127.0.0.1:17891/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: printer.host, port: printer.port || 9100, text, cut: printer.autoCut === true }) })
          .then(async response => { if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha na impressora.'); })
          .catch(error => alert(error instanceof Error ? error.message : 'Falha ao imprimir pela rede.'));
        return;
      }
      const popup = window.open('', `_sand_print_${index}`, 'width=420,height=720');
      if (!popup) return;
      popup.document.write(`<!doctype html><html><head><title>${escapeHtml(printer.name)}</title><style>body{font-family:monospace;width:72mm;margin:4mm;color:#000}h1,h2,p{margin:0 0 8px}h1{font-size:20px}h2{font-size:15px;border-bottom:1px dashed #000;padding-bottom:8px}.item{display:flex;justify-content:space-between;gap:8px;margin:7px 0}.total{border-top:1px dashed #000;margin-top:10px;padding-top:10px;font-size:18px;font-weight:bold}</style></head><body><h1>${routeTitle(route)}</h1><h2>Impressora: ${escapeHtml(printer.name)}</h2><p><b>Guarda-sol:</b> ${order.umbrella}</p><p><b>Cliente:</b> ${escapeHtml(order.customer)}</p><p><b>Pedido:</b> ${order.active_request?.sequence || '-'} · ${escapeHtml(order.time)}</p><hr>${items.map(item => `<div class="item"><b>${item.q}x ${escapeHtml(item.n)}</b>${route === 'cashier' ? `<span>${money(Number(item.subtotal || 0))}</span>` : ''}</div>`).join('')}${order.notes ? `<hr><p><b>Observações:</b> ${escapeHtml(order.notes)}</p>` : ''}${route === 'cashier' ? `<p class="total">TOTAL DA CONTA: ${money(order.total)}</p>` : ''}<script>window.onload=()=>window.print()<\/script></body></html>`);
      popup.document.close();
    });
  };
  return <button type="button" onClick={print} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-4 font-black text-gray-800 hover:bg-gray-50"><Printer size={18}/> Imprimir comandas</button>;
}

