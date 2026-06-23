-- Atualizacao: tema por tenant/quiosque
-- Execute este arquivo em bancos ja existentes antes de usar a aba Personalizacao.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#ff6b00',
  ADD COLUMN IF NOT EXISTS button_text_color TEXT NOT NULL DEFAULT '#ffffff';

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#ff6b00',
  ADD COLUMN IF NOT EXISTS button_text_color TEXT NOT NULL DEFAULT '#ffffff';

ALTER TABLE tenants
  ALTER COLUMN primary_color SET DEFAULT '#ff6b00',
  ALTER COLUMN secondary_color SET DEFAULT '#82533f',
  ALTER COLUMN button_color SET DEFAULT '#ff6b00',
  ALTER COLUMN button_text_color SET DEFAULT '#ffffff',
  ALTER COLUMN logo_url SET DEFAULT '/logo-sandexpress.png';

ALTER TABLE vendors
  ALTER COLUMN primary_color SET DEFAULT '#ff6b00',
  ALTER COLUMN secondary_color SET DEFAULT '#82533f',
  ALTER COLUMN button_color SET DEFAULT '#ff6b00',
  ALTER COLUMN button_text_color SET DEFAULT '#ffffff',
  ALTER COLUMN logo_url SET DEFAULT '/logo-sandexpress.png';

UPDATE tenants
SET primary_color = '#ff6b00'
WHERE primary_color IS NULL OR lower(primary_color) = '#ff7a1a';

UPDATE tenants
SET secondary_color = '#82533f'
WHERE secondary_color IS NULL OR lower(secondary_color) = '#0f3d4f';

UPDATE tenants
SET button_color = COALESCE(NULLIF(button_color, ''), primary_color, '#ff6b00'),
    button_text_color = COALESCE(NULLIF(button_text_color, ''), '#ffffff');

UPDATE tenants
SET logo_url = '/logo-sandexpress.png'
WHERE logo_url IS NULL OR btrim(logo_url) = '';

UPDATE vendors
SET primary_color = '#ff6b00'
WHERE primary_color IS NULL OR lower(primary_color) = '#ff7a1a';

UPDATE vendors
SET secondary_color = '#82533f'
WHERE secondary_color IS NULL OR lower(secondary_color) = '#0f3d4f';

UPDATE vendors
SET button_color = COALESCE(NULLIF(button_color, ''), primary_color, '#ff6b00'),
    button_text_color = COALESCE(NULLIF(button_text_color, ''), '#ffffff');

UPDATE vendors
SET logo_url = '/logo-sandexpress.png'
WHERE logo_url IS NULL OR btrim(logo_url) = '';

UPDATE tenants AS tenant
SET
  primary_color = COALESCE(vendor.primary_color, tenant.primary_color, '#ff6b00'),
  secondary_color = COALESCE(vendor.secondary_color, tenant.secondary_color, '#82533f'),
  button_color = COALESCE(vendor.button_color, tenant.button_color, vendor.primary_color, tenant.primary_color, '#ff6b00'),
  button_text_color = COALESCE(vendor.button_text_color, tenant.button_text_color, '#ffffff'),
  logo_url = COALESCE(vendor.logo_url, tenant.logo_url, '/logo-sandexpress.png')
FROM vendors AS vendor
WHERE vendor.tenant_id = tenant.id
  AND (
    tenant.primary_color IS NULL
    OR tenant.secondary_color IS NULL
    OR tenant.button_color IS NULL
    OR tenant.button_text_color IS NULL
    OR tenant.logo_url IS NULL
  );

ALTER TABLE tenants
  ALTER COLUMN secondary_color SET NOT NULL,
  ALTER COLUMN button_color SET NOT NULL,
  ALTER COLUMN button_text_color SET NOT NULL;
