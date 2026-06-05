import crypto from 'crypto';
import { DEFAULT_MENU } from '@/lib/default-menu';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TEST_TENANT_ID = '10000000-0000-0000-0000-000000000001';
const TEST_VENDOR_ID = '20000000-0000-0000-0000-000000000001';
const TEST_VENDOR_LOGIN = 'teste001';
const TEST_VENDOR_PASSWORD = 'teste001';

async function hashPassword(password: string, fixedSalt?: string) {
  const salt = fixedSalt || crypto.randomBytes(16).toString('hex');
  const key = (await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  })) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

function mapPosition(index: number) {
  return {
    map_x: 8 + ((index % 10) * 9),
    map_y: 10 + (Math.floor(index / 10) * 14),
  };
}

export async function ensureTestVendor() {
  const passwordHash = await hashPassword(TEST_VENDOR_PASSWORD, 'sandexpress_teste001_2026');

  const { data: existingVendors, error: existingError } = await supabaseAdmin
    .from('vendors')
    .select('id, tenant_id, document_login')
    .or(`document_login.eq.${TEST_VENDOR_LOGIN},id.eq.${TEST_VENDOR_ID}`);

  if (existingError) throw existingError;
  const existingVendor =
    (existingVendors || []).find((vendor: { document_login?: string }) => vendor.document_login === TEST_VENDOR_LOGIN) ||
    (existingVendors || [])[0];

  const tenantId = existingVendor?.tenant_id || TEST_TENANT_ID;
  const vendorId = existingVendor?.id || TEST_VENDOR_ID;

  const { error: tenantError } = await supabaseAdmin
    .from('tenants')
    .upsert({
      id: tenantId,
      name: 'Quiosque Teste',
      status: 'active',
      city: 'Cidade Teste',
      state: 'SP',
      beach_name: 'Praia Teste',
      primary_color: '#ff7a1a',
    }, { onConflict: 'id' });
  if (tenantError) throw tenantError;

  const vendorPayload = {
    id: vendorId,
    tenant_id: tenantId,
    name: 'Quiosque Teste',
    document_login: TEST_VENDOR_LOGIN,
    address: 'Praia Teste',
    city: 'Cidade Teste',
    state: 'SP',
    beach_name: 'Praia Teste',
    owner_name: 'Operador Teste',
    owner_phone: '11999999999',
    owner_email: null,
    primary_color: '#ff7a1a',
    secondary_color: '#0f3d4f',
    password_hash: passwordHash,
    password_needs_reset: false,
    subscription_status: 'active',
    plan_type: 'monthly',
    max_umbrellas: 50,
    pix_enabled: true,
    pix_key: '11999999999',
    pix_account_name: 'Quiosque Teste',
    is_active: true,
  };

  const { data: vendor, error: vendorError } = await supabaseAdmin
    .from('vendors')
    .upsert(vendorPayload, { onConflict: 'id' })
    .select('id, tenant_id, document_login, name')
    .single();
  if (vendorError) throw vendorError;

  const { error: planError } = await supabaseAdmin
    .from('vendor_plans')
    .upsert({
      vendor_id: vendor.id,
      plan_type: 'monthly',
      can_upload_images: true,
      max_custom_images: 100,
      custom_images_used: 0,
    }, { onConflict: 'vendor_id' });
  if (planError) throw planError;

  const { error: umbrellasError } = await supabaseAdmin
    .from('umbrellas')
    .upsert(Array.from({ length: 50 }, (_, index) => ({
      tenant_id: vendor.tenant_id,
      vendor_id: vendor.id,
      number: index + 1,
      label: `Guarda-sol ${index + 1}`,
      active: true,
      is_occupied: false,
      ...mapPosition(index),
    })), { onConflict: 'vendor_id,number' });
  if (umbrellasError) throw umbrellasError;

  const { error: deleteProductsError } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('vendor_id', vendor.id);
  if (deleteProductsError) throw deleteProductsError;

  const { error: productsError } = await supabaseAdmin
    .from('products')
    .insert(DEFAULT_MENU.map((item) => ({
      tenant_id: vendor.tenant_id,
      vendor_id: vendor.id,
      ...item,
      active: true,
      stock_quantity: 100,
      blocked_by_stock: false,
    })));
  if (productsError) throw productsError;

  return {
    vendor,
    credentials: {
      login: TEST_VENDOR_LOGIN,
      password: TEST_VENDOR_PASSWORD,
    },
    products_count: DEFAULT_MENU.length,
    umbrellas_count: 50,
  };
}
