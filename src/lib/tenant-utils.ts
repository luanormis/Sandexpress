import { supabaseAdmin } from './supabase-admin';
import type { SessionPayload } from './auth-session';
import { NextRequest } from 'next/server';

const pgAdmin = supabaseAdmin as any;

export type Tenant = {
  id: string;
  name: string;
  status: 'active' | 'blocked';
  city?: string | null;
  state?: string | null;
  region?: string | null;
  beach_name?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
  created_at?: string | null;
};

export async function getTenantById(tenantId: string) {
  const { data, error } = await pgAdmin
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Tenant;
}

export async function getTenantByUser(userId: string) {
  const { data, error } = await pgAdmin
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return getTenantById(data.tenant_id);
}

export async function validateTenantAccess(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error('Tenant não encontrado.');
  }
  if (tenant.status !== 'active') {
    throw new Error('Tenant bloqueado ou inativo.');
  }
  return tenant;
}

export function enforceTenantScope(query: any, tenantId: string): any {
  return query.eq('tenant_id', tenantId);
}

export function getTenantIdFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-tenant-id');
}

export function resolveTenantIdFromSession(session: SessionPayload): string | null {
  return session.tenant_id || null;
}
