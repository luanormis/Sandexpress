import { calculatePaymentBreakdown, normalizePaymentMethod } from './payments';

describe('payment helpers', () => {
  it('calculates card fees and net amount', () => {
    expect(calculatePaymentBreakdown({
      grossAmount: 100,
      method: 'credit_card',
      rates: { credit_card: 3.5, debit_card: 1.9, pix: 0 },
    })).toEqual({
      payment_method: 'credit_card',
      gross_amount: 100,
      fee_rate: 3.5,
      fee_amount: 3.5,
      net_amount: 96.5,
    });
  });

  it('does not charge a fee for cash unless configured', () => {
    expect(calculatePaymentBreakdown({
      grossAmount: 80,
      method: 'cash',
      rates: { credit_card: 3, debit_card: 2, pix: 0 },
    })).toMatchObject({
      payment_method: 'cash',
      fee_amount: 0,
      net_amount: 80,
    });
  });

  it('normalizes legacy payment method names', () => {
    expect(normalizePaymentMethod('card')).toBe('credit_card');
    expect(normalizePaymentMethod('transfer')).toBe('pix');
    expect(normalizePaymentMethod('dinheiro')).toBe('cash');
  });
});
