import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/sql-atualizacao-producao-500-pedidos.sql'), 'utf8');
const orderRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/orders/route.ts'), 'utf8');

describe('production order hardening', () => {
  it('requires database idempotency with no legacy RPC fallback', () => {
    expect(orderRoute).toContain('idempotency_key UUID e obrigatoria');
    expect(orderRoute).toContain("rpc('create_customer_order_idempotent'");
    expect(orderRoute).not.toContain("rpc('create_customer_order', baseOrderParams)");
    expect(orderRoute).not.toContain('offline_order_idempotency');
  });

  it('locks product rows in deterministic order and adds hot-path indexes', () => {
    expect(sql).toContain('ORDER BY p.id');
    expect(sql).toContain('FOR UPDATE;');
    expect(sql).toContain('idx_orders_vendor_updated_open');
    expect(sql).toContain('idx_umbrellas_vendor_number_active');
    expect(sql).toContain('idx_order_requests_vendor_created');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION consume_rate_limit');
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION consume_rate_limit');
  });

  it('is incremental and never deletes operational data', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE TABLE|DELETE FROM/);
  });
});
