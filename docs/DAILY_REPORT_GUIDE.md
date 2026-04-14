# 📊 Relatório de Encerramento do Dia

## O que é?

O **Relatório de Encerramento do Dia** é uma funcionalidade que permite ao vendor (quiosqueiro) visualizar um resumo completo de todas as operações do dia, incluindo:

- 💰 **Faturamento Total**
- 📦 **Pedidos Completados**
- 👥 **Clientes Únicos**
- 🎫 **Ticket Médio**
- 💳 **Métodos de Pagamento**
- 🏆 **Produtos Mais Vendidos**
- 📈 **Vendas por Hora**
- 📋 **Todos os Pedidos do Dia**

---

## Como Acessar

**URL**: `/vendor/daily-report`

## Como Usar

1. **Acesse a página**: `/vendor/daily-report`
2. **Selecione a data**: Use o campo de data
3. **Clique em Buscar**: Para gerar o relatório
4. **Exporte em PDF**: Clique no botão PDF para baixar/imprimir

### Fluxo Passo a Passo

```
1. Vendor acessa "/vendor/daily-report"
   ↓
2. Sistema carrega o relatório do dia atual (automático)
   ↓
3. Vendor pode selecionar outra data
   ↓
4. Clica "🔍 Buscar" para carregar relatório
   ↓
5. Sistema exibe:
   - KPIs: Faturamento, Pedidos, Clientes, Ticket Médio
   - Métodos de Pagamento (caixa resumida)
   - Top 10 Produtos Mais Vendidos
   - Vendas Hora a Hora
   - Tabela com TODOS os pedidos do dia
   ↓
6. Clica "📥 PDF" para exportar/imprimir
```

---

## 📊 Estrutura do Relatório

### 1. **KPIs (Key Performance Indicators)**
Cards coloridos mostrando:
- 💚 **Faturamento Total** - Total em dinheiro faturado
- 💙 **Pedidos Completados** - Quantidade de pedidos finalizados
- 💜 **Clientes Únicos** - Número de clientes distintos
- 🧡 **Ticket Médio** - Valor médio por pedido

### 2. **Métodos de Pagamento**
Pequenos cards mostrando cada método:
- 💵 **Dinheiro** (Cash)
- 💳 **Cartão** (Card)
- 📲 **PIX**
- 🏦 **Transferência**
- Outros

Cada card mostra:
- Quantidade de transações
- Total em reais

### 3. **Top 10 Produtos Mais Vendidos**
Tabela com:
| Produto | Quantidade | Faturamento |
|---------|-----------|-------------|

### 4. **Vendas por Hora**
Tabela mostrando breakdown por hora:
| Hora | Pedidos | Faturamento |
|------|--------|-------------|

### 5. **Todos os Pedidos**
Tabela completa com cada pedido:
| Guarda-sol | Cliente | Telefone | Itens | Pagamento | Total | Hora |
|-----------|---------|----------|-------|-----------|-------|------|

---

## 🔌 API Endpoint

### GET /api/daily-report

**Query Parameters:**
```
vendor_id (obrigatório) - UUID do vendor
date (opcional) - Data no formato YYYY-MM-DD (padrão: hoje)
```

**Exemplo de Request:**
```bash
curl "http://localhost:3000/api/daily-report?vendor_id=abc123&date=2024-04-11"
```

**Response:**
```json
{
  "date": "2024-04-11",
  "summary": {
    "total_orders": 15,
    "total_revenue": 1245.50,
    "total_items_sold": 58,
    "avg_ticket": 83.03,
    "unique_customers": 12,
    "payment_methods": {
      "cash": { "count": 10, "total": 850.00 },
      "card": { "count": 3, "total": 275.50 },
      "pix": { "count": 2, "total": 120.00 }
    }
  },
  "orders": [
    {
      "id": "order-uuid",
      "umbrella_number": 12,
      "customer_name": "João Silva",
      "customer_phone": "11999999999",
      "total": 125.50,
      "status": "completed",
      "payment_method": "cash",
      "items_count": 5,
      "created_at": "2024-04-11T08:30:00Z"
    }
  ],
  "top_products": [
    {
      "name": "Cerveja Heineken",
      "quantity": 25,
      "revenue": 300.00
    }
  ],
  "hourly_breakdown": [
    {
      "hour": "08:00",
      "orders": 2,
      "revenue": 210.00
    }
  ]
}
```

