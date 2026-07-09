import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { isOptionalPromotionSchemaError } from '@/lib/kiosk-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

const MAX_PROMOTION_CART_ITEMS = 50;

function normalizeCart(items: unknown) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PROMOTION_CART_ITEMS) return null;
  const merged = new Map<string, number>();

  for (const item of items) {
    if (!item || typeof item !== 'object') return null;
    const raw = item as { product_id?: unknown; quantity?: unknown };
    const productId = String(raw.product_id || '').trim();
    const quantity = Number(raw.quantity);
    if (!isCanonicalUuid(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  return Array.from(merged.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendorId = String(body.vendor_id || '');
    const cart = normalizeCart(body.items);

    if (!isCanonicalUuid(vendorId) || !cart) {
      return NextResponse.json({ error: 'vendor_id e items validos sao obrigatorios.' }, { status: 400 });
    }

    const session = getRequestSession(req);
    if (!session) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    const customerCanAccess = session.role === 'customer' && session.vendor_id === vendorId;
    if (!canAccessVendor(session, vendorId) && !customerCanAccess) {
      return NextResponse.json({ error: 'Nao autorizado para este quiosque.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.rpc('calcular_promocoes_carrinho', {
      p_vendor_id: vendorId,
      p_cart: cart,
      p_momento: new Date().toISOString(),
    });

    if (error) {
      if (isOptionalPromotionSchemaError(error)) {
        return NextResponse.json({
          subtotal: null,
          discount_total: 0,
          total: null,
          applied_promotions: [],
          unavailable: true,
        });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Promotion calculation error:', err);
    return NextResponse.json({ error: 'Erro ao calcular promocoes.' }, { status: 500 });
  }
}
