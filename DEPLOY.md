# SandExpress - Sistema de Gestão para Quiosques

Plataforma SaaS multi-tenant para gerenciamento de quiosques/entrega de refeições com painéis para vendedores e clientes.

## 📋 Tecnologias

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Backend**: API Routes do Next.js
- **Database**: Supabase (PostgreSQL) com Row Level Security
- **Autenticação**: CPF/CNPJ + Senha Hash (Scrypt)
- **Deploy**: Vercel (recomendado) ou Docker

## 🚀 Quick Start (Desenvolvimento)

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta Supabase ([supabase.com](https://supabase.com))

### Setup Local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/sandexpress.git
cd sandexpress

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local

# Edite .env.local com suas credenciais Supabase:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx

# 4. Initialize banco de dados
# Acesse Supabase Dashboard → SQL Editor
# Execute os scripts em infra/supabase-schema.sql

# 5. Inicie servidor de desenvolvimento
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 📋 Configuração do Supabase

### 1. Criar Projeto
1. Acesse [supabase.com](https://supabase.com) → "+ New Project"
2. Preencha dados do projeto
3. Anote `Project URL` e `Anon Key`

### 2. Executar Schema
1. Copie conteúdo de `infra/supabase-schema.sql`
2. Vá para Supabase Dashboard → SQL Editor
3. Cole e execute

### 3. Executar Seed (Produtos de Teste)
1. Copie conteúdo de `infra/seed-products.sql`
2. Cole no SQL Editor e execute
3. Cria 60 produtos por quiosque

### 4. Configurar RLS (Row Level Security)
- ✅ Já incluído em `supabase-schema.sql`
- Garante isolamento de dados por tenant

## 🔐 Autenticação

### Login do Quiosque
- **Credencial**: CPF ou CNPJ (único por quiosque)
- **Senha**: Hash com Scrypt (seguro)
- **Padrão**: `senha123@`
- **Mudança obrigatória**: No primeiro acesso

### Query Login:
```bash
POST /api/auth/vendor
Body: {
  "document_login": "12345678901", // CPF ou CNPJ
  "password": "senha123@"
}
```

### Admin
- **Senha**: `123@senha123@` (env: `ADMIN_PASSWORD`)
- Query: `POST /api/auth/admin`

## 📦 Estrutura de Dados

### Vendors (Quiosques)
- `document_login`: CPF/CNPJ único (login principal)
- `max_umbrellas`: Até 120 guarda-sóis
- `primary_color`: Cor da marca (ex: #FF6B00)
- `logo_url`: Logo customizada do quiosque

### Products (Cardápio)
- Até **150 itens** por quiosque
- `active`: Visível no cardápio
- `stock_quantity`: Estoque (NULL = infinito)
- `blocked_by_stock`: Auto-bloqueia se estoque = 0
- Seed inclui **60 produtos de teste**

### Umbrellas
- Até **120 guarda-sóis** por quiosque
- Cada um com QR code único
- Localização/ID configurável

## 📱 Client App

Ao fazer pedido, o cliente vê:
- Logo do quiosque
- Número da mesa/guarda-sol
- Cardápio ativo (apenas itens em estoque)
- Cores da marca do quiosque

## 🛠️ Scripts Disponíveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build para produção
npm run start      # Inicia servidor em produção
npm run lint       # ESLint checks
```

## 🐳 Deploy com Docker

```bash
# Build imagem
docker build -t sandexpress .

# Executar container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx \
  sandexpress
```

## ☁️ Deploy no Vercel

### 1. Conectar Repositório
```bash
git push origin main
```

1. Acesse [vercel.com](https://vercel.com)
2. Clique "+ New Project"
3. Importe repositório GitHub
4. Selecione este projeto

### 2. Variáveis de Ambiente
No Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
ADMIN_PASSWORD=123@senha123@
```

### 3. Deploy
- Clique "Deploy"
- Será deployado automaticamente a cada push no `main`
- URL: `https://sandexpress-xxxxx.vercel.app`

## 🌐 Arquitetura Multi-Tenant

**Modelo**: SaaS com banco único + isolamento por `vendor_id`

### Vantagens:
- ✅ 1 código-fonte (sem duplicação)
- ✅ Escalável a "N" clientes
- ✅ Atualizações centralizadas
- ✅ Row Level Security (isolamento no DB)
- ✅ Sem limite de clientes

### Segurança:
- Isolamento via `vendor_id` em todas as tabelas
- RLS ativa no Supabase
- Senhas com Hash Scrypt (não reversível)
- Tokens de reset com expiração

## 📊 API Endpoints

### Autenticação
- `POST /api/auth/vendor` - Login do quiosque
- `POST /api/auth/vendor/reset` - Iniciar recuperação de senha
- `POST /api/auth/vendor/change-password` - Alterar senha
- `POST /api/auth/admin` - Login do admin

### Dados
- `GET /api/products` - Cardápio (público)
- `GET /api/umbrellas` - Lista de mesas
- `GET /api/orders` - Histórico de pedidos
- `POST /api/orders` - Criar novo pedido

## 🔍 Troubleshooting

### Erro "Cannot find module 'crypto'"
- ✅ Já resolvido: usando `crypto` nativo do Node

### Supabase Connection Error
- Verifique URL e chave em `.env.local`
- Teste conexão em Supabase Dashboard

### Build Error TypeScript
- Execute: `npm run build`
- Verifique erros em `get_errors` output

## 📚 Próximas Features

- [ ] Labels de QR code personalizadas
- [ ] Integração de pagamento (Stripe)
- [ ] SMS de confirmação de pedidos
- [ ] Dashboard analítico (faturamento)
- [ ] App mobile nativo (React Native)

## 📄 Licença

Propriedade de SandExpress

## 👤 Contato

- **Email**: suporte@sandexpress.com
- **Site**: www.sandexpress.com

---

**Última atualização**: Abril 2026
