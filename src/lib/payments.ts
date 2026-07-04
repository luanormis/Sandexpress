export const PAYMENT_METHODS = ['cash', 'pix', 'debit_card', 'credit_card'] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

type PaymentRates = Partial<Record<PaymentMethod, number>>;
export type PaymentFeeType = 'percent' | 'fixed';
export type PaymentFeeConfig = {
  type?: PaymentFeeType;
  rate?: number;
  amount?: number;
};
type PaymentFees = Partial<Record<PaymentMethod, PaymentFeeConfig>>;

type PaymentBreakdownInput = {
  grossAmount: number;
  method: unknown;
  rates?: PaymentRates | null;
  fees?: PaymentFees | null;
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
  const feeConfig = input.fees?.[paymentMethod];
  const feeType: PaymentFeeType = feeConfig?.type === 'fixed' ? 'fixed' : 'percent';
  const feeRate = feeType === 'percent'
    ? Math.max(0, Number(feeConfig?.rate ?? input.rates?.[paymentMethod] ?? 0))
    : 0;
  const calculatedFeeAmount = feeType === 'fixed'
    ? Number(feeConfig?.amount || 0)
    : grossAmount * (feeRate / 100);
  const feeAmount = Math.min(grossAmount, toMoney(calculatedFeeAmount));
  const netAmount = toMoney(grossAmount - feeAmount);

  return {
    payment_method: paymentMethod,
    gross_amount: grossAmount,
    fee_type: feeType,
    fee_rate: feeRate,
    fee_amount: feeAmount,
    net_amount: netAmount,
  };
}

export function toMoney(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Number(numeric.toFixed(2)) : 0;
}
