-- SandExpress - libera margem administrativa ate 120 guarda-sois.
-- Incremental e idempotente: execute mesmo se a migracao de escala para 100 ja foi aplicada.
-- Nao apaga tabelas nem dados. O padrao comercial continua sendo 100.

BEGIN;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS max_umbrellas INTEGER NOT NULL DEFAULT 100;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'vendors'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%max_umbrellas%'
  LOOP
    EXECUTE format('ALTER TABLE public.vendors DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE vendors ALTER COLUMN max_umbrellas SET DEFAULT 100;
UPDATE vendors SET max_umbrellas = 100 WHERE max_umbrellas IS NULL OR max_umbrellas = 50;
UPDATE vendors SET max_umbrellas = 120 WHERE max_umbrellas > 120;

ALTER TABLE vendors
  ADD CONSTRAINT vendors_max_umbrellas_admin_check
  CHECK (max_umbrellas BETWEEN 1 AND 120) NOT VALID;
ALTER TABLE vendors VALIDATE CONSTRAINT vendors_max_umbrellas_admin_check;

CREATE OR REPLACE FUNCTION enforce_vendor_umbrella_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vendor_limit INTEGER;
  current_count INTEGER;
BEGIN
  SELECT LEAST(120, COALESCE(max_umbrellas, 100))
  INTO vendor_limit
  FROM vendors
  WHERE id = NEW.vendor_id
  FOR UPDATE;

  IF vendor_limit IS NULL THEN
    RAISE EXCEPTION 'Quiosque nao encontrado.';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM umbrellas
  WHERE vendor_id = NEW.vendor_id;

  IF current_count >= vendor_limit THEN
    RAISE EXCEPTION 'Limite de % guarda-sois autorizado para o quiosque atingido.', vendor_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_umbrella_limit ON umbrellas;
CREATE TRIGGER trg_enforce_vendor_umbrella_limit
BEFORE INSERT ON umbrellas
FOR EACH ROW EXECUTE FUNCTION enforce_vendor_umbrella_limit();

COMMENT ON COLUMN vendors.max_umbrellas IS
  'Limite individual autorizado pelo admin. Padrao 100; teto tecnico 120.';

COMMIT;
