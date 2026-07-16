import { supabaseAdmin } from '@/lib/supabase-admin';

export type CashControl = {
  status: 'open' | 'closed';
  opened_at: string;
  opened_by: string;
  opening_cash: number;
  expected_cash?: number;
  counted_cash?: number;
  difference?: number;
  difference_reason?: string;
  notes?: string;
  closed_at?: string;
  closed_by?: string;
};

export const CASH_CONTROL_PREFIX = 'cash_control:';

export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parseCashControl(value: unknown): CashControl | null {
  const text = String(value || '');
  if (!text.startsWith(CASH_CONTROL_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(CASH_CONTROL_PREFIX.length)) as CashControl;
    return parsed?.status === 'open' || parsed?.status === 'closed' ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeCashControl(value: CashControl) {
  return `${CASH_CONTROL_PREFIX}${JSON.stringify(value)}`;
}

export function cashControlBlock(control: CashControl | null) {
  if (!control) {
    return {
      code: 'CASH_REGISTER_NOT_OPEN',
      error: 'O caixa de hoje ainda nao foi aberto. Solicite ao responsavel do quiosque que abra o caixa.',
    };
  }
  if (control.status === 'closed') {
    return {
      code: 'CASH_REGISTER_CLOSED',
      error: 'O caixa de hoje ja foi encerrado e nao aceita novos atendimentos.',
    };
  }
  return null;
}

export async function getCashControl(vendorId: string, date = businessDate()) {
  const { data, error } = await supabaseAdmin
    .from('daily_closings')
    .select('closed_by')
    .eq('vendor_id', vendorId)
    .eq('business_date', date)
    .maybeSingle();
  if (error) throw error;
  return parseCashControl(data?.closed_by);
}
