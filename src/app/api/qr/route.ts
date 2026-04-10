import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/qr?umbrella_id=xxx&number=1&base_url=https://app.run.app
 * Gera a URL do QR code para um guarda-sol.
 * Usa a API pública do goqr.me para gerar o QR code como imagem.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const umbrella_id = searchParams.get('umbrella_id');
    const number = searchParams.get('number') || '1';
    const base_url = searchParams.get('base_url') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!umbrella_id) {
      return NextResponse.json({ error: 'umbrella_id obrigatório.' }, { status: 400 });
    }

    // URL que o QR code aponta
    const targetUrl = `${base_url}/u/${umbrella_id}`;

    // URL para gerar o QR code via API pública
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}&format=png&margin=20`;

    return NextResponse.json({
      umbrella_id,
      number: parseInt(number),
      target_url: targetUrl,
      qr_image_url: qrImageUrl,
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
