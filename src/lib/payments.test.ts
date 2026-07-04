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
      fee_type: 'percent',
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

  it('calculates fixed payment fees in currency', () => {
    expect(calculatePaymentBreakdown({
      grossAmount: 100,
      method: 'pix',
      fees: { pix: { type: 'fixed', amount: 2.5 } },
    })).toEqual({
      payment_method: 'pix',
      gross_amount: 100,
      fee_type: 'fixed',
      fee_rate: 0,
      fee_amount: 2.5,
      net_amount: 97.5,
    });
  });

  it('caps fixed payment fees at the gross amount', () => {
    expect(calculatePaymentBreakdown({
      grossAmount: 8,
      method: 'debit_card',
      fees: { debit_card: { type: 'fixed', amount: 10 } },
    })).toMatchObject({
      payment_method: 'debit_card',
      fee_type: 'fixed',
      fee_amount: 8,
      net_amount: 0,
    });
  });

  it('normalizes legacy payment method names', () => {
    expect(normalizePaymentMethod('card')).toBe('credit_card');
    expect(normalizePaymentMethod('transfer')).toBe('pix');
    expect(normalizePaymentMethod('dinheiro')).toBe('cash');
  });
});
