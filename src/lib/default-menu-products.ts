import { DEFAULT_PRODUCT_IMAGES } from '@/lib/default-product-images';
import { isMissingProductStockColumnError, removeProductStockFields } from '@/lib/product-stock';

type DefaultMenuProduct = {
  name: string;
  category: string;
  description: string;
  price: number;
  imageKey: string;
  sort_order: number;
};

const DEFAULT_MENU: DefaultMenuProduct[] = [
  { name: 'Heineken 350 ml', category: 'Alcoolicos', description: 'Cerveja gelada pronta para servir.', price: 12, imageKey: 'default-beer-can', sort_order: 10 },
  { name: 'Cerveja long neck', category: 'Alcoolicos', description: 'Long neck gelada.', price: 14, imageKey: 'default-beer-long-neck', sort_order: 11 },
  { name: 'Caipirinha', category: 'Alcoolicos', description: 'Drink classico com limao e gelo.', price: 24, imageKey: 'default-tropical-drink', sort_order: 20 },
  { name: 'Refrigerante lata', category: 'Bebidas', description: 'Refrigerante gelado.', price: 8, imageKey: 'default-soda', sort_order: 30 },
  { name: 'Suco natural', category: 'Nao Alcoolicos', description: 'Suco natural de frutas.', price: 12, imageKey: 'default-juice', sort_order: 40 },
  { name: 'Batata frita', category: 'Petiscos', description: 'Porcao crocante para compartilhar.', price: 32, imageKey: 'default-fries', sort_order: 50 },
  { name: 'Porcao de camarao', category: 'Petiscos', description: 'Porcao de camarao para praia.', price: 58, imageKey: 'default-shrimp', sort_order: 60 },
  { name: 'Hamburguer artesanal', category: 'Comidas', description: 'Hamburguer completo.', price: 34, imageKey: 'default-burger', sort_order: 70 },
];

function imageUrlFor(key: string) {
  return DEFAULT_PRODUCT_IMAGES.find((image) => image.id === key)?.image_url || null;
}

function buildCompatibleDefaultMenuRows(tenantId: string, vendorId: string) {
  return DEFAULT_MENU.map((item) => ({
    tenant_id: tenantId,
    vendor_id: vendorId,
    name: item.name,
    category: item.category,
    description: item.description,
    price: item.price,
    image_url: imageUrlFor(item.imageKey),
    active: true,
  }));
}

export function buildDefaultMenuRows(tenantId: string, vendorId: string) {
  return DEFAULT_MENU.map((item) => ({
    tenant_id: tenantId,
    vendor_id: vendorId,
    name: item.name,
    category: item.category,
    description: item.description,
    price: item.price,
    promotional_price: null,
    image_url: imageUrlFor(item.imageKey),
    is_default_image: true,
    active: true,
    is_combo: false,
    sort_order: item.sort_order,
    stock_tracking_enabled: false,
    stock_quantity: null,
    physical_stock_quantity: 0,
    beach_stock_quantity: 0,
    blocked_by_stock: false,
  }));
}

export async function seedDefaultMenuForVendor(tenantId: string, vendorId: string) {
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { count, error: countError } = await supabaseAdmin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  if (countError) throw countError;
  if (Number(count || 0) > 0) return { inserted: 0 };

  const rows = buildDefaultMenuRows(tenantId, vendorId);
  let { error } = await supabaseAdmin.from('products').insert(rows as any);
  if (error && ['42703', 'PGRST204'].includes(error.code || '')) {
    console.warn('Default menu seed retrying with compatible product fields because the database schema is older:', error.message);
    const retryRows = isMissingProductStockColumnError(error)
      ? rows.map((row) => removeProductStockFields(row))
      : buildCompatibleDefaultMenuRows(tenantId, vendorId);
    const retry = await supabaseAdmin.from('products').insert(retryRows as any);
    error = retry.error;
  }
  if (error) throw error;
  return { inserted: rows.length };
}
