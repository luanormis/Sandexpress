# 🚀 Deploy no Vercel e Teste no Celular

Este guia mostra como colocar o projeto online no Vercel, como testar a aplicação no celular fora da rede local e quais hospedagens são recomendadas.

---

## 1. Requisitos

- Conta no GitHub ou GitLab
- Conta no Vercel
- Projeto no Supabase configurado
- Variáveis de ambiente do Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

> Use o `SUPABASE_SERVICE_ROLE_KEY` apenas em rotas server-side. Não deixe essa chave exposta no cliente.

---

## 2. Passo a passo para deploy no Vercel

### 2.1. Subir o código para o GitHub

1. No repositório local, inicialize o Git (se não estiver inicializado):
   ```bash
   git init
   git add .
   git commit -m "Inicial commit SandExpress"
   ```
2. Crie um repositório remoto no GitHub.
3. Envie o código:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git branch -M main
   git push -u origin main
   ```

### 2.2. Importar o projeto no Vercel

1. Acesse https://vercel.com/
2. Clique em **New Project** → **Import Git Repository**
3. Escolha o repositório GitHub do projeto
4. Em **Framework Preset**, selecione `Next.js`
5. Em **Root Directory**, deixe em branco se o app estiver na raiz do repositório
6. Em **Build Command**, use:
   ```bash
   npm run build
   ```
7. Em **Output Directory**, deixe o padrão (não precisa alterar)

### 2.3. Configurar variáveis de ambiente no Vercel

No projeto Vercel:
- Vá em `Settings` → `Environment Variables`
- Adicione:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

Defina os valores corretos do seu projeto Supabase.

### 2.4. Deploy

1. Clique em `Deploy`
2. Aguarde a construção terminar
3. Use a URL gerada pelo Vercel, por exemplo: `https://seu-projeto.vercel.app`

---

## 3. Testar no celular fora da rede local

### Opção A: Usar a URL do Vercel

1. Abra o navegador do celular
2. Digite a URL do Vercel
3. A aplicação estará disponível publicamente via HTTPS

> Essa é a melhor forma. Não é preciso estar na mesma rede Wi-Fi.

### Opção B: Testar localmente com `ngrok` (quando ainda não estiver no Vercel)

1. Instale o `ngrok`: https://ngrok.com/
2. Execute o app localmente:
   ```bash
   npm install
   npm run dev
   ```
3. Execute o tunnel:
   ```bash
   ngrok http 3000
   ```
4. Copie a URL pública `https://xxxxxx.ngrok.io`
5. Abra essa URL no celular

> Assim você testa em celular antes de fazer deploy.

---

## 4. Como rodar o projeto no Vercel

### Comandos principais

```bash
npm install
npm run build
npm run start
```

### Observações

- O Vercel executa `npm run build` automaticamente
- App Router do Next.js é suportado nativamente
- API routes (`src/app/api/*`) funcionam normalmente no Vercel

---

## 5. Sugestões de hospedagem

### Recomendado

- **Vercel**: melhor opção para Next.js, deploy rápido, HTTPS automático e integração com GitHub.
- **Supabase**: ideal para o banco de dados e auth do projeto.

### Outras opções válidas

- **Railway**: fácil deploy fullstack, bom para protótipos
- **Render**: também suporta Next.js e APIs serverless
- **Fly.io**: bom para apps globais, mas mais avançado
- **Netlify**: funciona para Next.js estático e funções, mas Vercel costuma ser mais simples para App Router

### Para banco de dados

- **Supabase** (recomendado)
- **Crunchy Bridge** / **Neon** (Postgres)
- **PlanetScale** (MySQL, se migrar depois)

---

## 6. Checklist para deploy seguro

- [ ] Configurar `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Configurar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` não está no client bundle
- [ ] Ativar HTTPS automático no Vercel
- [ ] Definir `NODE_VERSION` compatível (`18` ou superior)
- [ ] Testar no celular com a URL pública

---

## 7. Como verificar se está online

1. Abra a URL do Vercel no navegador do celular
2. Verifique se a página inicial carrega
3. Acesse `/vendor/login` e `/admin/admin` para testar as rotas de painel
4. Teste o QR Code do guarda-sol `https://<seu-site>/u/<umbrella_id>` se tiver gerado

---

## 8. Dica rápida: Mudar região de hospedagem

- Escolha região Vercel próxima ao seu público principal
- Se o Supabase estiver em `sa-east-1` ou `us-east-1`, escolha região Vercel com baixa latência para o Brasil / América

---

## 9. Importante

Mesmo com o site no ar, a parte de banco precisa ser configurada corretamente.
Use o guia `infra/supabase-schema.sql` e `infra/seed-data.sql` para criar o esquema e popular os dados antes de testar a aplicação.
