-- Keeps the registered headcount on each bill, independently of future visits.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS party_size integer;

-- Only open bills can be backfilled reliably from the current customer visit.
UPDATE public.orders AS o
SET party_size = LEAST(50, GREATEST(1, COALESCE(c.party_size, 1)))
FROM public.customers AS c
WHERE o.customer_id = c.id
  AND o.vendor_id = c.vendor_id
  AND o.paid = false
  AND o.party_size IS NULL;

UPDATE public.orders SET party_size = 1 WHERE party_size IS NULL;
ALTER TABLE public.orders ALTER COLUMN party_size SET DEFAULT 1;
ALTER TABLE public.orders ALTER COLUMN party_size SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_party_size_range'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_party_size_range
      CHECK (party_size BETWEEN 1 AND 50);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
