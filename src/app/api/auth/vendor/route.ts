import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyVendorPassword } from '@/lib/vendor-password';

function setVendorCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: 'vendor_session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
}

/**
 * POST /api/auth/vendor
 * Login do proprietario do quiosque ou de usuarios da equipe.
 */
export async function POST(req: NextRequest) {
  try {
    const { document_login, password } = await req.json();
    if (!document_login || !password) {
      return NextResponse.json({ error: 'CPF/CNPJ/login e senha sao obrigatorios.' }, { status: 400 });
    }

    const login = String(document_login).trim();
    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('document_login', login)
      .maybeSingle() as { data: any; error: any };

    if (error) throw error;

    if (vendor?.password_hash) {
      const passwordMatches = await verifyVendorPassword(password, vendor.password_hash);
      if (!passwordMatches) {
        return NextResponse.json({ error: 'Credenciais invalidas.' }, { status: 401 });
      }
      if (!vendor.is_active || vendor.subscription_status === 'blocked') {
        return NextResponse.json({ error: 'Quiosque bloqueado. Entre em contato com o suporte.' }, { status: 403 });
      }

      const token = createSessionToken(
        { role: 'vendor', vendor_id: vendor.id, tenant_id: vendor.tenant_id },
        12 * 60 * 60
      );
      const response = NextResponse.json({
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        owner_name: vendor.owner_name,
        must_change_password: vendor.password_needs_reset ?? false,
      });
      setVendorCookie(response, token);
      return response;
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('vendor_users')
      .select('*, vendors(id, name, subscription_status, is_active)')
      .eq('login', login)
      .eq('active', true)
      .maybeSingle() as { data: any; error: any };

    if (userError) throw userError;
    if (!user?.password_hash) {
      return NextResponse.json({ error: 'Credenciais invalidas.' }, { status: 401 });
    }

    const passwordMatches = await verifyVendorPassword(password, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Credenciais invalidas.' }, { status: 401 });
    }

    const linkedVendor = Array.isArray(user.vendors) ? user.vendors[0] : user.vendors;
    if (!linkedVendor?.is_active || linkedVendor.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque bloqueado. Entre em contato com o suporte.' }, { status: 403 });
    }

    const token = createSessionToken(
      { role: 'vendor', vendor_id: user.vendor_id, tenant_id: user.tenant_id, user_id: user.id, user_role: user.role },
      12 * 60 * 60
    );
    const response = NextResponse.json({
      vendor_id: user.vendor_id,
      vendor_name: linkedVendor.name,
      owner_name: user.name,
      user_role: user.role,
      user_id: user.id,
      user_name: user.name,
      must_change_password: user.password_needs_reset ?? false,
    });
    setVendorCookie(response, token);
    return response;
  } catch (err) {
    console.error('Vendor auth error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
