import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOtpMode, setCustomerOtp } from '@/lib/customer-otp';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * POST /api/customers/request-otp
 * Solicita código de verificação (armazenado no servidor).
 * Integração WhatsApp/SMS: configure o provedor e chame a API de envio aqui — ver docs/EXTERNAL_INTEGRATIONS.md
 */
export async function POST(req: NextRequest) {
  try {
    if (isRateLimited(req, 'customer-request-otp', 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { phone, vendor_id } = await req.json();
    if (!phone || !vendor_id) {
      return NextResponse.json({ error: 'phone e vendor_id são obrigatórios.' }, { status: 400 });
    }

    const { data: v } = await supabaseAdmin.from('vendors').select('id').eq('id', vendor_id).single();
    if (!v) {
      return NextResponse.json({ message: 'Se os dados estiverem corretos, você receberá o código.' });
    }

    const mode = getOtpMode();
    if (mode === 'dev') {
      return NextResponse.json({
        message: 'Modo desenvolvimento: use o código 000000 ou veja CUSTOMER_OTP_MODE em documentação.',
        dev_hint: '000000',
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    setCustomerOtp(phone, vendor_id, code, 10 * 60 * 1000);

    // TODO: integrar Twilio / Meta WhatsApp Cloud — quando variáveis estiverem definidas, enviar `code` ao telefone.
    return NextResponse.json({
      message: 'Código gerado. Verifique seu WhatsApp/SMS quando o envio estiver configurado.',
    });
  } catch (err) {
    console.error('request-otp error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
