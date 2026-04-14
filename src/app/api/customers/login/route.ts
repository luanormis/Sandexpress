import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionToken } from '@/lib/auth-session';
import { getOtpMode, verifyCustomerOtp } from '@/lib/customer-otp';

/**
 * POST /api/customers/login
 * Login/cadastro do cliente.
 * Se o cliente já existe (mesmo phone + vendor_id), incrementa visitas.
 * Se não, cria novo registro.
 *
 * Env CUSTOMER_OTP_MODE=dev → aceita código fixo 000000 (apenas desenvolvimento).
 * Env CUSTOMER_OTP_MODE=required → exige otp_code válido após /api/customers/request-otp.
 */
export async function POST(req: NextRequest) {
  try {
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
      if (!verifyCustomerOtp(phone, vendor_id, otp_code)) {
        return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 });
      }
    }

    // Verificar se cliente já existe neste quiosque
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('vendor_id', vendor_id)
      .eq('phone', phone)
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
      .insert({ name, phone, vendor_id })
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
