import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOtpMode, setCustomerOtp, sendOtpWhatsApp } from '@/lib/customer-otp';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * POST /api/customers/request-otp
 * Gera e envia código de verificação via WhatsApp (Meta Cloud API ou Twilio).
 * Configure: WHATSAPP_TOKEN + WHATSAPP_PHONE_ID  ou  TWILIO_SID + TWILIO_TOKEN + TWILIO_FROM
 */
export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'customer-request-otp', 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { phone, vendor_id } = await req.json();
    if (!phone || !vendor_id) {
      return NextResponse.json({ error: 'phone e vendor_id são obrigatórios.' }, { status: 400 });
    }

    const { data: v } = await supabaseAdmin.from('vendors').select('id').eq('id', vendor_id).single();
    if (!v) {
      // Resposta genérica para evitar enumeração de vendors
      return NextResponse.json({ message: 'Se os dados estiverem corretos, você receberá o código.' });
    }

    const mode = getOtpMode();
    if (mode === 'dev') {
      return NextResponse.json({
        message: 'Modo desenvolvimento: use o código 000000.',
        dev_hint: '000000',
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await setCustomerOtp(phone, vendor_id, code, 10 * 60 * 1000);

    const sent = await sendOtpWhatsApp(phone, code);
    if (!sent) {
      console.warn('[OTP] Nenhum provedor WhatsApp configurado. Defina WHATSAPP_TOKEN+WHATSAPP_PHONE_ID ou TWILIO_SID+TWILIO_TOKEN+TWILIO_FROM.');
      return NextResponse.json({ error: 'Serviço de envio de código indisponível. Contate o suporte.' }, { status: 503 });
    }

    return NextResponse.json({ message: 'Código enviado para seu WhatsApp.' });
  } catch (err) {
    console.error('request-otp error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
