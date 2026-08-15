-- RESET DE PRODUCAO: apaga dados operacionais antigos e preserva a biblioteca de imagens.
-- Preservados:
--   public.product_images
--   public.platform_settings
--   todos os objetos do Supabase Storage (catalogo-global, product-images, kiosk-assets etc.)
--
-- Execute somente no projeto correto do Supabase. Esta operacao nao pode ser desfeita sem backup.

begin;

do $$
declare
  table_name text;
  reset_tables constant text[] := array[
    'account_adjustments',
    'analytics_events',
    'customer_order_requests',
    'customer_otps',
    'customer_push_tokens',
    'customer_satisfaction_surveys',
    'daily_closings',
    'order_idempotency_keys',
    'order_items',
    'orders',
    'otp_challenges',
    'payment_method_rates',
    'payment_receivables',
    'product_categories',
    'products',
    'promocao_itens',
    'promocao_push_queue',
    'promocoes',
    'rate_limit_buckets',
    'service_calls',
    'sessions',
    'sessoes_quiosque',
    'terms_acceptances',
    'tenant_features',
    'umbrellas',
    'vendor_plans',
    'vendor_users',
    'customers',
    'vendors',
    'users',
    'tenants',
    'beaches'
  ];
begin
  foreach table_name in array reset_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format('truncate table public.%I restart identity cascade', table_name);
    end if;
  end loop;
end
$$;

commit;

-- Verificacao: imagens e configuracoes globais permanecem; operacao deve retornar zero.
select
  (select count(*) from public.product_images) as imagens_preservadas,
  case when to_regclass('public.platform_settings') is null then null
       else (select count(*) from public.platform_settings) end as configuracoes_preservadas,
  (select count(*) from public.tenants) as tenants_restantes,
  (select count(*) from public.vendors) as quiosques_restantes,
  (select count(*) from public.products) as produtos_restantes,
  (select count(*) from public.customers) as clientes_restantes,
  (select count(*) from public.orders) as pedidos_restantes;
