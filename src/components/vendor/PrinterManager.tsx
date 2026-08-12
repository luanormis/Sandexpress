"use client";

import { useState } from 'react';
import { Plus, Printer, Search, Trash2 } from 'lucide-react';
import {
  DEFAULT_PRINTER_SETTINGS,
  normalizePrinterSettings,
  printerStorageKey,
  PrinterProfile,
  PrinterRole,
  PrinterSettings,
  routeOrderItems,
} from '@/lib/printer-routing';

const ROLE_LABELS: Record<PrinterRole, string> = {
  food: 'Alimentos / cozinha',
  drinks: 'Bebidas / bar',
  cashier: 'Caixa (consolidado)',
};

function usbPrinterId(device: { vendorId?: number; productId?: number; serialNumber?: string }) {
  return `usb-${device.vendorId || 0}-${device.productId || 0}-${device.serialNumber || 'sem-serie'}`;
}

export function loadPrinterSettings(vendorId: string): PrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_PRINTER_SETTINGS;
  try {
    return normalizePrinterSettings(JSON.parse(localStorage.getItem(printerStorageKey(vendorId)) || 'null'));
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(vendorId: string, settings: PrinterSettings) {
  localStorage.setItem(printerStorageKey(vendorId), JSON.stringify(normalizePrinterSettings(settings)));
}

export default function PrinterManager({ vendorId }: { vendorId: string }) {
  const [settings, setSettings] = useState<PrinterSettings>(() => loadPrinterSettings(vendorId));
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const commit = (next: PrinterSettings, notice: string) => {
    const normalized = normalizePrinterSettings(next);
    setSettings(normalized);
    savePrinterSettings(vendorId, normalized);
    setMessage(notice);
  };

  const addManual = () => {
    const safeName = name.trim();
    if (safeName.length < 2) return setMessage('Informe um nome com pelo menos 2 caracteres.');
    if (settings.printers.some(printer => printer.name.toLowerCase() === safeName.toLowerCase())) {
      return setMessage('Já existe uma impressora com esse nome.');
    }
    const printer: PrinterProfile = { id: `manual-${Date.now()}`, name: safeName.slice(0, 80), connection: 'manual' };
    commit({ ...settings, printers: [...settings.printers, printer] }, 'Impressora cadastrada neste quiosque.');
    setName('');
  };

  const discoverUsb = async () => {
    setMessage('');
    const usb = (navigator as Navigator & { usb?: { getDevices(): Promise<Array<{ productName?: string; vendorId?: number; productId?: number; serialNumber?: string }>> } }).usb;
    if (!usb) return setMessage('Este navegador não oferece descoberta USB. Use Chrome/Edge ou cadastre a impressora manualmente.');
    try {
      const devices = await usb.getDevices();
      const found = devices.map(device => ({
        id: usbPrinterId(device),
        name: (device.productName || `USB ${device.vendorId || ''}:${device.productId || ''}`).slice(0, 80),
        connection: 'usb' as const,
        deviceId: device.serialNumber,
      }));
      const merged = [...settings.printers];
      found.forEach(printer => { if (!merged.some(item => item.id === printer.id)) merged.push(printer); });
      commit({ ...settings, printers: merged }, found.length ? `${found.length} dispositivo(s) USB autorizado(s) encontrado(s).` : 'Nenhum dispositivo USB autorizado. Cadastre pelo nome ou autorize-o nas configurações do navegador.');
    } catch {
      setMessage('Não foi possível consultar os dispositivos USB autorizados.');
    }
  };

  const discoverNetwork = async () => {
    setMessage('Procurando impressoras na rede local...');
    try {
      const response = await fetch('http://127.0.0.1:17891/printers', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Agente indisponível.');
      const found: PrinterProfile[] = (Array.isArray(data.printers) ? data.printers : []).map((printer: any) => ({
        id: `network-${String(printer.host)}-${Number(printer.port || 9100)}`,
        name: String(printer.name || `Térmica ${printer.host}`).slice(0, 80),
        connection: 'network',
        host: String(printer.host),
        port: Number(printer.port || 9100),
      }));
      const merged = [...settings.printers];
      found.forEach(printer => { if (!merged.some(item => item.id === printer.id)) merged.push(printer); });
      commit({ ...settings, printers: merged }, found.length ? `${found.length} impressora(s) de rede encontrada(s).` : 'Nenhuma impressora térmica respondeu na rede.');
    } catch {
      setMessage('Instale e execute o Agente de Impressão SandExpress neste desktop para buscar impressoras Wi‑Fi.');
    }
  };

  const removePrinter = (id: string) => {
    if (id === 'system-dialog') return;
    commit({ ...settings, printers: settings.printers.filter(printer => printer.id !== id) }, 'Impressora removida e rotas inválidas restauradas para a impressora do sistema.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-bold"><Printer size={20} /> Impressoras deste quiosque</h3>
        <p className="mt-1 text-sm text-gray-500">A configuração fica salva neste dispositivo. O navegador exibirá a tela de impressão para confirmar o destino físico.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button onClick={discoverUsb} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white"><Search size={18} /> Buscar USB</button>
          <button onClick={discoverNetwork} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white"><Search size={18} /> Buscar Wi‑Fi</button>
          <input value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="Ex.: Cozinha térmica" className="min-h-11 flex-1 rounded-xl border-2 border-gray-200 px-4 outline-none focus:border-[#FF6B00]" />
          <button onClick={addManual} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 font-bold text-white"><Plus size={18} /> Adicionar</button>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-800">{message}</p>}
        <div className="mt-5 space-y-2">
          {settings.printers.map(printer => (
            <div key={printer.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <div><p className="font-bold text-gray-900">{printer.name}</p><p className="text-xs uppercase text-gray-500">{printer.connection === 'system' ? 'Seleção do sistema' : printer.connection}</p></div>
              {!['system-dialog', 'sandexpress-virtual-test'].includes(printer.id) && <button onClick={() => removePrinter(printer.id)} aria-label={`Remover ${printer.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">Roteamento dos pedidos</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(ROLE_LABELS) as PrinterRole[]).map(role => (
            <label key={role} className="text-sm font-bold text-gray-700">{ROLE_LABELS[role]}
              <select value={settings.routes[role]} onChange={event => commit({ ...settings, routes: { ...settings.routes, [role]: event.target.value } }, 'Roteamento salvo neste quiosque.')} className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white p-3">
                {settings.printers.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
}

type PrintOrder = { id: string; sequence?: number; umbrella: number; customer: string; time: string; notes?: string; total: number; items: Array<{ n: string; q: number; category?: string; subtotal?: number; cancelled?: boolean }>; accountItems?: Array<{ n: string; q: number; category?: string; subtotal?: number; cancelled?: boolean }> };

export function printRoutedOrder(vendorId: string, order: PrintOrder) {
  const settings = loadPrinterSettings(vendorId);
  const routed = routeOrderItems(order.items);
  const consolidated = routeOrderItems(order.accountItems || order.items).cashier;
  const jobs: Array<{ role: PrinterRole; items: typeof routed.cashier }> = [
    ...(routed.food.length ? [{ role: 'food' as const, items: routed.food }] : []),
    ...(routed.drinks.length ? [{ role: 'drinks' as const, items: routed.drinks }] : []),
    { role: 'cashier', items: consolidated },
  ];
  jobs.forEach(({ role, items }, index) => {
    const printer = settings.printers.find(item => item.id === settings.routes[role]) || settings.printers[0];
    if (printer?.connection === 'network' && printer.host) {
      const lines = [
        'SAND EXPRESS',
        ROLE_LABELS[role],
        `GUARDA-SOL ${order.umbrella}`,
        order.sequence ? `PEDIDO Nº ${order.sequence}` : `PEDIDO #${order.id.slice(0, 8)}`,
        `CLIENTE: ${order.customer}`,
        `HORÁRIO: ${order.time}`,
        '--------------------------------',
        ...items.map(item => `${item.q}x ${item.n}${item.subtotal === undefined ? '' : `  R$ ${Number(item.subtotal).toFixed(2).replace('.', ',')}`}`),
        role === 'cashier' ? `TOTAL R$ ${Number(order.total).toFixed(2).replace('.', ',')}` : '',
        order.notes ? `OBSERVAÇÕES: ${order.notes}` : '',
        '\n\n\n',
      ].filter(Boolean).join('\n');
      void fetch('http://127.0.0.1:17891/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: printer.host, port: printer.port || 9100, text: lines }) })
        .then(async response => { if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha de impressão.'); })
        .catch(error => window.alert(error instanceof Error ? error.message : 'Falha ao enviar para a impressora de rede.'));
      return;
    }
    const popup = window.open('', `_blank`, 'width=440,height=720');
    if (!popup) return;
    const rows = items.map(item => `<tr><td>${escapeHtml(item.q)}x ${escapeHtml(item.n)}</td><td>${item.subtotal === undefined ? '' : `R$ ${Number(item.subtotal).toFixed(2).replace('.', ',')}`}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(ROLE_LABELS[role])}</title><style>@page{margin:8mm}body{font:14px monospace;color:#000}h1{font-size:19px;margin:0}.route{border:2px solid #000;padding:8px;margin:10px 0;font-weight:bold}table{width:100%;border-collapse:collapse}td{border-bottom:1px dashed #777;padding:7px 0}td:last-child{text-align:right}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:12px}.notes{white-space:pre-wrap;border:1px solid #000;padding:8px}</style></head><body><h1>SAND EXPRESS</h1><div class="route">${escapeHtml(ROLE_LABELS[role])}<br>Destino: ${escapeHtml(printer?.name || 'Impressora do sistema')}</div><p><strong>GUARDA-SOL ${escapeHtml(order.umbrella)}</strong><br>Pedido ${order.sequence ? `nº ${escapeHtml(order.sequence)}` : `#${escapeHtml(order.id.slice(0, 8))}`}<br>Cliente: ${escapeHtml(order.customer)}<br>Horário: ${escapeHtml(order.time)}</p><table>${rows}</table>${role === 'cashier' ? `<p class="total">TOTAL R$ ${Number(order.total).toFixed(2).replace('.', ',')}</p>` : ''}${order.notes ? `<p class="notes"><strong>OBSERVAÇÕES</strong><br>${escapeHtml(order.notes)}</p>` : ''}<script>window.onload=()=>setTimeout(()=>window.print(),${250 + index * 300})<\/script></body></html>`);
    popup.document.close();
  });
}
