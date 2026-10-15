import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';

const KEY = 'theme.global';
const DEFAULT_THEME = { background: '#fff8e8', foreground: '#241b16', surface: '#fffdf7', primary: '#ff9a3c', border: '#d5b797', muted: '#65574b', buttonText: '#241b16' };
const HEX = /^#[0-9a-f]{6}$/i;
function normalize(value: unknown, fallback: string) { const text = String(value || '').trim(); return HEX.test(text) ? text : fallback; }
function clean(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key, fallback]) => [key, normalize(value[key], fallback)])); }

export async function GET() {
  const { data, error } = await supabaseAdmin.from('platform_settings').select('value').eq('key', KEY).maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível carregar o tema global.' }, { status: 500 });
  return NextResponse.json(clean((data?.value || {}) as Record<string, unknown>));
}

export async function PATCH(request: NextRequest) {
  const session = getRequestSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const theme = clean(body);
  const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: KEY, value: theme, description: 'Paleta global das telas internas; a página inicial permanece independente.', updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: 'Não foi possível salvar o tema global.' }, { status: 500 });
  return NextResponse.json(theme);
}
