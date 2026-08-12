import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyVendorPassword } from '@/lib/vendor-password';

const COOKIE = 'owner_sales_session';

function setCookie(response: NextResponse, token: string) {
  response.cookies.set({ name: COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const login = String(body.login || '').trim();
    const password = String(body.password || '');
    if (!login || !password) return NextResponse.json({ error: 'Informe login e senha.' }, { status: 400 });

    const { data: vendor, error } = await supabaseAdmin.from('vendors').select('id, tenant_id, name, owner_name, password_hash, is_active, subscription_status').eq('document_login', login).maybeSingle() as { data: any; error: any };
    if (error) throw error;
    let selected = vendor;
    let passwordHash = vendor?.password_hash;

    if (!selected) {
      const { data: user, error: userError } = await supabaseAdmin.from('vendor_users').select('vendor_id, tenant_id, name, role, password_hash, active, vendors(id, name, owner_name, is_active, subscription_status)').eq('login', login).eq('role', 'owner').eq('active', true).maybeSingle() as { data: any; error: any };
      if (userError) throw userError;
      const linked = Array.isArray(user?.vendors) ? user.vendors[0] : user?.vendors;
      if (user && linked) {
        selected = { ...linked, id: user.vendor_id, tenant_id: user.tenant_id, owner_name: user.name };
        passwordHash = user.password_hash;
      }
    }

    if (!selected || !passwordHash || !(await verifyVendorPassword(password, passwordHash))) {
      return NextResponse.json({ error: 'Credenciais inválidas ou sem permissão de proprietário.' }, { status: 401 });
    }
    if (!selected.is_active || selected.subscription_status === 'blocked') {
      return NextResponse.json({ error: 'Quiosque bloqueado. Contate o administrador.' }, { status: 403 });
    }

    const token = createSessionToken({ role: 'owner_sales', vendor_id: selected.id, tenant_id: selected.tenant_id }, 12 * 60 * 60);
    const response = NextResponse.json({ vendor_id: selected.id, vendor_name: selected.name, owner_name: selected.owner_name });
    setCookie(response, token);
    return response;
  } catch (error) {
    console.error('Owner sales login error:', error);
    return NextResponse.json({ error: 'Não foi possível entrar agora.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ signed_out: true });
  response.cookies.set({ name: COOKIE, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
