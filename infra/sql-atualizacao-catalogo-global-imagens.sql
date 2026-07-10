-- SandExpress - Catalogo global de imagens administrado pelo admin.
-- Usa a tabela publica product_images e o bucket ja existente catalogo-global.

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalogo-global', 'catalogo-global', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

ALTER TABLE product_images
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS source_bucket TEXT NOT NULL DEFAULT 'catalogo-global',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'image/webp',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_product_images_active_category ON product_images(active, category, sort_order, name);
CREATE INDEX IF NOT EXISTS idx_product_images_tags ON product_images USING GIN(tags);

UPDATE product_images
SET tags = ARRAY(
      SELECT DISTINCT tag
      FROM unnest(ARRAY[
        LOWER(COALESCE(category, '')),
        LOWER(COALESCE(title, '')),
        LOWER(COALESCE(name, ''))
      ]) AS tag
      WHERE tag <> ''
    ),
    source_bucket = COALESCE(NULLIF(source_bucket, ''), 'catalogo-global'),
    mime_type = COALESCE(NULLIF(mime_type, ''), 'image/webp'),
    active = COALESCE(active, TRUE),
    updated_at = NOW()
WHERE tags = ARRAY[]::TEXT[] OR source_bucket IS NULL OR mime_type IS NULL OR active IS NULL;

DROP POLICY IF EXISTS catalogo_global_storage_public_read ON storage.objects;
CREATE POLICY catalogo_global_storage_public_read ON storage.objects
FOR SELECT USING (bucket_id = 'catalogo-global');

DROP POLICY IF EXISTS catalogo_global_storage_service_all ON storage.objects;
CREATE POLICY catalogo_global_storage_service_all ON storage.objects
FOR ALL USING (bucket_id = 'catalogo-global') WITH CHECK (bucket_id = 'catalogo-global');

GRANT SELECT ON product_images TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_images TO service_role;
