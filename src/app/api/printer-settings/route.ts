import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { normalizePrinters } from '@/lib/printer-routing';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }
    const [{ data: config, error: configError }, { data: vendor, error: vendorError }] = await Promise.all([
      supabaseAdmin.from('analytics_events').select('metadata').eq('vendor_id', vendorId).eq('event_type', 'printer_config').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('vendors').select('name').eq('id', vendorId).single(),
    ]);
    if (configError) throw configError;
    if (vendorError) throw vendorError;
    return NextResponse.json({ kiosk_name: String(vendor?.name || 'Quiosque'), printers: normalizePrinters((config as any)?.metadata?.printers) });
  } catch (error) {
    console.error('Printer settings GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar impressoras.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(session, vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const printers = normalizePrinters(body.printers);
    if (!Array.isArray(body.printers) || printers.length !== body.printers.length) return NextResponse.json({ error: 'Configuracao de impressoras invalida.' }, { status: 400 });
    const { data: vendor } = await supabaseAdmin.from('vendors').select('tenant_id').eq('id', vendorId).single();
    const { error } = await supabaseAdmin.from('analytics_events').insert({ tenant_id: vendor?.tenant_id, vendor_id: vendorId, event_type: 'printer_config', metadata: { printers }, payload: { updated_by: session?.user_id || session?.role || 'vendor' } } as any);
    if (error) throw error;
    return NextResponse.json({ saved: true, printers });
  } catch (error) {
    console.error('Printer settings POST error:', error);
    return NextResponse.json({ error: 'Erro ao salvar impressoras.' }, { status: 500 });
  }
}
