-- Ajustes incrementais para escala multi-tenant e limpeza de OTP.
-- Aplicar em projetos existentes antes do deploy.

CREATE INDEX IF NOT EXISTS idx_orders_vendor_paid_status_created
  ON orders(vendor_id, paid, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_customer_open
  ON orders(vendor_id, customer_id, created_at DESC)
  WHERE paid = FALSE;

CREATE INDEX IF NOT EXISTS idx_order_items_order_product
  ON order_items(order_id, product_id);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_status_expires
  ON otp_challenges(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_used_at
  ON otp_challenges(used_at)
  WHERE used_at IS NOT NULL;

CREATE OR REPLACE FUNCTION cleanup_otp_challenges(retention_minutes INTEGER DEFAULT 10)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM otp_challenges
  WHERE expires_at < NOW()
     OR used_at < NOW() - make_interval(mins => GREATEST(retention_minutes, 1))
     OR status IN ('expired', 'blocked');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION cleanup_otp_challenges(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_otp_challenges(INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'cron'
  ) AND NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-otp-challenges-10m'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-otp-challenges-10m',
      '*/10 * * * *',
      'SELECT public.cleanup_otp_challenges(10);'
    );
  END IF;
END;
$$;

ANALYZE orders;
ANALYZE order_items;
ANALYZE otp_challenges;
