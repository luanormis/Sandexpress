import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

type UpsellRule = { trigger_product_id: string; suggested_product_ids: string[]; message: string };

function normalizeRules(value: unknown): UpsellRule[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const rules: UpsellRule[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as any;
    const trigger = String(item.trigger_product_id || '');
    const suggestions: string[] = Array.isArray(item.suggested_product_ids) ? item.suggested_product_ids.map(String).filter(isCanonicalUuid).slice(0, 8) : [];
    if (!isCanonicalUuid(trigger) || suggestions.length === 0) continue;
    rules.push({ trigger_product_id: trigger, suggested_product_ids: Array.from(new Set(suggestions.filter(id => id !== trigger))), message: String(item.message || 'Que tal adicionar também?').trim().slice(0, 120) });
  }
  return rules;
}

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    if (!isCanonicalUuid(vendorId)) return NextResponse.json({ error: 'vendor_id invalido.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('analytics_events').select('metadata, created_at').eq('vendor_id', vendorId).eq('event_type', 'upsell_config').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ rules: normalizeRules((data as any)?.metadata?.rules || []) || [] });
  } catch (error) {
    console.error('Upsell settings GET error:', error);
    return NextResponse.json({ rules: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(session, vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const rules = normalizeRules(body.rules);
    if (!rules) return NextResponse.json({ error: 'Regras invalidas.' }, { status: 400 });
    const { data: vendor } = await supabaseAdmin.from('vendors').select('tenant_id').eq('id', vendorId).single();
    const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: vendor?.tenant_id, vendor_id: vendorId, event_type: 'upsell_config', metadata: { rules }, payload: { updated_by: session?.user_id || session?.role || 'vendor' } } as any);
    if (error) throw error;
    return NextResponse.json({ saved: true, rules });
  } catch (error) {
    console.error('Upsell settings POST error:', error);
    return NextResponse.json({ error: 'Erro ao salvar sugestoes.' }, { status: 500 });
  }
}
