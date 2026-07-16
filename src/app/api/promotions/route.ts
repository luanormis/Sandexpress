import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';

type PromotionItemInput = { product_id?: unknown; quantity?: unknown; group?: unknown };

function normalizeItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const merged = new Map<string, { product_id: string; quantidade: number; grupo: string }>();
  for (const raw of value as PromotionItemInput[]) {
    const productId = String(raw?.product_id || '');
    const quantity = Math.max(1, Math.min(50, Number(raw?.quantity || 1)));
    const group = String(raw?.group || 'principal').slice(0, 30);
    if (!isCanonicalUuid(productId) || !Number.isInteger(quantity)) return null;
    merged.set(`${productId}:${group}`, { product_id: productId, quantidade: quantity, grupo: group });
  }
  return [...merged.values()];
}


function saoPauloSchedule(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayName = parts.find(part => part.type === 'weekday')?.value || 'Sun';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return { weekday: weekdays[weekdayName] ?? 0, minutes: hour * 60 + minute };
}

function timeToMinutes(value: unknown) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function promotionIsActiveNow(promotion: any, now: Date) {
  if (promotion.inicia_em && new Date(promotion.inicia_em).getTime() > now.getTime()) return false;
  if (promotion.termina_em && new Date(promotion.termina_em).getTime() < now.getTime()) return false;
  const schedule = saoPauloSchedule(now);
  const days = Array.isArray(promotion.dias_semana) ? promotion.dias_semana.map(Number) : [];
  if (days.length > 0 && !days.includes(schedule.weekday)) return false;
  const starts = timeToMinutes(promotion.hora_inicio);
  const ends = timeToMinutes(promotion.hora_fim);
  if (starts !== null && schedule.minutes < starts) return false;
  if (ends !== null && schedule.minutes > ends) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const vendorId = req.nextUrl.searchParams.get('vendor_id') || '';
    const session = getRequestSession(req);
    if (!isCanonicalUuid(vendorId)) return NextResponse.json({ error: 'Quiosque invalido.' }, { status: 400 });
    const customerAccess = !session || (session.role === 'customer' && session.vendor_id === vendorId);
    if (!customerAccess && !canAccessVendor(session, vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });

    let query = (supabaseAdmin.from('promocoes') as any)
      .select('id, titulo, descricao, tipo, desconto_tipo, desconto_valor, hora_inicio, hora_fim, dias_semana, inicia_em, termina_em, ativa, limite_por_pedido, created_at, promocao_itens(id, product_id, quantidade, grupo, products(id, name, price, promotional_price, active))')
      .eq('vendor_id', vendorId).order('created_at', { ascending: false });
    if (customerAccess) query = query.eq('ativa', true);
    const { data, error } = await query;
    if (error) throw error;
    const now = new Date();
    const promotions = (data || []).filter((promotion: any) => !customerAccess || promotionIsActiveNow(promotion, now));
    return NextResponse.json({ promotions });
  } catch (err) {
    console.error('Promotions GET error:', err);
    return NextResponse.json({ error: 'Erro ao carregar promocoes.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getRequestSession(req);
    const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || '');
    const title = String(body.title || '').trim().slice(0, 120);
    const benefitType = String(body.benefit_type || 'percent');
    const items = normalizeItems(body.items);
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(session, vendorId) || title.length < 3 || !items) return NextResponse.json({ error: 'Dados da promocao invalidos.' }, { status: 400 });

    const productIds = [...new Set(items.map(item => item.product_id))];
    const { data: products, error: productError } = await supabaseAdmin.from('products').select('id, price, promotional_price').eq('vendor_id', vendorId).in('id', productIds);
    if (productError) throw productError;
    if ((products || []).length !== productIds.length) return NextResponse.json({ error: 'Um produto nao pertence ao quiosque.' }, { status: 400 });
    const productPrice = new Map<string, number>((products || []).map((product: any) => [String(product.id), Number(product.promotional_price ?? product.price)] as [string, number]));
    const groupGross = items.reduce((sum, item) => sum + (productPrice.get(item.product_id) || 0) * item.quantidade, 0);

    let discountType = benefitType === 'percent' ? 'percentual' : benefitType === 'closed_price' ? 'preco_fechado' : 'valor_fixo';
    let discountValue = Math.max(0, Number(body.discount_value || 0));
    if (benefitType === 'free_product') {
      const rewardId = String(body.reward_product_id || '');
      if (!productPrice.has(rewardId)) return NextResponse.json({ error: 'Escolha o produto gratis.' }, { status: 400 });
      if (!items.some(item => item.grupo === 'principal' && item.product_id !== rewardId) || !items.some(item => item.grupo === 'brinde' && item.product_id === rewardId) || items.some(item => item.grupo === 'principal' && item.product_id === rewardId)) {
        return NextResponse.json({ error: 'Escolha ao menos um produto principal e um brinde diferente.' }, { status: 400 });
      }
      discountType = 'valor_fixo';
      discountValue = productPrice.get(rewardId) || 0;
    }
    if (discountValue <= 0 || (discountType === 'percentual' && discountValue > 100)) return NextResponse.json({ error: 'Informe um desconto valido.' }, { status: 400 });
    if (discountType === 'preco_fechado' && discountValue >= groupGross) {
      return NextResponse.json({ error: 'O preco final do combo deve ser menor que a soma normal dos produtos.' }, { status: 400 });
    }

    const { data: vendor } = await supabaseAdmin.from('vendors').select('tenant_id').eq('id', vendorId).single();
    const descriptionPrefix = benefitType === 'free_product' ? '[PRODUTO_GRATIS] ' : benefitType === 'closed_price' ? '[COMBO] ' : '';
    const { data: promotion, error } = await (supabaseAdmin.from('promocoes') as any).insert({
      tenant_id: vendor?.tenant_id, vendor_id: vendorId, titulo: title,
      descricao: `${descriptionPrefix}${String(body.description || '').trim()}`.trim() || null,
      tipo: 'combo_misto', desconto_tipo: discountType, desconto_valor: discountValue,
      inicia_em: body.starts_at || null, termina_em: body.ends_at || null, ativa: body.active !== false,
      limite_por_pedido: Math.max(1, Math.min(20, Number(body.limit_per_order || 1))),
    }).select('id').single();
    if (error) throw error;
    const { error: itemsError } = await (supabaseAdmin.from('promocao_itens') as any).insert(items.map(item => ({ ...item, promocao_id: promotion.id, tenant_id: vendor?.tenant_id, vendor_id: vendorId })));
    if (itemsError) {
      await (supabaseAdmin.from('promocoes') as any).delete().eq('id', promotion.id);
      throw itemsError;
    }
    return NextResponse.json({ id: promotion.id }, { status: 201 });
  } catch (err) {
    console.error('Promotions POST error:', err);
    return NextResponse.json({ error: 'Erro ao criar promocao.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = getRequestSession(req); const body = await req.json().catch(() => ({}));
    const vendorId = String(body.vendor_id || ''); const id = String(body.id || '');
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(id) || !canAccessVendor(session, vendorId) || typeof body.active !== 'boolean') return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const { error } = await (supabaseAdmin.from('promocoes') as any).update({ ativa: body.active, updated_at: new Date().toISOString() }).eq('id', id).eq('vendor_id', vendorId);
    if (error) throw error;
    return NextResponse.json({ id, active: body.active });
  } catch { return NextResponse.json({ error: 'Erro ao atualizar promocao.' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getRequestSession(req); const vendorId = req.nextUrl.searchParams.get('vendor_id') || ''; const id = req.nextUrl.searchParams.get('id') || '';
    if (!isCanonicalUuid(vendorId) || !isCanonicalUuid(id) || !canAccessVendor(session, vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const { error } = await (supabaseAdmin.from('promocoes') as any).delete().eq('id', id).eq('vendor_id', vendorId);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch { return NextResponse.json({ error: 'Erro ao excluir promocao.' }, { status: 500 }); }
}
