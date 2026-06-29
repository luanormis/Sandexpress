import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { getPlatformPlanSettings, savePlatformPlanSettings } from '@/lib/platform-plans';

function assertAdmin(req: NextRequest) {
  const session = getRequestSession(req);
  return Boolean(session && session.role === 'admin');
}

export async function GET(req: NextRequest) {
  try {
    if (!assertAdmin(req)) {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }
    return NextResponse.json(await getPlatformPlanSettings());
  } catch (err) {
    console.error('Plan settings GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar valores dos planos.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!assertAdmin(req)) {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }
    const body = await req.json();
    const settings = await savePlatformPlanSettings({
      trial_days: body.trial_days,
      monthly_price: body.monthly_price,
      annual_monthly_price: body.annual_monthly_price,
      max_umbrellas: body.max_umbrellas,
    });
    return NextResponse.json(settings);
  } catch (err) {
    console.error('Plan settings PATCH error:', err);
    return NextResponse.json({ error: 'Erro ao salvar valores dos planos.' }, { status: 500 });
  }
}
