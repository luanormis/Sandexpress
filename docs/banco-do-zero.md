# Banco do zero - SandExpress

## Atualizar um banco que ja esta em uso

Para preservar tabelas e dados existentes e aplicar o limite de 100 guarda-sois, indices de escala, protecao concorrente e idempotencia de pedidos, execute no SQL Editor o arquivo `infra/sql-atualizacao-escala-1000-quiosques.sql`.

Esse update usa `ALTER TABLE`, `CREATE ... IF NOT EXISTS` e `UPDATE`. Ele nao possui `DROP TABLE` nem `TRUNCATE` e pode ser executado novamente com seguranca.

Se o banco ja recebeu essa migracao e o limite de 100, execute depois `infra/sql-atualizacao-limite-admin-120.sql`. Ele mantem 100 como padrao, amplia apenas o teto tecnico para 120 e deixa a liberacao individual sob controle do administrador.

Use este fluxo quando for iniciar ou recriar o Supabase do projeto.

## 1. Rodar o schema completo

No Supabase:

1. Abra o projeto.
2. Clique em `SQL Editor`.
3. Clique em `New query`.
4. Cole todo o conteudo de `infra/schema-supabase-completo.sql`.
5. Clique em `Run`.

Esse script apaga e recria as tabelas do SandExpress. Use somente em projeto novo ou depois de backup.

Se preferir, `infra/sql-iniciar-novo-projeto.sql` tem o mesmo conteudo. O arquivo `schema-supabase-completo.sql` existe para ficar claro qual SQL colar no Supabase quando for iniciar do zero.

## 2. O que o script cria

- Tabelas reais para tenants, praias, quiosques, equipe, clientes, guarda-sois, produtos, pedidos, itens, fechamento diario, ajustes, OTP, rate limit, analytics e configuracoes.
- Indices de escala para consultas por quiosque, data, status, telefone, QR e relatorios.
- RLS bloqueando acesso direto para dados operacionais.
- Grants para `service_role`, usado pelas API routes server-side.
- Buckets:
  - `product-images`, publico, para imagens de produto.
  - `kiosk-assets`, publico, para logos em `logos/{vendor_id}/`.
  - `order-archives`, privado, para arquivos de auditoria.
- Defaults reais de plataforma em `platform_settings`.

## 3. O que ele nao cria

Ele nao cria quiosques, produtos, guarda-sois, clientes, pedidos ou praias falsas. Esses dados entram pelo cadastro real do sistema.

## 4. Depois de rodar

1. Abra `/api/health` no dominio local ou deploy.
2. Confirme se `database.status` nao esta bloqueado.
3. Cadastre o primeiro quiosque pelo admin ou pela tela publica.
4. Cadastre produtos reais.
5. Cadastre guarda-sois reais e gere os QR Codes.
6. Suba a logo do quiosque pela aba `Personalizacao`.

## 5. Chaves externas que ainda podem bloquear funcoes

- Meta WhatsApp Cloud API: necessaria para envio real de OTP.
- Resend: necessario para envio real de email.
- Provedor de pagamento: necessario para liquidar PIX/cartao automaticamente.
- Dominio publico em `NEXT_PUBLIC_APP_URL`: necessario para QR Codes e links de email.
