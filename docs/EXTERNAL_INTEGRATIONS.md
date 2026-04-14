# Integrações externas (produção)

Configure credenciais no ambiente de deploy (Cloud Run, Vercel, etc.) e no Supabase. O código não envia SMS/WhatsApp/e-mail sozinho até você plugar um provedor.

## Supabase

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Crie o bucket `product-images` (público ou com URL assinada) para upload de fotos de produto.
- Aplique o schema em `infra/supabase-schema.sql` no projeto SQL.

## Sessões e admin

- `SESSION_SECRET` (ou `VENDOR_JWT_SECRET`) — obrigatório para assinar cookies de sessão (vendor, admin, cliente).
- `ADMIN_PASSWORD` — login do painel em `/admin`.

## OTP do cliente (login por telefone)

- `CUSTOMER_OTP_MODE=dev` — em desenvolvimento costuma aceitar fluxo de teste (ex.: código `000000` conforme implementação em `src/lib/customer-otp.ts`).
- `CUSTOMER_OTP_MODE=required` — exige OTP válido (recomendado em produção).

O armazenamento de OTP é **em memória** no processo Node. Com várias réplicas ou cold starts, use Redis ou tabela no Supabase para o código e o envio.

### Enviar o código (você implementa)

1. Em `src/app/api/customers/request-otp/route.ts`, após gerar o OTP, chame seu provedor:
   - **SMS**: Twilio, Zenvia, etc.
   - **WhatsApp**: API da Meta (Cloud API) ou provedor intermediário.
2. Nunca commite API keys; use variáveis de ambiente (ex.: `TWILIO_*`, `WHATSAPP_*`).

## Recuperação de senha do vendor

`POST /api/auth/vendor/reset` grava token no banco mas **não envia** e-mail/SMS. Integre SendGrid, Resend, Twilio, etc., e envie o link ou código usando os campos `password_reset_token` / `password_reset_expires_at` na tabela `vendors`.
