'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Loader, Save } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number | null;
  blocked_by_stock: boolean;
  active: boolean;
}

export default function OpeningDayStockControl() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') || '' : '';

  // Carrega produtos ao abrir
  useEffect(() => {
    if (vendorId) {
      loadProducts();
    }
  }, [vendorId]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stock?vendor_id=${vendorId}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        // Inicializar com valores atuais
        const initial: Record<string, number> = {};
        data.forEach((p: Product) => {
          initial[p.id] = p.stock_quantity || 0;
        });
        setStockUpdates(initial);
      }
    } catch (err) {
      setError('Erro ao carregar produtos: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (productId: string, value: string) => {
    const num = parseInt(value) || 0;
    setStockUpdates(prev => ({
      ...prev,
      [productId]: num,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updates = Object.entries(stockUpdates).map(([product_id, stock_quantity]) => ({
        product_id,
        stock_quantity,
      }));

      const response = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          updates,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao salvar estoque');
        return;
      }

      setMessage(`✓ Estoque atualizado! ${result.updated_count} produtos salvos.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Erro ao salvar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2">Carregando produtos...</span>
      </div>
    );
  }

  // Agrupar por categoria
  const grouped = products.reduce((acc: Record<string, Product[]>, p) => {
    const cat = p.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">🌅 Abertura do Dia</h1>
        <p className="text-gray-600 mt-1">Atualize o estoque dos itens para o controle de venda</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {/* Categorias de Produtos */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
            {category}
          </h2>

          <div className="space-y-3">
            {items.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">R$ {product.price.toFixed(2)}</p>
                </div>

                {/* Input de Estoque */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={stockUpdates[product.id] || 0}
                    onChange={(e) => handleStockChange(product.id, e.target.value)}
                    placeholder="0"
                    className="w-16 px-3 py-2 border border-gray-300 rounded-md text-center font-semibold"
                  />
                  <span className="text-sm text-gray-500 w-10">unid.</span>

                  {/* Indicador de Status */}
                  {stockUpdates[product.id] === 0 ? (
                    <div className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-medium">
                      ⚠️ Sem estoque
                    </div>
                  ) : (
                    <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                      ✓ OK
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Botão Salvar */}
      <div className="flex gap-3 sticky bottom-6">
        <button
          onClick={loadProducts}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition"
        >
          Recarregar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Salvar Estoque
            </>
          )}
        </button>
      </div>

      {/* Resumo */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          💡 <strong>Dica:</strong> Preencha os números dos itens em estoque. Itens com 0 unidades ficarão indisponíveis para venda.
        </p>
      </div>
    </div>
  );
}
