# 📋 Guia de Uso - Gerenciador de Ajustes de Conta

## O que é?

O **Gerenciador de Ajustes de Conta** permite que você (vendor/quiosqueiro) cancele ou abata itens da conta de clientes, com proteção por **senha de acesso**.

## Funcionalidades Principais

### 1. **Três Tipos de Ajustes**
- **Cancelamento**: Reduz o total gasto pelo cliente (ex: pedido cancelado)
- **Abatimento**: Reduz o saldo devedor (desconto)
- **Crédito**: Adiciona crédito à conta (promoção, devolução)

### 2. **Proteção por Senha**
Todas as operações de ajuste requerem a **senha de acesso do seu painel** para garantir segurança.

### 3. **Registro Completo**
Cada ajuste é rastreado com:
- Data e hora
- Tipo de ajuste
- Valor
- Motivo/observação
- Status de verificação de senha

## Como Usar

### Passo 1: Acessar o Painel
1. No painel admin, navigate até **Ajustes de Conta**
2. URL: `/admin/adjustments`

### Passo 2: Preencher o Formulário
1. **Selecione um Cliente**: Escolha da lista de clientes do seu quiosque
2. **Tipo de Ajuste**: Escolha entre:
   - `Cancelamento` - para pedidos cancelados
   - `Abatimento` - para descontos
   - `Crédito` - para promoções/devoluções
3. **Valor**: Digite o valor em reais (ex: 25.50)
4. **Motivo**: Opcional - descreva o motivo (ex: "Cliente solicitou cancelamento")
5. **Senha**: Digite sua senha de acesso do painel

### Passo 3: Processar
Clique em **"Processar Ajuste"** e pronto!

## API - Integração

Se você quiser integrar essa funcionalidade em outro sistema:

### Endpoint
```
POST /api/adjustments
```

### Request Body
```json
{
  "vendor_id": "uuid-do-seu-vendor",
  "vendor_password": "sua-senha-do-painel",
  "customer_id": "uuid-do-cliente",
  "adjustment_type": "cancellation|deduction|credit",
  "amount": 25.50,
  "reason": "Cliente solicitou cancelamento",
  "order_id": "uuid-do-pedido (opcional)"
}
```

### Response Sucesso (201)
```json
{
  "adjustment": {
    "id": "uuid",
    "vendor_id": "...",
    "customer_id": "...",
    "adjustment_type": "cancellation",
    "amount": 25.50,
    "created_at": "2024-04-11T..."
  },
  "customer_updated": {
    "id": "uuid",
    "total_spent_before": 150.00,
    "total_spent_after": 124.50
  }
}
```

### Response Erro
```json
{
  "error": "Descrição do erro"
}
```

## Cenários de Uso

### Cenário 1: Cliente pediu cancelamento
1. **Tipo**: Cancelamento
2. **Valor**: Valor total do pedido
3. **Motivo**: "Cliente solicitou cancelamento"

### Cenário 2: Desconto para cliente fiel
1. **Tipo**: Abatimento
2. **Valor**: 10.00 (desconto)
3. **Motivo**: "Desconto cliente fiel"

### Cenário 3: Devolução/Reembolso
1. **Tipo**: Crédito
2. **Valor**: Valor devolvido
3. **Motivo**: "Devolvido - produto defeituoso"

## Banco de Dados

### Tabela `account_adjustments`
```sql
CREATE TABLE account_adjustments (
  id UUID PRIMARY KEY,
  vendor_id UUID,                    -- seu quiosque
  customer_id UUID,                  -- cliente
  order_id UUID (nullable),          -- pedido relacionado
  adjustment_type TEXT,              -- 'cancellation', 'deduction', 'credit'
  amount NUMERIC(10,2),              -- valor do ajuste
  reason TEXT,                       -- motivo
  password_verified BOOLEAN,         -- senha foi verificada
  created_at TIMESTAMPTZ            -- quando foi criado
);
```

### Atualização em `customers`
O campo `total_spent` é atualizado automaticamente:
- **Cancelamento/Abatimento**: `total_spent -= amount`
- **Crédito**: `total_spent += amount`

## Segurança

1. ✅ **Validação de Senha**: Todas as operações usam hash bcrypt
2. ✅ **Verificação de Propriedade**: Um client só pode ajustar contas de seus próprios clientes
3. ✅ **Auditoria**: Todo ajuste é registrado com timestamp
4. ✅ **Rastreamento**: Cada ajuste tem um ID único para referência

## Troubleshooting

### ❌ "Senha do vendor inválida"
- Verifique se está digitando a senha correta
- A senha diferencia maiúsculas de minúsculas

### ❌ "Cliente não encontrado"
- Verifique se o cliente pertence ao seu quiosque
- O cliente precisa estar registrado no sistema

### ❌ "Valor inválido"
- O valor deve ser positivo
- Use ponto (.) como separador decimal

---

## Exemplos com cURL

### Criar um cancelamento
```bash
curl -X POST http://localhost:3000/api/adjustments \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "123e4567-e89b-12d3-a456-426614174000",
    "vendor_password": "sua-senha",
    "customer_id": "223e4567-e89b-12d3-a456-426614174000",
    "adjustment_type": "cancellation",
    "amount": 25.50,
    "reason": "Cliente solicitou cancelamento"
  }'
```

### Listar ajustes de um cliente
```bash
curl http://localhost:3000/api/adjustments?vendor_id=123e4567-e89b-12d3-a456-426614174000&customer_id=223e4567-e89b-12d3-a456-426614174000
```

---

**Versão**: 1.0
**Data**: Abril 2024
