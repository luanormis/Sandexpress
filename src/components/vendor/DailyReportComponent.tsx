'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Award, BarChart3, Clock, Download, Loader, PackageCheck, Search, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface DailyReportData {
  date: string;
  summary: {
    total_orders: number;
    total_revenue: number;
    total_items_sold: number;
    avg_ticket: number;
    unique_customers: number;
    total_gross_revenue?: number;
    total_payment_fees?: number;
    total_net_revenue?: number;
    payment_methods: Record<string, { count: number; total: number; gross?: number; fees?: number; net?: number }>;
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
    paid_at?: string;
  }>;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  category_performance?: Array<{ category: string; quantity: number; revenue: number }>;
  low_stock_alerts?: Array<{ name: string; category: string; quantity: number; blocked: boolean }>;
  hourly_breakdown: Array<{ hour: string; orders: number; revenue: number }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  credit_card: 'Cartao credito',
  debit_card: 'Cartao debito',
  card: 'Cartao',
};

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
}

function paymentLabel(method: string) {
  return PAYMENT_LABELS[method] || method;
}

export default function DailyReportComponent() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendor_id') || '' : '';

  const loadReport = async () => {
    if (!vendorId) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/daily-report?vendor_id=${vendorId}&date=${selectedDate}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao carregar relatorio');
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
    if (vendorId) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const handleExportPDF = () => {
    if (!report) return;

    const paymentRows = Object.entries(report.summary.payment_methods || {})
      .map(([method, data]) => `
        <tr>
          <td>${paymentLabel(method)}</td>
          <td>${data.count}</td>
          <td>${formatCurrency(Number(data.gross ?? data.total ?? 0))}</td>
          <td>${formatCurrency(Number(data.fees ?? 0))}</td>
          <td>${formatCurrency(Number(data.net ?? data.total ?? 0))}</td>
        </tr>
      `)
      .join('');

    const lowStockRows = (report.low_stock_alerts || [])
      .map((item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.category}</td>
          <td>${item.quantity} un.</td>
          <td>${item.blocked || item.quantity <= 0 ? 'Sem estoque' : 'Baixo'}</td>
        </tr>
      `)
      .join('');

    const categoryRows = (report.category_performance || [])
      .map((item) => `
        <tr>
          <td>${item.category}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.revenue)}</td>
        </tr>
      `)
      .join('');

    const productRows = report.top_products
      .map((product) => `
        <tr>
          <td>${product.name}</td>
          <td>${product.quantity}</td>
          <td>${formatCurrency(product.revenue)}</td>
        </tr>
      `)
      .join('');

    const hourRows = report.hourly_breakdown
      .map((hour) => `
        <tr>
          <td>${hour.hour}</td>
          <td>${hour.orders}</td>
          <td>${formatCurrency(hour.revenue)}</td>
        </tr>
      `)
      .join('');

    const orderRows = report.orders
      .map((order) => `
        <tr>
          <td>#${order.umbrella_number}</td>
          <td>${order.customer_name}</td>
          <td>${order.items_count}</td>
          <td>${paymentLabel(order.payment_method)}</td>
          <td>${formatCurrency(order.total)}</td>
          <td>${new Date(order.paid_at || order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
      `)
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatorio do Dia - ${selectedDate}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 24px; color: #111111; background: #ffffff; font-family: Arial, sans-serif; }
            header { border-bottom: 3px solid #111111; padding-bottom: 14px; margin-bottom: 18px; }
            h1 { margin: 0; font-size: 26px; color: #111111; }
            h2 { margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #cfcfcf; color: #111111; font-size: 16px; }
            p { margin: 5px 0; color: #444444; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
            .box { border: 1px solid #bdbdbd; border-radius: 8px; background: #f4f4f4; padding: 10px; }
            .box span { display: block; color: #555555; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .box strong { display: block; margin-top: 5px; color: #111111; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; background: #ffffff; }
            th, td { border: 1px solid #cfcfcf; padding: 7px; color: #111111; text-align: left; font-size: 11px; }
            th { background: #e5e5e5; font-size: 10px; text-transform: uppercase; }
            tr:nth-child(even) td { background: #f7f7f7; }
            footer { margin-top: 26px; color: #555555; text-align: center; font-size: 11px; }
            @media print { body { padding: 16px; } .summary { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <header>
            <h1>Relatorio de fechamento do dia</h1>
            <p><strong>Data:</strong> ${formatDate(selectedDate)}</p>
            <p>Use este relatorio para conferir vendas, estoque baixo e categorias que mais vendem.</p>
          </header>

          <section class="summary">
            <div class="box"><span>Faturamento</span><strong>${formatCurrency(report.summary.total_revenue)}</strong></div>
            <div class="box"><span>Pedidos pagos</span><strong>${report.summary.total_orders}</strong></div>
            <div class="box"><span>Clientes</span><strong>${report.summary.unique_customers}</strong></div>
            <div class="box"><span>Ticket medio</span><strong>${formatCurrency(report.summary.avg_ticket)}</strong></div>
          </section>

          <h2>Meios de pagamento</h2>
          <table><thead><tr><th>Metodo</th><th>Contas</th><th>Bruto</th><th>Taxas</th><th>Liquido</th></tr></thead><tbody>${paymentRows || '<tr><td colspan="5">Sem pagamentos no dia.</td></tr>'}</tbody></table>

          <h2>Alertas de estoque</h2>
          <table><thead><tr><th>Produto</th><th>Categoria</th><th>Restante</th><th>Status</th></tr></thead><tbody>${lowStockRows || '<tr><td colspan="4">Nenhum produto com estoque baixo.</td></tr>'}</tbody></table>

          <h2>Drinks, porcoes e categorias</h2>
          <table><thead><tr><th>Categoria</th><th>Itens vendidos</th><th>Faturamento</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">Sem vendas por categoria.</td></tr>'}</tbody></table>

          <h2>Produtos mais vendidos</h2>
          <table><thead><tr><th>Produto</th><th>Quantidade</th><th>Faturamento</th></tr></thead><tbody>${productRows || '<tr><td colspan="3">Sem produtos vendidos.</td></tr>'}</tbody></table>

          <h2>Vendas por hora</h2>
          <table><thead><tr><th>Hora</th><th>Pedidos</th><th>Faturamento</th></tr></thead><tbody>${hourRows || '<tr><td colspan="3">Sem vendas por hora.</td></tr>'}</tbody></table>

          <h2>Pedidos</h2>
          <table><thead><tr><th>Guarda-sol</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Hora</th></tr></thead><tbody>${orderRows || '<tr><td colspan="6">Sem pedidos pagos.</td></tr>'}</tbody></table>

          <footer>Relatorio gerado em ${new Date().toLocaleString('pt-BR')}</footer>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const paymentMethods = report?.summary.payment_methods || {};

  return (
    <div className="vendor-ops-shell vendor-sales-surface min-h-screen space-y-6 bg-[#fff3ec] p-4 text-[#2d1b14] sm:p-6">
      <div className="rounded-2xl border border-[#e5c2ae] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#a44100]">Relatorio simples</p>
            <h1 className="mt-1 text-2xl font-black text-[#2d1b14] sm:text-3xl">Fechamento do dia</h1>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-[#5a2d1d]">
              Veja em poucos blocos quanto entrou, quais produtos precisam de reposicao e quais categorias venderam melhor.
              O PDF e gerado em preto e cinza para impressao limpa.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
            <label className="text-sm font-black text-[#2d1b14]">
              Data
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setReport(null);
                }}
                className="mt-1 w-full rounded-xl border border-[#e5c2ae] bg-[#fffaf6] px-4 py-3 font-black text-[#2d1b14]"
              />
            </label>
            <button
              onClick={loadReport}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ff6b00] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
            >
              <Search size={18} />
              Buscar
            </button>
            <button
              onClick={handleExportPDF}
              disabled={!report || loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#8a3e22] bg-white px-4 py-3 text-sm font-black text-[#5a2d1d] disabled:opacity-60"
            >
              <Download size={18} />
              PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex gap-2 rounded-xl border border-[#f1b8a8] bg-[#fff1e8] p-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-[#8f1d1d]" />
            <p className="text-sm font-bold text-[#8f1d1d]">{error}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#e5c2ae] bg-white p-12">
          <Loader className="mr-3 h-8 w-8 animate-spin text-[#a44100]" />
          <span className="text-lg font-black text-[#2d1b14]">Gerando relatorio...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Faturamento" value={formatCurrency(report.summary.total_revenue)} icon={<TrendingUp />} />
            <SummaryCard title="Pedidos pagos" value={String(report.summary.total_orders)} icon={<ShoppingBag />} />
            <SummaryCard title="Clientes unicos" value={String(report.summary.unique_customers)} icon={<Users />} />
            <SummaryCard title="Ticket medio" value={formatCurrency(report.summary.avg_ticket)} icon={<BarChart3 />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ReportCard title="Como analisar" icon={<BarChart3 />}>
              <p className="text-sm font-bold leading-6 text-[#5a2d1d]">
                1. Veja se o faturamento esta bom. 2. Confira estoque baixo. 3. Veja categorias e produtos para decidir compra e preparo.
              </p>
            </ReportCard>

            <ReportCard title="Estoque quase acabando" icon={<PackageCheck />}>
              {(report.low_stock_alerts || []).length === 0 ? (
                <EmptyText>Nenhum produto com alerta agora.</EmptyText>
              ) : (
                <div className="space-y-2">
                  {(report.low_stock_alerts || []).slice(0, 5).map((item) => (
                    <div key={`${item.name}-${item.category}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5c2ae] bg-[#fffaf6] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2d1b14]">{item.name}</p>
                        <p className="text-xs font-bold text-[#5a2d1d]">{item.category}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-black text-[#8a3e22]">{item.quantity} un.</span>
                    </div>
                  ))}
                </div>
              )}
            </ReportCard>

            <ReportCard title="Drinks e porcoes" icon={<Award />}>
              <p className="mb-3 text-sm font-bold leading-6 text-[#5a2d1d]">
                Hoje mostramos faturamento por categoria. Margem real precisa do cadastro de custo dos insumos.
              </p>
              {(report.category_performance || []).length === 0 ? (
                <EmptyText>Sem vendas por categoria.</EmptyText>
              ) : (
                <div className="space-y-2">
                  {(report.category_performance || []).slice(0, 4).map((item) => (
                    <MetricRow key={item.category} label={item.category} detail={`${item.quantity} itens`} value={formatCurrency(item.revenue)} />
                  ))}
                </div>
              )}
            </ReportCard>
          </div>

          <ReportCard title="Meios de recebimento" icon={<ShoppingBag />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(paymentMethods).length === 0 ? (
                <EmptyText>Nenhuma conta paga no dia.</EmptyText>
              ) : Object.entries(paymentMethods).map(([method, data]) => (
                <div key={method} className="rounded-xl border border-[#e5c2ae] bg-[#fffaf6] p-4">
                  <p className="text-sm font-black text-[#2d1b14]">{paymentLabel(method)}</p>
                  <p className="mt-1 text-2xl font-black text-[#a44100]">{data.count}</p>
                  <p className="mt-2 text-xs font-bold text-[#5a2d1d]">Bruto: {formatCurrency(Number(data.gross ?? data.total ?? 0))}</p>
                  <p className="text-xs font-bold text-[#8f1d1d]">Taxas: {formatCurrency(Number(data.fees ?? 0))}</p>
                  <p className="text-xs font-bold text-[#2f4858]">Liquido: {formatCurrency(Number(data.net ?? data.total ?? 0))}</p>
                </div>
              ))}
            </div>
          </ReportCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportTable
              title="Produtos mais vendidos"
              icon={<Award />}
              headers={['Produto', 'Qtd', 'Faturamento']}
              rows={report.top_products.map((product) => [product.name, String(product.quantity), formatCurrency(product.revenue)])}
              empty="Sem produtos vendidos."
            />
            <ReportTable
              title="Vendas por hora"
              icon={<Clock />}
              headers={['Hora', 'Pedidos', 'Faturamento']}
              rows={report.hourly_breakdown.map((hour) => [hour.hour, String(hour.orders), formatCurrency(hour.revenue)])}
              empty="Sem vendas por hora."
            />
          </div>

          <ReportTable
            title={`Pedidos pagos (${report.orders.length})`}
            icon={<ShoppingBag />}
            headers={['Guarda-sol', 'Cliente', 'Itens', 'Pagamento', 'Total', 'Hora']}
            rows={report.orders.map((order) => [
              `#${order.umbrella_number}`,
              order.customer_name,
              String(order.items_count),
              paymentLabel(order.payment_method),
              formatCurrency(order.total),
              new Date(order.paid_at || order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            ])}
            empty="Sem pedidos pagos."
          />
        </>
      ) : (
        <div className="rounded-2xl border border-[#e5c2ae] bg-white p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-16 w-16 text-[#a44100]" />
          <p className="text-lg font-black text-[#5a2d1d]">Selecione uma data para ver o relatorio.</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e5c2ae] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-[#5a2d1d]">{title}</p>
          <p className="mt-2 text-3xl font-black text-[#a44100]">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1e8] text-[#8a3e22] [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e5c2ae] bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#2d1b14] [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-[#a44100]">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-[#fff1e8] p-4 text-sm font-bold text-[#5a2d1d]">{children}</p>;
}

function MetricRow({ label, detail, value }: { label: string; detail: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fff1e8] px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-black text-[#2d1b14]">{label}</span>
        <span className="text-sm font-black text-[#a44100]">{value}</span>
      </div>
      <p className="text-xs font-bold text-[#5a2d1d]">{detail}</p>
    </div>
  );
}

function ReportTable({ title, icon, headers, rows, empty }: { title: string; icon: ReactNode; headers: string[]; rows: string[][]; empty: string }) {
  return (
    <ReportCard title={title} icon={icon}>
      {rows.length === 0 ? (
        <EmptyText>{empty}</EmptyText>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead>
              <tr className="border-b-2 border-[#e5c2ae] bg-[#fff1e8]">
                {headers.map((header) => (
                  <th key={header} className="px-3 py-3 text-left font-black text-[#2d1b14]">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[#efd5ca]">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-3 font-bold text-[#2d1b14]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportCard>
  );
}
