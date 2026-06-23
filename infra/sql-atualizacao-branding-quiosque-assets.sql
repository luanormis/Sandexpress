-- SandExpress - atualizacao de branding por quiosque e bucket de assets
-- Rode no SQL Editor do Supabase quando o projeto ja existir.

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#ff6b00',
  ADD COLUMN IF NOT EXISTS button_text_color TEXT NOT NULL DEFAULT '#ffffff';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#ff6b00',
  ADD COLUMN IF NOT EXISTS button_text_color TEXT NOT NULL DEFAULT '#ffffff';

UPDATE tenants
SET
  button_color = COALESCE(NULLIF(button_color, ''), primary_color, '#ff6b00'),
  button_text_color = COALESCE(NULLIF(button_text_color, ''), '#ffffff');

UPDATE vendors
SET
  button_color = COALESCE(NULLIF(button_color, ''), primary_color, '#ff6b00'),
  button_text_color = COALESCE(NULLIF(button_text_color, ''), '#ffffff');

INSERT INTO storage.buckets (id, name, public)
VALUES ('kiosk-assets', 'kiosk-assets', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS kiosk_assets_storage_public_read ON storage.objects;
DROP POLICY IF EXISTS kiosk_assets_storage_service_all ON storage.objects;

CREATE POLICY kiosk_assets_storage_public_read
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'kiosk-assets');

CREATE POLICY kiosk_assets_storage_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'kiosk-assets')
  WITH CHECK (bucket_id = 'kiosk-assets');

INSERT INTO platform_settings (key, value, description) VALUES
(
  'default.vendor',
  '{
    "primary_color": "#ff6b00",
    "secondary_color": "#82533f",
    "button_color": "#ff6b00",
    "button_text_color": "#ffffff",
    "logo_url": "/logo-sandexpress.png"
  }'::jsonb,
  'Defaults usados para criacao de novos quiosques.'
)
ON CONFLICT (key) DO UPDATE
SET value = platform_settings.value
  || jsonb_build_object(
    'button_color', COALESCE(platform_settings.value->>'button_color', '#ff6b00'),
    'button_text_color', COALESCE(platform_settings.value->>'button_text_color', '#ffffff')
  ),
  updated_at = NOW();

COMMIT;
