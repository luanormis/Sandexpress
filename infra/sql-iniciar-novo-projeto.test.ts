import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(process.cwd(), 'infra/sql-iniciar-novo-projeto.sql'), 'utf8');
const sqlWithoutFunctionBodies = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi, '');

describe('sql-iniciar-novo-projeto', () => {
  it('starts without operational seed data for beaches, vendors, products, umbrellas or orders', () => {
    expect(sqlWithoutFunctionBodies).not.toMatch(/INSERT\s+INTO\s+beaches/i);
    expect(sqlWithoutFunctionBodies).not.toMatch(/INSERT\s+INTO\s+vendors/i);
    expect(sqlWithoutFunctionBodies).not.toMatch(/INSERT\s+INTO\s+products/i);
    expect(sqlWithoutFunctionBodies).not.toMatch(/INSERT\s+INTO\s+umbrellas/i);
    expect(sqlWithoutFunctionBodies).not.toMatch(/INSERT\s+INTO\s+orders/i);
    expect(sql).not.toContain('default_city');
    expect(sql).not.toContain('default_state');
    expect(sql).not.toContain('default_beach');
  });

  it('drops auxiliary and legacy tables before rebuilding from zero', () => {
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+tenant_features\s+CASCADE/i);
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+sessions\s+CASCADE/i);
    expect(sql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+users\s+CASCADE/i);
  });

  it('grants Data API access explicitly for service role and public image gallery reads', () => {
    expect(sql).toMatch(/GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+service_role/i);
    expect(sql).toMatch(/GRANT\s+SELECT\s+ON\s+product_images\s+TO\s+anon,\s*authenticated/i);
  });

  it('keeps generated QR URLs unique when they are stored', () => {
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+idx_umbrellas_qr_url_unique\s+ON\s+umbrellas\(qr_url\)\s+WHERE\s+qr_url\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/qr_path\s+TEXT/i);
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+idx_umbrellas_qr_path_unique\s+ON\s+umbrellas\(qr_path\)\s+WHERE\s+qr_path\s+IS\s+NOT\s+NULL/i);
  });

  it('supports physical stock, active beach stock and payment fee accounting', () => {
    expect(sql).toContain('stock_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    expect(sql).toContain('physical_stock_quantity INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('beach_stock_quantity INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain("payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash','pix','debit_card','credit_card'))");
    expect(sql).toContain('payment_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0');
    expect(sql).toContain('net_total NUMERIC(10,2) NOT NULL DEFAULT 0');
    expect(sql).toContain('debit_card_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0');
    expect(sql).toContain('credit_card_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0');
    expect(sql).toContain('pix_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0');
  });

  it('stores plan prices per vendor so future price changes do not rewrite existing clients', () => {
    expect(sql).toContain('plan_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 499.99');
    expect(sql).toContain('plan_annual_monthly_price NUMERIC(10,2) NOT NULL DEFAULT 299.99');
    expect(sql).toContain("'plans.current'");
    expect(sql).toContain('"monthly_price": 499.99');
    expect(sql).toContain('"annual_monthly_price": 299.99');
  });

  it('supports scalable kiosk branding without operational seed data', () => {
    expect(sql).toContain("button_color TEXT NOT NULL DEFAULT '#ff6b00'");
    expect(sql).toContain("button_text_color TEXT NOT NULL DEFAULT '#ffffff'");
    expect(sql).toMatch(/VALUES\s+\('kiosk-assets',\s*'kiosk-assets',\s*TRUE\)/i);
    expect(sql).toMatch(/CREATE\s+POLICY\s+kiosk_assets_storage_public_read/i);
    expect(sql).toContain('"button_color": "#ff6b00"');
    expect(sql).toContain('"button_text_color": "#ffffff"');
  });

  it('protects high concurrency order and rate-limit flows with database invariants', () => {
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+idx_orders_one_open_per_umbrella/i);
    expect(sql).toMatch(/WHERE\s+paid\s*=\s*FALSE\s+AND\s+status\s+IN\s+\('received',\s*'preparing',\s*'delivering',\s*'completed',\s*'closing_requested'\)/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+create_customer_order/i);
    expect(sql).toMatch(/FOR\s+UPDATE/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+close_customer_account/i);
    expect(sql).toMatch(/UPDATE\s+umbrellas[\s\S]*current_order_id\s*=\s*NULL/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+consume_rate_limit/i);
    expect(sql).toMatch(/ON\s+CONFLICT\s+\(key\)\s+DO\s+UPDATE/i);
  });
});
