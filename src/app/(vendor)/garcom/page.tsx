"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, LogOut, MapPin, Minus, Plus, Search, ShoppingBasket, UserRound, Volume2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_DEVICE_ALERT_PREFERENCES, readDeviceAlertPreferences, saveDeviceAlertPreferences, vibrateDevice, type DeviceAlertPreferences } from "@/lib/device-alert-preferences";

type Umbrella = { id: string; number: number; active: boolean; is_occupied?: boolean; current_order_id?: string | null };
type Product = { id: string; name: string; category: string; price: number; promotional_price?: number | null; active: boolean; blocked_by_stock?: boolean; option_group_name?: string | null; option_values?: string[] | null };
type OrderItem = { id?: string; n?: string; q?: number; quantity?: number; subtotal?: number; cancelled?: boolean };
type Order = { id: string; customer_id: string; umbrella_id: string; umbrella: number; customer: string; phone: string; total: number; notes?: string | null; status: string; active_request_id?: string | null; active_request?: { id?: string | null } | null; items?: OrderItem[]; paid: boolean };
type OfflineOrderAction = { id: string; body: { vendor_id: string; customer_id: string; umbrella_id: string; items: Array<{ product_id: string; quantity: number }>; notes: string; idempotency_key: string }; created_at: string };

function offlineQueueKey(vendorId: string) { return `sandexpress_waiter_queue_${vendorId}`; }
function offlineCacheKey(vendorId: string) { return `sandexpress_waiter_cache_${vendorId}`; }
function readOfflineQueue(vendorId: string): OfflineOrderAction[] { try { return JSON.parse(localStorage.getItem(offlineQueueKey(vendorId)) || '[]'); } catch { return []; } }
function writeOfflineQueue(vendorId: string, queue: OfflineOrderAction[]) { localStorage.setItem(offlineQueueKey(vendorId), JSON.stringify(queue)); }

const CALLS = [
  { marker: "[WAITER_CALL]", label: "Cliente chamou o garcom" },
  { marker: "[CLEANING_REQUEST]", label: "Cliente pediu limpeza" },
  { marker: "[UMBRELLA_TRANSFER]", label: "Cliente pediu troca de guarda-sol" },
];

function callFor(order: Order) { return CALLS.find(call => order.notes?.includes(call.marker)); }
function assignmentFor(order: Order) {
  const match = String(order.notes || '').match(/\[WAITER_ASSIGNED:([0-9a-f-]{36})\]\s*Assumido por\s*([^\n]+)/i);
  return match ? { userId: match[1], name: match[2].trim() } : null;
}
function productOptionGroups(product: Pick<Product, 'option_group_name' | 'option_values'>) {
  const values = Array.isArray(product.option_values) ? product.option_values.map(String).filter(Boolean) : [];
  if (values.length === 0) return [] as Array<{ name: string; options: string[] }>;
  if (!values.some(value => value.includes('::'))) return [{ name: product.option_group_name || 'Opcao', options: values }];
  const groups = new Map<string, string[]>();
  values.forEach(value => { const [rawName, ...parts] = value.split('::'); const name = rawName.trim() || 'Opcao'; const option = parts.join('::').trim(); if (option) groups.set(name, [...(groups.get(name) || []), option]); });
  return Array.from(groups, ([name, options]) => ({ name, options: Array.from(new Set(options)) }));
}

