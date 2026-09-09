# Segurança e organização do backend

## Proteção HTTP

O SandExpress usa Next.js App Router. O `src/proxy.ts` já aplica CSP, `nosniff`, proteção contra frames, política de origem, limite de payload e rate limit. Não instale Express apenas para duplicar essa camada.

Para um serviço Express separado, use:

```ts
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
```

## RLS por tenant

Revise e execute `infra/sql-seguranca-rls-tenant.sql`. `tenant_id` e `vendor_id` devem vir de `app_metadata`, nunca do corpo do cliente. A chave `service_role` deve existir somente no servidor.

## Validação com Zod

Centralize schemas em `src/server/schemas`:

```ts
import { z } from 'zod';

export const createProductSchema = z.object({
  vendor_id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(80),
  price: z.coerce.number().finite().nonnegative(),
  description: z.string().trim().max(500).optional(),
  image_url: z.string().url().max(2048).optional().or(z.literal('')),
}).strict();
```

Use `safeParse`, devolva HTTP 400 sem expor detalhes internos e derive `tenant_id` da sessão. Nunca confie no `tenant_id` do JSON.

## Estrutura recomendada

```text
src/server/
  controllers/   # traduz HTTP para casos de uso
  services/      # regras de negócio e transações
  repositories/  # consultas Supabase
  schemas/       # Zod e contratos de entrada
  errors/        # AppError e mapeamento HTTP
  types/         # tipos gerados do Supabase
```

No Next.js, `route.ts` deve autenticar, validar, chamar o Service e formatar a resposta. O Service não conhece `NextRequest`.

## Tratamento global de erros

```ts
export class AppError extends Error {
  constructor(message: string, public status = 400, public code = 'BAD_REQUEST') { super(message); }
}

export const route = (handler: (req: Request) => Promise<Response>) => async (req: Request) => {
  try { return await handler(req); }
  catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error(error);
    return Response.json({ error: 'Erro interno.' }, { status: 500 });
  }
};
```

## Tipos do Supabase

Gere tipos em `src/lib/database.types.ts`, use `createClient<Database>()` e, nos Services, utilize `Database['public']['Tables']['products']['Insert']` e `['Row']`. Mudanças incompatíveis de schema passam a falhar antes do deploy.

