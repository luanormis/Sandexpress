import { toMoney } from '@/lib/payments';

export function serviceFeeFromOrderNotes(notes: unknown) {
  const match = String(notes || '').match(/10% do gar(?:ç|c)om:\s*R\$\s*([\d.]+,\d{2})/i);
  if (!match) return 0;
  return toMoney(Number(match[1].replace(/\./g, '').replace(',', '.')));
}

export function accountAmountsWithServiceFee(order: { total?: number | null; notes?: string | null }) {
  const baseTotal = toMoney(order.total);
  const serviceFeeAmount = serviceFeeFromOrderNotes(order.notes);
  return { baseTotal, serviceFeeAmount, accountTotal: toMoney(baseTotal + serviceFeeAmount) };
}
