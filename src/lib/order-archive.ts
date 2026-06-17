import { supabaseAdmin } from "@/lib/supabase-admin";

export const ORDER_ARCHIVE_BUCKET = "order-archives";

type ArchivePaidOrdersOptions = {
  vendorId?: string;
  before?: string;
  limit?: number;
};

type FetchArchivedOrdersOptions = {
  vendorId?: string;
  startDate?: string;
  endDate?: string;
};

const ARCHIVE_SELECT = `
  id,
  tenant_id,
  vendor_id,
  customer_id,
  umbrella_id,
  total,
  status,
  paid,
  payment_method,
  notes,
  created_at,
  updated_at,
  close_requested_at,
  paid_at,
  order_items(id, tenant_id, order_id, product_id, quantity, unit_price, subtotal, cancelled, created_at, products(id, name, category, price)),
  customers(id, name, phone, visit_count, total_spent, last_visit_at),
  umbrellas!orders_umbrella_id_fkey(id, number, label)
`;

function toSafeLimit(limit?: number) {
  const parsed = Number(limit || 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(1000, Math.max(1, Math.floor(parsed)));
}

function monthKeyFromOrder(order: any) {
  const date = new Date(order.paid_at || order.updated_at || order.created_at || Date.now());
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeysBetween(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(new Date().getUTCFullYear() - 3, 0, 1));
  const end = endDate ? new Date(endDate) : new Date();
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const keys: string[] = [];
  while (cursor <= last) {
    keys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function withinRange(order: any, startDate?: string, endDate?: string) {
  const time = new Date(order.created_at || order.paid_at || order.updated_at || 0).getTime();
  if (!Number.isFinite(time)) return false;
  if (startDate && time < new Date(startDate).getTime()) return false;
  if (endDate && time > new Date(endDate).getTime()) return false;
  return true;
}

async function ensureOrderArchiveBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(ORDER_ARCHIVE_BUCKET, {
    public: false,
  });
  if (error && !String(error.message || "").toLowerCase().includes("already exists")) {
    throw error;
  }
}

async function deleteChunked(table: string, column: string, ids: string[]) {
  for (let index = 0; index < ids.length; index += 250) {
    const chunk = ids.slice(index, index + 250);
    if (chunk.length === 0) continue;
    const { error } = await supabaseAdmin.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
}

export async function archivePaidOrders(options: ArchivePaidOrdersOptions = {}) {
  await ensureOrderArchiveBucket();

  let query = supabaseAdmin
    .from("orders")
    .select(ARCHIVE_SELECT)
    .eq("paid", true)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true })
    .limit(toSafeLimit(options.limit));

  if (options.vendorId) query = query.eq("vendor_id", options.vendorId);
  if (options.before) query = query.lte("paid_at", options.before);

  const { data, error } = await query;
  if (error) throw error;

  const orders = (data || []) as any[];
  if (orders.length === 0) {
    return { archived_orders: 0, deleted_orders: 0, files: [] as string[] };
  }

  const groups = new Map<string, any[]>();
  orders.forEach((order) => {
    const key = `${order.vendor_id}/${monthKeyFromOrder(order)}`;
    groups.set(key, [...(groups.get(key) || []), order]);
  });

  const files: string[] = [];
  for (const [prefix, groupOrders] of groups.entries()) {
    const path = `${prefix}/orders-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const payload = {
      version: 1,
      archived_at: new Date().toISOString(),
      archive_type: "paid-orders",
      orders: groupOrders,
    };
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ORDER_ARCHIVE_BUCKET)
      .upload(path, Buffer.from(JSON.stringify(payload)), {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    files.push(path);
  }

  const orderIds = orders.map((order) => order.id).filter(Boolean);
  await deleteChunked("order_items", "order_id", orderIds);
  await deleteChunked("orders", "id", orderIds);

  return {
    archived_orders: orders.length,
    deleted_orders: orderIds.length,
    files,
  };
}

async function listVendorFolders() {
  const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).list("", { limit: 1000 });
  if (error) {
    if (String(error.message || "").toLowerCase().includes("not found")) return [];
    throw error;
  }
  return (data || []).filter((item: any) => !item.name.includes(".")).map((item: any) => item.name);
}

async function readArchiveFile(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).download(path);
  if (error) throw error;
  return JSON.parse(await data.text());
}

export async function fetchArchivedOrders(options: FetchArchivedOrdersOptions = {}) {
  const vendorIds = options.vendorId ? [options.vendorId] : await listVendorFolders();
  const months = monthKeysBetween(options.startDate, options.endDate);
  const archivedOrders: any[] = [];

  for (const vendorId of vendorIds) {
    for (const month of months) {
      const prefix = `${vendorId}/${month}`;
      const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).list(prefix, { limit: 1000 });
      if (error) {
        if (String(error.message || "").toLowerCase().includes("not found")) continue;
        throw error;
      }

      for (const file of data || []) {
        if (!file.name.endsWith(".json")) continue;
        const payload = await readArchiveFile(`${prefix}/${file.name}`);
        const orders = Array.isArray(payload.orders) ? payload.orders : [];
        archivedOrders.push(
          ...orders.filter((order: any) =>
            (!options.vendorId || order.vendor_id === options.vendorId) &&
            withinRange(order, options.startDate, options.endDate)
          )
        );
      }
    }
  }

  return archivedOrders;
}

