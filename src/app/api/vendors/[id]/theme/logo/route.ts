import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { validateImageUpload } from '@/lib/upload-guard';
import { catalogImageProxyUrl } from '@/lib/product-image-url';

const LOGO_MAX_BYTES = 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function canManageLogo(session: ReturnType<typeof getRequestSession>, vendorId: string) {
  return session?.role === 'admin'
    || (session?.role === 'vendor' && session.user_role === 'owner' && session.vendor_id === vendorId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!canManageLogo(getRequestSession(req), id)) {
      return NextResponse.json({ error: 'Apenas o proprietario pode acessar as logos do quiosque.' }, { status: 403 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin.from('vendors').select('name').eq('id', id).single();
    if (vendorError || !vendor) return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    if (!/vera/i.test(vendor.name || '')) {
      return NextResponse.json({ images: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const { data, error } = await (supabaseAdmin.from('product_images') as any)
      .select('id, name, title, category, image_url, storage_path, active')
      .eq('active', true)
      .or('name.ilike.%vera%,title.ilike.%vera%')
      .order('name')
      .limit(20);
    if (error) throw error;

    const { data: globalFiles } = await supabaseAdmin.storage.from('catalogo-global').list('global', { limit: 100 });
    const storedVeraLogos = (globalFiles || [])
      .filter((file: any) => /vera/i.test(file.name) && /\.(png|jpe?g|webp)$/i.test(file.name))
      .map((file: any) => {
        const storagePath = `global/${file.name}`;
        return {
          id: `storage:${storagePath}`,
          storage_path: storagePath,
          name: file.name,
          image_url: `/api/products/gallery-image?path=${encodeURIComponent(storagePath)}`,
        };
      });
    const catalogLogos = (data || []).map((image: any) => ({
      id: image.id,
      storage_path: image.storage_path || undefined,
      name: image.name || image.title || 'Logo',
      image_url: catalogImageProxyUrl(image),
    }));
    const uniqueLogos = [...catalogLogos, ...storedVeraLogos].filter((image, index, all) =>
      all.findIndex(candidate => candidate.id === image.id || candidate.image_url === image.image_url) === index
    );
    uniqueLogos.unshift({
      id: 'bundled:vera-quiosque',
      name: 'Logo Quiosque da Vera',
      image_url: '/logos/vera-quiosque.webp',
    });

    return NextResponse.json({
      images: uniqueLogos,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Vendor logo gallery error:', error);
    return NextResponse.json({ error: 'Nao foi possivel carregar a logo global.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getRequestSession(req);
    if (!canManageLogo(session, id)) {
      return NextResponse.json({ error: 'Apenas o proprietario pode alterar a logo do quiosque.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const imageId = String(formData.get('image_id') || '').trim();
    const storagePath = String(formData.get('storage_path') || '').trim();
    if (!file && !imageId && !storagePath) return NextResponse.json({ error: 'Escolha uma imagem global ou envie uma logo.' }, { status: 400 });

    if (file) {
      const uploadError = validateImageUpload(file, { maxBytes: LOGO_MAX_BYTES });
      if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id, name')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    let fileName = '';
    let logoUrl = '';
    if (file) {
      const ext = EXT_BY_MIME[file.type] || 'png';
      fileName = `logos/${id}/logo-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('kiosk-assets')
        .upload(fileName, buffer, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabaseAdmin.storage.from('kiosk-assets').getPublicUrl(fileName);
      logoUrl = urlData.publicUrl;
    } else if (imageId === 'bundled:vera-quiosque') {
      if (!/vera/i.test(vendor.name || '')) {
        return NextResponse.json({ error: 'Esta logo esta reservada ao Quiosque da Vera.' }, { status: 403 });
      }
      logoUrl = '/logos/vera-quiosque.webp';
    } else if (imageId) {
      const { data: image, error: imageError } = await (supabaseAdmin.from('product_images') as any)
        .select('id, image_url, storage_path, active')
        .eq('id', imageId)
        .eq('active', true)
        .single();
      if (imageError || !image) return NextResponse.json({ error: 'A logo escolhida nao esta mais disponivel no catalogo global.' }, { status: 404 });
      logoUrl = catalogImageProxyUrl(image);
    } else {
      if (!storagePath.startsWith('global/') || storagePath.includes('..') || storagePath.includes('\\') || storagePath.startsWith('/')) {
        return NextResponse.json({ error: 'A imagem escolhida nao pertence a pasta global.' }, { status: 400 });
      }
      const { data: imageFile, error: imageError } = await supabaseAdmin.storage.from('catalogo-global').download(storagePath);
      if (imageError || !imageFile || !['image/png', 'image/jpeg', 'image/webp'].includes(imageFile.type)) {
        return NextResponse.json({ error: 'A logo Vera nao foi encontrada na pasta global.' }, { status: 404 });
      }
      logoUrl = `/api/products/gallery-image?path=${encodeURIComponent(storagePath)}`;
    }

    const themeUpdate = {
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    };

    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update(themeUpdate)
      .eq('id', id);

    if (vendorUpdateError) throw vendorUpdateError;

    const { error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .update({ logo_url: logoUrl })
      .eq('id', vendor.tenant_id);

    if (tenantError) throw tenantError;

    const { data: previousFiles } = await supabaseAdmin.storage.from('kiosk-assets').list(`logos/${id}`, { limit: 100 });
    const staleFiles = (previousFiles || []).map((item: any) => `logos/${id}/${item.name}`).filter((path: string) => path !== fileName);
    if (staleFiles.length > 0) {
      await supabaseAdmin.storage.from('kiosk-assets').remove(staleFiles);
    }

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      logo_url: logoUrl,
      primary_color: '#fff8e8',
    });
  } catch (err) {
    console.error('Vendor logo upload error:', err);
    return NextResponse.json({ error: 'Erro no upload da logo.' }, { status: 500 });
  }
}
