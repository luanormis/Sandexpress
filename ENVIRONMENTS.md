# Ambientes Git e Deploy

Este projeto usa dois ambientes separados:

- `staging`: testes, validação de fluxo, banco Supabase de testes e OTP em modo `dev`.
- `production`: produção, banco Supabase real e OTP obrigatório.

## Branches

- Desenvolvimento seguro: trabalhe em branches `codex/...` ou `feature/...`.
- Testes: abra PR para `staging`.
- Produção: depois de validar em `staging`, abra PR de `staging` para `production`.

## Variáveis no Vercel

Crie dois projetos no Vercel ou dois ambientes no mesmo projeto:

- Staging: use `.env.staging.example` como referência.
- Production: use `.env.production.example` como referência.

Nunca coloque `.env.local`, `SUPABASE_SERVICE_ROLE_KEY` real ou tokens JWT no Git.

## Banco

Use projetos Supabase separados:

- Supabase Staging: dados de teste, pode ser resetado.
- Supabase Production: dados reais, sem testes manuais destrutivos.

Execute `infra/add-close-account-pix-flow.sql` nos dois bancos antes do deploy da versão atual.