---

## 📥 Exportação em PDF

O relatório pode ser exportado mediante o botão **PDF**:

1. Clica no botão "PDF"
2. Abre preview de impressão
3. Pode gerar PDF direto do browser
4. Ou imprimir em papel

**O PDF inclui:**
- ✅ Todos os KPIs
- ✅ Métodos de pagamento
- ✅ Top 10 produtos
- ✅ Vendas por hora
- ✅ Todos os pedidos
- ✅ Data e hora de geração

---

## 💡 Casos de Uso

### Caso 1: Encerramento Diário
1. No final do dia, vendor acessa `/vendor/daily-report`
2. Sistema mostra automaticamente do dia
3. Valida: "Todos os pedidos foram marcados como pagos?"
4. Exporta em PDF como comprovante
5. Arquiva para auditoria

### Caso 2: Análise de Tendências
1. Vendor quer saber qual hora vende mais
2. Consulta "Vendas por Hora"
3. Aumenta pessoal na hora de pico
4. Reduz na hora baixa

### Caso 3: Produtos Mais Vendidos
1. Vendor quer refazer o cardápio
2. Consulta "Top 10 Produtos Mais Vendidos"
3. Vê que Cerveja é #1
4. Aumenta stock e promotion dela
5. Remove produtos com baixa venda

### Caso 4: Auditoria
1. Admin/dono quer auditar
2. Pede relatório de data específica
3. Valida valores e tendências
4. Compara com dias anteriores
5. Detecta anomalias

---

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/app/api/daily-report/route.ts` | Endpoint da API |
| `src/components/vendor/DailyReportComponent.tsx` | Componente React com UI |
| `src/app/(vendor)/vendor/daily-report/page.tsx` | Página |

---

## 📊 Dados do Banco

### Queries Executadas:
1. **GET orders** (COMPLETED do dia)
   - status = 'completed'
   - created_at entre start e end do dia
   - Inclui: items, customers, umbrellas

2. **GET products** (pelos IDs dos itens vendidos)
   - Para obter nome de cada produto

### Cálculos Feitos:
- Total revenue = sum(order.total)
- Total items = sum(order_items count)
- Avg ticket = total revenue / total orders
- Unique customers = count distinct customer_id
- Payment methods = group by payment_method
- Top products = group by product, sum(quantity e revenue)
- Hourly breakdown = group by hour from created_at

---

## 🎯 Roadmap Futuro

- [ ] Gráficos interativos (Chart.js / Recharts)
- [ ] Comparar com dia anterior
- [ ] Comparar com mesma semana do mês anterior
- [ ] Filtro por período (semana/mês)
- [ ] Email automático com relatório
- [ ] Alertas de anomalias (venda muito baixa, etc)
- [ ] Integração com contabilidade
- [ ] Dashboard em tempo real (updates a cada novo pedido)
- [ ] Relatório de não-pagos (ainda abertos)
- [ ] Análise de ticket médio (tendência)

---

## 🔒 Segurança

✅ **Validações:**
- Vendor_id verificado em todos os endpoints
- Apenas pedidos completados aparecem
- Apenas do dia(data) selecionado
- Dados anônimos (sem IP etc)

✅ **Performance:**
- Cache possível no futuro (relatório não muda ao longo do dia)
- Queries otimizadas com índices

✅ **Auditoria:**
- Cada relatório tem timestamp
- Pode ser rastreado quem exportou quando

---

## 🧪 Exemplos de Uso

### Exemplo 1: Relatório do Dia
```bash
curl "http://localhost:3000/api/daily-report?vendor_id=vendor-uuid"
```

### Exemplo 2: Relatório de Data Específica
```bash
curl "http://localhost:3000/api/daily-report?vendor_id=vendor-uuid&date=2024-04-10"
```

---

## Como Integrar no Menu

Edite `src/app/(vendor)/vendor/dashboard/page.tsx`

```typescript
import DailyReportComponent from '@/components/vendor/DailyReportComponent';
import { BarChart3 } from 'lucide-react';

const TABS = [
  // ... outros tabs
  { id: "daily-report", label: "📊 Encerramento", icon: BarChart3 },
];

// No render:
{activeTab === "daily-report" && <DailyReportComponent />}
```

---

**Status**: ✅ Implementação Concluída
**Data**: Abril 2024
**Versão**: 1.0
