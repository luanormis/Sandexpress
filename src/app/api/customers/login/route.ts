import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionToken } from '@/lib/auth-session';
import { getOtpMode, verifyCustomerOtp } from '@/lib/customer-otp';
import { isRateLimited } from '@/lib/rate-limit';

/**
 * POST /api/customers/login
 * Login/cadastro do cliente com verificação OTP.
 * visit_count é gerenciado APENAS aqui (removido do close-account para evitar duplicata).
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting no login para evitar brute-force de OTP
    if (await isRateLimited(req, 'customer-login', 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { name, phone, vendor_id, otp_code } = await req.json();

    if (!name || !phone || !vendor_id) {
      return NextResponse.json({ error: 'name, phone e vendor_id são obrigatórios.' }, { status: 400 });
    }

    const mode = getOtpMode();
    if (mode === 'dev') {
      const code = (otp_code || '').replace(/\D/g, '');
      if (code && code !== '000000') {
        return NextResponse.json({ error: 'Código inválido. Em dev use 000000.' }, { status: 401 });
      }
    } else {
      if (!otp_code) {
        return NextResponse.json({ error: 'Código de verificação obrigatório.' }, { status: 400 });
      }
      const valid = await verifyCustomerOtp(phone, vendor_id, otp_code);
      if (!valid) {
        return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
      }
    }

    // Verificar se cliente já existe neste quiosque
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('vendor_id', vendor_id)
      .eq('phone', phone.replace(/\D/g, ''))
      .single();

    if (existing) {
      // Atualizar nome e incrementar visitas
      const { data: updated, error } = await supabaseAdmin
        .from('customers')
        .update({
          name,
          visit_count: existing.visit_count + 1,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      const token = createSessionToken({ role: 'customer', vendor_id, customer_id: updated.id }, 12 * 60 * 60);
      const response = NextResponse.json(updated);
      response.cookies.set({
        name: 'customer_session',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60,
      });
      return response;
    }

    // Criar novo cliente
    const { data: newCustomer, error } = await supabaseAdmin
      .from('customers')
      .insert({ name, phone: phone.replace(/\D/g, ''), vendor_id })
      .select()
      .single();

    if (error) throw error;
    const token = createSessionToken({ role: 'customer', vendor_id, customer_id: newCustomer.id }, 12 * 60 * 60);
    const response = NextResponse.json(newCustomer, { status: 201 });
    response.cookies.set({
      name: 'customer_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Customer login error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
