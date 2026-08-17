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
