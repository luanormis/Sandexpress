# Estratégia de Escalabilidade - SandExpress

## Recomendação: Modelo Híbrido com SaaS Multi-tenant

### Opção 1: ❌ Branch por Cliente (NÃO recomendado)
**Problemas:**
- Múltiplos repositórios = múltipla manutenção de código
- Atualizações de bug/feature devem ser replicadas em N branches
- Impossível sincronizar melhorias rapidamente
- CI/CD multiplicado por N clientes

### Opção 2: ✅ Projeto Global (Multi-tenant SaaS) - RECOMENDADO
**Vantagens:**
- **1 código-fonte único** = fácil manutenção
- **Rápida escalabilidade** = novos clientes em minutos
- **Atualizações centralizadas** = todos ganham melhorias ao mesmo tempo
- **Banco de dados único com isolamento por tenant** = economia de recursos

**Arquitetura:**
```
1 Projeto Next.js global
    ↓
1 Banco Supabase (Row Level Security)
    ↓
Isolamento por `vendor_id` (tenant_id)
```

### Opção 3: 🟡 Bancos Individuais (Escalabilidade Intermediária)
**Se escolher bancos individuais:**

**Como gerenciar acesso:**
1. **Painel de controle central (master)**
   - Registra cada cliente + dados conexão Supabase
   - Armazena `client_id` → `supabase_url` | `supabase_key`

2. **Dinâmicamente mudar instância**
   ```typescript
   // Exemplo
   const supabase = createClient(
     process.env[`SUPABASE_URL_${clientId}`],
     process.env[`SUPABASE_KEY_${clientId}`]
   );
   ```

3. **Problemas:**
   - N credenciais na env
   - Risco de vazamento de chaves
   - Backup/restore multiplicado

---

## ✅ RECOMENDAÇÃO FINAL: Multi-tenant com Supabase RLS

### Implementação:
```sql
-- 1. Tabela de clientes (franquias)
CREATE TABLE franchises (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vendors vinculados a franchises
ALTER TABLE vendors ADD COLUMN franchise_id UUID REFERENCES franchises(id);

-- 3. Row Level Security (RLS)
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors veem apenas seus dados"
  ON vendors
  USING (auth.uid()::text = id OR franchise_id = current_setting('app.franchise_id')::uuid);
```

### Benefícios:
- ✅ 1 banco de dados
- ✅ Sem limite de tenants
- ✅ Segurança nativa no DB (RLS)
- ✅ Cobrança por uso (Supabase)
- ✅ Fácil deploy (1 instância)
- ✅ Backups centralizados

---

## Próximos Passos:
1. Adicionar tabela `franchises`
2. Modificar `vendors` para referenciar `franchise_id`
3. Implementar seleção de franchise no login
4. Configurar RLS para isolamento
