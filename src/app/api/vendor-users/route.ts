import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/vendor-password';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendor_id');
    if (!vendorId) return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('vendor_users')
      .select('id, name, email, login, role, active, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const { data: commissionEvents } = await supabaseAdmin
      .from('analytics_events')
      .select('metadata, created_at')
      .eq('vendor_id', vendorId)
      .eq('event_type', 'staff_commission_config')
      .order('created_at', { ascending: false });
    const commissionByUser = new Map<string, any>();
    (commissionEvents || []).forEach((event: any) => {
      const userId = String(event.metadata?.user_id || '');
      if (userId && !commissionByUser.has(userId)) commissionByUser.set(userId, event.metadata);
    });
    return NextResponse.json((data || []).map((user: any) => ({
      ...user,
      commission_type: commissionByUser.get(user.id)?.commission_type || 'none',
      commission_value: Number(commissionByUser.get(user.id)?.commission_value || 0),
    })));
  } catch (err) {
    console.error('Vendor users GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendor_id, name, email, login, role, password, password_confirm } = body;
    if (!vendor_id || !name || !login || !password || !password_confirm) {
      return NextResponse.json({ error: 'vendor_id, nome, login, senha e confirmação são obrigatórios.' }, { status: 400 });
    }
    if (password !== password_confirm) {
      return NextResponse.json({ error: 'A senha e a confirmacao nao conferem.' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('tenant_id')
      .eq('id', vendor_id)
      .single();
    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);
    const { data, error } = await (supabaseAdmin.from('vendor_users') as any)
      .insert({
        tenant_id: vendor.tenant_id,
        vendor_id,
        name,
        email: email ? String(email).trim().toLowerCase() : null,
        login: String(login).trim(),
        role: ['owner', 'manager', 'seller'].includes(role) ? role : 'seller',
        password_hash: passwordHash,
        password_needs_reset: false,
        active: true,
      })
      .select('id, name, email, login, role, active, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este login de usuário já existe.' }, { status: 409 });
      }
      throw error;
    }

    const commissionType = ['percent', 'fixed'].includes(body.commission_type) ? body.commission_type : 'none';
    const commissionValue = Math.max(0, Number(body.commission_value || 0));
    if (commissionType !== 'none') {
      await supabaseAdmin.from('analytics_events').insert({
        tenant_id: vendor.tenant_id,
        vendor_id,
        event_type: 'staff_commission_config',
        metadata: { user_id: data.id, commission_type: commissionType, commission_value: commissionValue },
        payload: { staff_name: data.name, role: data.role },
      } as any);
    }

    return NextResponse.json({ ...data, commission_type: commissionType, commission_value: commissionValue }, { status: 201 });
  } catch (err) {
    console.error('Vendor users POST error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
