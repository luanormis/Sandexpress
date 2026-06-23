export const PAYMENT_METHODS = ['cash', 'pix', 'debit_card', 'credit_card'] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

type PaymentRates = Partial<Record<PaymentMethod, number>>;

type PaymentBreakdownInput = {
  grossAmount: number;
  method: unknown;
  rates?: PaymentRates | null;
};

const LEGACY_PAYMENT_METHODS: Record<string, PaymentMethod> = {
  cash: 'cash',
  dinheiro: 'cash',
  pix: 'pix',
  transfer: 'pix',
  transferencia: 'pix',
  card: 'credit_card',
  cartao: 'credit_card',
  credit: 'credit_card',
  credit_card: 'credit_card',
  credito: 'credit_card',
  debit: 'debit_card',
  debit_card: 'debit_card',
  debito: 'debit_card',
};

export function normalizePaymentMethod(method: unknown): PaymentMethod {
  const key = String(method || 'cash').trim().toLowerCase();
  return LEGACY_PAYMENT_METHODS[key] || 'cash';
}

export function calculatePaymentBreakdown(input: PaymentBreakdownInput) {
  const paymentMethod = normalizePaymentMethod(input.method);
  const grossAmount = toMoney(input.grossAmount);
  const feeRate = Math.max(0, Number(input.rates?.[paymentMethod] || 0));
  const feeAmount = toMoney(grossAmount * (feeRate / 100));
  const netAmount = toMoney(grossAmount - feeAmount);

  return {
    payment_method: paymentMethod,
    gross_amount: grossAmount,
    fee_rate: feeRate,
    fee_amount: feeAmount,
    net_amount: netAmount,
  };
}

export function toMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Number(numeric.toFixed(2)) : 0;
}
