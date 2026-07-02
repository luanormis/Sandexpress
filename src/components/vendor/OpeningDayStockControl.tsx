'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader, Minus, Plus, Save } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_tracking_enabled: boolean;
  physical_stock_quantity: number;
  beach_stock_quantity: number;
  stock_quantity: number | null;
  blocked_by_stock: boolean;
  active: boolean;
}

export default function OpeningDayStockControl({ vendorId: vendorIdProp }: { vendorId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [physicalUpdates, setPhysicalUpdates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const vendorId = vendorIdProp || (typeof window !== 'undefined'
    ? sessionStorage.getItem('vendor_id') || localStorage.getItem('vendor_id') || ''
    : '');

  const loadProducts = async () => {
    if (!vendorId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/stock?vendor_id=${vendorId}`);
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setError(result.error || 'Erro ao carregar produtos.');
        return;
      }
      const data = await response.json();
      setProducts(data);
      const initial: Record<string, number> = {};
      const physicalInitial: Record<string, number> = {};
      data.forEach((product: Product) => {
        initial[product.id] = product.beach_stock_quantity || product.stock_quantity || 0;
        physicalInitial[product.id] = product.physical_stock_quantity || 0;
      });
      setStockUpdates(initial);
      setPhysicalUpdates(physicalInitial);
    } catch (err) {
      setError('Erro ao carregar produtos: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [vendorId]);

  const setStock = (productId: string, value: string) => {
    const next = Math.max(0, parseInt(value, 10) || 0);
    setStockUpdates(prev => ({ ...prev, [productId]: next }));
  };

  const setPhysicalStock = (productId: string, value: string) => {
    const next = Math.max(0, parseInt(value, 10) || 0);
    setPhysicalUpdates(prev => ({ ...prev, [productId]: next }));
  };

  const stepStock = (productId: string, delta: number) => {
    setStockUpdates(prev => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const saveStock = async (mode: 'open' | 'close' | 'set_physical') => {
    if (!vendorId) {
      setError('Quiosque nao identificado. Faca login novamente.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updates = Object.entries(stockUpdates).map(([product_id, stock_quantity]) => ({
        product_id,
        stock_quantity,
        physical_stock_quantity: physicalUpdates[product_id] ?? 0,
      }));

      const response = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, mode, updates }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao salvar estoque.');
        return;
      }

      setMessage(mode === 'close'
        ? `Fechamento de estoque salvo: ${result.updated_count} produtos devolvidos ao estoque fisico.`
        : `Estoque de praia salvo: ${result.updated_count} produtos atualizados.`);
      await loadProducts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Erro ao salvar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => saveStock('open');
  const handleCloseDayStock = () => saveStock('close');
  const handleSavePhysicalStock = () => saveStock('set_physical');

  const grouped = products.reduce((acc: Record<string, Product[]>, product) => {
    const category = product.category || 'Geral';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white p-8 text-gray-600">
        <Loader className="h-6 w-6 animate-spin text-[#FF6B00]" />
        <span className="ml-2 font-bold">Carregando produtos...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Controle de estoque</h1>
        <p className="mt-1 text-sm font-semibold text-gray-500">
          Informe o estoque fisico, abra a quantidade da praia e feche o dia devolvendo as sobras.
        </p>
      </div>

      {error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <Check className="h-5 w-5 flex-shrink-0 text-green-600" />
          <p className="text-sm font-bold text-green-700">{message}</p>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-bold text-gray-500">
          Nenhum produto ativo encontrado para abertura.
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-lg font-black text-gray-900">
            {category}
          </h2>

          <div className="space-y-3">
            {items.map((product) => {
              const quantity = stockUpdates[product.id] || 0;
              const tracksStock = Boolean(product.stock_tracking_enabled);
              return (
                <div
                  key={product.id}
                  className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 transition hover:bg-gray-100 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900">{product.name}</p>
                    <p className="text-sm font-semibold text-gray-500">R$ {product.price.toFixed(2)}</p>
                    <p className="text-xs font-bold text-gray-500">
                      Fisico: {product.physical_stock_quantity || 0} un. | Praia: {product.beach_stock_quantity ?? product.stock_quantity ?? 0} un.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="text-xs font-black uppercase text-gray-500">Fisico</span>
                    <input
                      type="number"
                      min="0"
                      value={physicalUpdates[product.id] || 0}
                      onChange={(event) => setPhysicalStock(product.id, event.target.value)}
                      disabled={!tracksStock}
                      className="h-10 w-20 rounded-lg border border-gray-300 px-3 text-center font-black outline-none focus:border-[#FF6B00] disabled:bg-gray-100"
                      aria-label={`Estoque fisico de ${product.name}`}
                    />
                    <span className="text-xs font-black uppercase text-gray-500">Praia</span>
                    <button
                      type="button"
                      onClick={() => stepStock(product.id, -1)}
                      disabled={!tracksStock || quantity <= 0}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label={`Diminuir estoque de ${product.name}`}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(event) => setStock(product.id, event.target.value)}
                      disabled={!tracksStock}
                      className="h-10 w-20 rounded-lg border border-gray-300 px-3 text-center font-black outline-none focus:border-[#FF6B00]"
                      aria-label={`Quantidade de ${product.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => stepStock(product.id, 1)}
                      disabled={!tracksStock}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                      aria-label={`Aumentar estoque de ${product.name}`}
                    >
                      <Plus size={16} />
                    </button>
                    <span className="w-10 text-sm font-semibold text-gray-500">unid.</span>

                    {!tracksStock ? (
                      <span className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-black text-gray-600">Nao contabiliza</span>
                    ) : quantity === 0 ? (
                      <span className="rounded-lg bg-red-100 px-2 py-1 text-xs font-black text-red-700">Sem estoque</span>
                    ) : (
                      <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-black text-green-700">OK</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row">
        <button
          onClick={loadProducts}
          className="rounded-xl bg-gray-200 px-6 py-3 font-bold text-gray-800 transition hover:bg-gray-300"
        >
          Recarregar
        </button>
        <button
          onClick={handleSavePhysicalStock}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-black text-white transition hover:bg-blue-800 disabled:bg-gray-400"
        >
          {saving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar estoque fisico
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-6 py-3 font-black text-white transition hover:bg-[#E56000] disabled:bg-gray-400"
        >
          {saving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'Salvando...' : 'Salvar abertura do dia'}
        </button>
        <button
          onClick={handleCloseDayStock}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-black text-white transition hover:bg-gray-800 disabled:bg-gray-400"
        >
          {saving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Fechar estoque do dia
        </button>
      </div>
    </div>
  );
}
