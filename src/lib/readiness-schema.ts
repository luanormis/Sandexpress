export type RequiredSchemaCheck = {
  table: string;
  column: string;
};

export const REQUIRED_SCHEMA_CHECKS: RequiredSchemaCheck[] = [
  { table: 'tenants', column: 'id' },
  { table: 'beaches', column: 'id' },
  { table: 'vendors', column: 'id' },
  { table: 'vendors', column: 'plan_monthly_price' },
  { table: 'vendors', column: 'plan_annual_monthly_price' },
  { table: 'vendor_users', column: 'id' },
  { table: 'customers', column: 'id' },
  { table: 'umbrellas', column: 'id' },
  { table: 'products', column: 'id' },
  { table: 'products', column: 'stock_tracking_enabled' },
  { table: 'products', column: 'physical_stock_quantity' },
  { table: 'products', column: 'beach_stock_quantity' },
  { table: 'products', column: 'stock_quantity' },
  { table: 'products', column: 'blocked_by_stock' },
  { table: 'product_images', column: 'id' },
  { table: 'orders', column: 'id' },
  { table: 'order_items', column: 'id' },
  { table: 'daily_closings', column: 'id' },
  { table: 'terms_acceptances', column: 'id' },
  { table: 'account_adjustments', column: 'id' },
  { table: 'customer_satisfaction_surveys', column: 'id' },
  { table: 'vendor_plans', column: 'id' },
  { table: 'tenant_features', column: 'id' },
  { table: 'rate_limit_buckets', column: 'key' },
  { table: 'otp_challenges', column: 'id' },
  { table: 'analytics_events', column: 'id' },
  { table: 'platform_settings', column: 'key' },
  { table: 'platform_settings', column: 'value' },
];
