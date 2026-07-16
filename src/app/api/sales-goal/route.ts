import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

const EVENT_TYPE = 'daily_sales_goal_config';

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    const { data, error } = await supabaseAdmin.from('analytics_events')
      .select('metadata, created_at').eq('vendor_id', vendorId).eq('event_type', EVENT_TYPE)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ daily_goal: Math.max(0, Number((data as any)?.metadata?.daily_goal || 0)), updated_at: data?.created_at || null });
  } catch (error) {
    console.error('Sales goal GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar a meta.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const dailyGoal = Number(body.daily_goal);
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    if (!Number.isFinite(dailyGoal) || dailyGoal < 0 || dailyGoal > 10000000) {
      return NextResponse.json({ error: 'Informe uma meta diaria valida.' }, { status: 400 });
    }
    const { data: vendor, error: vendorError } = await supabaseAdmin.from('vendors').select('tenant_id').eq('id', vendorId).maybeSingle();
    if (vendorError || !vendor?.tenant_id) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });

    const normalizedGoal = Math.round(dailyGoal * 100) / 100;
    const { data, error } = await supabaseAdmin.from('analytics_events').insert({
      tenant_id: vendor.tenant_id,
      vendor_id: vendorId,
      event_type: EVENT_TYPE,
      metadata: { daily_goal: normalizedGoal },
      payload: { updated_by: session?.user_id || session?.role || 'vendor' },
    } as any).select('created_at').single();
    if (error) throw error;
    return NextResponse.json({ daily_goal: normalizedGoal, updated_at: data.created_at });
  } catch (error) {
    console.error('Sales goal POST error:', error);
    return NextResponse.json({ error: 'Erro ao salvar a meta.' }, { status: 500 });
  }
}
