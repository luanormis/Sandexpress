import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { vendorFeatureEnabled } from '@/lib/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyVendorPassword } from '@/lib/vendor-password';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const login = String(body.login || '').trim();
    const password = String(body.password || '');
    if (!login || !password) {
      return NextResponse.json({ error: 'Informe login e senha.' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('vendor_users')
      .select('id, tenant_id, vendor_id, name, role, password_hash, password_needs_reset, active, vendors(id, name, is_active, subscription_status)')
      .eq('login', login)
      .eq('active', true)
      .maybeSingle() as { data: any; error: any };
    if (error) throw error;
    if (!user?.password_hash || user.role !== 'seller' || !await verifyVendorPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Login ou senha de garcom invalidos.' }, { status: 401 });
    }
    const vendor = Array.isArray(user.vendors) ? user.vendors[0] : user.vendors;
    if (!vendor?.is_active || vendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque bloqueado.' }, { status: 403 });
    }
    if (!await vendorFeatureEnabled(user.vendor_id, 'waiter_service')) {
      return NextResponse.json({ error: 'Modulo de garcom ainda nao foi liberado pelo administrador.' }, { status: 403 });
    }

    const token = createSessionToken({
      role: 'vendor', vendor_id: user.vendor_id, tenant_id: user.tenant_id, user_id: user.id, user_role: 'seller',
    }, 12 * 60 * 60);
    const response = NextResponse.json({
      vendor_id: user.vendor_id,
      vendor_name: vendor.name,
      waiter_id: user.id,
      waiter_name: user.name,
      must_change_password: Boolean(user.password_needs_reset),
    });
    response.cookies.set({
      name: 'vendor_session', value: token, httpOnly: true,
      secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error('Waiter auth error:', err);
    return NextResponse.json({ error: 'Erro ao entrar no atendimento.' }, { status: 500 });
  }
}
