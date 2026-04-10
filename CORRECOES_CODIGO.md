# 🔧 Correções Recomendadas para o Código

Arquivo com exemplos de correção para todos os erros encontrados na análise.

---

## 1. ✅ CORREÇÃO: Hash de Senha (CRÍTICO)

**Arquivo:** `src/app/api/vendors/register/route.ts`

### Antes (❌ INSEGURO):
```typescript
const tempPassword = Math.random().toString(36).slice(-8);

const { data, error } = await supabaseAdmin
  .from('vendors')
  .insert({
    // ... outros campos
    password_hash: tempPassword,  // ❌ Texto plano!
  })
```

### Depois (✅ CORRETO):
```typescript
import bcrypt from 'bcrypt';

const tempPassword = Math.random().toString(36).slice(-8);
const password_hash = await bcrypt.hash(tempPassword, 10);  // ✅ Hash com salt 10

const { data, error } = await supabaseAdmin
  .from('vendors')
  .insert({
    // ... outros campos
    password_hash: password_hash,  // ✅ Seguro!
  })
```

**Install:**
```bash
npm install bcrypt
npm install -D @types/bcrypt
```

---

## 2. ✅ CORREÇÃO: Validação de Email

**Arquivo:** `src/app/api/vendors/register/route.ts`

### Antes (❌ SEM VALIDAÇÃO):
```typescript
if (!body.name || !body.owner_name || !body.owner_phone) {
  return NextResponse.json({ error: '...' }, { status: 400 });
}
// owner_email não é sequer validado!
```

### Depois (✅ COM VALIDAÇÃO):
```typescript
// Validar email
if (body.owner_email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.owner_email)) {
    return NextResponse.json(
      { error: 'Email inválido' },
      { status: 400 }
    );
  }
}

// Validar telefone (11 dígitos)
const phoneRegex = /^[0-9]{10,11}$/;
if (!phoneRegex.test(body.owner_phone)) {
  return NextResponse.json(
    { error: 'Telefone inválido (10 ou 11 dígitos)' },
    { status: 400 }
  );
}

// Validar CNPJ/CPF se fornecidos
if (body.cnpj && !isValidCNPJ(body.cnpj)) {
  return NextResponse.json(
    { error: 'CNPJ inválido' },
    { status: 400 }
  );
}

if (body.cpf && !isValidCPF(body.cpf)) {
  return NextResponse.json(
    { error: 'CPF inválido' },
    { status: 400 }
  );
}
```

### Funções helper para validação:
```typescript
/**
 * Validar CNPJ brasileiro (simplificado)
 * Em produção, use biblioteca especializada:
 * npm install @brazilian-utils/cnpj
 */
function isValidCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  // Implementar verificação de dígitos verificadores aqui
  return true;
}

/**
 * Validar CPF brasileiro (simplificado)
 * Em produção, use: npm install @brazilian-utils/cpf
 */
function isValidCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  // Implementar verificação de dígitos verificadores aqui
  return true;
}
```

---

## 3. ✅ CORREÇÃO: Admin Client - Avisar se chave não existe

**Arquivo:** `src/lib/supabase-admin.ts`

### Antes (❌ SILENCIOSO):
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
// Se não estiver definido, continua com chave fake sem avisar!
```

### Depois (✅ COM AVISO):
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Avisar se não estiver configurado
if (!supabaseUrl) {
  console.error(
    '❌ ERRO: NEXT_PUBLIC_SUPABASE_URL não está definido em .env.local'
  );
}

if (!serviceRoleKey) {
  console.error(
    '❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está definido em .env.local'
  );
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl || 'https://mock.supabase.co',
  serviceRoleKey || 'mock-service-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);
```

---

## 4. ✅ CORREÇÃO: RLS Policies (SEGURANÇA - ALTO IMPACTO)

**Arquivo:** `infra/supabase-schema.sql`

