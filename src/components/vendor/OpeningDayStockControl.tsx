'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader, Minus, Pencil, Plus, Save, Trash2, Utensils } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  promotional_price?: number | null;
  description?: string | null;
  image_url?: string | null;
  is_combo?: boolean;
  sort_order?: number;
  stock_tracking_enabled?: boolean | null;
  physical_stock_quantity?: number | null;
  beach_stock_quantity?: number | null;
  stock_quantity?: number | null;
  blocked_by_stock?: boolean | null;
  active: boolean;
}

type OpeningDayStockControlProps = {
  vendorId?: string;
  products?: Product[];
  onProductsLoaded?: (products: Product[]) => void;
  onAddProduct?: () => void;
  onEditProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
};

export default function OpeningDayStockControl({
  vendorId: vendorIdProp,
  products: externalProducts,
  onProductsLoaded,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
}: OpeningDayStockControlProps) {
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
      onProductsLoaded?.(data);
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

  useEffect(() => {
    if (externalProducts) {
      setProducts(externalProducts);
      const initial: Record<string, number> = {};
      const physicalInitial: Record<string, number> = {};
      externalProducts.forEach((product: Product) => {
        initial[product.id] = product.beach_stock_quantity || product.stock_quantity || 0;
        physicalInitial[product.id] = product.physical_stock_quantity || 0;
      });
      setStockUpdates(initial);
      setPhysicalUpdates(physicalInitial);
    }
  }, [externalProducts]);

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
        ? `Fechamento de estoque salvo: ${result.updated_count} produtos devolvidos ao estoque central.`
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Controle de estoque</h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Cada quiosque controla seu estoque central e o estoque levado para a praia.
            </p>
          </div>
          {onAddProduct && (
            <button
              type="button"
              onClick={onAddProduct}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-3 font-black text-white shadow-sm transition hover:bg-[#E56000] active:scale-95"
            >
              <Plus size={18} />
              Adicionar produto
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e2bfb0] bg-[#fff8f6] p-4">
            <p className="text-xs font-black uppercase text-[#3d1a0a]">Estoque central</p>
            <p className="mt-1 text-sm font-bold text-[#82533f]">Quantidade fisica guardada no quiosque.</p>
          </div>
          <div className="rounded-xl border border-[#ffb693] bg-[#fff1eb] p-4">
            <p className="text-xs font-black uppercase text-[#a04100]">Estoque praia</p>
            <p className="mt-1 text-sm font-bold text-[#572000]">Quantidade disponivel para venda no cardapio do cliente.</p>
          </div>
        </div>
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
          Nenhum produto cadastrado para este quiosque.
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-gray-300">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Utensils size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-gray-900">{product.name}</p>
                        <p className="text-sm font-semibold text-gray-500">R$ {product.price.toFixed(2)}</p>
                        <p className="text-xs font-bold text-gray-500">
                          Estoque central: {product.physical_stock_quantity || 0} un. | Estoque praia: {product.beach_stock_quantity ?? product.stock_quantity ?? 0} un.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="min-w-[9.5rem] rounded-xl border border-[#e2bfb0] bg-white p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-black uppercase text-[#3d1a0a]">Estoque central</label>
                      <input
                        type="number"
                        min="0"
                        value={physicalUpdates[product.id] || 0}
                        onChange={(event) => setPhysicalStock(product.id, event.target.value)}
                        disabled={!tracksStock}
                        className="h-10 w-full rounded-lg border border-[#e2bfb0] bg-[#fff8f6] px-3 text-center font-black text-[#3d1a0a] outline-none focus:border-[#FF6B00] disabled:bg-gray-100"
                        aria-label={`Estoque central de ${product.name}`}
                      />
                    </div>
                    <div className="min-w-[14rem] rounded-xl border border-[#ffb693] bg-[#fff7f2] p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-black uppercase text-[#a04100]">Estoque praia</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stepStock(product.id, -1)}
                          disabled={!tracksStock || quantity <= 0}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#ffb693] bg-white text-[#a04100] hover:bg-[#fff1eb] disabled:opacity-40"
                          aria-label={`Diminuir estoque de praia de ${product.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(event) => setStock(product.id, event.target.value)}
                          disabled={!tracksStock}
                          className="h-10 w-20 rounded-lg border border-[#ffb693] bg-white px-3 text-center font-black text-[#572000] outline-none focus:border-[#FF6B00]"
                          aria-label={`Estoque praia de ${product.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => stepStock(product.id, 1)}
                          disabled={!tracksStock}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#ffb693] bg-white text-[#a04100] hover:bg-[#fff1eb]"
                          aria-label={`Aumentar estoque de praia de ${product.name}`}
                        >
                          <Plus size={16} />
                        </button>
                        <span className="text-sm font-semibold text-[#82533f]">unid.</span>
                      </div>
                    </div>

                    {!tracksStock ? (
                      <span className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-black text-gray-600">Nao contabiliza</span>
                    ) : quantity === 0 ? (
                      <span className="rounded-lg bg-red-100 px-2 py-1 text-xs font-black text-red-700">Sem estoque</span>
                    ) : (
                      <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-black text-green-700">OK</span>
                    )}
                    {onEditProduct && (
                      <button
                        type="button"
                        onClick={() => onEditProduct(product)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:text-gray-900"
                        aria-label={`Alterar produto ${product.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {onDeleteProduct && (
                      <button
                        type="button"
                        onClick={() => onDeleteProduct(product.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-white text-red-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Deletar produto ${product.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
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
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#3d1a0a] px-6 py-3 font-black text-white transition hover:bg-[#261812] disabled:bg-gray-400"
        >
          {saving ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar estoque central
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
