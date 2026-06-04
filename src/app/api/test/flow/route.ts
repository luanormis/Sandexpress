import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TEST_VENDOR_LOGIN = 'TEST-FLOW-001';
const TEST_VENDOR_PASSWORD = 'teste12345';
const TEST_CUSTOMER_PHONE = '11977770001';
const db = supabaseAdmin as any;

type TestContext = {
  tenantId: string;
  vendor: any;
  umbrella: any;
  customer: any;
  products: any[];
};

function assertLocalTestAllowed() {
  if (process.env.NEXT_PUBLIC_ENV === 'production') {
    throw new Error('Fluxo de teste bloqueado em producao.');
  }
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  })) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function must<T>(label: string, promise: any) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function getTenantId() {
  const tenants = await must<any[]>('buscar tenant', db.from('tenants').select('id').eq('status', 'active').limit(1));
  if (tenants?.[0]?.id) return tenants[0].id as string;

  const inserted = await must<any[]>('criar tenant teste', db.from('tenants')
    .insert({
      name: 'Tenant Teste Local',
      status: 'active',
      city: 'Santos',
      state: 'SP',
      beach_name: 'Praia do Teste',
      primary_color: '#FF6B00',
    })
    .select('id'));
  return inserted[0].id as string;
}

async function seedTestFlow(): Promise<TestContext> {
  const tenantId = await getTenantId();
  await must('limpar vendor teste', db.from('vendors').delete().eq('document_login', TEST_VENDOR_LOGIN));

  const passwordHash = await hashPassword(TEST_VENDOR_PASSWORD);
  const vendor = (await must<any[]>('criar vendor teste', db.from('vendors')
    .insert({
      name: 'Quiosque Fluxo Local',
      document_login: TEST_VENDOR_LOGIN,
      owner_name: 'Operador Teste',
      owner_phone: '11977770000',
      owner_email: 'fluxo-local@example.com',
      address: 'Praia do Teste Local',
      city: 'Santos',
      state: 'SP',
      subscription_status: 'active',
      plan_type: 'monthly',
      max_umbrellas: 50,
      is_active: true,
      password_hash: passwordHash,
      password_needs_reset: false,
      pix_enabled: true,
      pix_key: '11977770000',
      pix_account_name: 'Quiosque Fluxo Local',
    } as any)
    .select('*')))[0];

  const umbrella = (await must<any[]>('criar guarda-sol teste', db.from('umbrellas')
    .insert({
      tenant_id: tenantId,
      vendor_id: vendor.id,
      number: 1,
      label: 'Guarda-sol Teste 1',
      location_hint: 'Primeira fileira',
      active: true,
      is_occupied: false,
      current_order_id: null,
      map_x: 38,
      map_y: 58,
    } as any)
    .select('*')))[0];

  const customer = (await must<any[]>('criar cliente teste', db.from('customers')
    .insert({
      tenant_id: tenantId,
      vendor_id: vendor.id,
      name: 'Cliente Fluxo Local',
      phone: TEST_CUSTOMER_PHONE,
      visit_count: 1,
      total_spent: 0,
    } as any)
    .select('*')))[0];

  const menu = [
    ['Cervejas', 'Cerveja Heineken Lata 350ml', 12, 1],
    ['Petiscos', 'Porcao de Batata Frita', 35, 2],
    ['Drinks', 'Caipirinha de Limao', 22, 3],
    ['Bebidas sem alcool', 'Agua Mineral sem Gas', 5, 4],
  ] as const;

  const products = await must<any[]>('criar produtos teste', db.from('products')
    .insert(menu.map(([category, name, price, sort_order]) => ({
      tenant_id: tenantId,
      vendor_id: vendor.id,
      category,
      name,
      description: 'Produto local para teste de fluxo',
      price,
      active: true,
      sort_order,
      stock_quantity: 100,
      blocked_by_stock: false,
    } as any)))
    .select('*'));

  return { tenantId, vendor, umbrella, customer, products };
}

async function getContext(): Promise<TestContext> {
  const existing = (await must<any[]>('buscar vendor teste', db.from('vendors')
    .select('*')
    .eq('document_login', TEST_VENDOR_LOGIN)
    .limit(1)))[0];

  if (!existing) return seedTestFlow();

  const tenantId = await getTenantId();
  const umbrella = (await must<any[]>('buscar guarda-sol teste', db.from('umbrellas')
    .select('*')
    .eq('vendor_id', existing.id)
    .eq('number', 1)
    .limit(1)))[0];
  const customer = (await must<any[]>('buscar cliente teste', db.from('customers')
    .select('*')
    .eq('vendor_id', existing.id)
    .eq('phone', TEST_CUSTOMER_PHONE)
    .limit(1)))[0];
  const products = await must<any[]>('buscar produtos teste', db.from('products')
    .select('*')
    .eq('vendor_id', existing.id)
    .eq('active', true)
    .order('sort_order'));

  if (!umbrella || !customer || products.length === 0) return seedTestFlow();
  return { tenantId, vendor: existing, umbrella, customer, products };
}

