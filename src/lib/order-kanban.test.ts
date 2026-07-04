import { mapOrderForKanban } from './order-kanban';

describe('order kanban mapper', () => {
  it('shows only the active request items in kanban', () => {
    const mapped = mapOrderForKanban({
      id: 'account-1',
      status: 'received',
      customer_order_requests: [
        { id: 'request-a', sequence: 1, status: 'completed', subtotal: 18 },
        { id: 'request-b', sequence: 2, status: 'received', subtotal: 10 },
      ],
      order_items: [
        { id: 'item-a', order_request_id: 'request-a', quantity: 1, subtotal: 18, products: { name: 'Pastel de carne' } },
        { id: 'item-b', order_request_id: 'request-b', quantity: 1, subtotal: 10, products: { name: 'Amstel 350ml' } },
      ],
    });

    expect(mapped.active_request_id).toBe('request-b');
    expect(mapped.items).toEqual([
      expect.objectContaining({ id: 'item-b', n: 'Amstel 350ml' }),
    ]);
    expect(mapped.account_items).toHaveLength(2);
  });

  it('keeps completed account history out of kanban when no request is active', () => {
    const mapped = mapOrderForKanban({
      id: 'account-1',
      status: 'completed',
      customer_order_requests: [
        { id: 'request-a', sequence: 1, status: 'completed', subtotal: 18 },
      ],
      order_items: [
        { id: 'item-a', order_request_id: 'request-a', quantity: 1, subtotal: 18, products: { name: 'Pastel de carne' } },
      ],
    });

    expect(mapped.active_request_id).toBeNull();
    expect(mapped.items).toEqual([]);
    expect(mapped.account_items).toHaveLength(1);
  });
});