export default function WaiterServicePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [waiterName, setWaiterName] = useState("Garcom");
  const [waiterId, setWaiterId] = useState("");
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opening, setOpening] = useState<Umbrella | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [ordering, setOrdering] = useState<Order | null>(null);
  const [paying, setPaying] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [welcomeOfflineMessage, setWelcomeOfflineMessage] = useState("");
  const [soundReady, setSoundReady] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState<Array<{ id: string; umbrella: number; customer: string }>>([]);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertPreferences, setAlertPreferences] = useState<DeviceAlertPreferences>(DEFAULT_DEVICE_ALERT_PREFERENCES);
  const knownCalls = useRef(new Set<string>());
  const callsInitialized = useRef(false);
  const knownOrderRequests = useRef(new Set<string>());
  const ordersInitialized = useRef(false);
  const ordersRevisionRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const orderBellAudioRef = useRef<HTMLAudioElement | null>(null);
  const alertPreferencesRef = useRef<DeviceAlertPreferences>(DEFAULT_DEVICE_ALERT_PREFERENCES);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioCtor();
    return audioContextRef.current;
  }, []);

  const activateSound = useCallback(async () => {
    const audio = getAudioContext();
    try {
      if (audio) {
        await audio.resume();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        gain.gain.value = 0.0001;
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + 0.02);
      }
      const bell = orderBellAudioRef.current;
      if (bell) {
        bell.muted = true; bell.currentTime = 0; await bell.play(); bell.pause(); bell.currentTime = 0; bell.muted = false;
      }
      setSoundReady(true);
    } catch { setSoundReady(false); }
  }, [getAudioContext]);

  const playOrderBell = useCallback(() => {
    vibrateDevice(alertPreferencesRef.current);
    const bell = orderBellAudioRef.current;
    if (!bell || alertPreferencesRef.current.volume <= 0) return;
    bell.currentTime = 0;
    bell.volume = alertPreferencesRef.current.volume;
    bell.play().catch(() => undefined);
  }, []);

  const updateAlertPreferences = (next: DeviceAlertPreferences) => {
    alertPreferencesRef.current = next;
    setAlertPreferences(next);
    saveDeviceAlertPreferences(next);
    if (orderBellAudioRef.current) orderBellAudioRef.current.volume = next.volume;
  };

  const beep = useCallback(() => {
    try {
      const audio = getAudioContext();
      if (!audio || audio.state !== 'running') return;
      [0, .18, .36].forEach((delay, index) => {
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.frequency.value = index === 2 ? 980 : 740; oscillator.type = index === 2 ? "triangle" : "square";
        gain.gain.setValueAtTime(.001, audio.currentTime + delay); gain.gain.exponentialRampToValueAtTime(.16, audio.currentTime + delay + .01); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + .14);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(audio.currentTime + delay); oscillator.stop(audio.currentTime + delay + .16);
      });
    } catch { /* navegador ainda nao liberou audio */ }
  }, [getAudioContext]);

  const loadData = useCallback(async (id: string, initial = false, refreshReferences = true) => {
    try {
      const [ordersResponse, umbrellasResponse, productsResponse] = await Promise.all([
        fetch(`/api/orders?vendor_id=${id}`),
        refreshReferences ? fetch(`/api/umbrellas?vendor_id=${id}`) : Promise.resolve(null),
        refreshReferences ? fetch(`/api/products?vendor_id=${id}`) : Promise.resolve(null),
      ]);
      if ([ordersResponse, umbrellasResponse, productsResponse].filter(Boolean).some(response => response!.status === 401 || response!.status === 403)) {
        if (ordersResponse.status === 403) setError("Modulo indisponivel ou acesso sem permissao.");
        return;
      }
      const nextOrders: Order[] = ordersResponse.ok ? await ordersResponse.json() : [];
      if (ordersResponse.ok) ordersRevisionRef.current = ordersResponse.headers.get('X-Orders-Revision') || ordersRevisionRef.current;
      const nextUmbrellas: Umbrella[] | null = umbrellasResponse?.ok ? await umbrellasResponse.json() : null;
      const nextProducts: Product[] | null = productsResponse?.ok ? await productsResponse.json() : null;
      const nextCalls = new Set(nextOrders.filter(callFor).map(order => `${order.id}:${order.notes}`));
      const receivedOrders = nextOrders.filter(order => order.status === 'received');
      const requestKey = (order: Order) => order.active_request?.id || order.active_request_id || `${order.id}:${order.total}`;
      const nextOrderRequests = new Set(receivedOrders.map(requestKey));
      if (!initial && callsInitialized.current && [...nextCalls].some(key => !knownCalls.current.has(key))) beep();
      const newReceivedOrders = !initial && ordersInitialized.current ? receivedOrders.filter(order => !knownOrderRequests.current.has(requestKey(order))) : [];
      if (newReceivedOrders.length > 0) {
        playOrderBell();
        setNewOrderAlert(newReceivedOrders.slice(0, 4).map(order => ({ id: requestKey(order), umbrella: order.umbrella, customer: order.customer })));
      }
      knownCalls.current = nextCalls;
      callsInitialized.current = true;
      knownOrderRequests.current = nextOrderRequests;
      ordersInitialized.current = true;
      setOrders(nextOrders);
      if (nextUmbrellas) setUmbrellas(nextUmbrellas);
      if (nextProducts) setProducts(nextProducts);
      setOnline(true);
      if (nextUmbrellas && nextProducts) localStorage.setItem(offlineCacheKey(id), JSON.stringify({ orders: nextOrders, umbrellas: nextUmbrellas, products: nextProducts, saved_at: new Date().toISOString() }));
      setSelectedOrder(current => current ? nextOrders.find(order => order.id === current.id) || null : null);
    } catch {
      setOnline(false);
      const cached = localStorage.getItem(offlineCacheKey(id));
      if (cached) try { const data = JSON.parse(cached); setOrders(data.orders || []); setUmbrellas(data.umbrellas || []); setProducts(data.products || []); } catch { /* cache invalido */ }
    }
  }, [beep, playOrderBell]);

  const loadOrdersWhenChanged = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/orders?vendor_id=${id}&mode=revision`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const revision = String(data.revision || '');
      if (!ordersRevisionRef.current || revision !== ordersRevisionRef.current) await loadData(id, false, false);
    } catch { setOnline(false); }
  }, [loadData]);

  const syncOfflineQueue = useCallback(async (id: string) => {
    const queue = readOfflineQueue(id);
    if (queue.length === 0 || !navigator.onLine) { setPendingSync(queue.length); return; }
    setSyncing(true);
    const remaining = [...queue];
    while (remaining.length > 0) {
      const action = remaining[0];
      try {
        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.body) });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'Um pedido offline precisa de revisao.');
          const mustKeepForReview = response.status >= 500 || data.code === 'CASH_REGISTER_NOT_OPEN' || data.code === 'CASH_REGISTER_CLOSED';
          if (mustKeepForReview) break;
          remaining.shift();
        } else remaining.shift();
        writeOfflineQueue(id, remaining); setPendingSync(remaining.length);
      } catch { break; }
    }
    setSyncing(false);
    if (remaining.length === 0) await loadData(id);
  }, [loadData]);

  useEffect(() => {
    const preferences = readDeviceAlertPreferences();
    alertPreferencesRef.current = preferences;
    setAlertPreferences(preferences);
    const bell = new Audio('/sounds/order-bell.mp3');
    bell.preload = 'auto';
    bell.volume = preferences.volume;
    orderBellAudioRef.current = bell;
    const unlock = () => { activateSound(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      bell.pause();
      orderBellAudioRef.current = null;
    };
  }, [activateSound]);

  useEffect(() => {
    const id = sessionStorage.getItem("waiter_vendor_id") || sessionStorage.getItem("vendor_id") || "";
    const name = sessionStorage.getItem("waiter_name") || "Garcom";
    const storedWaiterId = sessionStorage.getItem("waiter_id") || "";
    if (!id) { router.replace("/garcom/login"); return; }
    setVendorId(id); setWaiterName(name); setWaiterId(storedWaiterId);
    setOnline(navigator.onLine); setPendingSync(readOfflineQueue(id).length);
    const cached = localStorage.getItem(offlineCacheKey(id));
    if (cached) try { const data = JSON.parse(cached); setOrders(data.orders || []); setUmbrellas(data.umbrellas || []); setProducts(data.products || []); } catch { /* cache invalido */ }
    fetch(`/api/features?vendor_id=${id}`).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.features?.waiter_service !== true) { setError("Modulo de atendimento do garcom nao liberado pelo administrador."); return; }
      await loadData(id, true);
      await syncOfflineQueue(id);
    }).catch(() => { setOnline(false); if (!cached) setError('Sem internet e sem dados salvos neste aparelho.'); });
  }, [loadData, router, syncOfflineQueue]);

  useEffect(() => {
    if (!vendorId) return;
    const connected = () => { setOnline(true); setError(current => current.startsWith('Sem internet') ? '' : current); loadData(vendorId); syncOfflineQueue(vendorId); };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, [vendorId, loadData, syncOfflineQueue]);

  useEffect(() => {
    if (!vendorId || error) return;
    let loading = false;
    const refresh = async (references = false) => {
      if (loading || !navigator.onLine || document.visibilityState !== 'visible') return;
      loading = true;
      try {
        if (references) await loadData(vendorId, false, true);
        else await loadOrdersWhenChanged(vendorId);
      } finally { loading = false; }
    };
    const ordersTimer = window.setInterval(() => void refresh(false), 5000);
    const referencesTimer = window.setInterval(() => void refresh(true), 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh(true); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(ordersTimer);
      window.clearInterval(referencesTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [vendorId, error, loadData, loadOrdersWhenChanged]);

  const calls = useMemo(() => orders.filter(callFor), [orders]);
  const orderByUmbrella = useMemo(() => new Map(orders.map(order => [order.umbrella_id, order])), [orders]);

  async function updateCall(order: Order, action: 'claim' | 'resolve') {
    if (!navigator.onLine) return setError('Chamados so podem ser assumidos ou concluidos com internet.');
    const response = await fetch('/api/waiter-service', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, order_id: order.id, action }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || 'Nao foi possivel atualizar o chamado.'); await loadData(vendorId); return; }
    setError('');
    await loadData(vendorId);
  }

  async function openAccount(umbrella: Umbrella, name: string, phone: string) {
    if (!navigator.onLine) throw new Error('Para abrir uma nova comanda, aguarde a internet voltar. Comandas ja abertas continuam aceitando pedidos offline.');
    if (!umbrella.active) {
      const activation = await fetch(`/api/umbrellas/${umbrella.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) });
      if (!activation.ok) throw new Error("Nao foi possivel ativar este guarda-sol.");
    }
    const response = await fetch("/api/vendor/manual-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_id: vendorId, umbrella_id: umbrella.id, name, phone }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Nao foi possivel abrir a comanda.");
    setOpening(null); await loadData(vendorId);
  }

  async function launchItems(order: Order, cart: Record<string, number>, notes: string) {
    const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
    const idempotencyKey = crypto.randomUUID();
    const body = { vendor_id: vendorId, customer_id: order.customer_id, umbrella_id: order.umbrella_id, items, notes: notes || `Pedido lancado por ${waiterName}`, idempotency_key: idempotencyKey };
    if (!navigator.onLine) {
      const queue = [...readOfflineQueue(vendorId), { id: idempotencyKey, body, created_at: new Date().toISOString() }];
      writeOfflineQueue(vendorId, queue); setPendingSync(queue.length); setOrdering(null); setWelcomeOfflineMessage('Pedido salvo no aparelho. Sera enviado quando a internet voltar.'); return;
    }
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Nao foi possivel lancar o pedido.");
      setOrdering(null); setSelectedOrder(null); await loadData(vendorId);
    } catch (err) {
      if (err instanceof TypeError) { const queue = [...readOfflineQueue(vendorId), { id: idempotencyKey, body, created_at: new Date().toISOString() }]; writeOfflineQueue(vendorId, queue); setPendingSync(queue.length); setOrdering(null); setOnline(false); setWelcomeOfflineMessage('Sinal caiu. Pedido guardado para sincronizar.'); return; }
      throw err;
    }
  }

  async function registerPayment(order: Order, amount: number, paymentMethod: string, payerName: string, note: string) {
    if (!navigator.onLine) throw new Error('Pagamentos nao sao gravados offline para evitar cobranca duplicada. Aguarde a conexao voltar.');
    const response = await fetch('/api/account-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: vendorId, order_id: order.id, amount, payment_method: paymentMethod, payer_name: payerName, note, idempotency_key: crypto.randomUUID() }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Nao foi possivel registrar o pagamento.');
    setPaying(null); setSelectedOrder(null); await loadData(vendorId);
  }

  function logout() { sessionStorage.removeItem("waiter_vendor_id"); sessionStorage.removeItem("waiter_name"); sessionStorage.removeItem("waiter_id"); sessionStorage.removeItem("vendor_id"); router.push("/garcom/login"); }

  return <main className="min-h-screen bg-[#fff8f3] pb-24 text-gray-950">
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#FF6B00]">Atendimento em tempo real</p><h1 className="text-lg font-black">Ola, {waiterName}</h1></div><div className="flex items-center gap-2"><button type="button" onClick={() => { setShowAlertSettings(true); activateSound(); }} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-black ${soundReady ? 'bg-blue-100 text-blue-800' : 'animate-pulse bg-orange-100 text-orange-800'}`} aria-label="Configurar alertas de novos pedidos"><Volume2 size={18} /><span className="hidden sm:inline">{soundReady ? 'Som ativo' : 'Ativar som'}</span></button><button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-xl bg-gray-100 px-4 text-sm font-black text-gray-700"><LogOut size={18} /> <span className="hidden sm:inline">Sair</span></button></div></div></header>
    {showAlertSettings && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="waiter-alert-settings-title"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="waiter-alert-settings-title" className="text-xl font-black">Alertas de novos pedidos</h2><p className="mt-1 text-sm font-semibold text-gray-600">Preferencias salvas neste celular ou tablet.</p></div><button type="button" onClick={() => setShowAlertSettings(false)} className="rounded-full bg-gray-100 p-2" aria-label="Fechar"><X size={20} /></button></div><label className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-4"><span><strong className="block">Vibrar o aparelho</strong><small className="text-gray-600">Ligado por padrao quando compativel.</small></span><input type="checkbox" checked={alertPreferences.vibrationEnabled} onChange={event => updateAlertPreferences({ ...alertPreferences, vibrationEnabled: event.target.checked })} className="h-6 w-6 accent-[#FF6B00]" /></label><label className="mt-4 block rounded-2xl border border-gray-200 p-4"><span className="flex justify-between font-black"><span>Volume da campainha</span><span>{Math.round(alertPreferences.volume * 100)}%</span></span><input type="range" min="0" max="100" step="5" value={Math.round(alertPreferences.volume * 100)} onChange={event => updateAlertPreferences({ ...alertPreferences, volume: Number(event.target.value) / 100 })} className="mt-4 w-full accent-[#FF6B00]" /><small className="mt-2 block text-gray-600">Tambem respeita o volume fisico e o modo silencioso do aparelho.</small></label><button type="button" onClick={async () => { await activateSound(); playOrderBell(); }} className="mt-5 min-h-12 w-full rounded-2xl bg-[#FF6B00] font-black text-white"><Volume2 className="mr-2 inline" size={19} /> Testar alerta</button></div></div>}
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {newOrderAlert.length > 0 && <section className="rounded-3xl border-2 border-green-500 bg-green-50 p-4 text-green-950 shadow-lg" role="alert"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-lg font-black"><BellRing className="animate-bounce" size={22} /> {newOrderAlert.length === 1 ? 'Novo pedido recebido' : `${newOrderAlert.length} novos pedidos recebidos`}</p><div className="mt-2 space-y-1">{newOrderAlert.map(order => <p key={order.id} className="font-bold">Guarda-sol {order.umbrella} · {order.customer || 'Cliente'}</p>)}</div></div><button type="button" onClick={() => setNewOrderAlert([])} className="rounded-full bg-white p-2 text-green-900 shadow" aria-label="Fechar aviso de novo pedido"><X size={20} /></button></div></section>}
      {(!online || pendingSync > 0 || syncing) && <div className={`rounded-2xl border p-4 font-bold ${online ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}><p className="font-black">{online ? syncing ? 'Sincronizando pedidos...' : 'Conexao restabelecida' : 'Modo offline ativo'}</p><p className="mt-1 text-sm">{pendingSync > 0 ? `${pendingSync} pedido(s) aguardando envio automatico.` : 'Mapa e cardapio salvos continuam disponiveis.'}</p></div>}
      {welcomeOfflineMessage && <div className="rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">{welcomeOfflineMessage}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-800">{error}</div>}
      {!error && <>
        <section><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black"><BellRing className="text-red-600" /> Chamados</h2><span className="rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white">{calls.length}</span></div>
          {calls.length === 0 ? <p className="rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">Nenhum cliente aguardando atendimento.</p> : <div className="grid gap-3 sm:grid-cols-2">{calls.map(order => { const assignment = assignmentFor(order); const mine = Boolean(assignment && waiterId && assignment.userId === waiterId); return <div key={order.id} className={`rounded-2xl border-2 bg-white p-4 shadow-lg ${assignment ? 'border-blue-500' : 'animate-pulse border-red-500'}`}><p className={`text-sm font-black uppercase ${assignment ? 'text-blue-700' : 'text-red-700'}`}>{callFor(order)?.label}</p><p className="mt-1 text-2xl font-black">Guarda-sol {order.umbrella}</p><p className="font-semibold text-gray-600">{order.customer}</p>{assignment && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-sm font-black text-blue-800">Em atendimento por {assignment.name}</p>}{!assignment ? <button onClick={() => updateCall(order, 'claim')} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-black text-white"><UserRound size={20} /> Assumir chamado</button> : mine ? <button onClick={() => updateCall(order, 'resolve')} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 font-black text-white"><CheckCircle2 size={20} /> Concluir atendimento</button> : <button disabled className="mt-4 min-h-12 w-full rounded-xl bg-gray-200 font-black text-gray-600">Ja assumido</button>}</div>; })}</div>}
        </section>
        <section><h2 className="mb-3 flex items-center gap-2 text-xl font-black"><MapPin className="text-[#FF6B00]" /> Mesas e guarda-sois</h2><div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">{umbrellas.map(umbrella => { const order = orderByUmbrella.get(umbrella.id); return <button key={umbrella.id} onClick={() => order ? setSelectedOrder(order) : setOpening(umbrella)} className={`min-h-28 rounded-2xl border-2 p-3 text-left shadow-sm ${order ? "border-orange-500 bg-orange-50" : umbrella.active ? "border-green-400 bg-white" : "border-gray-300 bg-gray-100"}`}><span className="block text-2xl font-black">{umbrella.number}</span><span className={`mt-3 block text-xs font-black ${order ? "text-orange-700" : umbrella.active ? "text-green-700" : "text-gray-600"}`}>{order ? `${order.customer}\n${formatCurrency(order.total)}` : umbrella.active ? "Livre - abrir" : "Inativo - ativar"}</span></button>; })}</div></section>
      </>}
    </div>
    {opening && <OpenAccountModal umbrella={opening} onClose={() => setOpening(null)} onSubmit={openAccount} />}
    {selectedOrder && <AccountModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onOrder={() => { setOrdering(selectedOrder); setSelectedOrder(null); }} onPayment={() => { setPaying(selectedOrder); setSelectedOrder(null); }} />}
    {ordering && <OrderMenuModal order={ordering} products={products} onClose={() => setOrdering(null)} onSubmit={launchItems} />}
    {paying && <SharedPaymentModal order={paying} vendorId={vendorId} onClose={() => setPaying(null)} onSubmit={registerPayment} />}
  </main>;
}

function OpenAccountModal({ umbrella, onClose, onSubmit }: { umbrella: Umbrella; onClose: () => void; onSubmit: (umbrella: Umbrella, name: string, phone: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}><form onSubmit={async e => { e.preventDefault(); setLoading(true); setError(""); try { await onSubmit(umbrella, name, phone); } catch (err) { setError(err instanceof Error ? err.message : "Erro ao abrir."); } finally { setLoading(false); } }} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6"><button type="button" onClick={onClose} className="float-right text-gray-500"><X /></button><p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {umbrella.number}</p><h2 className="text-2xl font-black">Abrir comanda</h2>{!umbrella.active && <p className="mt-2 rounded-lg bg-gray-100 p-2 text-sm font-bold text-gray-700">O guarda-sol sera ativado automaticamente.</p>}<input required minLength={2} autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cliente" className="mt-5 w-full rounded-xl border-2 border-gray-200 p-4 outline-none focus:border-[#FF6B00]" /><input required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone com DDD" className="mt-3 w-full rounded-xl border-2 border-gray-200 p-4 outline-none focus:border-[#FF6B00]" />{error && <p className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}<button disabled={loading} className="mt-5 min-h-14 w-full rounded-xl bg-[#FF6B00] font-black text-white disabled:opacity-50">{loading ? "Abrindo..." : "Abrir e atender"}</button></form></div>;
}

function AccountModal({ order, onClose, onOrder, onPayment }: { order: Order; onClose: () => void; onOrder: () => void; onPayment: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}><div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6"><button onClick={onClose} className="float-right text-gray-500"><X /></button><p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p><h2 className="text-2xl font-black">{order.customer}</h2><p className="font-semibold text-gray-600">{order.phone}</p><div className="my-5 rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black uppercase text-orange-700">Total da comanda</p><p className="text-3xl font-black text-[#FF6B00]">{formatCurrency(order.total)}</p></div><div className="grid gap-3 sm:grid-cols-2"><button onClick={onOrder} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 font-black text-white"><ShoppingBasket size={20} /> Lancar itens</button><button onClick={onPayment} disabled={order.total <= 0} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-green-600 font-black text-white disabled:opacity-40">Receber parte</button></div></div></div>;
}

function SharedPaymentModal({ order, vendorId, onClose, onSubmit }: { order: Order; vendorId: string; onClose: () => void; onSubmit: (order: Order, amount: number, paymentMethod: string, payerName: string, note: string) => Promise<void> }) {
  const [summary, setSummary] = useState<{ total: number; base_total: number; service_fee_amount: number; paid_amount: number; remaining_amount: number; payments: Array<{ id: string; amount: number; payer_name: string; payment_method: string }> } | null>(null);
  const [amount, setAmount] = useState(''); const [payerName, setPayerName] = useState(''); const [method, setMethod] = useState('pix'); const [note, setNote] = useState(''); const [people, setPeople] = useState(2); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { fetch(`/api/account-payments?vendor_id=${vendorId}&order_id=${order.id}`).then(response => response.json()).then(data => { setSummary(data); setAmount(String(Number((Number(data.remaining_amount || order.total) / people).toFixed(2)))); }).catch(() => setError('Nao foi possivel carregar o saldo.')); }, [vendorId, order.id]);
  const remaining = Number(summary?.remaining_amount ?? order.total); const suggested = Number((remaining / Math.max(1, people)).toFixed(2));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}><div onClick={e => e.stopPropagation()} className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6"><button onClick={onClose} className="float-right text-gray-500"><X /></button><p className="text-xs font-black uppercase text-green-700">Conta compartilhada</p><h2 className="text-2xl font-black">Receber uma parte</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-100 p-3"><p className="text-xs font-bold text-gray-600">Ja recebido</p><p className="text-xl font-black text-green-700">{formatCurrency(Number(summary?.paid_amount || 0))}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs font-bold text-orange-700">Falta receber</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(remaining)}</p></div></div>{Number(summary?.service_fee_amount || 0) > 0 && <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-black text-green-900">Consumo {formatCurrency(Number(summary?.base_total || 0))} + 10% do garçom {formatCurrency(Number(summary?.service_fee_amount || 0))}</p>}
    <label className="mt-4 block text-sm font-black">Dividir saldo entre quantas pessoas?<div className="mt-2 flex items-center gap-2"><button onClick={() => setPeople(value => Math.max(1, value - 1))} className="h-11 w-11 rounded-xl bg-gray-100"><Minus className="mx-auto" /></button><b className="flex-1 text-center text-xl">{people}</b><button onClick={() => setPeople(value => Math.min(50, value + 1))} className="h-11 w-11 rounded-xl bg-gray-100"><Plus className="mx-auto" /></button></div><button onClick={() => setAmount(String(suggested))} className="mt-2 w-full rounded-lg bg-blue-50 p-2 text-sm font-black text-blue-700">Usar {formatCurrency(suggested)} por pessoa</button></label>
    <input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Nome de quem esta pagando" className="mt-4 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-green-600" /><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(',', '.'))} placeholder="Valor recebido" className="mt-3 w-full rounded-xl border-2 border-gray-200 p-3 text-lg font-black outline-none focus:border-green-600" /><select value={method} onChange={e => setMethod(e.target.value)} className="mt-3 w-full rounded-xl border-2 border-gray-200 p-3 font-bold"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Cartao de debito</option><option value="credit_card">Cartao de credito</option></select><input value={note} onChange={e => setNote(e.target.value)} placeholder="Observacao opcional" className="mt-3 w-full rounded-xl border-2 border-gray-200 p-3" />
    {(summary?.payments || []).length > 0 && <div className="mt-4 space-y-2"><p className="text-sm font-black">Pagamentos registrados</p>{summary!.payments.map(payment => <div key={payment.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-sm"><span className="font-bold">{payment.payer_name}</span><b className="text-green-700">{formatCurrency(payment.amount)}</b></div>)}</div>}{error && <p className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}<button disabled={loading || !summary || Number(amount) <= 0} onClick={async () => { setLoading(true); setError(''); try { await onSubmit(order, Number(amount), method, payerName || `Pessoa ${(summary?.payments.length || 0) + 1}`, note); } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao receber.'); } finally { setLoading(false); } }} className="mt-5 min-h-14 w-full rounded-xl bg-green-600 font-black text-white disabled:opacity-40">{loading ? 'Registrando...' : remaining - Number(amount) <= .009 ? 'Receber e fechar conta' : 'Registrar pagamento parcial'}</button></div></div>;
}

function OrderMenuModal({ order, products, onClose, onSubmit }: { order: Order; products: Product[]; onClose: () => void; onSubmit: (order: Order, cart: Record<string, number>, notes: string) => Promise<void> }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const available = products.filter(product => product.active && !product.blocked_by_stock && product.name.toLowerCase().includes(search.toLowerCase()));
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);
  const total = products.reduce((sum, product) => sum + Number(product.promotional_price ?? product.price) * (cart[product.id] || 0), 0);
  const signature = (product: Product) => productOptionGroups(product).map(group => `${group.name}: ${choices[`${product.id}:${group.name}`] || group.options[0]}`).join(' | ');
  const submit = async () => {
    setLoading(true); setError('');
    try {
      const optionNotes = products.filter(product => (cart[product.id] || 0) > 0 && productOptionGroups(product).length > 0).map(product => `${product.name}: ${signature(product)}`).join('; ');
      await onSubmit(order, cart, [notes.trim(), optionNotes ? `Opcoes escolhidas: ${optionNotes}` : ''].filter(Boolean).join('\n'));
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao lancar.'); }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
    <div onClick={event => event.stopPropagation()} className="flex max-h-[96vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white sm:rounded-3xl">
      <div className="border-b p-5"><button onClick={onClose} className="float-right text-gray-500"><X /></button><p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p><h2 className="text-xl font-black">Cardapio</h2><div className="relative mt-4"><Search className="absolute left-3 top-3.5 text-gray-400" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto" className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-3 outline-none focus:border-[#FF6B00]" /></div></div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">{available.map(product => { const groups = productOptionGroups(product); return <div key={product.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="text-xs font-bold text-gray-500">{product.category}</p><p className="font-black text-[#FF6B00]">{formatCurrency(Number(product.promotional_price ?? product.price))}</p>{groups.length > 0 && (cart[product.id] || 0) > 0 && <p className="mt-1 text-xs font-black text-blue-700">{signature(product)}</p>}</div><div className="flex items-center gap-2"><button onClick={() => setCart(current => ({ ...current, [product.id]: Math.max(0, (current[product.id] || 0) - 1) }))} className="h-10 w-10 rounded-xl bg-gray-100"><Minus className="mx-auto" size={18} /></button><b className="w-6 text-center">{cart[product.id] || 0}</b><button onClick={() => groups.length > 0 ? setConfiguring(product) : setCart(current => ({ ...current, [product.id]: Math.min(50, (current[product.id] || 0) + 1) }))} className="h-10 w-10 rounded-xl bg-[#FF6B00] text-white"><Plus className="mx-auto" size={18} /></button></div></div>{groups.length > 0 && <button onClick={() => setConfiguring(product)} className="mt-2 w-full rounded-lg bg-blue-50 py-2 text-xs font-black text-blue-700">Escolher opcoes</button>}</div>; })}<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observacao do pedido" className="min-h-20 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]" />{error && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}</div>
      <div className="flex items-center justify-between gap-3 border-t p-4"><div><p className="text-xs font-bold text-gray-500">{count} itens</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(total)}</p></div><button disabled={!count || loading} onClick={submit} className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40">{loading ? 'Lancando...' : 'Lancar pedido'}</button></div>
    </div>
    {configuring && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={event => { event.stopPropagation(); setConfiguring(null); }}><div className="w-full max-w-md rounded-3xl bg-white p-5" onClick={event => event.stopPropagation()}><button onClick={() => setConfiguring(null)} className="float-right text-2xl text-gray-500">×</button><p className="text-xs font-black uppercase text-blue-700">Escolher opcoes</p><h3 className="text-xl font-black">{configuring.name}</h3><div className="mt-4 space-y-3">{productOptionGroups(configuring).map(group => <div key={group.name} className="rounded-xl border p-3"><p className="text-sm font-black">{group.name}</p><div className="mt-2 flex flex-wrap gap-2">{group.options.map(option => <button key={option} onClick={() => setChoices(current => ({ ...current, [`${configuring.id}:${group.name}`]: option }))} className={`rounded-full border px-3 py-2 text-sm font-black ${(choices[`${configuring.id}:${group.name}`] || group.options[0]) === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-gray-50'}`}>{option}</button>)}</div></div>)}</div><button onClick={() => { setCart(current => ({ ...current, [configuring.id]: Math.min(50, (current[configuring.id] || 0) + 1) })); setConfiguring(null); }} className="mt-4 min-h-12 w-full rounded-xl bg-blue-600 font-black text-white">Adicionar com estas escolhas</button></div></div>}
  </div>;
}

function LegacyOrderMenuModal({ order, products, onClose, onSubmit }: { order: Order; products: Product[]; onClose: () => void; onSubmit: (order: Order, cart: Record<string, number>, notes: string) => Promise<void> }) {
  const [cart, setCart] = useState<Record<string, number>>({}); const [search, setSearch] = useState(""); const [notes, setNotes] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const available = products.filter(product => product.active && !product.blocked_by_stock && product.name.toLowerCase().includes(search.toLowerCase()));
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0); const total = products.reduce((sum, product) => sum + Number(product.promotional_price ?? product.price) * (cart[product.id] || 0), 0);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}><div onClick={e => e.stopPropagation()} className="flex max-h-[96vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white sm:rounded-3xl"><div className="border-b p-5"><button onClick={onClose} className="float-right text-gray-500"><X /></button><p className="text-xs font-black uppercase text-[#FF6B00]">Guarda-sol {order.umbrella}</p><h2 className="text-xl font-black">Cardapio</h2><div className="relative mt-4"><Search className="absolute left-3 top-3.5 text-gray-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto" className="w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-3 outline-none focus:border-[#FF6B00]" /></div></div><div className="flex-1 space-y-2 overflow-y-auto p-4">{available.map(product => <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="text-xs font-bold text-gray-500">{product.category}</p><p className="font-black text-[#FF6B00]">{formatCurrency(Number(product.promotional_price ?? product.price))}</p></div><div className="flex items-center gap-2"><button onClick={() => setCart(value => ({ ...value, [product.id]: Math.max(0, (value[product.id] || 0) - 1) }))} className="h-10 w-10 rounded-xl bg-gray-100"><Minus className="mx-auto" size={18} /></button><b className="w-6 text-center">{cart[product.id] || 0}</b><button onClick={() => setCart(value => ({ ...value, [product.id]: Math.min(50, (value[product.id] || 0) + 1) }))} className="h-10 w-10 rounded-xl bg-[#FF6B00] text-white"><Plus className="mx-auto" size={18} /></button></div></div>)}<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observacao do pedido" className="min-h-20 w-full rounded-xl border-2 border-gray-200 p-3 outline-none focus:border-[#FF6B00]" />{error && <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</p>}</div><div className="flex items-center justify-between gap-3 border-t p-4"><div><p className="text-xs font-bold text-gray-500">{count} itens</p><p className="text-xl font-black text-[#FF6B00]">{formatCurrency(total)}</p></div><button disabled={!count || loading} onClick={async () => { setLoading(true); setError(""); try { await onSubmit(order, cart, notes); } catch (err) { setError(err instanceof Error ? err.message : "Erro ao lancar."); } finally { setLoading(false); } }} className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40">{loading ? "Lancando..." : "Lancar pedido"}</button></div></div></div>;
}