async function createReceivedOrder() {
  const ctx = await getContext();
  await db.from('orders').delete().eq('vendor_id', ctx.vendor.id).eq('status', 'received');

  const selectedProducts = ctx.products.slice(0, 3);
  const total = selectedProducts.reduce((sum, product, index) => sum + Number(product.price) * (index === 0 ? 2 : 1), 0);

  const order = (await must<any[]>('criar pedido teste', db.from('orders')
    .insert({
      tenant_id: ctx.tenantId,
      vendor_id: ctx.vendor.id,
      customer_id: ctx.customer.id,
      umbrella_id: ctx.umbrella.id,
      status: 'received',
      total,
      notes: 'Pedido criado pela pagina local de teste',
      paid: false,
      payment_method: null,
    } as any)
    .select('*')))[0];

  await must('criar itens teste', db.from('order_items').insert(selectedProducts.map((product, index) => {
    const quantity = index === 0 ? 2 : 1;
    return {
      tenant_id: ctx.tenantId,
      order_id: order.id,
      product_id: product.id,
      quantity,
      unit_price: product.price,
      subtotal: Number(product.price) * quantity,
    } as any;
  })));

  await must('ocupar guarda-sol', db.from('umbrellas')
    .update({ is_occupied: true, current_order_id: order.id } as any)
    .eq('id', ctx.umbrella.id));

  return { ...ctx, order };
}

async function closeOpenOrder() {
  const ctx = await getContext();
  const order = (await must<any[]>('buscar pedido aberto', db.from('orders')
    .select('*')
    .eq('vendor_id', ctx.vendor.id)
    .eq('umbrella_id', ctx.umbrella.id)
    .eq('status', 'received')
    .order('created_at', { ascending: false })
    .limit(1)))[0];

  if (!order) return { ...ctx, order: null, closed: false };

  const closed = (await must<any[]>('fechar pedido teste', db.from('orders')
    .update({
      status: 'completed',
      paid: true,
      payment_method: 'pix',
      pending_close: false,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', order.id)
    .select('*')))[0];

  await must('liberar guarda-sol', db.from('umbrellas')
    .update({ is_occupied: false, current_order_id: null } as any)
    .eq('id', ctx.umbrella.id));

  return { ...ctx, order: closed, closed: true };
}

async function summary() {
  const ctx = await getContext();
  const orders = await must<any[]>('contar pedidos teste', db.from('orders')
    .select('id, status, total, paid, payment_method, created_at')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: false })
    .limit(10));
  const latestUmbrella = (await must<any[]>('buscar estado guarda-sol', db.from('umbrellas')
    .select('*')
    .eq('id', ctx.umbrella.id)
    .limit(1)))[0];

  return {
    vendor: ctx.vendor,
    umbrella: latestUmbrella || ctx.umbrella,
    customer: ctx.customer,
    products: ctx.products,
    orders,
    links: {
      admin: '/admin',
      vendor: '/vendor/login',
      customer: `/u/${ctx.umbrella.id}`,
    },
    credentials: {
      vendor_login: TEST_VENDOR_LOGIN,
      vendor_password: TEST_VENDOR_PASSWORD,
      admin: 'Use ADMIN_PASSWORD do .env.local ou 95732 em local sem variavel.',
      customer_otp: '000000 quando CUSTOMER_OTP_MODE=dev',
    },
  };
}

export async function GET() {
  try {
    assertLocalTestAllowed();
    return NextResponse.json(await summary());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    assertLocalTestAllowed();
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'seed';

    if (action === 'seed') {
      await seedTestFlow();
      return NextResponse.json(await summary());
    }
    if (action === 'order') {
      const result = await createReceivedOrder();
      return NextResponse.json({ ...(await summary()), last_action: 'order_created', order: result.order });
    }
    if (action === 'close') {
      const result = await closeOpenOrder();
      return NextResponse.json({ ...(await summary()), last_action: 'account_closed', order: result.order, closed: result.closed });
    }
    if (action === 'full') {
      await createReceivedOrder();
      const result = await closeOpenOrder();
      return NextResponse.json({ ...(await summary()), last_action: 'full_flow', order: result.order, closed: result.closed });
    }

    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno.' }, { status: 500 });
  }
}
