import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/health
 * Endpoint de health check para Cloud Run e monitoramento.
 */
export async function GET() {
  const base = {
    timestamp: new Date().toISOString(),
    env: process.env.NEXT_PUBLIC_ENV || 'development',
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        status: 'degraded',
        ...base,
        database: 'not_configured',
        hint: 'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      },
      { status: 503 }
    );
  }

  try {
    const { error } = await supabaseAdmin.from('vendors').select('id').limit(1);
    if (error) throw error;

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
