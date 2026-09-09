-- Revise em homologação antes de executar no Supabase SQL Editor.
-- service_role permanece exclusivamente no servidor e ignora RLS.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.jwt_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid $$;

CREATE OR REPLACE FUNCTION public.jwt_vendor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'vendor_id', '')::uuid $$;

REVOKE ALL ON FUNCTION public.jwt_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jwt_vendor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jwt_tenant_id(), public.jwt_vendor_id() TO authenticated;

DROP POLICY IF EXISTS tenant_products_access ON products;
CREATE POLICY tenant_products_access ON products FOR ALL TO authenticated
USING (tenant_id = public.jwt_tenant_id() AND vendor_id = public.jwt_vendor_id())
WITH CHECK (tenant_id = public.jwt_tenant_id() AND vendor_id = public.jwt_vendor_id());

DROP POLICY IF EXISTS tenant_orders_access ON orders;
CREATE POLICY tenant_orders_access ON orders FOR ALL TO authenticated
USING (tenant_id = public.jwt_tenant_id() AND vendor_id = public.jwt_vendor_id())
WITH CHECK (tenant_id = public.jwt_tenant_id() AND vendor_id = public.jwt_vendor_id());

DROP POLICY IF EXISTS tenant_order_items_access ON order_items;
CREATE POLICY tenant_order_items_access ON order_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.tenant_id = public.jwt_tenant_id() AND o.vendor_id = public.jwt_vendor_id()))
WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.tenant_id = public.jwt_tenant_id() AND o.vendor_id = public.jwt_vendor_id()));

