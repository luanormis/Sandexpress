import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const session = getRequestSession(req);
    const vendorId = req.nextUrl.searchParams.get('vendor_id') || session?.vendor_id;

    if (!tenantId || !vendorId) {
      return NextResponse.json({ error: 'Tenant/vendor nao identificado.' }, { status: 400 });
    }
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('service_calls')
        .select('id, vendor_id, umbrella_id, customer_id, status, message, created_at, umbrellas(number)')
        .eq('vendor_id', vendorId)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      tenantId
    );

    if (error) {
      if (String(error.message || '').includes('service_calls')) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Service calls GET error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    if (!session || session.role !== 'customer' || !session.vendor_id || !session.customer_id) {
      return NextResponse.json({ error: 'Cliente nao autenticado.' }, { status: 401 });
    }
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 });
    }

    const body = await req.json();
    const umbrellaId = body.umbrella_id || session.umbrella_id;
    if (!umbrellaId) {
      return NextResponse.json({ error: 'Guarda-sol nao informado.' }, { status: 400 });
    }

    const payload = {
      tenant_id: tenantId,
      vendor_id: session.vendor_id,
      umbrella_id: umbrellaId,
      customer_id: session.customer_id,
      status: 'open',
      message: body.message || 'Cliente chamou o garcom',
    };

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('service_calls')
        .insert(payload)
        .select()
        .single(),
      tenantId
    );

    if (error) {
      if (String(error.message || '').includes('service_calls')) {
        return NextResponse.json({ success: true, local_only: true });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Service calls POST error:', err);
    return NextResponse.json({ error: 'Erro ao chamar garcom.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const session = getRequestSession(req);
    const body = await req.json();
    const vendorId = body.vendor_id || session?.vendor_id;
    const callId = body.id;

    if (!tenantId || !vendorId || !callId) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('service_calls')
        .update({ status: body.status || 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', callId)
        .eq('vendor_id', vendorId)
        .select()
        .single(),
      tenantId
    );

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Service calls PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