### Antes (❌ MUITO PERMISSIVO):
```sql
CREATE POLICY pol_customers_insert ON customers 
  FOR INSERT WITH CHECK (TRUE);  -- ❌ QUALQUER UM PODE INSERIR !

CREATE POLICY pol_customers_update ON customers 
  FOR UPDATE USING (TRUE);  -- ❌ QUALQUER UM PODE ATUALIZAR!
```

### Depois (✅ SEGURO - vinculado ao usuário):
```sql
-- Para CLIENTES criando pedidos
CREATE POLICY pol_customers_insert ON customers 
  FOR INSERT 
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE id = auth.uid()
    )
  );

-- Para CLIENTES atualizando seus dados
CREATE POLICY pol_customers_update ON customers 
  FOR UPDATE 
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE id = auth.uid()
    )
  );

-- Para ADMIN ler tudo
CREATE POLICY pol_customers_admin_select ON customers 
  FOR SELECT 
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 5. ✅ CORREÇÃO: Adicionar UNIQUE constraint no nome do vendor

**Arquivo:** `infra/supabase-schema.sql`

### Antes (❌ PERMITE DUPLICATAS):
```sql
CREATE TABLE vendors (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL,  -- ❌ Sem UNIQUE
  ...
);
```

### Depois (✅ ÚNICO):
```sql
CREATE TABLE vendors (
  id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name  TEXT NOT NULL UNIQUE,  -- ✅ Agora é único!
  ...
);

-- Ou adicionar depois:
ALTER TABLE vendors ADD CONSTRAINT unique_vendor_name UNIQUE(name);
```

---

## 📦 Exemplo Completo Corrigido

Aqui está o arquivo `route.ts` completo corrigido:

**`src/app/api/vendors/register/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1️⃣ Validar campos obrigatórios
    if (!body.name || !body.owner_name || !body.owner_phone) {
      return NextResponse.json(
        { error: 'name, owner_name e owner_phone são obrigatórios' },
        { status: 400 }
      );
    }

    // 2️⃣ Validar telefone
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(body.owner_phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: 'Telefone inválido (11 dígitos)' },
        { status: 400 }
      );
    }

    // 3️⃣ Validar email se fornecido
    if (body.owner_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.owner_email)) {
        return NextResponse.json(
          { error: 'Email inválido' },
          { status: 400 }
        );
      }
    }

    // 4️⃣ Demo mode
    const isDemo =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock.supabase.co';
    if (isDemo) {
      return NextResponse.json(
        {
          id: 'demo-vendor-' + Date.now(),
          ...body,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          max_umbrellas: 5,
          is_active: true,
        },
        { status: 201 }
      );
    }

    // 5️⃣ Gerar senha e fazer HASH ✅
    const tempPassword = Math.random().toString(36).slice(-8);
    const password_hash = await bcrypt.hash(tempPassword, 10);

    // 6️⃣ Inserir vendor
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        name: body.name,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        owner_email: body.owner_email || null,
        cpf: body.cpf || null,
        cnpj: body.cnpj || null,
        city: body.city || null,
        state: body.state || null,
        password_hash,  // ✅ Password corretamente hashado!
        subscription_status: 'trial',
        plan_type: 'trial',
        max_umbrellas: 5,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        ...data,
        temp_password: tempPassword,  // Enviar via email/SMS, não retornar aqui!
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json(
      { error: 'Erro interno ao criar quiosque' },
      { status: 500 }
    );
  }
}
```

---

## 📋 Checklist de Implementação

- [ ] Instalar `bcrypt`
- [ ] Atualizar `route.ts` com validações
- [ ] Atualizar `supabase-admin.ts` com avisos
- [ ] Executar `seed-data.sql` para popular banco
- [ ] Atualizar RLS Policies no SQL
- [ ] Adicionar UNIQUE constraint em `vendors.name`
- [ ] Testar com Postman/curl
- [ ] Deploy em produção

---

**Última revisão:** 2026-04-10
