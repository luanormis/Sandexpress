export const ACTIVE_ORDER_REQUEST_STATUSES = ['received', 'preparing', 'delivering'] as const;

export const OPEN_ACCOUNT_STATUSES = [
  ...ACTIVE_ORDER_REQUEST_STATUSES,
  'completed',
  'closing_requested',
] as const;

export function isActiveOrderRequestStatus(status: unknown) {
  return ACTIVE_ORDER_REQUEST_STATUSES.includes(String(status) as (typeof ACTIVE_ORDER_REQUEST_STATUSES)[number]);
}

export function isOpenAccountStatus(status: unknown) {
  return OPEN_ACCOUNT_STATUSES.includes(String(status) as (typeof OPEN_ACCOUNT_STATUSES)[number]);
}
