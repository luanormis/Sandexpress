import { supabaseAdmin } from './supabase-admin';
import { closeBeachStockToPhysical } from './inventory';

export async function reduceProductStock(productId: string, quantity: number) {
  try {
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('stock_tracking_enabled, stock_quantity, beach_stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !product?.stock_tracking_enabled) return;

    const currentBeachStock = Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0);
    const newStock = Math.max(currentBeachStock - quantity, 0);
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        beach_stock_quantity: newStock,
        stock_quantity: newStock,
        blocked_by_stock: newStock <= 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError) console.error('Stock update error:', updateError);
  } catch (err) {
    console.error('reduceProductStock error:', err);
  }
}

export async function restoreProductStock(productId: string, quantity: number) {
  try {
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('stock_tracking_enabled, stock_quantity, beach_stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !product?.stock_tracking_enabled) return;

    const newStock = Number(product.beach_stock_quantity ?? product.stock_quantity ?? 0) + quantity;
    const { error } = await supabaseAdmin
      .from('products')
      .update({
        beach_stock_quantity: newStock,
        stock_quantity: newStock,
        blocked_by_stock: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (error) console.error('Stock restore error:', error);
  } catch (err) {
    console.error('restoreProductStock error:', err);
  }
}

export async function returnBeachStockToPhysical(vendorId: string) {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, physical_stock_quantity, beach_stock_quantity')
    .eq('vendor_id', vendorId)
    .eq('stock_tracking_enabled', true);

  if (error) throw error;

  const results = [];
  for (const product of products || []) {
    const next = closeBeachStockToPhysical({
      physicalStock: (product as any).physical_stock_quantity,
      beachStock: (product as any).beach_stock_quantity,
    });

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        physical_stock_quantity: next.physicalStock,
        beach_stock_quantity: next.beachStock,
        stock_quantity: next.beachStock,
        blocked_by_stock: next.blockedByStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (product as any).id);

    results.push({ product_id: (product as any).id, success: !updateError, error: updateError?.message });
  }

  return results;
}
