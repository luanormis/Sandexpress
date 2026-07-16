jest.mock('./runtime-config', () => ({
  getSessionSecret: () => 'session-secret-for-auth-tests-123456789',
}));

import { createSessionToken, getRequestSession } from './auth-session';

const secretCookieNames = ['admin_session', 'vendor_session', 'customer_session'] as const;

function requestWithCookies(cookies: Partial<Record<(typeof secretCookieNames)[number], string>>) {
  return {
    cookies: {
      get(name: string) {
        const value = cookies[name as keyof typeof cookies];
        return value ? { value } : undefined;
      },
    },
  } as Parameters<typeof getRequestSession>[0];
}

describe('getRequestSession', () => {
  it('prioritizes a valid admin session when vendor and admin cookies coexist', () => {
    const admin = createSessionToken({ role: 'admin' }, 60);
    const vendor = createSessionToken({ role: 'vendor', vendor_id: 'vendor-1' }, 60);
    const session = getRequestSession(requestWithCookies({ admin_session: admin, vendor_session: vendor }));
    expect(session?.role).toBe('admin');
  });

  it('falls back to a valid vendor session when the admin cookie is invalid', () => {
    const vendor = createSessionToken({ role: 'vendor', vendor_id: 'vendor-1' }, 60);
    const session = getRequestSession(requestWithCookies({
      admin_session: 'invalid',
      vendor_session: vendor,
    }));
    expect(session?.role).toBe('vendor');
  });
});
