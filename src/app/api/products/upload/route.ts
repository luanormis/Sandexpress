import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { validateImageUpload } from '@/lib/upload-guard';
import { catalogImageProxyUrl } from '@/lib/product-image-url';
import {
  buildSharedImagePath,
  convertProductImageToWebp,
  sanitizeImageLabel,
} from '@/lib/product-image-processing';

const CATALOG_BUCKET = 'catalogo-global';
export const runtime = 'nodejs';

/**
 * Upload autenticado do quiosque para a galeria geral.
 * Converte no servidor para WebP, remove metadados e registra no catalogo.
 */
export async function POST(req: NextRequest) {
  let uploadedPath = '';
  try {
    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const vendorId = String(formData.get('vendor_id') || '').trim();
    const category = sanitizeImageLabel(formData.get('category'), 'Geral').slice(0, 80);
    const title = sanitizeImageLabel(formData.get('title') || file?.name?.replace(/\.[^.]+$/, ''));

    if (!file || !vendorId) {
      return NextResponse.json({ error: 'Arquivo e quiosque sao obrigatorios.' }, { status: 400 });
    }
    const uploadError = validateImageUpload(file);
    if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 });
    if (!canAccessVendor(session, vendorId)) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    let converted: Buffer;
    try {
      converted = await convertProductImageToWebp(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      console.warn('Invalid product image payload:', error);
      return NextResponse.json({ error: 'O arquivo nao contem uma imagem valida.' }, { status: 400 });
    }

    uploadedPath = buildSharedImagePath(category);
    const { error: storageError } = await supabaseAdmin.storage
      .from(CATALOG_BUCKET)
      .upload(uploadedPath, converted, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });
    if (storageError) throw storageError;

    const tags = Array.from(new Set([category.toLowerCase(), title.toLowerCase()]));
    const { data: galleryImage, error: galleryError } = await (supabaseAdmin.from('product_images') as any)
      .insert({
        category,
        title,
        name: title,
        description: `Imagem compartilhada pelo quiosque ${vendorId}`,
        image_url: '',
        plan_type: 'free',
        tags,
        source_bucket: CATALOG_BUCKET,
        storage_path: uploadedPath,
        mime_type: 'image/webp',
        active: true,
      })
      .select('*')
      .single();

    if (galleryError) {
      await supabaseAdmin.storage.from(CATALOG_BUCKET).remove([uploadedPath]);
      uploadedPath = '';
      throw galleryError;
    }

    const image = { ...galleryImage, image_url: catalogImageProxyUrl(galleryImage) };
    return NextResponse.json({ success: true, url: image.image_url, image }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin.storage.from(CATALOG_BUCKET).remove([uploadedPath]).catch(() => undefined);
    }
    console.error('Shared product image upload error:', error);
    return NextResponse.json({ error: 'Nao foi possivel processar e salvar a imagem.' }, { status: 500 });
  }
}
