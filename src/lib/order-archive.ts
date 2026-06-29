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
  gross_total,
  payment_fee_amount,
  net_total,
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

function dayKeyFromOrder(order: any) {
  const date = new Date(order.paid_at || order.updated_at || order.created_at || Date.now());
  return date.toISOString().slice(0, 10);
}

function dayKeysBetween(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1));
  const end = endDate ? new Date(endDate) : new Date();
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [];

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const keys: string[] = [];
  while (cursor <= last && keys.length < 3700) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
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

function compactOrder(order: any) {
  return {
    id: order.id,
    tenant_id: order.tenant_id,
    vendor_id: order.vendor_id,
    customer_id: order.customer_id,
    umbrella_id: order.umbrella_id,
    total: order.total,
    gross_total: order.gross_total,
    payment_fee_amount: order.payment_fee_amount,
    net_total: order.net_total,
    status: order.status,
    paid: order.paid,
    payment_method: order.payment_method,
    created_at: order.created_at,
    updated_at: order.updated_at,
    close_requested_at: order.close_requested_at,
    paid_at: order.paid_at,
    order_items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      cancelled: item.cancelled,
      created_at: item.created_at,
      products: item.products
        ? {
            id: item.products.id,
            name: item.products.name,
            category: item.products.category,
          }
        : null,
    })),
    customers: order.customers
      ? {
          id: order.customers.id,
          name: order.customers.name,
          phone: order.customers.phone,
        }
      : null,
    umbrellas: order.umbrellas
      ? {
          id: order.umbrellas.id,
          number: order.umbrellas.number,
        }
      : null,
  };
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
    .eq("status", "completed")
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
    const key = `daily/${dayKeyFromOrder(order)}/${order.vendor_id}`;
    groups.set(key, [...(groups.get(key) || []), compactOrder(order)]);
  });

  const files: string[] = [];
  for (const [key, groupOrders] of groups.entries()) {
    const [prefix, vendorId] = key.split(/\/([^/]+)$/);
    const path = `${prefix}/${vendorId}-orders-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
    const payload = `${groupOrders.map((order) => JSON.stringify(order)).join("\n")}\n`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ORDER_ARCHIVE_BUCKET)
      .upload(path, Buffer.from(payload), {
        contentType: "text/plain; charset=utf-8",
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
  return (data || [])
    .filter((item: any) => !item.name.includes(".") && item.name !== "daily")
    .map((item: any) => item.name);
}

async function readArchiveOrders(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).download(path);
  if (error) throw error;
  const text = (await data.text()).trim();
  if (!text) return [];

  if (text.startsWith("{")) {
    const payload = JSON.parse(text);
    return Array.isArray(payload.orders) ? payload.orders : [];
  }

  if (text.startsWith("[")) {
    const payload = JSON.parse(text);
    return Array.isArray(payload) ? payload : [];
  }

  return text
    .split("\n")
    .map((line: string) => line.trim())
    .filter(Boolean)
    .map((line: string) => JSON.parse(line));
}

export async function fetchArchivedOrders(options: FetchArchivedOrdersOptions = {}) {
  const vendorIds = options.vendorId ? [options.vendorId] : await listVendorFolders();
  const days = dayKeysBetween(options.startDate, options.endDate);
  const months = monthKeysBetween(options.startDate, options.endDate);
  const archivedOrders = new Map<string, any>();

  for (const day of days) {
    const prefix = `daily/${day}`;
    const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).list(prefix, { limit: 1000 });
    if (error) {
      if (!String(error.message || "").toLowerCase().includes("not found")) throw error;
      continue;
    }

    for (const file of data || []) {
      if (!file.name.endsWith(".ndjson") && !file.name.endsWith(".json") && !file.name.endsWith(".txt")) continue;
      if (options.vendorId && !file.name.startsWith(`${options.vendorId}-`)) continue;
      const orders = await readArchiveOrders(`${prefix}/${file.name}`);
      orders
        .filter((order: any) =>
          (!options.vendorId || order.vendor_id === options.vendorId) &&
          withinRange(order, options.startDate, options.endDate)
        )
        .forEach((order: any) => archivedOrders.set(order.id || `${prefix}/${file.name}`, order));
    }
  }

  if (options.vendorId) {
    for (const day of days) {
      const prefix = `${options.vendorId}/daily/${day}`;
      const { data, error } = await supabaseAdmin.storage.from(ORDER_ARCHIVE_BUCKET).list(prefix, { limit: 1000 });
      if (error) {
        if (String(error.message || "").toLowerCase().includes("not found")) continue;
        throw error;
      }

      for (const file of data || []) {
        if (!file.name.endsWith(".ndjson") && !file.name.endsWith(".json") && !file.name.endsWith(".txt")) continue;
        const orders = await readArchiveOrders(`${prefix}/${file.name}`);
        orders
          .filter((order: any) =>
            order.vendor_id === options.vendorId &&
            withinRange(order, options.startDate, options.endDate)
          )
          .forEach((order: any) => archivedOrders.set(order.id || `${prefix}/${file.name}`, order));
      }
    }
  }

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
        const orders = await readArchiveOrders(`${prefix}/${file.name}`);
        orders
          .filter((order: any) =>
            (!options.vendorId || order.vendor_id === options.vendorId) &&
            withinRange(order, options.startDate, options.endDate)
          )
          .forEach((order: any) => archivedOrders.set(order.id || `${prefix}/${file.name}`, order));
      }
    }
  }

  return Array.from(archivedOrders.values());
}
