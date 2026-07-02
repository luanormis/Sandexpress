-- SANDEXPRESS - GRANTS SEGUROS PARA O BANCO ATUAL
-- Use no SQL Editor do Supabase se alguma rota retornar permission denied / 42501.
-- Nao apaga tabelas e nao altera dados.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- As rotas Next.js usam SUPABASE_SERVICE_ROLE_KEY no servidor.
-- A role service_role precisa enxergar e escrever nas tabelas via Data API.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- Leitura publica estritamente necessaria quando algum cliente Supabase direto for usado.
-- O app principal tambem passa pelo servidor, mas estes grants evitam quebra da Data API.
GRANT SELECT ON product_images TO anon, authenticated;
GRANT SELECT ON platform_settings TO anon, authenticated;

-- Tabelas usadas no cardapio publico permanecem protegidas por RLS/policies.
GRANT SELECT ON vendors TO anon, authenticated;
GRANT SELECT ON tenants TO anon, authenticated;
GRANT SELECT ON umbrellas TO anon, authenticated;
GRANT SELECT ON products TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;
  END IF;
END $$;
