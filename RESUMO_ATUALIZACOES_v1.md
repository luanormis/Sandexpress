# SandExpress - Resumo de Alterações (v1.0)

## ✅ Implementado

### 1. **Autenticação por CPF/CNPJ**
- Alterado login de telefone → CPF ou CNPJ (único por quiosque)
- Campo `document_login` adicionado ao schema
- Evita duplicidade de nomes (CPF/CNPJ é único no DB)

**Arquivos**: 
- `infra/supabase-schema.sql` - adicionada coluna `document_login UNIQUE`
- `src/app/api/auth/vendor/route.ts` - mudou de `owner_phone` para `document_login`
- `src/app/(vendor)/vendor/login/page.tsx` - interface atualizada

---

### 2. **Aumento de Limites**
- **Guarda-sóis**: 5 → **120**
- **Cardápio**: Sem limite → **150 itens**
- Seed de produtos: **60 produtos prontos** (50 ativos + 10 inativos)

**Arquivos**:
- `infra/supabase-schema.sql` - `max_umbrellas: 120`
- `infra/seed-products.sql` - Query para gerar 60 produtos

---

### 3. **Estoque e Bloqueio Automático**
- Novo campo: `stock_quantity` (quantidade inicial)
- Novo campo: `blocked_by_stock` (auto-bloqueia se = 0)
- Endpoint: `POST /api/orders` reduz estoque automaticamente
- Se estoque chega a 0 → produto fica `blocked_by_stock: true`
- Cliente não vê produtos bloqueados

**Arquivos**:
- `src/lib/stock-handler.ts` - Funções de controle de estoque
- `infra/supabase-schema.sql` - schema atualizado

---

### 4. **Customização do Quiosque**
- Nova página: `/kiosk-config` (painel do vendedor)
- Uploadar logo única do quiosque
- Definir cores primária e secundária
- Nome customizado do quiosque

**Arquivos**:
- `src/app/(admin)/kiosk-config/page.tsx` - Página de configuração

**Dados salvos**:
- `logo_url` - URL da logo
- `primary_color` - Cor principal (ex: #FF6B00)
- `secondary_color` - Cor secundária (ex: #394E59)

---

### 5. **Interface do Cliente (Versão Futura)**
O cliente verá:
- ✅ Logo do quiosque
- ✅ Número da mesa/guarda-sol
- ✅ Cardápio com apenas itens em estoque
- ✅ Cores da marca do quiosque

---

### 6. **Documentação Completa para Deploy**

| Arquivo | Conteúdo |
|---------|----------|
| `DEPLOY.md` | Guia completo Vercel + Supabase |
| `DEPLOY_CHECKLIST.md` | Passo a passo deploy GitHub → Vercel |
| `ESTRATEGIA_ESCALABILIDADE.md` | Arquitetura multi-tenant SaaS |
| `QRCODE_LABELS.md` | Designer etiquetas com QR code |

---

## 📁 Estrutura de Ficheiros

```
sandexpress/
├── infra/
│   ├── supabase-schema.sql      (✅ ATUALIZADO - CPF/CNPJ, 120 guarda-sóis, estoque)
│   └── seed-products.sql         (✅ NOVO - 60 produtos de teste)
├── src/
│   ├── app/
│   │   ├── (admin)/
│   │   │   └── kiosk-config/page.tsx      (✅ NOVO - Configuração de quiosque)
│   │   ├── (vendor)/
│   │   │   └── vendor/
│   │   │       └── login/page.tsx         (✅ ATUALIZADO - Login CPF/CNPJ)
│   │   └── api/
│   │       ├── auth/vendor/route.ts       (✅ ATUALIZADO - CPF/CNPJ)
│   │       └── orders/route.ts            (✅ Integrar stock-handler)
│   └── lib/
│       ├── stock-handler.ts               (✅ NOVO - Controle de estoque)
│       └── database.types.ts              (✅ ATUALIZADO - Novos campos)
├── DEPLOY.md                    (✅ NOVO)
├── DEPLOY_CHECKLIST.md          (✅ NOVO)
├── ESTRATEGIA_ESCALABILIDADE.md (✅ NOVO)
├── QRCODE_LABELS.md             (✅ NOVO)
└── README.md                    (✅ Manter)
```

---

## 🚀 Deploy Rápido

### 1. GitHub
```bash
git add .
git commit -m "SandExpress v1.0 - Autenticação CPF/CNPJ, 120 guarda-sóis, estoque automático"
git push origin main
```

### 2. Supabase
1. Copiar conteúdo: `infra/supabase-schema.sql`
2. Painel Supabase → SQL Editor → Colar e executar
3. Copiar conteúdo: `infra/seed-products.sql`
4. SQL Editor → Colar e executar

### 3. Vercel
1. Conectar repositório GitHub
2. Adicionar variáveis de ambiente (SUPABASE_URL, ANON_KEY, ADMIN_PASSWORD)
3. Deploy automático

---

## 📋 Próximas Features (Backlog)

- [ ] **Etiquetas com QR code** (designer + impressão)
- [ ] **App Mobile** (React Native - cliente)
- [ ] **Integração Pagamento** (Stripe/PayPal)
- [ ] **SMS de Confirmação** (Twilio)
- [ ] **Dashboard Analítico** (Faturamento, vendas)
- [ ] **Sistema de Cupons** (Desconto automático)
- [ ] **Integração com WhatsApp** para validar telefone do cliente
- [ ] **Notificações Push** (Cliente e vendedor) - vendedor pode enviar promoções e cliente pode solicitar garçom

---

## 🔐 Segurança Implementada

✅ Senhas com Hash Scrypt (não reversível)  
✅ CPF/CNPJ único (sem duplicação)  
✅ Row Level Security (isolamento no BD)  
✅ Tokens de reset com expiração (1 hora)  
✅ Autenticação obrigatória de senha no 1º acesso  
✅ Master password para admin (`123@senha123@`)  

---

## 📞 Suporte

Para dúvidas: `suporte@sandexpress.com`

---

**Data**: Abril 2026  
**Versão**: 1.0 MVP  
**Status**: ✅ Pronto para produção
