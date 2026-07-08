import { isActiveOrderRequestStatus } from './order-account';

type OrderRequestRecord = {
  id: string;
  sequence?: number | null;
  subtotal?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type OrderItemRecord = {
  id: string;
  order_request_id?: string | null;
  quantity?: number | null;
  subtotal?: number | null;
  cancelled?: boolean | null;
  products?: { name?: string | null } | null;
};

type KanbanOrderRecord = {
  customer_order_requests?: OrderRequestRecord[] | null;
  order_items?: OrderItemRecord[] | null;
  paid?: boolean | null;
  status?: string | null;
  total?: number | string | null;
  [key: string]: unknown;
};

function hasBillableOrderItems(items?: OrderItemRecord[] | null) {
  return Boolean((items || []).some((item) => !item.cancelled));
}

export function getActiveOrderRequest(requestsInput: OrderRequestRecord[] | null | undefined) {
  const requests = [...(requestsInput || [])].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  return [...requests].reverse().find((request) => isActiveOrderRequestStatus(request.status)) || null;
}

export function shouldShowOrderInKanban(order: KanbanOrderRecord) {
  if (order.paid) return false;
  if (getActiveOrderRequest(order.customer_order_requests)) return true;
  if (order.status === 'cancelled') return false;
  if (order.status === 'closing_requested') return true;
  return Number(order.total || 0) > 0 || hasBillableOrderItems(order.order_items);
}

export function mapOrderForKanban(order: KanbanOrderRecord) {
  const requests = [...(order.customer_order_requests || [])]
    .sort((a: OrderRequestRecord, b: OrderRequestRecord) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const activeRequest = getActiveOrderRequest(requests);
  const accountItems = (order.order_items || []).map((item: OrderItemRecord) => ({
    id: item.id,
    order_request_id: item.order_request_id,
    q: item.quantity,
    n: item.products?.name || 'Produto',
    subtotal: Number(item.subtotal || 0),
    cancelled: Boolean(item.cancelled),
  }));
  const activeItems = activeRequest
    ? accountItems.filter((item) => item.order_request_id === activeRequest.id && !item.cancelled)
    : [];

  return {
    ...order,
    status: activeRequest?.status || order.status,
    account_status: order.status,
    active_request: activeRequest,
    active_request_id: activeRequest?.id || null,
    requests,
    account_items: accountItems,
    items: activeItems,
  };
}
