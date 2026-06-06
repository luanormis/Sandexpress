import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isSupabaseUrlConfigured } from '@/lib/supabase-env';

/**
 * GET /api/health
 * Endpoint de health check para Cloud Run e monitoramento.
 */
export async function GET() {
  const base = {
    timestamp: new Date().toISOString(),
    env: process.env.NEXT_PUBLIC_ENV || 'development',
  };

  if (!isSupabaseUrlConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        status: 'degraded',
        ...base,
        database: 'not_configured',
        hint: 'Defina NEXT_PUBLIC_SUPABASE_URL como https://SEU-PROJETO.supabase.co e SUPABASE_SERVICE_ROLE_KEY com a service role key.',
      },
      { status: 503 }
    );
  }

  try {
    const checks = await Promise.all([
      supabaseAdmin.from('vendors').select('id').limit(1),
      supabaseAdmin.from('beaches').select('id').limit(1),
      supabaseAdmin.from('default_menu_items').select('id').limit(1),
    ]);
    const missingSchema = checks.some(({ error }) => ['42P01', 'PGRST205'].includes(error?.code));
    if (missingSchema) {
      return NextResponse.json(
        {
          status: 'degraded',
          ...base,
          database: 'schema_outdated',
          hint: 'Rode infra/sql-iniciar-novo-projeto.sql no SQL Editor do Supabase para criar beaches e default_menu_items.',
        },
        { status: 503 }
      );
    }
    const failed = checks.find(({ error }) => error);
    if (failed?.error) throw failed.error;

    return NextResponse.json({
      status: 'ok',
      ...base,
      database: 'connected',
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
