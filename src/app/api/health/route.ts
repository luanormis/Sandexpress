import { NextResponse } from 'next/server';
import { isSupabaseUrlConfigured } from '@/lib/supabase-env';
import { buildReadinessReport, getBlockingReadinessIssues } from '@/lib/readiness';

const REQUIRED_TABLES = [
  { table: 'tenants', column: 'id' },
  { table: 'beaches', column: 'id' },
  { table: 'vendors', column: 'id' },
  { table: 'vendors', column: 'plan_monthly_price' },
  { table: 'vendors', column: 'plan_annual_monthly_price' },
  { table: 'vendor_users', column: 'id' },
  { table: 'customers', column: 'id' },
  { table: 'umbrellas', column: 'id' },
  { table: 'products', column: 'id' },
  { table: 'product_images', column: 'id' },
  { table: 'orders', column: 'id' },
  { table: 'order_items', column: 'id' },
  { table: 'daily_closings', column: 'id' },
  { table: 'terms_acceptances', column: 'id' },
  { table: 'account_adjustments', column: 'id' },
  { table: 'customer_satisfaction_surveys', column: 'id' },
  { table: 'vendor_plans', column: 'id' },
  { table: 'tenant_features', column: 'id' },
  { table: 'rate_limit_buckets', column: 'key' },
  { table: 'otp_challenges', column: 'id' },
  { table: 'analytics_events', column: 'id' },
  { table: 'platform_settings', column: 'key' },
  { table: 'platform_settings', column: 'value' },
];

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
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const checks = await Promise.all(
      REQUIRED_TABLES.map(async ({ table, column }) => {
        const { error } = await supabaseAdmin.from(table).select(column).limit(1);
        return {
          table,
          ok: !error,
          code: error?.code || null,
          error: error?.message || null,
        };
      })
    );
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
