import { supabaseAdmin } from '@/lib/supabase-admin';
import { VERA_MENU, VERA_MENU_TEMPLATE_TAG } from '@/lib/vera-menu';

const READY_MENU_TAG = 'ready-menu';

export async function ensureVeraMenuSeeded() {
  const { data: existing, error: lookupError } = await (supabaseAdmin.from('product_images') as any)
    .select('id, tags')
    .contains('tags', [VERA_MENU_TEMPLATE_TAG]);
  if (lookupError) throw lookupError;

  const existingByCode = new Map<string, any>();
  for (const row of existing || []) {
    const code = (row.tags || []).find((tag: string) => String(tag).startsWith('menu-item:'));
    if (code) existingByCode.set(String(code).slice('menu-item:'.length), row);
  }
  const missing: typeof VERA_MENU = [];
  let updated = 0;
  for (const [index, item] of VERA_MENU.entries()) {
    const current = existingByCode.get(item.code);
    if (!current) {
      missing.push(item);
      continue;
    }
    // Refresh the photographed name, category and price while preserving each
    // admin's enabled/disabled choice, chosen image, and any extra tags.
    const currentTags: string[] = (current.tags || []).map(String);
    const tags = Array.from(new Set([
      ...currentTags.filter(tag => !tag.startsWith('menu-price:') && tag !== VERA_MENU_TEMPLATE_TAG && !tag.startsWith('menu-item:')),
      VERA_MENU_TEMPLATE_TAG,
      `menu-item:${item.code}`,
      `menu-price:${item.price.toFixed(2)}`,
    ]));
    const { error } = await (supabaseAdmin.from('product_images') as any).update({
      category: item.category,
      title: item.name,
      name: item.name,
      description: item.description,
      tags,
      sort_order: 1000 + index,
      updated_at: new Date().toISOString(),
    }).eq('id', current.id);
    if (error) throw error;
    updated += 1;
  }
  if (missing.length) {
    const payload = missing.map((item) => ({
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
      sort_order: 1000 + VERA_MENU.indexOf(item),
    }));
    const { error } = await (supabaseAdmin.from('product_images') as any).insert(payload);
    if (error) throw error;
  }
  return { inserted: missing.length, updated, total: VERA_MENU.length };
}

/** Ensures the complete standard menu exists without replacing a kiosk's products or images. */
export async function seedVeraMenuForVendor(tenantId: string, vendorId: string) {
  const { data: existing, error: lookupError } = await supabaseAdmin.from('products')
    .select('id, name, category, price, description, image_url, is_default_image').eq('vendor_id', vendorId);
  if (lookupError) throw lookupError;
  const signature = (name: unknown, category: unknown) =>
    `${String(name || '').trim().toLocaleLowerCase('pt-BR')}|${String(category || '').trim().toLocaleLowerCase('pt-BR')}`;
  const existingBySignature = new Map((existing || []).map((product: any) => [signature(product.name, product.category), product]));
  const missing = VERA_MENU.filter(item => !existingBySignature.has(signature(item.name, item.category)));
  let refreshed = 0;
  for (const item of VERA_MENU) {
    const product = existingBySignature.get(signature(item.name, item.category)) as any;
    const generatedPlaceholder = product?.is_default_image === true
      && String(product.image_url || '').startsWith('/ready-menu/vera/');
    if (!generatedPlaceholder || Number(product.price) !== 0) continue;
    const { error } = await supabaseAdmin.from('products').update({
      price: item.price,
      description: item.description || null,
      active: item.price > 0,
      updated_at: new Date().toISOString(),
    }).eq('id', product.id).eq('vendor_id', vendorId);
    if (error) throw error;
    refreshed += 1;
  }

  const legacyDefaultBeverageNames = new Set([
    'água mineral 500 ml', 'refrigerante lata', 'refrigerante 2 litros', 'suco natural',
    'água de coco', 'chá gelado', 'cerveja lata', 'cerveja long neck', 'caipirinha',
  ]);
  let deactivated = 0;
  for (const product of existing || []) {
    const legacyPlaceholder = String(product.category || '').trim().toLocaleLowerCase('pt-BR') === 'bebidas'
      && legacyDefaultBeverageNames.has(String(product.name || '').trim().toLocaleLowerCase('pt-BR'))
      && Number(product.price) === 0
      && product.is_default_image === true
      && String(product.image_url || '').startsWith('/ready-menu/vera/');
    if (!legacyPlaceholder) continue;
    const { error } = await supabaseAdmin.from('products').update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', product.id).eq('vendor_id', vendorId);
    if (error) throw error;
    deactivated += 1;
  }

  if (!missing.length) return { inserted: 0, refreshed, deactivated, skipped: false, total: VERA_MENU.length };
  const payload = missing.map((item) => ({
    tenant_id: tenantId, vendor_id: vendorId, category: item.category,
    name: item.name, description: item.description || null, price: item.price,
    image_url: null, is_default_image: false, active: item.price > 0, sort_order: VERA_MENU.indexOf(item),
    stock_tracking_enabled: false, stock_quantity: 0, physical_stock_quantity: 0, beach_stock_quantity: 0,
  }));
  const { error } = await supabaseAdmin.from('products').insert(payload as any);
  if (error) throw error;
  return { inserted: payload.length, refreshed, deactivated, skipped: false, total: VERA_MENU.length };
}
