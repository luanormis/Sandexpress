import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Reduz estoque ao criar order_item.
 * Se chegar a 0, bloqueia automaticamente.
 */
export async function reduceProductStock(productId: string, quantity: number) {
  try {
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      console.error('Product not found:', productId);
      return;
    }

    const newStock = (product.stock_quantity || 0) - quantity;

    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        stock_quantity: newStock,
        blocked_by_stock: newStock <= 0,
      })
      .eq('id', productId);

    if (updateError) {
      console.error('Stock update error:', updateError);
    }

    if (newStock <= 0) {
      console.log(`[STOCK ALERT] Produto ${productId} sem estoque!`);
    }
  } catch (err) {
    console.error('reduceProductStock error:', err);
  }
}

/**
 * Restaura estoque ao cancelar pedido
 */
export async function restoreProductStock(productId: string, quantity: number) {
  try {
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    const newStock = (product?.stock_quantity || 0) + quantity;

    const { error } = await supabaseAdmin
      .from('products')
      .update({
        stock_quantity: newStock,
        blocked_by_stock: false,
      })
      .eq('id', productId);

    if (error) console.error('Stock restore error:', error);
  } catch (err) {
    console.error('restoreProductStock error:', err);
  }
}
