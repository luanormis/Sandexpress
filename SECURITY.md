# Protocolo de seguranca SandExpress

## Segredos

- Nunca commitar `.env.local`, JWTs, service role, tokens de Twilio, chaves PIX ou senhas reais.
- Rotacionar imediatamente qualquer `SUPABASE_SERVICE_ROLE_KEY` que tenha aparecido em GitHub, chat, print ou log.
- Usar chaves diferentes para `staging` e `production`.
- `SESSION_SECRET` deve ter 32+ caracteres em producao.

## Deploy

- `staging` usa banco Supabase de testes e `CUSTOMER_OTP_MODE=dev`.
- `production` usa banco Supabase real e `CUSTOMER_OTP_MODE=required`.
- Vercel Production deve apontar para a branch `production`.
- Vercel Preview/Staging deve apontar para a branch `staging`.

## Banco

- Rodar `infra/add-close-account-pix-flow.sql` nos bancos de staging e producao.
- Manter backups automaticos do Supabase ativos em producao.
- Testes destrutivos, resets e seeds completos somente em staging.
- Em producao, preferir migracoes incrementais e revisadas.

## Protecoes implementadas no app

- Cookies de sessao `httpOnly`, `sameSite=lax` e `secure` em producao.
- Assinatura HMAC das sessoes com comparacao em tempo constante.
- Headers globais: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS e CSP basica.
- Proxy de API com:
  - bloqueio de metodos inesperados;
  - validacao de `Origin` em metodos mutaveis;
  - limite de tamanho de payload;
  - exigencia de `application/json` nas APIs JSON;
  - rate limit leve para login/cadastro/mutacoes;
  - autenticacao obrigatoria nas APIs privadas.

## Operacao

- Monitorar erros 4xx/5xx e picos de `429`.
- Monitorar uso de banco, latencia e consumo de realtime no Supabase.
- Ativar alertas de billing no Supabase e Vercel.
- Criar usuario admin forte antes de producao e trocar qualquer senha padrao.
- Revisar permissoes RLS antes de liberar dados reais.

## Incidente

1. Pausar deploy se houver vazamento de chave.
2. Rotacionar chave no provedor afetado.
3. Remover segredo do HEAD do Git.
4. Invalidar sessoes se `SESSION_SECRET` vazou.
5. Auditar logs de acesso e pedidos recentes.
