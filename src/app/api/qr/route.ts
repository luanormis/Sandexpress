import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPublicAppUrl } from '@/lib/public-url';

/**
 * GET /api/qr?umbrella_id=xxx&format=svg|png
 * Generates a QR code that points to the exact vendor + umbrella route.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const umbrellaId = searchParams.get('umbrella_id');
    const format = searchParams.get('format') || 'svg';
    const baseUrl = searchParams.get('base_url') || getPublicAppUrl(req);

    if (!umbrellaId) {
      return NextResponse.json({ error: 'umbrella_id obrigatorio.' }, { status: 400 });
    }

    const { data: umbrella, error } = await supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, vendor_id, number, active')
      .eq('id', umbrellaId)
      .single();

    if (error || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }

    if (!umbrella.active) {
      return NextResponse.json({ error: 'Guarda-sol inativo.' }, { status: 403 });
    }

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/u/${umbrella.vendor_id}/${umbrella.id}`;

    await supabaseAdmin
      .from('umbrellas')
      .update({ qr_url: targetUrl })
      .eq('id', umbrella.id);

    if (format === 'png') {
      const dataUrl = await QRCode.toDataURL(targetUrl, { width: 400, margin: 2 });
      return NextResponse.json({
        umbrella_id: umbrella.id,
        tenant_id: umbrella.tenant_id,
        vendor_id: umbrella.vendor_id,
        number: umbrella.number,
        target_url: targetUrl,
        qr_image_url: dataUrl,
        format: 'png',
      });
    }

    const svg = await QRCode.toString(targetUrl, { type: 'svg', margin: 2 });
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
