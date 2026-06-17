export const ORDER_ARCHIVE_BUCKET = 'order-archives';
const DELETE_CHUNK_SIZE = 250;

type StoragePrefix = {
  bucket: string;
  prefix: string;
};

export function buildCustomerDatabaseDeletePlan() {
  return [
    'account_adjustments',
    'order_items',
    'orders',
    'customers',
  ];
}

export function buildKioskStoragePrefixes(vendorId: string): StoragePrefix[] {
  return [
    { bucket: ORDER_ARCHIVE_BUCKET, prefix: `${vendorId}/` },
    { bucket: 'product-images', prefix: `products/${vendorId}/` },
    { bucket: 'product-images', prefix: `${vendorId}/` },
    { bucket: 'product-images', prefix: `logos/${vendorId}/` },
  ];
}

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import('./supabase-admin');
  return supabaseAdmin;
}

async function selectIds(table: string, filters: Record<string, string | string[]>) {
  const supabaseAdmin = await getSupabaseAdmin();
  const ids: string[] = [];
  let from = 0;

  while (true) {
    let query = supabaseAdmin.from(table).select('id').range(from, from + 999);
    Object.entries(filters).forEach(([column, value]) => {
      query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
    });

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []).map((row: any) => row.id).filter(Boolean);
    ids.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }

  return ids;
}

async function deleteByIds(table: string, ids: string[]) {
  const supabaseAdmin = await getSupabaseAdmin();
  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.from(table).delete().in('id', chunk);
    if (error) throw error;
  }
}

async function deleteByColumn(table: string, column: string, ids: string[]) {
  const supabaseAdmin = await getSupabaseAdmin();
  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
}

async function listStorageFiles(bucket: string, prefix: string): Promise<string[]> {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('not found') || message.includes('does not exist')) return [];
    throw error;
  }

  const files: string[] = [];
  for (const item of data || []) {
    const path = `${prefix}${item.name}`;
    if ((item as any).metadata || item.name.includes('.')) {
      files.push(path);
    } else {
      files.push(...await listStorageFiles(bucket, `${path}/`));
    }
  }
  return files;
}

async function removeStorageFiles(bucket: string, files: string[]) {
  const supabaseAdmin = await getSupabaseAdmin();
  for (let index = 0; index < files.length; index += DELETE_CHUNK_SIZE) {
    const chunk = files.slice(index, index + DELETE_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
}

async function purgeStoragePrefixes(prefixes: StoragePrefix[]) {
  let deletedFiles = 0;

  for (const { bucket, prefix } of prefixes) {
    const files = await listStorageFiles(bucket, prefix);
    await removeStorageFiles(bucket, files);
    deletedFiles += files.length;
  }

  return deletedFiles;
}

export async function purgeCustomerDatabase(vendorId?: string) {
  const customerFilters: Record<string, string | string[]> = vendorId ? { vendor_id: vendorId } : {};
  const orderFilters: Record<string, string | string[]> = vendorId ? { vendor_id: vendorId } : {};
  const customerIds = await selectIds('customers', customerFilters);
  const orderIds = await selectIds('orders', orderFilters);

  await deleteByColumn('account_adjustments', 'customer_id', customerIds);
  await deleteByColumn('order_items', 'order_id', orderIds);
  await deleteByIds('orders', orderIds);
  await deleteByIds('customers', customerIds);

  const deletedStorageFiles = await purgeStoragePrefixes([
    { bucket: ORDER_ARCHIVE_BUCKET, prefix: vendorId ? `${vendorId}/` : '' },
  ]);

  return {
    deleted_customers: customerIds.length,
    deleted_orders: orderIds.length,
    deleted_storage_files: deletedStorageFiles,
  };
}

export async function purgeKiosk(vendorId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data: vendor, error } = await supabaseAdmin
    .from('vendors')
    .select('id, tenant_id')
    .eq('id', vendorId)
    .single();
  if (error || !vendor) {
    throw new Error('Quiosque nao encontrado.');
  }

  const deletedStorageFiles = await purgeStoragePrefixes(buildKioskStoragePrefixes(vendorId));

  if ((vendor as any).tenant_id) {
    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .delete()
      .eq('id', (vendor as any).tenant_id);
    if (tenantError) throw tenantError;
  } else {
    const { error: vendorError } = await supabaseAdmin
      .from('vendors')
      .delete()
      .eq('id', vendorId);
    if (vendorError) throw vendorError;
  }

  return {
    deleted_vendor_id: vendorId,
    deleted_storage_files: deletedStorageFiles,
  };
}
