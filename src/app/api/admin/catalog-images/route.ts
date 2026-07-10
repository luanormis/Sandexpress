import { NextRequest, NextResponse } from 'next/server';
import { getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateImageUpload } from '@/lib/upload-guard';

const CATALOG_BUCKET = 'catalogo-global';
const MAX_CATALOG_IMAGE_BYTES = 2 * 1024 * 1024;

function requireAdmin(req: NextRequest) {
  const session = getRequestSession(req);
  return Boolean(session && session.role === 'admin');
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imagem';
}

function normalizeTags(value: FormDataEntryValue | null, category: string, name: string) {
  const raw = String(value || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([category.toLowerCase(), name.toLowerCase(), ...raw])).slice(0, 20);
}

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = String(searchParams.get('q') || '').trim().toLowerCase();
    const category = String(searchParams.get('category') || '').trim();

    let query = (supabaseAdmin.from('product_images') as any)
      .select('id, category, title, name, image_url, description, plan_type, tags, source_bucket, storage_path, mime_type, active, sort_order, created_at, updated_at')
      .order('active', { ascending: false })
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (category) query = query.eq('category', category);
    if (search) {
      query = query.or(`name.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    return NextResponse.json({ images: data || [] });
  } catch (err) {
    console.error('Admin catalog GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar catalogo global.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = String(formData.get('name') || '').trim().slice(0, 120);
    const category = String(formData.get('category') || '').trim().slice(0, 80);
    const description = String(formData.get('description') || '').trim().slice(0, 300);
    const planType = formData.get('plan_type') === 'plus' ? 'plus' : 'free';

    if (!file || !name || !category) {
      return NextResponse.json({ error: 'Imagem, nome e categoria sao obrigatorios.' }, { status: 400 });
    }
    if (file.type !== 'image/webp') {
      return NextResponse.json({ error: 'Envie imagens em WEBP. O painel do admin converte automaticamente antes do upload.' }, { status: 400 });
    }
    const uploadError = validateImageUpload(file, { maxBytes: MAX_CATALOG_IMAGE_BYTES });
    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }

    const storagePath = `${slugify(category)}/${Date.now()}-${slugify(name)}.webp`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(CATALOG_BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabaseAdmin.storage
      .from(CATALOG_BUCKET)
      .getPublicUrl(storagePath);

    const { data, error } = await (supabaseAdmin.from('product_images') as any)
      .insert({
        category,
        title: name,
        name,
        description: description || null,
        image_url: urlData.publicUrl,
        plan_type: planType,
        tags: normalizeTags(formData.get('tags'), category, name),
        source_bucket: CATALOG_BUCKET,
        storage_path: storagePath,
        mime_type: 'image/webp',
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ image: data }, { status: 201 });
  } catch (err) {
    console.error('Admin catalog POST error:', err);
    return NextResponse.json({ error: 'Erro ao salvar imagem global.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'Acesso restrito ao admin.' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id obrigatorio.' }, { status: 400 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.active === 'boolean') update.active = body.active;
    if (typeof body.name === 'string') {
      update.name = body.name.trim().slice(0, 120);
      update.title = body.name.trim().slice(0, 120);
    }
    if (typeof body.category === 'string') update.category = body.category.trim().slice(0, 80);
    if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 300) || null;
    if (typeof body.tags === 'string') update.tags = normalizeTags(body.tags, String(update.category || ''), String(update.name || ''));

    const { data, error } = await (supabaseAdmin.from('product_images') as any)
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ image: data });
  } catch (err) {
    console.error('Admin catalog PATCH error:', err);
    return NextResponse.json({ error: 'Erro ao atualizar imagem global.' }, { status: 500 });
  }
}
