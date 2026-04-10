# Webhook para Bloquear Automaticamente por Falta de Estoque

Quando o estoque de um produto chega a 0, bloqueia automaticamente.

## Implementação: `/src/lib/stock-handler.ts`

```typescript
import { supabaseAdmin } from "./supabase-admin";

/**
 * Reduz estoque ao criar order_item
 * Se chegar a 0, bloqueia automaticamente
 */
export async function reduceProductStock(
  productId: string,
  quantity: number
) {
  try {
    // Pegar estoque atual
    const { data: product, error: fetchError } = await supabaseAdmin
      .from("products")
      .select("stock_quantity")
      .eq("id", productId)
      .single();

    if (fetchError || !product) {
      console.error("Product not found:", productId);
      return;
    }

    const newStock = (product.stock_quantity || 0) - quantity;

    // Atualizar estoque e bloquear se necessário
    const { error: updateError } = await supabaseAdmin
      .from("products")
      .update({
        stock_quantity: newStock,
        blocked_by_stock: newStock <= 0,
      })
      .eq("id", productId);

    if (updateError) {
      console.error("Stock update error:", updateError);
    }

    // Log automático
    if (newStock <= 0) {
      console.log(`[STOCK ALERT] Produto ${productId} sem estoque!`);
    }
  } catch (err) {
    console.error("reduceProductStock error:", err);
  }
}

/**
 * Restaura estoque ao cancelar pedido
 */
export async function restoreProductStock(
  productId: string,
  quantity: number
) {
  try {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("stock_quantity")
      .eq("id", productId)
      .single();

    const newStock = (product?.stock_quantity || 0) + quantity;

    const { error } = await supabaseAdmin
      .from("products")
      .update({
        stock_quantity: newStock,
        blocked_by_stock: false, // Desbloqueia
      })
      .eq("id", productId);

    if (error) console.error("Stock restore error:", error);
  } catch (err) {
    console.error("restoreProductStock error:", err);
  }
}
```

## Uso: `/src/app/api/orders/route.ts`

```typescript
import { reduceProductStock } from "@/lib/stock-handler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items } = body; // array de { product_id, quantity }

    // Reduzir estoque para cada item
    for (const item of items) {
      await reduceProductStock(item.product_id, item.quantity);
    }

    // Criar ordem...
    // ...

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Order error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

## Comportamento:

| Estoque | Status | Cliente vê? |
|---------|--------|-----------|
| > 0 | `active=true`, `blocked_by_stock=false` | ✅ Sim |
| = 0 | `active=true`, `blocked_by_stock=true` | ❌ Não |
| < 0 | `active=false`, `blocked_by_stock=true` | ❌ Não |

## Query do Cliente (Filtro de Estoque)

```typescript
// Cardápio do cliente só mostra ativos E sem bloqueio
const { data: products } = await supabase
  .from("products")
  .select("*")
  .eq("vendor_id", vendorId)
  .eq("active", true)
  .eq("blocked_by_stock", false)
  .order("sort_order");
```

## Notificação (Opcional)

Quando estoque chega a 0:

```typescript
// Enviar alerta para vendor
console.log(`[ALERT] Produto fora de estoque: ${product.name}`);

// Em produção, enviar email/SMS:
// await sendAlert(vendor.owner_email, product.name);
```
