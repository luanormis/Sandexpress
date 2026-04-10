import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Endpoint de health check para Cloud Run e monitoramento.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NEXT_PUBLIC_ENV || 'development',
  });
}
