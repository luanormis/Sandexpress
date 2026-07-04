import { getVisibleConsumptionItems, getVisibleVendorOrderNotes, isAccountWithoutConsumption } from './vendor-order-state';

describe('vendor order state helpers', () => {
  it('does not mark an account with delivered consumption as empty', () => {
    const order = {
      total: 8,
      items: [],
      account_items: [{ id: 'item-1', n: 'Agua', q: 1, subtotal: 8, cancelled: false }],
    };

    expect(isAccountWithoutConsumption(order)).toBe(false);
    expect(getVisibleConsumptionItems(order, false)).toEqual(order.account_items);
  });

  it('marks a zero-total account with no active or account items as empty', () => {
    expect(isAccountWithoutConsumption({ total: 0, items: [], account_items: [] })).toBe(true);
  });

  it('uses active request items while the order is still in progress', () => {
    const order = {
      total: 18,
      items: [{ id: 'active-item', n: 'Pastel', q: 1, subtotal: 18, cancelled: false }],
      account_items: [{ id: 'old-item', n: 'Agua', q: 1, subtotal: 8, cancelled: false }],
    };

    expect(getVisibleConsumptionItems(order, true)).toEqual(order.items);
  });

  it('hides system-only order notes from the vendor modal', () => {
    expect(getVisibleVendorOrderNotes('Comanda aberta pelo QR Code')).toBe('');
    expect(getVisibleVendorOrderNotes('Comanda aberta pelo QR Code\nCliente pediu gelo')).toBe('Cliente pediu gelo');
  });
});
