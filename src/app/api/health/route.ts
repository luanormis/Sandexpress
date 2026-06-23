import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isSupabaseUrlConfigured } from '@/lib/supabase-env';
import { buildReadinessReport, getBlockingReadinessIssues } from '@/lib/readiness';

/**
 * GET /api/health
 * Endpoint de health check para Cloud Run e monitoramento.
 */
export async function GET() {
  const readiness = buildReadinessReport();
  const blockingEnv = getBlockingReadinessIssues(readiness);
  const base = {
    timestamp: new Date().toISOString(),
    env: process.env.NEXT_PUBLIC_ENV || 'development',
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
    const checks = await Promise.all([
      supabaseAdmin.from('vendors').select('id').limit(1),
      supabaseAdmin.from('vendor_users').select('id').limit(1),
      supabaseAdmin.from('beaches').select('id').limit(1),
      supabaseAdmin.from('tenant_features').select('id').limit(1),
      supabaseAdmin.from('otp_challenges').select('id').limit(1),
    ]);
    const missingSchema = checks.some(({ error }) => ['42P01', 'PGRST205'].includes(error?.code));
    if (missingSchema) {
      return NextResponse.json(
        {
          status: 'degraded',
          ...base,
          database: 'schema_outdated',
          hint: 'Rode infra/sql-iniciar-novo-projeto.sql no SQL Editor do Supabase para criar/atualizar as tabelas obrigatorias, incluindo otp_challenges.',
        },
        { status: 503 }
      );
    }
    const failed = checks.find(({ error }) => error);
    if (failed?.error) throw failed.error;

    return NextResponse.json({
      status: readiness.status === 'ok' ? 'ok' : 'degraded',
      ...base,
      database: 'connected',
      hint: readiness.status === 'ok'
        ? 'Sistema pronto para operacao com integracoes reais configuradas.'
        : 'Sistema principal pronto, mas ha integracoes externas pendentes em readiness.external.',
    });
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        ...base,
        database: 'unreachable',
      },
      { status: 503 }
    );
  }
}
