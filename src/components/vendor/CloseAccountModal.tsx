'use client';

import { useState } from 'react';
import { AlertCircle, Check, X, Search, DollarSign, Phone } from 'lucide-react';

interface OrderPreview {
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  umbrella_id: string;
  total: number;
  items_count: number;
  created_at: string;
  opened_at: string;
}

export default function CloseAccountModal() {
  const [searchType, setSearchType] = useState<'umbrella' | 'phone'>('umbrella');
  const [searchInput, setSearchInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') || '' : '';

  const handleSearch = async () => {
    setError('');
    setMessage('');
    setOrderPreview(null);

    if (!searchInput.trim()) {
      setError('Digite um número de guarda-sol ou telefone');
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        vendor_id: vendorId,
      });

      if (searchType === 'umbrella') {
        params.append('umbrella_id', searchInput);
      } else {
        params.append('customer_phone', searchInput);
      }

      const response = await fetch(`/api/close-account?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Conta não encontrada');
        return;
      }

      setOrderPreview(result);
      setMessage('✓ Conta encontrada! Revise os dados antes de confirmar.');
    } catch (err) {
      setError('Erro na busca: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!orderPreview) return;

    setConfirming(true);
    setError('');
    setMessage('');

    try {
      const body: any = {
        vendor_id: vendorId,
        payment_method: paymentMethod,
      };

      if (searchType === 'umbrella') {
        body.umbrella_id = searchInput;
      } else {
        body.customer_phone = searchInput;
      }

      if (notes) body.notes = notes;

      const response = await fetch('/api/close-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao fechar conta');
        return;
      }

      setSuccess(true);
      setMessage(result.message || 'Conta fechada com sucesso!');
      setOrderPreview(null);
      setSearchInput('');

      // Limpar após 2 segundos
      setTimeout(() => {
        setSuccess(false);
        setMessage('');
      }, 2000);
    } catch (err) {
      setError('Erro ao fechar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setConfirming(false);
    }
  };

  const timeOpened = orderPreview
    ? Math.floor(
        (Date.now() - new Date(orderPreview.opened_at).getTime()) / 60000
      )
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">💳 Fechar Conta</h1>
        <p className="text-gray-600 mt-1">Busque e feche a conta do cliente</p>
      </div>

      {/* Seção de Busca */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Buscar Conta Aberta</h2>

        {/* Tipo de Busca */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSearchType('umbrella');
              setSearchInput('');
              setOrderPreview(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              searchType === 'umbrella'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏖️ Por Guarda-sol
          </button>
          <button
            onClick={() => {
              setSearchType('phone');
              setSearchInput('');
              setOrderPreview(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              searchType === 'phone'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Phone className="w-4 h-4 inline mr-1" /> Por Telefone
          </button>
        </div>

        {/* Input de Busca */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={
              searchType === 'umbrella' ? 'Ex: 12' : 'Ex: 11999999999'
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-2"
          >
            {loading ? '...' : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {message && !orderPreview && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-700">{message}</p>
          </div>
        )}
      </div>

      {/* Prévia da Conta */}
      {orderPreview && (
        <div className="bg-white border-2 border-green-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-green-100">
            <Check className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-700">Conta Encontrada</h3>
          </div>

          {/* Detalhes do Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Nome do Cliente</p>
              <p className="text-lg font-bold text-gray-900">{orderPreview.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="text-lg font-bold text-gray-900">{orderPreview.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Guarda-sol</p>
              <p className="text-lg font-bold text-gray-900">#{orderPreview.umbrella_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tempo Aberto</p>
              <p className="text-lg font-bold text-gray-900">{timeOpened}min</p>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">TOTAL A PAGAR</p>
            <p className="text-4xl font-bold text-blue-900 mt-1">
              R$ {orderPreview.total.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              {orderPreview.items_count} itens na conta
            </p>
          </div>

          {/* Método de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium"
            >
              <option value="cash">💵 Dinheiro</option>
              <option value="card">💳 Cartão</option>
              <option value="transfer">🏦 Transferência</option>
              <option value="pix">📲 PIX</option>
              <option value="other">📝 Outro</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente pediu desconto, sem troco, etc."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setOrderPreview(null);
                setSearchInput('');
                setNotes('');
              }}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition"
            >
              <X className="w-4 h-4 inline mr-2" /> Cancelar
            </button>
            <button
              onClick={handleCloseAccount}
              disabled={confirming}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
            >
              {confirming ? (
                '⏳ Processando...'
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  Confirmar Pagamento
                </>
              )}
            </button>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          ℹ️ <strong>Dica:</strong> Após confirmar o pagamento, o guarda-sol será automaticamente liberado para o próximo cliente. O cliente poderá ver seu histórico de compras.
        </p>
      </div>
    </div>
  );
}
