import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildUmbrellaQrTargetPath, buildUmbrellaQrTargetUrl, getConfiguredPublicAppUrl, getPublicAppUrl } from '@/lib/public-url';
import { createBrandedQrSvg, svgToDataUrl } from '@/lib/branded-qr';

/**
 * GET /api/qr?umbrella_id=xxx&format=svg|png
 * Generates a QR code that points to the exact vendor + umbrella route.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const umbrellaId = searchParams.get('umbrella_id');
    const format = searchParams.get('format') || 'svg';
    const configuredPublicUrl = getConfiguredPublicAppUrl();
    if (process.env.NODE_ENV === 'production' && !configuredPublicUrl) {
      return NextResponse.json({
        error: 'Configure NEXT_PUBLIC_APP_URL com o dominio publico de producao antes de gerar QR Code.',
      }, { status: 500 });
    }
    const baseUrl = configuredPublicUrl || getPublicAppUrl(req);

    if (!umbrellaId) {
      return NextResponse.json({ error: 'umbrella_id obrigatorio.' }, { status: 400 });
    }

    const { data: umbrella, error } = await supabaseAdmin
      .from('umbrellas')
      .select('id, tenant_id, vendor_id, number, active, vendors(name)')
      .eq('id', umbrellaId)
      .single();

    if (error || !umbrella) {
      return NextResponse.json({ error: 'Guarda-sol nao encontrado.' }, { status: 404 });
    }

    if (!umbrella.active) {
      return NextResponse.json({ error: 'Guarda-sol inativo.' }, { status: 403 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, umbrella.vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const vendor = Array.isArray((umbrella as any).vendors) ? (umbrella as any).vendors[0] : (umbrella as any).vendors;
    const qrOptions = { vendorName: vendor?.name || null, umbrellaNumber: umbrella.number };
    const targetPath = buildUmbrellaQrTargetPath(umbrella.vendor_id, umbrella.id, qrOptions);
    const targetUrl = buildUmbrellaQrTargetUrl(baseUrl, umbrella.vendor_id, umbrella.id, qrOptions);

    await supabaseAdmin
      .from('umbrellas')
      .update({ qr_url: targetUrl, qr_path: targetPath })
      .eq('id', umbrella.id);

    if (format === 'png') {
      const dataUrl = await QRCode.toDataURL(targetUrl, { width: 400, margin: 2 });
      return NextResponse.json({
        umbrella_id: umbrella.id,
        tenant_id: umbrella.tenant_id,
        vendor_id: umbrella.vendor_id,
        number: umbrella.number,
        target_url: targetUrl,
        target_path: targetPath,
        qr_image_url: dataUrl,
        format: 'png',
      });
    }

    const svg = await createBrandedQrSvg(targetUrl);
    if (format === 'json') {
      return NextResponse.json({
        umbrella_id: umbrella.id,
        tenant_id: umbrella.tenant_id,
        vendor_id: umbrella.vendor_id,
        number: umbrella.number,
        target_url: targetUrl,
        target_path: targetPath,
        qr_image_url: svgToDataUrl(svg),
        format: 'svg',
      });
    }
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
