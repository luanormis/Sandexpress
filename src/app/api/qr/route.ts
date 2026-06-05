import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/qr?umbrella_id=xxx&number=1
 * Gera QR code localmente (sem dependência de serviço externo).
 * Retorna SVG inline ou PNG em base64.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const umbrella_id = searchParams.get('umbrella_id');
    const number = searchParams.get('number') || '1';
    const format = searchParams.get('format') || 'svg'; // 'svg' ou 'png'
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const base_url =
      searchParams.get('base_url') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      origin;

    if (!umbrella_id) {
      return NextResponse.json({ error: 'umbrella_id obrigatório.' }, { status: 400 });
    }

    const targetUrl = `${base_url}/u/${umbrella_id}`;
    let umbrella: { vendor_id?: string; number?: number } | null = null;
    try {
      const { data } = await supabaseAdmin
        .from('umbrellas')
        .select('id, vendor_id, number, active')
        .eq('id', umbrella_id)
        .single();
      umbrella = data;
    } catch {
      umbrella = null;
    }

    if (format === 'png') {
      const dataUrl = await QRCode.toDataURL(targetUrl, { width: 400, margin: 2 });
      return NextResponse.json({
        umbrella_id,
        vendor_id: umbrella?.vendor_id || null,
        number: umbrella?.number ?? parseInt(number),
        target_url: targetUrl,
        qr_image_url: dataUrl,
        format: 'png',
      });
    }

    // SVG (padrão — menor, escalável, sem dependência de browser)
    const svg = await QRCode.toString(targetUrl, { type: 'svg', margin: 2 });
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
