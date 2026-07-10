import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { validateImageUpload } from '@/lib/upload-guard';

const LOGO_MAX_BYTES = 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getRequestSession(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas o admin geral pode alterar a logo do quiosque.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatorio.' }, { status: 400 });
    }

    const uploadError = validateImageUpload(file, { maxBytes: LOGO_MAX_BYTES });
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

    const ext = EXT_BY_MIME[file.type] || 'png';
    const fileName = `logos/${id}/logo-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('kiosk-assets')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabaseAdmin.storage
      .from('kiosk-assets')
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

    const { data: previousFiles } = await supabaseAdmin.storage
      .from('kiosk-assets')
      .list(`logos/${id}`, { limit: 100 });
    const staleFiles = (previousFiles || [])
      .map((item: any) => `logos/${id}/${item.name}`)
      .filter((path: string) => path !== fileName);
    if (staleFiles.length > 0) {
      await supabaseAdmin.storage.from('kiosk-assets').remove(staleFiles);
    }

    return NextResponse.json({
      tenant_id: vendor.tenant_id,
      logo_url: urlData.publicUrl,
    });
  } catch (err) {
    console.error('Vendor logo upload error:', err);
    return NextResponse.json({ error: 'Erro no upload da logo.' }, { status: 500 });
  }
}
