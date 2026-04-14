# 📝 Guia de Integração - Abertura do Dia e Fechar Conta

## ✅ Funcionalidades Implementadas

Foram criadas duas novas funcionalidades para o painel do vendor (quiosqueiro):

### 1. 🌅 **Abertura do Dia** (Stock Control)
Permite atualizar o estoque de itens na abertura do dia.

**Características:**
- Visualiza todos os produtos do quiosque
- Atualizar estoque por categoria
- Produtos com 0 unidades são bloqueados para venda
- Protege contra sobrevenda

**URLs:**
- Página: `/vendor/opening-day`
- API: `GET/PUT /api/stock`

**Fluxo:**
1. Vendor acessa `/vendor/opening-day`
2. Carrega lista de produtos ativos
3. Preenche quantidade de estoque para cada item
4. Clica "Salvar Estoque"
5. Server atualiza banco de dados

**Exemplo dados atualizado:**
```json
{
  "vendor_id": "uuid-vendor",
  "updated_count": 12,
  "results": [
    { "product_id": "uuid", "stock_quantity": 50, "success": true },
    { "product_id": "uuid", "stock_quantity": 0, "success": true }
  ]
}
```

---

### 2. 💳 **Fechar Conta** (Close Account)
Permite fechar conta do cliente após pagamento.

**Características:**
- Busca conta aberta por **número do guarda-sol** OU **telefone do cliente**
- Mostra total a pagar
- Seleciona método de pagamento
- Adiciona observações (opcional)
- Marca como pago e libera guarda-sol
- Atualiza estatísticas do cliente

**URLs:**
- Página: `/vendor/close-account`
- API: `GET/POST /api/close-account`

**Fluxo 1 - Por Guarda-sol:**
1. Vendor acessa `/vendor/close-account`
2. Seleciona "Por Guarda-sol"
3. Digita número do guarda-sol (ex: 12)
4. Clica "Buscar"
5. Sistema mostra:
   - Nome do cliente
   - Telefone
   - Total a pagar
   - Tempo que conta está aberta
   - Quantidade de itens
6. Seleciona método de pagamento
7. Clica "Confirmar Pagamento"
8. Conta é fechada, guarda-sol liberado ✅

**Fluxo 2 - Por Telefone:**
1. Segue mesmo fluxo mas usa telefone do cliente
2. Útil se não souber número do guarda-sol

**Métodos de Pagamento:**
- 💵 Dinheiro
- 💳 Cartão
- 🏦 Transferência
- 📲 PIX
- 📝 Outro

**Response de Sucesso:**
```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "customer_name": "João Silva",
    "customer_phone": "(11) 9999-9999",
    "umbrella_id": "12",
    "total": 125.50,
    "status": "completed",
    "paid": true,
    "payment_method": "cash",
    "closed_at": "2024-04-11T10:30:00.000Z"
  },
  "message": "Conta fechada com sucesso! Guarda-sol 12 liberado."
}
```

---

## 📊 Banco de Dados

### Campos Afetados em `products`
- `stock_quantity` - ATUALIZADO na abertura do dia
- `blocked_by_stock` - Bloqueado automaticamente se estoque = 0

### Campos Afetados em `orders`
- `status` - Muda para `completed` ao fechar conta
- `paid` - Muda para `true`
- `payment_method` - Registra método de pagamento
- `notes` - Observações opcionais
- `updated_at` - Timestamp de fechamento

### Campos Afetados em `customers`
- `visit_count` - Incrementado
- `last_visit_at` - Atualizado para agora
- `updated_at` - Timestamp

---

## 🔌 Endpoints de API

### Stock Control

**GET /api/stock**
Obter estoque atual de produtos
```bash
curl http://localhost:3000/api/stock?vendor_id=uuid-vendor
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Cerveja Heineken",
    "category": "Bebidas",
    "price": 15.0,
    "stock_quantity": 50,
    "blocked_by_stock": false,
    "active": true
  }
]
```

**PUT /api/stock**
Atualizar estoque
```bash
curl -X PUT http://localhost:3000/api/stock \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "uuid-vendor",
    "updates": [
      { "product_id": "uuid", "stock_quantity": 50 },
      { "product_id": "uuid", "stock_quantity": 0 }
    ]
  }'
```

---

### Close Account

