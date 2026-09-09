export type PartialDeliveryEvent = {
  metadata?: { order_item_id?: string; delivered_quantity?: number } | null;
};

export function latestDeliveredQuantities(events: PartialDeliveryEvent[]) {
  const result: Record<string, number> = {};
  for (const event of events) {
    const itemId = String(event.metadata?.order_item_id || '');
    const quantity = Math.max(0, Math.floor(Number(event.metadata?.delivered_quantity || 0)));
    if (itemId) result[itemId] = quantity;
  }
  return result;
}

export function clampDeliveredQuantity(value: unknown, orderedQuantity: unknown) {
  const ordered = Math.max(0, Math.floor(Number(orderedQuantity || 0)));
  const requested = Math.max(0, Math.floor(Number(value || 0)));
  return Math.min(requested, ordered);
}

