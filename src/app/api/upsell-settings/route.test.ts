import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { supabaseAdmin } from '@/lib/supabase-admin';
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('@/lib/auth-session', () => ({ getRequestSession: () => ({ role: 'vendor' }), canAccessVendor: () => true }));
const vendor = '00000000-0000-4000-8000-000000000001';
function query(result: any) { const q: any = {}; for (const name of ['select','eq','order','limit','maybeSingle','single','insert']) q[name] = jest.fn(() => q); q.then = (resolve: any) => Promise.resolve(result).then(resolve); return q; }
it('returns the persisted disabled flag', async () => {
  (supabaseAdmin.from as jest.Mock).mockReturnValue(query({ data: { metadata: { enabled: false, rules: [] } } }));
  const response = await GET(new NextRequest('http://localhost/api/upsell-settings?vendor_id=' + vendor));
  expect(await response.json()).toMatchObject({ enabled: false, rules: [] });
});
it('persists the activation flag along with the rules', async () => {
  const event = query({ error: null });
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => table === 'vendors' ? query({ data: { tenant_id: 'tenant' } }) : event);
  const response = await POST(new NextRequest('http://localhost/api/upsell-settings', { method: 'POST', body: JSON.stringify({ vendor_id: vendor, rules: [], enabled: false }) }));
  expect(response.status).toBe(200);
  expect(event.insert).toHaveBeenCalledWith(expect.objectContaining({ metadata: { rules: [], enabled: false } }));
});
