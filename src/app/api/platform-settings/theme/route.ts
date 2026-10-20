import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';

const DEFAULT_THEME = { background: '#fff8e8', foreground: '#241b16', surface: '#fffdf7', primary: '#ff9a3c', border: '#d5b797', muted: '#65574b', buttonText: '#241b16' };

export async function GET() {
  return NextResponse.json(DEFAULT_THEME, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const session = getRequestSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
  return NextResponse.json({ error: 'As cores do sistema agora usam a paleta padrão fixa.' }, { status: 410 });
}
