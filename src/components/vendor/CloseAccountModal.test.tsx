/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CloseAccountModal from './CloseAccountModal';

it('uses registered people and keeps the same share after a separate payment', async () => {
  localStorage.setItem('vendor_id', 'vendor-test');
  let paid = 0;
  const charges: number[] = [];
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url, options) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body));
      charges.push(body.amount);
      paid += body.amount;
      return { ok: true, json: async () => ({ closed: false, remaining_amount: 120 - paid }) } as Response;
    }
    if (String(url).startsWith('/api/close-account')) {
      return { ok: true, json: async () => ({ order_id: 'order-test', customer_name: 'Cliente', total: 120, opened_at: new Date().toISOString() }) } as Response;
    }
    return { ok: true, json: async () => ({ total: 120, base_total: 120, party_size: 4, paid_amount: paid, remaining_amount: 120 - paid, payments: [] }) } as Response;
  });
  try {
    render(<CloseAccountModal />);
    fireEvent.change(screen.getByPlaceholderText('Ex: 12'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar$/ }));
    await waitFor(() => expect((screen.getByLabelText('Quantidade de pessoas') as HTMLInputElement).value).toBe('4'));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pagamento/ }));
    await waitFor(() => expect(charges).toEqual([30]));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar Pagamento/ }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Pagamento/ }));
    await waitFor(() => expect(charges).toEqual([30, 30]));
  } finally {
    global.fetch = originalFetch;
    localStorage.clear();
  }
});
