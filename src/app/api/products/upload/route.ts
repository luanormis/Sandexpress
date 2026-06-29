import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { validateImageUpload } from '@/lib/upload-guard';

/**
 * POST /api/products/upload
 * Upload de foto de produto para Supabase Storage.
 * Aceita FormData com campo 'file' e 'vendor_id'.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const vendor_id = formData.get('vendor_id') as string | null;

    if (!file || !vendor_id) {
      return NextResponse.json({ error: 'file e vendor_id obrigatórios.' }, { status: 400 });
    }
    const uploadError = validateImageUpload(file);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }
    if (!canAccessVendor(session, vendor_id)) {
      return NextResponse.json({ error: 'Não autorizado para este vendor.' }, { status: 403 });
    }

    // Gerar nome único para o arquivo
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${vendor_id}/${Date.now()}.${ext}`;

    // Converter File para Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload para Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // Gerar URL pública
    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Erro no upload.' }, { status: 500 });
  }
}
