import { NextRequest } from 'next/server';
import { GET } from './route';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/auth-session', () => ({ getRequestSession: jest.fn(), canAccessVendor: jest.fn() }));
function query(result: any) { const q: any = {}; for (const name of ['select','eq','order','contains','range','single']) q[name] = jest.fn(() => q); q.then = (resolve: any) => Promise.resolve(result).then(resolve); return q; }
it('returns requested items with recorded partial deliveries scoped to their request', async () => {
  (getRequestSession as jest.Mock).mockReturnValue({ role: 'customer', customer_id: 'customer', vendor_id: 'vendor' });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => query({ data: table === 'customers' ? { id: 'customer', vendor_id: 'vendor' } : table === 'orders' ? [{ id: 'account', total: 30, status: 'received', customer_order_requests: [{ id: 'request', sequence: 1, subtotal: 30 }], order_items: [{ id: 'item', order_request_id: 'request', quantity: 3, unit_price: 10, subtotal: 30, products: { name: 'Água' } }] }] : [{ metadata: { order_item_id: 'item', delivered_quantity: 2 } }], error: null }));
  const response = await GET(new NextRequest('http://localhost/api/customers/customer/orders'), { params: Promise.resolve({ id: 'customer' }) });
  const data = await response.json();
  expect(data[0].items[0]).toMatchObject({ name: 'Água', quantity: 3, delivered_quantity: 2, subtotal: 30 });
  expect(data[0].total).toBe(30);
});
it('rejects access to another customer before reading their orders', async () => {
  (getRequestSession as jest.Mock).mockReturnValue({ role: 'customer', customer_id: 'other', vendor_id: 'vendor' });
  (supabaseAdmin.from as jest.Mock).mockClear().mockReturnValue(query({ data: { id: 'customer', vendor_id: 'vendor' } }));
  const response = await GET(new NextRequest('http://localhost/api/customers/customer/orders'), { params: Promise.resolve({ id: 'customer' }) });
  expect(response.status).toBe(403);
  expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
});
