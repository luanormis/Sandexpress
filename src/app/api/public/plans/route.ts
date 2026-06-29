import { NextResponse } from 'next/server';
import { getPlatformPlanSettings } from '@/lib/platform-plans';

export async function GET() {
  try {
    return NextResponse.json(await getPlatformPlanSettings());
  } catch (err) {
    console.error('Public plans GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar planos.' }, { status: 500 });
  }
}
