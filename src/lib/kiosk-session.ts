import { supabaseAdmin } from '@/lib/supabase-admin';


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

  if (error) throw error;
}

export async function closeKioskSessions(vendorId: string) {
  const { error } = await supabaseAdmin.rpc('fechar_sessoes_quiosque', {
    p_vendor_id: vendorId,
  });

  if (error) throw error;
}
