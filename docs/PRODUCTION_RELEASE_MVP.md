# SandExpress MVP - release para Vercel

## Branches

- Teste/staging: `sandexpress-teste`
- Producao: `sandexpress-producao`

No Vercel, use `sandexpress-producao` como branch de producao. A branch `sandexpress-teste` deve ficar para preview e validacao antes de liberar dominio proprio.

## Banco Supabase

Antes do deploy de producao, rode no SQL Editor:

```sql
-- arquivo do repositorio
infra/production-multitenant-mvp.sql
```

Esse script cria/normaliza o modelo multi-tenant. Cada quiosque vira um `tenant` separado, com produtos e guarda-sois proprios. Clientes, pedidos e analytics ficam isolados por `tenant_id`; o admin global acessa tudo pelas APIs com service role.

## Variaveis Vercel

Use `env.staging.example` no ambiente Preview/Staging e `env.production.example` no ambiente Production.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no navegador, em commit ou em variavel publica `NEXT_PUBLIC_*`. Ela deve ficar somente em Environment Variables do Vercel.

## WhatsApp/OTP

Validacao por WhatsApp esta desativada no MVP:

```env
CUSTOMER_OTP_MODE=disabled
```

O cliente acessa pelo QR do guarda-sol e abre comanda com nome, telefone e quantidade de pessoas. A integracao WhatsApp/Twilio deve voltar depois do teste real com mais de 20 clientes.

## Escala inicial

O banco foi preparado com indices por `tenant_id`, `vendor_id`, `status` e `created_at` para operar a primeira meta de 100 quiosques. Para 10 mil clientes simultaneos, mantenha:

- APIs server-side no Vercel usando service role.
- Realtime apenas para tabelas operacionais (`orders`, `order_items`, `umbrellas`).
- Produtos e guarda-sois carregados por consultas filtradas pelo vendor/tenant.
- Relatorios pesados no admin com filtros por periodo, praia, cidade e quiosque.
