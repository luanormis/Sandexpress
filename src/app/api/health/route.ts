import { NextResponse } from 'next/server';
import { isSupabaseUrlConfigured } from '@/lib/supabase-env';
import { buildReadinessReport, getBlockingReadinessIssues } from '@/lib/readiness';
import { REQUIRED_SCHEMA_CHECKS } from '@/lib/readiness-schema';

type SchemaCheck = {
  table: string;
  ok: boolean;
  code: string | null;
  error: string | null;
};

const SCHEMA_CACHE_TTL_MS = 30_000;
let schemaCache: { expiresAt: number; checks: SchemaCheck[] } | null = null;
let schemaCheckInFlight: Promise<SchemaCheck[]> | null = null;

async function runSchemaChecks(): Promise<SchemaCheck[]> {
  if (schemaCache && schemaCache.expiresAt > Date.now()) return schemaCache.checks;
  if (schemaCheckInFlight) return schemaCheckInFlight;

  schemaCheckInFlight = (async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const grouped = new Map<string, string[]>();
    for (const { table, column } of REQUIRED_SCHEMA_CHECKS) {
      const columns = grouped.get(table) || [];
      if (!columns.includes(column)) columns.push(column);
      grouped.set(table, columns);
    }

    const tableResults = new Map<string, { code: string | null; error: string | null }>();
    await Promise.all([...grouped.entries()].map(async ([table, columns]) => {
      const { error } = await supabaseAdmin.from(table).select(columns.join(',')).limit(1);
      tableResults.set(table, {
        code: error?.code || null,
        error: error?.message || null,
      });
    }));

    const checks = REQUIRED_SCHEMA_CHECKS.map(({ table }) => {
      const result = tableResults.get(table);
      return {
        table,
        ok: !result?.error,
        code: result?.code || null,
        error: result?.error || null,
      };
    });
    schemaCache = { expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS, checks };
    return checks;
  })();

  try {
    return await schemaCheckInFlight;
  } finally {
    schemaCheckInFlight = null;
  }
}

/**
 * GET /api/health
 * Endpoint de health check para Cloud Run e monitoramento.
 */
export async function GET() {
  const readiness = buildReadinessReport();
  const blockingEnv = getBlockingReadinessIssues(readiness);
  const base = {
    timestamp: new Date().toISOString(),
    env: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
    readiness,
  };

  if (blockingEnv.length > 0 || !isSupabaseUrlConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        status: 'blocked',
        ...base,
        database: 'not_configured',
        blocking_env: blockingEnv,
        hint: 'Configure as variaveis obrigatorias indicadas em readiness.required antes do deploy.',
      },
      { status: 503 }
    );
  }

  try {
    const checks = await runSchemaChecks();
    const missingSchema = checks.some((check) => ['42P01', 'PGRST205', '42703'].includes(check.code || ''));
    if (missingSchema) {
      return NextResponse.json(
        {
          status: 'degraded',
          ...base,
          database: 'schema_outdated',
          schema_checks: checks,
          hint: 'Rode os SQLs incrementais em infra/ ou recrie com infra/sql-iniciar-novo-projeto.sql para criar/atualizar todas as tabelas obrigatorias.',
        },
        { status: 503 }
      );
    }
    const failed = checks.find((check) => !check.ok);
    if (failed) throw new Error(failed.error || `Falha ao validar tabela ${failed.table}`);

    return NextResponse.json({
      status: readiness.status === 'ok' ? 'ok' : 'degraded',
      ...base,
      database: 'connected',
      schema_checks: checks,
      hint: readiness.status === 'ok'
        ? 'Sistema pronto para operacao com integracoes reais configuradas.'
        : 'Sistema principal pronto, mas ha integracoes externas pendentes em readiness.external.',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        ...base,
        database: 'unreachable',
        error: err?.message || 'Falha ao conectar no Supabase.',
      },
      { status: 503 }
    );
  }
}
