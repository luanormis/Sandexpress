type AccountItem = { id: string; name: string; quantity: number; unit_price: number; subtotal: number; delivered_quantity: number; cancelled?: boolean };
export function customerOrderView<T extends { id: string; items?: AccountItem[]; total?: number; account_total?: number; status?: string; created_at?: string }>(order: T) {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items : [],
    total: Number(order.total || 0),
    account_total: Number(order.account_total ?? order.total ?? 0),
    status: order.status || "received",
    created_at: order.created_at || new Date().toISOString(),
  };
}
