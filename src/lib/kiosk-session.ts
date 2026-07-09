import { supabaseAdmin } from '@/lib/supabase-admin';

const OPTIONAL_SCHEMA_CODES = new Set(['42P01', 'PGRST205', '42703', '42883']);

export function isOptionalPromotionSchemaError(error: any) {
  return OPTIONAL_SCHEMA_CODES.has(error?.code || '') ||
    String(error?.message || '').includes('sessoes_quiosque') ||
    String(error?.message || '').includes('promocoes') ||
    String(error?.message || '').includes('customer_push_tokens') ||
    String(error?.message || '').includes('function');
}

export async function touchKioskSession({
  vendorId,
  customerId,
  umbrellaId,
  userAgent,
}: {
  vendorId: string;
  customerId: string;
  umbrellaId?: string | null;
  userAgent?: string | null;
}) {
  const { error } = await supabaseAdmin.rpc('touch_sessao_quiosque', {
    p_vendor_id: vendorId,
    p_customer_id: customerId,
    p_umbrella_id: umbrellaId || null,
    p_user_agent: userAgent || null,
    p_inactivity_minutes: 120,
  });

  if (error && !isOptionalPromotionSchemaError(error)) throw error;
}

export async function closeKioskSessions(vendorId: string) {
  const { error } = await supabaseAdmin.rpc('fechar_sessoes_quiosque', {
    p_vendor_id: vendorId,
  });

  if (error && !isOptionalPromotionSchemaError(error)) throw error;
}
