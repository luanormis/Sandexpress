/**
 * OTP persistido no Supabase (funciona com múltiplas réplicas).
 * Tabela: customer_otps  (ver infra/migration-ajustes.sql)
 *
 * WhatsApp/SMS: configure WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (Meta Cloud API)
 * ou TWILIO_SID + TWILIO_TOKEN + TWILIO_FROM para Twilio.
 * Enquanto não configurados, o modo 'dev' retorna o código na resposta da API.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function setCustomerOtp(
  phone: string,
  vendorId: string,
  code: string,
  ttlMs: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const normalized = normalizePhone(phone);

  // Invalida OTPs anteriores do mesmo telefone/vendor
  await supabaseAdmin
    .from('customer_otps')
    .update({ used: true })
    .eq('vendor_id', vendorId)
    .eq('phone', normalized)
    .eq('used', false);

  await supabaseAdmin.from('customer_otps').insert({
    phone: normalized,
    vendor_id: vendorId,
    code,
    expires_at: expiresAt,
  });
}

export async function verifyCustomerOtp(
  phone: string,
  vendorId: string,
  code: string
): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const cleanCode = normalizePhone(code);

  const { data } = await supabaseAdmin
    .from('customer_otps')
    .select('id, code, expires_at')
    .eq('vendor_id', vendorId)
    .eq('phone', normalized)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return false;

  const ok = data.code === cleanCode;
  if (ok) {
    await supabaseAdmin
      .from('customer_otps')
      .update({ used: true })
      .eq('id', data.id);
  }
  return ok;
}

export function getOtpMode(): 'dev' | 'required' {
  const m = process.env.CUSTOMER_OTP_MODE;
  if (m === 'dev') return 'dev';
  if (m === 'required') return 'required';
  return process.env.NODE_ENV === 'production' ? 'required' : 'dev';
}

/**
 * Envia o código via WhatsApp (Meta Cloud API) ou Twilio.
 * Retorna true se enviado com sucesso, false se nenhum provedor configurado.
 */
export async function sendOtpWhatsApp(phone: string, code: string): Promise<boolean> {
  const normalized = normalizePhone(phone);

  // --- Meta WhatsApp Cloud API ---
  const waToken = process.env.WHATSAPP_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_ID;
  if (waToken && waPhoneId) {
    const body = {
      messaging_product: 'whatsapp',
      to: `55${normalized}`,
      type: 'text',
      text: { body: `Seu código de verificação SandExpress: *${code}*\nVálido por 10 minutos.` },
    };
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${waPhoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return res.ok;
  }

  // --- Twilio WhatsApp ---
  const twilioSid = process.env.TWILIO_SID;
  const twilioToken = process.env.TWILIO_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM;
  if (twilioSid && twilioToken && twilioFrom) {
    const params = new URLSearchParams({
      From: `whatsapp:${twilioFrom}`,
      To: `whatsapp:+55${normalized}`,
      Body: `Seu código SandExpress: ${code}. Válido por 10 minutos.`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    return res.ok;
  }

  return false; // Nenhum provedor configurado — use CUSTOMER_OTP_MODE=dev para testes
}
