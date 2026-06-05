import { supabaseAdmin } from './supabase-admin';

export async function reduceProductStock(productId: string, quantity: number) {
  try {
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !product || product.stock_quantity === null) return;

    const newStock = Number(product.stock_quantity) - quantity;
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
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
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !product || product.stock_quantity === null) return;

    const newStock = Number(product.stock_quantity) + quantity;
    const { error } = await supabaseAdmin
      .from('products')
      .update({
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
