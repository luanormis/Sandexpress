-- SandExpress - atualizacao QR Code por caminho publico
-- Use em projetos Supabase existentes antes de gerar novos QRs.

BEGIN;

ALTER TABLE umbrellas
  ADD COLUMN IF NOT EXISTS qr_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_umbrellas_qr_path_unique
  ON umbrellas(qr_path)
  WHERE qr_path IS NOT NULL;

COMMIT;
