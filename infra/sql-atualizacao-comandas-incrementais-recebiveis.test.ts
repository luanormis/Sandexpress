import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-comandas-incrementais-recebiveis.sql'),
  'utf8'
);

describe('sql-atualizacao-comandas-incrementais-recebiveis', () => {
  it('creates incremental order request and receivables tables', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS customer_order_requests');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS payment_method_rates');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS payment_receivables');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS order_request_id UUID REFERENCES customer_order_requests(id)');
  });

  it('keeps each new customer order as a unique request inside the open account', () => {
    expect(sql).toContain('SELECT COALESCE(MAX(sequence), 0) + 1 INTO next_sequence');
    expect(sql).toContain('INSERT INTO customer_order_requests');
    expect(sql).toContain("'order_request_id', request_row.id");
    expect(sql).toContain("'order_sequence', request_row.sequence");
  });

  it('stores card and pix fee settings with payout delay for receivables', () => {
    expect(sql).toContain("'debit_card', GREATEST(COALESCE(v.debit_card_fee_rate, 0), 0), 1");
    expect(sql).toContain("'credit_card', GREATEST(COALESCE(v.credit_card_fee_rate, 0), 0), 30");
    expect(sql).toContain('expected_payment_date');
    expect(sql).toContain('CURRENT_DATE + payout_delay_days');
  });

  it('uses explicit grants for Supabase Data API compatibility', () => {
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON customer_order_requests TO service_role');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON payment_method_rates TO service_role');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON payment_receivables TO service_role');
  });
});
