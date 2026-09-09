import { supabaseAdmin } from '@/lib/supabase-admin';
import { VERA_MENU, VERA_MENU_TEMPLATE_TAG } from '@/lib/vera-menu';

const READY_MENU_TAG = 'ready-menu';

export async function ensureVeraMenuSeeded() {
  const { data: existing, error: lookupError } = await (supabaseAdmin.from('product_images') as any)
    .select('id, tags')
    .contains('tags', [VERA_MENU_TEMPLATE_TAG]);
  if (lookupError) throw lookupError;

  const existingCodes = new Set(
    (existing || []).flatMap((row: any) => (row.tags || []).filter((tag: string) => tag.startsWith('menu-item:'))),
  );
  const missing = VERA_MENU.filter(item => !existingCodes.has(`menu-item:${item.code}`));
  if (!missing.length) return { inserted: 0, total: VERA_MENU.length };

  const payload = missing.map((item, index) => ({
    category: item.category,
    title: item.name,
    name: item.name,
    description: item.description,
    image_url: item.image,
    plan_type: 'free',
    tags: [
      READY_MENU_TAG,
      VERA_MENU_TEMPLATE_TAG,
      `menu-item:${item.code}`,
      `menu-price:${item.price.toFixed(2)}`,
      'opcional',
      item.category.toLocaleLowerCase('pt-BR'),
    ],
    mime_type: 'image/webp',
    active: true,
    sort_order: 1000 + index,
  }));
  const { error } = await (supabaseAdmin.from('product_images') as any).insert(payload);
  if (error) throw error;
  return { inserted: missing.length, total: VERA_MENU.length };
}

/** Creates an editable standard menu copy without overwriting existing products. */
export async function seedVeraMenuForVendor(tenantId: string, vendorId: string) {
  const { count, error: countError } = await supabaseAdmin.from('products')
    .select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId);
  if (countError) throw countError;
  if ((count || 0) > 0) return { inserted: 0, skipped: true, total: VERA_MENU.length };
  const payload = VERA_MENU.map((item, index) => ({
    tenant_id: tenantId, vendor_id: vendorId, category: item.category,
    name: item.name, description: item.description || null, price: item.price,
    image_url: item.image, is_default_image: true, active: true, sort_order: index,
  }));
  const { error } = await supabaseAdmin.from('products').insert(payload as any);
  if (error) throw error;
  return { inserted: payload.length, skipped: false, total: VERA_MENU.length };
}
