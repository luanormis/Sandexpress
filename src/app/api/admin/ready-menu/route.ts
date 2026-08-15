import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { configureReadyMenuTags, parseReadyMenuPrice } from '@/lib/ready-menu';
import { getTenantFeatureMap, getVendorTenantId } from '@/lib/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

function requireAdmin(req: NextRequest) {
  return getRequestSession(req)?.role === 'admin';
}

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    const { data, error } = await (supabaseAdmin.from('product_images') as any)
      .select('id, name, category, description, image_url, tags, active, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    const items = (data || []).map((image: any) => ({ ...image, price: parseReadyMenuPrice(image.tags) })).filter((image: any) => image.price !== null);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Ready menu GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar cardápio pronto.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const imageId = String(body.image_id || '');
    if (!isCanonicalUuid(imageId) || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Imagem e status são obrigatórios.' }, { status: 400 });
    }
    const { data: image, error: imageError } = await (supabaseAdmin.from('product_images') as any)
      .select('id, tags').eq('id', imageId).single();
    if (imageError || !image) return NextResponse.json({ error: 'Imagem não encontrada.' }, { status: 404 });
    let tags: string[];
    try {
      tags = configureReadyMenuTags(image.tags, body.enabled, Number(body.price));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Preço inválido.' }, { status: 400 });
    }
    const { data, error } = await (supabaseAdmin.from('product_images') as any)
      .update({ tags, updated_at: new Date().toISOString() }).eq('id', imageId)
      .select('id, name, category, description, image_url, tags, active, sort_order').single();
    if (error) throw error;
    return NextResponse.json({ item: { ...data, price: parseReadyMenuPrice(data.tags) } });
  } catch (error) {
    console.error('Ready menu PATCH error:', error);
    return NextResponse.json({ error: 'Erro ao configurar item do cardápio pronto.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    if (!isCanonicalUuid(vendorId)) return NextResponse.json({ error: 'Quiosque inválido.' }, { status: 400 });
    const tenantId = await getVendorTenantId(vendorId);
    if (!tenantId) return NextResponse.json({ error: 'Quiosque não encontrado.' }, { status: 404 });
    const features = await getTenantFeatureMap(tenantId);
    if (!features.ready_menu) return NextResponse.json({ error: 'Libere o cardápio pronto para este quiosque primeiro.' }, { status: 409 });

    const { data: images, error: imagesError } = await (supabaseAdmin.from('product_images') as any)
      .select('id, name, category, description, image_url, tags, active, sort_order').eq('active', true);
    if (imagesError) throw imagesError;
    const readyItems = (images || []).map((image: any) => ({ ...image, price: parseReadyMenuPrice(image.tags) })).filter((image: any) => image.price !== null);
    if (!readyItems.length) return NextResponse.json({ error: 'Cadastre ao menos uma imagem com preço no cardápio pronto.' }, { status: 409 });

    const { data: existing, error: existingError } = await supabaseAdmin.from('products')
      .select('id, image_url').eq('vendor_id', vendorId);
    if (existingError) throw existingError;
    const existingByImage = new Map((existing || []).map((product: any) => [String(product.image_url || ''), product.id]));
    let inserted = 0;
    let updated = 0;
    for (const [index, item] of readyItems.entries()) {
      const payload = {
        tenant_id: tenantId,
        vendor_id: vendorId,
        name: String(item.name || item.category || 'Produto').slice(0, 160),
        category: String(item.category || 'Geral').slice(0, 80),
        description: item.description ? String(item.description).slice(0, 500) : null,
        price: item.price,
        image_url: item.image_url,
        is_default_image: true,
        active: true,
        sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
      };
      const productId = existingByImage.get(String(item.image_url || ''));
      if (productId) {
        const { error } = await supabaseAdmin.from('products').update(payload as any).eq('id', productId).eq('vendor_id', vendorId);
        if (error) throw error;
        updated += 1;
      } else {
        const { error } = await supabaseAdmin.from('products').insert(payload as any);
        if (error) throw error;
        inserted += 1;
      }
    }
    return NextResponse.json({ applied: readyItems.length, inserted, updated });
  } catch (error) {
    console.error('Ready menu POST error:', error);
    return NextResponse.json({ error: 'Erro ao aplicar cardápio pronto.' }, { status: 500 });
  }
}