**GET /api/close-account**
Buscar conta aberta (preview)
```bash
# Por guarda-sol
curl http://localhost:3000/api/close-account?vendor_id=uuid&umbrella_id=12

# Por telefone
curl http://localhost:3000/api/close-account?vendor_id=uuid&customer_phone=11999999999
```

Response:
```json
{
  "order_id": "uuid",
  "customer_name": "João Silva",
  "customer_phone": "(11) 9999-9999",
  "umbrella_id": "12",
  "total": 125.50,
  "items_count": 5,
  "opened_at": "2024-04-11T08:30:00.000Z"
}
```

**POST /api/close-account**
Fechar conta e confirmar pagamento
```bash
curl -X POST http://localhost:3000/api/close-account \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "uuid-vendor",
    "umbrella_id": "12",
    "payment_method": "cash",
    "notes": "Cliente pagou, sem troco"
  }'
```

Ou por telefone:
```bash
curl -X POST http://localhost:3000/api/close-account \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "uuid-vendor",
    "customer_phone": "11999999999",
    "payment_method": "card",
    "notes": ""
  }'
```

---

## 🎯 Como Integrar no Menu do Vendor

Para adicionar essas opções ao menu principal do vendor, editar o arquivo:
`src/app/(vendor)/vendor/dashboard/page.tsx`

**Adicione aos TABS:**
```typescript
const TABS = [
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "opening-day", label: "Abertura do Dia", icon: Sun },      // ← NOVO
  { id: "close-account", label: "Fechar Conta", icon: DollarSign }, // ← NOVO
  { id: "menu", label: "Cardápio", icon: Utensils },
  { id: "qr", label: "Guarda-Sóis", icon: QrCode },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "customers", label: "Clientes", icon: Users },
];
```

**Adicione os imports:**
```typescript
import { Sun, DollarSign } from "lucide-react";
import OpeningDayStockControl from "@/components/vendor/OpeningDayStockControl";
import CloseAccountModal from "@/components/vendor/CloseAccountModal";
```

**Adicione os renders no JSX:**
```typescript
{activeTab === "opening-day" && <OpeningDayStockControl />}
{activeTab === "close-account" && <CloseAccountModal />}
```

---

## 🛡️ Segurança

✅ Validações:
- Vendor_id verificado em todos os endpoints
- Apenas produtos ativos podem ter estoque alterado
- Apenas contas abertas podem ser fechadas
- Phone é tratado sem caracteres especiais para flexibilidade

✅ Bloqueios de Controle:
- Produtos com stock = 0 são bloqueados automaticamente (`blocked_by_stock = true`)
- Não permite vender itens sem estoque

✅ Auditoria:
- Cada mudança tem `updated_at`
- Histórico de pedidos completo
- Métodos de pagamento registrados

---

## 🧪 Exemplos de Uso

### Abertura do Dia
1. Acessa `/vendor/opening-day`
2. Vê sua categorias: Bebidas, Comidas, Petiscos, etc.
3. Preenche números:
   - Cerveja: 50
   - Água de Coco: 40
   - Isca de Peixe: 25
4. Clica "Salvar Estoque"
5. Sistema confirma: "✓ Estoque atualizado! 30 produtos salvos."

### Fechar Conta
**Cenário 1 - Cliente no guarda-sol 12:**
1. Acessa `/vendor/close-account`
2. Seleciona "Por Guarda-sol"
3. Digita: 12
4. Clica "Buscar"
5. Sistema mostra: João Silva, (11) 9999-9999, Total: R$ 125.50, 5 itens
6. Seleciona "Dinheiro"
7. Clica "Confirmar Pagamento"
8. Sucesso! ✓ Guarda-sol 12 liberado

**Cenário 2 - Não sabe o número do guarda-sol:**
1. Acessa `/vendor/close-account`
2. Seleciona "Por Telefone"
3. Digita: 11999999999
4. Clica "Buscar"
5. Segue mesmo fluxo

---

## 📮 Próximas Funcionalidades (Roadmap)

- [ ] Integração com pagamento direto (cartão/PIX)
- [ ] Dashboard de estoque em tempo real
- [ ] Alertas de baixo estoque
- [ ] Relatório de vendas por método de pagamento
- [ ] Exportar relatório de fechamentos diários
- [ ] Integração com sistemas de entrega
- [ ] Histórico de ajustes de preço

---

**Status**: ✅ Implementação Concluída
**Data**: Abril 2024
**Versão**: 1.0
