import type { NextRequest } from 'next/server';
import { getRequestSession, resolveTenantIdFromSession } from './auth-session';

export function getTenantIdFromRequest(req: NextRequest): string | null {
  const sessionTenantId = resolveTenantIdFromSession(getRequestSession(req));
  if (sessionTenantId) return sessionTenantId;

  const vendorId = req.nextUrl.searchParams.get('vendor_id');
  if (vendorId) return vendorId;

  const tenantId = req.headers.get('x-tenant-id');
  if (tenantId) return tenantId;

  return null;
}

export function enforceTenantScope(query: any, tenantId: string): any {
  return query.eq('tenant_id', tenantId);
}
