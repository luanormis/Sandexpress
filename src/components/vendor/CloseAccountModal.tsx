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
  umbrella_number?: number;
}

interface AccountPaymentSummary {
  total: number;
  base_total: number;
  service_fee_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payments: Array<{ id: string; amount: number; payer_name: string; payment_method: string; created_at: string }>;
}

export default function CloseAccountModal() {
  const [searchType, setSearchType] = useState<'umbrella' | 'phone'>('umbrella');
  const [searchInput, setSearchInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'split'>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [splitPeople, setSplitPeople] = useState(2);
  const [notes, setNotes] = useState('');
  const [payerName, setPayerName] = useState('');
  const [accountSummary, setAccountSummary] = useState<AccountPaymentSummary | null>(null);
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
    setAccountSummary(null);

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
      setPayerName(result.customer_name || 'Cliente');
      const paymentResponse = await fetch(`/api/account-payments?vendor_id=${encodeURIComponent(vendorId)}&order_id=${encodeURIComponent(result.order_id)}`);
      if (paymentResponse.ok) setAccountSummary(await paymentResponse.json());
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
      const total = Number(accountSummary?.remaining_amount ?? orderPreview.total ?? 0);
      const parsedPartial = Math.max(0, Number(partialAmount.replace(',', '.')) || 0);
      const requestedAmount = paymentMode === 'partial'
        ? Math.min(parsedPartial, total)
        : paymentMode === 'split'
          ? Number((total / Math.max(1, splitPeople)).toFixed(2))
          : total;
      const body = {
        vendor_id: vendorId,
        order_id: orderPreview.order_id,
        amount: requestedAmount,
        payment_method: paymentMethod,
        payer_name: payerName || 'Cliente',
        note: notes,
        idempotency_key: crypto.randomUUID(),
      };

      const response = await fetch('/api/account-payments', {
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
      if (result.closed) {
        setMessage('Conta totalmente recebida e guarda-sol liberado.');
        setOrderPreview(null);
        setAccountSummary(null);
        setSearchInput('');
        setPartialAmount('');
        setPaymentMode('full');
      } else {
        const summaryResponse = await fetch(`/api/account-payments?vendor_id=${encodeURIComponent(vendorId)}&order_id=${encodeURIComponent(orderPreview.order_id)}`);
        if (summaryResponse.ok) setAccountSummary(await summaryResponse.json());
        setMessage(`Pagamento registrado. Ainda faltam R$ ${Number(result.remaining_amount || 0).toFixed(2).replace('.', ',')}.`);
        setPartialAmount('');
      }

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
  const previewTotal = Number(accountSummary?.remaining_amount ?? orderPreview?.total ?? 0);
  const parsedPartial = Math.max(0, Number(partialAmount.replace(',', '.')) || 0);
  const paymentAmount = paymentMode === 'partial'
    ? Math.min(parsedPartial, previewTotal)
    : paymentMode === 'split'
      ? Number((previewTotal / Math.max(1, splitPeople)).toFixed(2))
      : previewTotal;
  const remainingAmount = Math.max(0, Number((previewTotal - paymentAmount).toFixed(2)));

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
              <p className="text-lg font-bold text-gray-900">#{orderPreview.umbrella_number || orderPreview.umbrella_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tempo Aberto</p>
              <p className="text-lg font-bold text-gray-900">{timeOpened}min</p>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">SALDO A RECEBER</p>
            <p className="text-4xl font-bold text-blue-900 mt-1">
              R$ {previewTotal.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Consumo: R$ {Number(accountSummary?.base_total ?? orderPreview.total ?? 0).toFixed(2)} · Serviço: R$ {Number(accountSummary?.service_fee_amount || 0).toFixed(2)} · Já recebido: R$ {Number(accountSummary?.paid_amount || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome de quem está pagando</label>
            <input value={payerName} onChange={(event) => setPayerName(event.target.value)} maxLength={100} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium" placeholder="Ex.: Maria" />
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
              <option value="cash">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="debit_card">Cartao de debito</option>
              <option value="credit_card">Cartao de credito</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Modo de pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['full', 'Total'],
                ['partial', 'Parcial'],
                ['split', 'Dividir'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode as 'full' | 'partial' | 'split')}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    paymentMode === mode
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {paymentMode === 'partial' && (
              <input
                type="text"
                inputMode="decimal"
                value={partialAmount}
                onChange={(event) => setPartialAmount(event.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="Valor parcial"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium"
              />
            )}

            {paymentMode === 'split' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSplitPeople((value) => Math.max(1, value - 1))}
                  className="h-10 w-10 rounded-lg border border-gray-300 font-bold"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={splitPeople}
                  onChange={(event) => setSplitPeople(Math.max(1, Math.min(50, Number(event.target.value.replace(/\D/g, '')) || 1)))}
                  className="h-10 w-20 rounded-lg border border-gray-300 text-center font-bold"
                  aria-label="Quantidade de pessoas"
                />
                <button
                  type="button"
                  onClick={() => setSplitPeople((value) => Math.min(50, value + 1))}
                  className="h-10 w-10 rounded-lg border border-gray-300 font-bold"
                >
                  +
                </button>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <div className="flex justify-between">
                <span>{paymentMode === 'split' ? 'Valor por pessoa' : paymentMode === 'partial' ? 'Pagamento agora' : 'Pagamento'}</span>
                <strong>R$ {paymentAmount.toFixed(2)}</strong>
              </div>
              {remainingAmount > 0 && (
                <div className="mt-1 flex justify-between text-blue-700">
                  <span>Saldo restante</span>
                  <strong>R$ {remainingAmount.toFixed(2)}</strong>
                </div>
              )}
            </div>
          </div>

          {(accountSummary?.payments || []).length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-sm font-bold text-gray-800">Pagamentos já registrados</p>
              <div className="space-y-2">
                {accountSummary!.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700">{payment.payer_name}</span>
                    <strong className="text-green-700">R$ {Number(payment.amount).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              disabled={confirming || paymentAmount <= 0 || paymentAmount > previewTotal}
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
