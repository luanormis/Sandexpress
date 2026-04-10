# Checklist para Deploy no GitHub e Vercel

## ✅ Pré-requisitos

- [ ] Conta GitHub criada
- [ ] Conta Vercel criada  
- [ ] Supabase project criado e schema aplicado
- [ ] `.env.local` com credenciais Supabase

## 📋 Etapa 1: Preparar Repositório Local

```bash
# Iniciar repositório Git (se não existir)
git init

# Remover arquivos sensíveis
echo "node_modules/" >> .gitignore
echo ".env.local" >> .gitignore

# Verificar status
git status
```

## 📤 Etapa 2: Upload para GitHub

### Opção A: Via CLI Git

```bash
# Adicionar remote
git remote add origin https://github.com/seu-usuario/sandexpress.git

# Se o branch estiver em "master", renomear para "main"
git branch -M main

# Adicionar arquivos
git add .

# Commit inicial
git commit -m "Initial commit: SandExpress SaaS MVP"

# Push
git push -u origin main
```

### Opção B: Via GitHub Desktop
1. File → Add Local Repository → Selecione pasta do projeto
2. Publish repository → Create on GitHub
3. Nome: "sandexpress"
4. Descrição: "Sistema de gestão para quiosques"

## 🚀 Etapa 3: Deploy no Vercel

### Passo 1: Conectar Repositório
1. Acesse [vercel.com](https://vercel.com)
2. Clique "New Project"
3. Selecione "Import Git Repository"
4. Busque "sandexpress" → Clique "Import"

### Passo 2: Configurar Ambiente
1. Em "Environment Variables", adicione:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = xxxxx
ADMIN_PASSWORD = 123@senha123@
```

2. Clique "Deploy"

### Passo 3: Verificar Deploy
- Status deve mudar para "Ready"
- URL será: `https://sandexpress-xxxxx.vercel.app`
- Acesse e teste login

## ✅ Etapa 4: Testes Pós-Deploy

```bash
# 1. Verificar saúde da app
curl https://sandexpress-xxxxx.vercel.app/api/health

# 2. Testar login (via Postman ou curl)
curl -X POST https://sandexpress-xxxxx.vercel.app/api/auth/vendor \
  -H "Content-Type: application/json" \
  -d '{"document_login":"12345678901","password":"senha123@"}'

# 3. Verificar conectividade com Supabase
# Abra DevTools > Network > qualquer requisição
# Verificar status 200 OK
```

## 🔄 Etapa 5: Atualizações Futuras

### Para deploar nova versão:
```bash
# Faça mudanças locais
nano src/app/page.tsx

# Commit
git add .
git commit -m "Feature: Adicionar novo painel"

# Push (Vercel detecta automaticamente)
git push origin main

# Vercel redeploy automático em ~1-2 min
```

## 🔐 Etapa 6: Variáveis de Segurança

### Nunca commitar:
```
❌ .env.local (credenciais reais)
❌ Supabase service key (admin key)
❌ Chaves de API
```

### Verificar antes de push:
```bash
# Listar arquivos que serão commitados
git diff --cached

# Se acidentalmente commitou, remover:
git rm --cached .env.local
git commit --amend
git push -f origin main
```

## 📊 Monitoramento

### Vercel Dashboard
- Analytics → Performance, Bandwidth
- Deployments → Histórico de deploys
- Settings → Configurações gerais

### Supabase Dashboard
- Database → Monitorar queries
- Logs → Ver erros de autenticação
- Storage → Gerenciar uploads

## 🆘 Troubleshooting

### Deploy falha em "Build"
```bash
# Testar build local
npm run build

# Verificar erros
npm run lint
```

### Erro 500 no Vercel
1. Verifique variáveis de ambiente
2. Cheque logs Supabase
3. Tente redeploy: "Vercel Dashboard → Deployments → Redeploy"

### Conexão com Supabase recusa
1. Verifique URL e chave em Vercel
2. Teste no Editor SQL do Supabase
3. Cheque CORS em Supabase → Auth → URL Configuration

## 📝 Documentação

- Arquivo: [DEPLOY.md](./DEPLOY.md) - Instruções completas
- Arquivo: [ESTRATEGIA_ESCALABILIDADE.md](./ESTRATEGIA_ESCALABILIDADE.md) - Arquitetura

## 🎉 Pronto!

Se chegou aqui, sua app está:
- ✅ Hospedada no Vercel
- ✅ Conectada ao Supabase
- ✅ Usando domínio seguro HTTPS
- ✅ Auto-deployando com Git

Acesse: `https://sandexpress-xxxxx.vercel.app`
