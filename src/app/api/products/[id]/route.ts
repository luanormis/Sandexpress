import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { enforceTenantScope, getTenantIdFromRequest } from '@/lib/tenant-utils';

/**
 * PATCH /api/products/[id]
 * Atualiza um produto existente.
 *
 * DELETE /api/products/[id]
 * Remove um produto.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const session = await getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const productLookup = await enforceTenantScope(
      supabaseAdmin
        .from('products')
        .select('vendor_id')
        .eq('id', id),
      tenantId
    ).single();
    if (productLookup.error || !productLookup.data) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }
    if (session.role === 'vendor' && session.vendor_id !== productLookup.data.vendor_id) {
      return NextResponse.json({ error: 'Acesso negado para este produto.' }, { status: 403 });
    }

    const { data, error } = await enforceTenantScope(
      supabaseAdmin
        .from('products')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(),
      tenantId
    ).single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Product PATCH error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado.' }, { status: 400 });
    }

    const session = await getRequestSession(req);
    if (!session || (session.role !== 'vendor' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { id } = await params;

    const productLookup = await enforceTenantScope(
      supabaseAdmin
        .from('products')
        .select('vendor_id')
        .eq('id', id),
      tenantId
    ).single();
    if (productLookup.error || !productLookup.data) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }
    if (session.role === 'vendor' && session.vendor_id !== productLookup.data.vendor_id) {
      return NextResponse.json({ error: 'Acesso negado para este produto.' }, { status: 403 });
    }

    const { error } = await enforceTenantScope(
      supabaseAdmin
        .from('products')
        .delete()
        .eq('id', id),
      tenantId
    );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Product DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
