import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'categoria';
}

function optionalSchemaError(error: any) {
  return ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error?.code || '');
}

export async function GET(req: NextRequest) {
  try {
    const vendorId = req.nextUrl.searchParams.get('vendor_id');
    if (!vendorId) return NextResponse.json({ error: 'vendor_id obrigatorio.' }, { status: 400 });

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data, error } = await (supabaseAdmin.from('product_categories') as any)
      .select('id, tenant_id, vendor_id, parent_id, name, slug, sort_order, active, created_at, updated_at')
      .eq('vendor_id', vendorId)
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      if (optionalSchemaError(error)) return NextResponse.json([]);
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Product categories GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar categorias.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendorId = String(body.vendor_id || '').trim();
    const name = String(body.name || '').trim().slice(0, 80);
    const parentId = body.parent_id ? String(body.parent_id).trim() : null;

    if (!vendorId || !name) {
      return NextResponse.json({ error: 'vendor_id e name sao obrigatorios.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data: vendor, error: vendorError } = await (supabaseAdmin.from('vendors') as any)
      .select('tenant_id')
      .eq('id', vendorId)
      .single();
    if (vendorError || !vendor?.tenant_id) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const payload = {
      tenant_id: vendor.tenant_id,
      vendor_id: vendorId,
      parent_id: parentId,
      name,
      slug: slugify(name),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      active: body.active !== false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabaseAdmin.from('product_categories') as any)
      .upsert(payload, { onConflict: 'vendor_id,parent_id,slug' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Product categories POST error:', err);
    return NextResponse.json({ error: 'Erro ao salvar categoria.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get('id') || '').trim();
    const vendorId = String(req.nextUrl.searchParams.get('vendor_id') || '').trim();

    if (!id || !vendorId) {
      return NextResponse.json({ error: 'id e vendor_id sao obrigatorios.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data: category, error: categoryError } = await (supabaseAdmin.from('product_categories') as any)
      .select('id, vendor_id')
      .eq('id', id)
      .eq('vendor_id', vendorId)
      .single();

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Categoria nao encontrada.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: childrenError } = await (supabaseAdmin.from('product_categories') as any)
      .update({ active: false, updated_at: now })
      .eq('vendor_id', vendorId)
      .eq('parent_id', id);
    if (childrenError) throw childrenError;

    const { error } = await (supabaseAdmin.from('product_categories') as any)
      .update({ active: false, updated_at: now })
      .eq('id', id)
      .eq('vendor_id', vendorId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Product categories DELETE error:', err);
    return NextResponse.json({ error: 'Erro ao excluir categoria.' }, { status: 500 });
  }
}
