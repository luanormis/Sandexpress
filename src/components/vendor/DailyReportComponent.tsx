'use client';

import { useEffect, useState } from 'react';
import { Download, Loader, AlertCircle, BarChart3, TrendingUp, Users, ShoppingBag, DollarSign, Clock } from 'lucide-react';

interface DailyReportData {
  date: string;
  summary: {
    total_orders: number;
    total_revenue: number;
    total_items_sold: number;
    avg_ticket: number;
    unique_customers: number;
    payment_methods: Record<string, { count: number; total: number }>;
  };
  orders: Array<{
    id: string;
    umbrella_number: string | number;
    customer_name: string;
    customer_phone: string;
    total: number;
    status: string;
    payment_method: string;
    items_count: number;
    created_at: string;
  }>;
  top_products: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  hourly_breakdown: Array<{
    hour: string;
    orders: number;
    revenue: number;
  }>;
}

export default function DailyReportComponent() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') || '' : '';

  const loadReport = async () => {
    if (!vendorId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/daily-report?vendor_id=${vendorId}&date=${selectedDate}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao carregar relatório');
        return;
      }

      setReport(data);
    } catch (err) {
      setError('Erro ao carregar: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      loadReport();
    }
  }, [vendorId]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setReport(null);
  };

  const handleSearch = () => {
    loadReport();
  };

  const handleExportPDF = () => {
    if (!report) return;

    // Criar conteúdo HTML para PDF
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatório do Dia - ${selectedDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
            h2 { color: #0066cc; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
            th { background-color: #0066cc; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
            .summary-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; }
            .summary-box h3 { margin: 0 0 10px 0; color: #0066cc; }
            .summary-box p { margin: 5px 0; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>📊 Relatório de Encerramento do Dia</h1>
          <p><strong>Data:</strong> ${new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
          
          <div class="summary">
            <div class="summary-box">
              <h3>💰 Faturamento Total</h3>
              <p>R$ ${report.summary.total_revenue.toFixed(2)}</p>
            </div>
            <div class="summary-box">
              <h3>📦 Pedidos Completados</h3>
              <p>${report.summary.total_orders}</p>
            </div>
            <div class="summary-box">
              <h3>👥 Clientes Únicos</h3>
              <p>${report.summary.unique_customers}</p>
            </div>
            <div class="summary-box">
              <h3>🎫 Ticket Médio</h3>
              <p>R$ ${report.summary.avg_ticket.toFixed(2)}</p>
            </div>
          </div>

          <h2>💳 Métodos de Pagamento</h2>
          <table>
            <tr>
              <th>Método</th>
              <th>Quantidade</th>
              <th>Total</th>
            </tr>
            ${Object.entries(report.summary.payment_methods)
              .map(([method, data]) => `
                <tr>
                  <td>${method.toUpperCase()}</td>
                  <td>${data.count}</td>
                  <td>R$ ${data.total.toFixed(2)}</td>
                </tr>
              `)
              .join('')}
          </table>

          <h2>🏆 Top 10 Produtos Mais Vendidos</h2>
          <table>
            <tr>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Faturamento</th>
            </tr>
            ${report.top_products
              .map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.quantity}</td>
                  <td>R$ ${p.revenue.toFixed(2)}</td>
                </tr>
              `)
              .join('')}
          </table>

          <h2>📈 Vendas por Hora</h2>
          <table>
            <tr>
              <th>Hora</th>
              <th>Pedidos</th>
              <th>Faturamento</th>
            </tr>
            ${report.hourly_breakdown
              .map(h => `
                <tr>
                  <td>${h.hour}</td>
                  <td>${h.orders}</td>
                  <td>R$ ${h.revenue.toFixed(2)}</td>
                </tr>
              `)
              .join('')}
          </table>

          <h2>📋 Todos os Pedidos</h2>
          <table>
            <tr>
              <th>Guarda-sol</th>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Itens</th>
              <th>Pagamento</th>
              <th>Total</th>
              <th>Hora</th>
            </tr>
            ${report.orders
              .map(o => `
                <tr>
                  <td>#${o.umbrella_number}</td>
                  <td>${o.customer_name}</td>
                  <td>${o.customer_phone}</td>
                  <td>${o.items_count}</td>
                  <td>${o.payment_method.toUpperCase()}</td>
                  <td>R$ ${o.total.toFixed(2)}</td>
                  <td>${new Date(o.created_at).toLocaleTimeString('pt-BR')}</td>
                </tr>
              `)
              .join('')}
          </table>

          <hr style="margin-top: 40px;">
          <p style="text-align: center; color: #666; font-size: 12px;">
            Relatório gerado em ${new Date().toLocaleString('pt-BR')}
          </p>
        </body>
      </html>
    `;

    // Abrir em nova aba para impressão
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const paymentMethods = report?.summary.payment_methods || {};

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="border-b pb-4 bg-white rounded-lg p-6">
        <h1 className="text-4xl font-bold text-gray-900">📊 Encerramento do Dia</h1>
        <p className="text-gray-600 mt-1">Relatório completo de vendas e faturamento</p>
      </div>

      {/* Seletor de Data */}
      <div className="bg-white rounded-lg p-6 border border-gray-200 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-medium"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? '⏳ Carregando...' : '🔍 Buscar'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!report || loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-lg border border-gray-200">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-lg text-gray-700">Gerando relatório...</span>
        </div>
      ) : report ? (
        <>
          {/* KPIs - Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-400 to-green-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Faturamento Total</p>
                  <p className="text-3xl font-bold mt-2">
                    R$ {report.summary.total_revenue.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-12 h-12 opacity-20" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Pedidos Completados</p>
                  <p className="text-3xl font-bold mt-2">{report.summary.total_orders}</p>
                </div>
                <ShoppingBag className="w-12 h-12 opacity-20" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Clientes Únicos</p>
                  <p className="text-3xl font-bold mt-2">{report.summary.unique_customers}</p>
                </div>
                <Users className="w-12 h-12 opacity-20" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Ticket Médio</p>
                  <p className="text-3xl font-bold mt-2">
                    R$ {report.summary.avg_ticket.toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 opacity-20" />
              </div>
            </div>
          </div>

          {/* Métodos de Pagamento */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              💳 Métodos de Pagamento
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(paymentMethods).map(([method, data]) => (
                <div key={method} className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 font-medium uppercase">{method}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{data.count}</p>
                  <p className="text-sm text-gray-700 mt-1">
                    R$ {data.total.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Produtos Mais Vendidos */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              🏆 Top 10 Produtos Mais Vendidos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Produto</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-700">Qtd</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-700">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {report.top_products.map((product, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{product.name}</td>
                      <td className="py-3 px-4 text-right text-gray-700 font-semibold">
                        {product.quantity}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600 font-bold">
                        R$ {product.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vendas por Hora */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Vendas por Hora
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-bold text-gray-700">Hora</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-700">Pedidos</th>
                    <th className="text-right py-3 px-4 font-bold text-gray-700">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {report.hourly_breakdown.map((hourly, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{hourly.hour}</td>
                      <td className="py-3 px-4 text-right text-gray-700 font-semibold">
                        {hourly.orders}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600 font-bold">
                        R$ {hourly.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Todos os Pedidos */}
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📋 Todos os Pedidos ({report.orders.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Guarda-sol</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Cliente</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Telefone</th>
                    <th className="text-center py-3 px-2 font-bold text-gray-700">Itens</th>
                    <th className="text-left py-3 px-2 font-bold text-gray-700">Pagamento</th>
                    <th className="text-right py-3 px-2 font-bold text-gray-700">Total</th>
                    <th className="text-center py-3 px-2 font-bold text-gray-700">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-900 font-medium">#{order.umbrella_number}</td>
                      <td className="py-2 px-2 text-gray-700">{order.customer_name}</td>
                      <td className="py-2 px-2 text-gray-700">{order.customer_phone}</td>
                      <td className="py-2 px-2 text-center text-gray-700">{order.items_count}</td>
                      <td className="py-2 px-2 text-gray-700 font-medium">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-green-600 font-bold">
                        R$ {order.total.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600">
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Selecione uma data para ver o relatório</p>
        </div>
      )}
    </div>
  );
}
