import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'infra/sql-atualizacao-descontos-promocoes-pedidos.sql'),
  'utf8'
);

describe('sql-atualizacao-descontos-promocoes-pedidos', () => {
  it('adds auditable discount fields to orders, requests and items', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS discount_total NUMERIC(10,2)');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS gross_subtotal NUMERIC(10,2)');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2)');
  });

  it('replaces order creation with transactional promotion persistence', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION create_customer_order');
    expect(sql).toContain('SELECT calcular_promocoes_carrinho(p_vendor_id, p_items, NOW()) INTO promotion_preview');
    expect(sql).toContain('request_discount_total := ROUND(LEAST(');
    expect(sql).toContain('discount_total = discount_total + request_discount_total');
    expect(sql).toContain("'promotion_preview', jsonb_build_object(");
  });

  it('keeps payment receivable amount based on the net customer charge', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION close_customer_account');
    expect(sql).toContain('gross_amount := ROUND(GREATEST(COALESCE(order_row.total, 0), 0), 2)');
    expect(sql).not.toContain('gross_total = gross_amount,');
    expect(sql).toContain("'discount_total', order_row.discount_total");
  });

  it('keeps service role grants explicit', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION create_customer_order(UUID, UUID, UUID, JSONB, TEXT) TO service_role');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION close_customer_account(UUID, UUID, TEXT, UUID, BOOLEAN, TEXT, TEXT) TO service_role');
  });
});
