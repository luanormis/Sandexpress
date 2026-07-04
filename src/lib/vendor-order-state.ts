type OrderItemLike = {
  cancelled?: boolean | null;
};

type OrderLike<TItem extends OrderItemLike = OrderItemLike> = {
  total?: number | string | null;
  items?: TItem[] | null;
  account_items?: TItem[] | null;
};

function hasBillableItems(items?: OrderItemLike[] | null) {
  return Boolean((items || []).some((item) => !item.cancelled));
}

export function isAccountWithoutConsumption(order: OrderLike) {
  if (Number(order.total || 0) > 0) return false;
  return !hasBillableItems(order.account_items) && !hasBillableItems(order.items);
}

export function getVisibleConsumptionItems<TItem extends OrderItemLike>(
  order: OrderLike<TItem>,
  hasActiveRequest: boolean
) {
  if (hasActiveRequest) return order.items || [];
  return order.account_items || order.items || [];
}

const SYSTEM_NOTE_LINES = new Set([
  'Comanda aberta pelo QR Code',
]);

export function getVisibleVendorOrderNotes(notes?: string | null, serviceMarkers: string[] = []) {
  return String(notes || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !SYSTEM_NOTE_LINES.has(line))
    .filter((line) => !serviceMarkers.some((marker) => line.includes(marker)))
    .join('\n')
    .trim();
}
