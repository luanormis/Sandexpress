import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { createBrandedQrSvg, svgToDataUrl } from '@/lib/branded-qr';
import { buildUmbrellaQrTargetUrl, getPublicAppUrl } from '@/lib/public-url';
import { supabaseAdmin } from '@/lib/supabase-admin';

const QR_BATCH_LIMIT = 120;
type PrintableUmbrella = { id: string; number: number; label: string; active: boolean };

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id');
    if (!vendorId) return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const [{ data: vendor, error: vendorError }, { data: umbrellas, error: umbrellasError }] = await Promise.all([
      supabaseAdmin.from('vendors').select('id, name').eq('id', vendorId).single(),
      supabaseAdmin
        .from('umbrellas')
        .select('id, number, label, active')
        .eq('vendor_id', vendorId)
        .order('number', { ascending: true })
        .limit(QR_BATCH_LIMIT),
    ]);

    if (vendorError || !vendor) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    if (umbrellasError) throw umbrellasError;

    const baseUrl = getPublicAppUrl(req);
    const items = await Promise.all(((umbrellas || []) as PrintableUmbrella[]).map(async umbrella => {
      const options = { vendorName: vendor.name, umbrellaNumber: umbrella.number };
      const targetUrl = buildUmbrellaQrTargetUrl(baseUrl, vendorId, umbrella.id, options);
      const svg = await createBrandedQrSvg(targetUrl);
      return {
        id: umbrella.id,
        number: umbrella.number,
        label: umbrella.label,
        active: umbrella.active,
        target_url: targetUrl,
        qr_image_url: svgToDataUrl(svg),
      };
    }));

    return NextResponse.json({
      vendor: { id: vendor.id, name: vendor.name },
      generated_at: new Date().toISOString(),
      count: items.length,
      items,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('QR batch error:', error);
    return NextResponse.json({ error: 'Nao foi possivel montar a folha de QR Codes.' }, { status: 500 });
  }
}
