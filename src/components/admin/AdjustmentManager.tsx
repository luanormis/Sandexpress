'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

interface Adjustment {
  id: string;
  customer_id: string;
  adjustment_type: 'cancellation' | 'deduction' | 'credit';
  amount: number;
  reason?: string;
  description?: string;
  password_verified: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  total_spent: number;
}

export default function AdjustmentManager() {
  const [vendorPassword, setVendorPassword] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<'cancellation' | 'deduction' | 'credit'>('cancellation');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  // Obter vendor_id da sessão/localStorage
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') || '' : '';

  // Carregar lista de customers
  useEffect(() => {
    if (vendorId) {
      loadCustomers();
      loadAdjustments();
    }
  }, [vendorId]);

  const loadCustomers = async () => {
    try {
      const response = await fetch(`/api/customers?vendor_id=${vendorId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomerList(data);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  const loadAdjustments = async () => {
    try {
      const response = await fetch(`/api/adjustments?vendor_id=${vendorId}`);
      if (response.ok) {
        const data = await response.json();
        setAdjustments(data);
      }
    } catch (err) {
      console.error('Erro ao carregar ajustes:', err);
    }
  };

  const handleProcessAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!customerId || !amount || !vendorPassword) {
      setError('Preencha todos os campos obrigatórios');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          vendor_password: vendorPassword,
          customer_id: customerId,
          adjustment_type: adjustmentType,
          amount: parseFloat(amount),
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao processar ajuste');
        return;
      }

      setMessage(`Ajuste de R$ ${amount} processado com sucesso!`);
      setCustomerId('');
      setAmount('');
      setReason('');
      setVendorPassword('');
      loadAdjustments();
      loadCustomers();
    } catch (err) {
      setError('Erro ao processar ajuste: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const getAdjustmentLabel = (type: string): string => {
    const labels: Record<string, string> = {
      cancellation: 'Cancelamento',
      deduction: 'Abatimento',
      credit: 'Crédito',
    };
    return labels[type] || type;
  };

  const getAdjustmentColor = (type: string): string => {
    const colors: Record<string, string> = {
      cancellation: 'text-red-600 bg-red-50',
      deduction: 'text-orange-600 bg-orange-50',
      credit: 'text-green-600 bg-green-50',
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      {/* Panel Título */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciador de Ajustes de Conta</h1>
        <p className="text-gray-600 mt-1">Cancele ou abata itens da conta do cliente</p>
      </div>

      {/* Formulário de Ajuste */}
      <form onSubmit={handleProcessAdjustment} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Novo Ajuste</h2>

        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cliente <span className="text-red-500">*</span>
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium"
          >
            <option value="">Selecione um cliente</option>
            {customerList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) - Total: R$ {c.total_spent.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Ajuste */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Ajuste <span className="text-red-500">*</span>
          </label>
          <select
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium"
          >
            <option value="cancellation">Cancelamento</option>
            <option value="deduction">Abatimento</option>
            <option value="credit">Crédito</option>
          </select>
        </div>

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Valor (R$) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium"
          />
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Motivo/Observação</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Cliente solicitou cancelamento"
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium"
          />
        </div>

        {/* Senha de Acesso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Senha de Acesso <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={vendorPassword}
            onChange={(e) => setVendorPassword(e.target.value)}
            placeholder="Digite sua senha"
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium"
          />
          <p className="text-xs text-gray-500 mt-1">Sua senha de acesso ao painel</p>
        </div>

        {/* Alertas */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 flex gap-2">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{message}</p>
          </div>
        )}

        {/* Botão Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Processando...' : 'Processar Ajuste'}
        </button>
      </form>

      {/* Histórico de Ajustes */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Histórico de Ajustes</h2>

        {adjustments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum ajuste registrado ainda</p>
        ) : (
          <div className="space-y-3">
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getAdjustmentColor(adj.adjustment_type)}`}>
                      {getAdjustmentLabel(adj.adjustment_type)}
                    </span>
                    <span className="font-medium text-gray-900">
                      R$ {adj.amount.toFixed(2)}
                    </span>
                    {adj.reason && <span className="text-sm text-gray-500">- {adj.reason}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(adj.created_at).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(adj.created_at).toLocaleTimeString('pt-BR')}
                  </p>
                </div>
                {adj.password_verified && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="text-xs">Verificado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
