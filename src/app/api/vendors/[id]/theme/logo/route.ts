import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { validateImageUpload } from '@/lib/upload-guard';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getRequestSession(req);
    if (!canAccessVendor(session, id)) {
      return NextResponse.json({ error: 'Acesso restrito ao quiosque.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatorio.' }, { status: 400 });
    }

    const uploadError = validateImageUpload(file);
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Quiosque nao encontrado.' }, { status: 404 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${id}/logo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabaseAdmin.storage
      .from('product-images')
      .getPublicUrl(fileName);

    const themeUpdate = {
      logo_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    };

    const { error: vendorUpdateError } = await supabaseAdmin
      .from('vendors')
      .update(themeUpdate)
      .eq('id', id);

    if (vendorUpdateError) throw vendorUpdateError;

    const { error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .update({ logo_url: urlData.publicUrl })
      .eq('id', vendor.tenant_id);

    if (tenantError) throw tenantError;

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      logo_url: urlData.publicUrl,
    });
  } catch (err) {
    console.error('Vendor logo upload error:', err);
    return NextResponse.json({ error: 'Erro no upload da logo.' }, { status: 500 });
  }
}
