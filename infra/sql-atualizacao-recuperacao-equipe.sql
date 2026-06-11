-- SandExpress - atualizacao segura para recuperacao de senha por email e usuarios da equipe
-- Use este arquivo quando o banco ja foi criado com infra/sql-iniciar-novo-projeto.sql.
-- Ele nao apaga dados.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_needs_reset BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS owner_email_verification_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vendors_owner_email_verification ON vendors(owner_email_verification_token);

CREATE TABLE IF NOT EXISTS vendor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  login TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('owner', 'manager', 'seller')),
  password_hash TEXT NOT NULL,
  password_needs_reset BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_users_vendor ON vendor_users(vendor_id, active);
CREATE INDEX IF NOT EXISTS idx_vendor_users_login ON vendor_users(login);

DROP TRIGGER IF EXISTS trg_vendor_users_updated_at ON vendor_users;
CREATE TRIGGER trg_vendor_users_updated_at BEFORE UPDATE ON vendor_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE vendor_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vendor_users'
      AND policyname = 'service_only_vendor_users'
  ) THEN
    CREATE POLICY service_only_vendor_users ON vendor_users FOR ALL USING (FALSE) WITH CHECK (FALSE);
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON vendor_users TO service_role;

ANALYZE vendor_users;
