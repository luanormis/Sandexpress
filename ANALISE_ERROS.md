# 🔍 Análise de Código - SandExpress

## ❌ ERROS ENCONTRADOS

### 1. **Segurança: Senha sem Hash** (CRÍTICO)
- **Arquivo**: `src/app/api/vendors/register/route.ts`
- **Linha**: ~33
- **Problema**: A senha temporária é armazenada em texto plano na variável `tempPassword`
```typescript
password_hash: tempPassword, // ❌ SEM HASH! 
```
- **Solução**: Usar biblioteca `bcrypt` para fazer hash da senha
```typescript
import bcrypt from 'bcrypt';
const password_hash = await bcrypt.hash(tempPassword, 10);
```

---

### 2. **Validação Incompleta de Email** (ALTO)
- **Arquivo**: `src/app/api/vendors/register/route.ts`
- **Linha**: ~13-15
- **Problema**: Não valida formato de email, apenas verifica se é obrigatório (e nem é obrigatório!)
```typescript
if (!body.name || !body.owner_name || !body.owner_phone) {
  // owner_email não está validado!
}
```
- **Solução**: Adicionar regex ou biblioteca de validação
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (body.owner_email && !emailRegex.test(body.owner_email)) {
  return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
}
```

---

### 3. **Tratamento de Erro Genérico** (MÉDIO)
- **Arquivo**: `src/lib/supabase-admin.ts`
- **Problema**: Se `SUPABASE_SERVICE_ROLE_KEY` não estiver definido, usa `'mock-service-key'` silenciosamente
```typescript
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
```
- **Impacto**: Em produção, as operações podem falhar silenciosamente
- **Solução**: Avisar no console ou em logs
```typescript
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY não definido!');
}
```

---

### 4. **Falta de Índice UNIQUE em vendor name** (MÉDIO)
- **Arquivo**: `infra/supabase-schema.sql`
- **Problema**: Dois quiosques podem ter o mesmo nome
- **Solução**: Adicionar constraint UNIQUE
```sql
ALTER TABLE vendors ADD CONSTRAINT unique_vendor_name UNIQUE(name);
```
Ou em criação:
```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  ...
);
```

---

### 5. **Falta de Validação de CNPJ/CPF** (MÉDIO)
- **Arquivo**: `src/app/api/vendors/register/route.ts`
- **Problema**: Aceita qualquer string como CNPJ/CPF
- **Solução**: Adicionar validação de dígitos verificadores

---

### 6. **RLS Policy Muito Permissiva** (ALTO - SEGURANÇA)
- **Arquivo**: `infra/supabase-schema.sql`
- **Linhas**: 140-155
- **Problema**: Políticas de INSERT/UPDATE/SELECT muito abertas
```sql
CREATE POLICY pol_customers_insert ON customers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY pol_customers_update ON customers FOR UPDATE USING (TRUE);
```
**Qualquer pessoa pode inserir/atualizar qualquer coisa!**
- **Solução**: Vincular ao `vendor_id` via `auth.uid()`
```sql
CREATE POLICY pol_customers_insert ON customers 
  FOR INSERT WITH CHECK (vendor_id = auth.uid());
```

---

### 7. **Falta de Validação de Telefone** (MÉDIO)
- **Arquivo**: `src/app/api/vendors/register/route.ts`
- **Problema**: Aceita qualquer string como telefone
- **Solução**: Validar formato
```typescript
const phoneRegex = /^[0-9]{10,11}$/;
if (!phoneRegex.test(body.owner_phone)) {
  return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 });
}
```

---

### 8. **Supabase Types Incompletos** (BAIXO)
- **Arquivo**: `src/lib/database.types.ts`
- **Problema**: Tipos truncados para produtos (description não aparece completo em alguns places)
- **Solução**: Regenerar tipos com `supabase gen types typescript`

---

## ✅ PONTOS POSITIVOS

- ✅ Estrutura de banco de dados bem organizada
- ✅ Índices de performance implementados corretamente
- ✅ RLS habilitado (mas precisa de ajustes)
- ✅ Tratamento básico de demo mode
- ✅ Estrutura de API RESTful limpa
- ✅ Soft delete não implementado (melhor para integridade dos dados)

---

## 🎯 PRIORIDADE DE CORREÇÃO

1. **🔴 CRÍTICO**: Hash de senha + RLS Policy
2. **🟠 ALTO**: Validação de email + Segurança do admin client
3. **🟡 MÉDIO**: CNPJ, CPF, Telefone + Índice UNIQUE
4. **🟢 BAIXO**: Tipos TypeScript

