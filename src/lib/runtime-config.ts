const UNSAFE_SECRET_VALUES = new Set([
  '95732',
  'sandexpress-mvp-session-secret-change-this-in-vercel',
  'invalid-anon-key',
  'invalid-service-role',
]);

type SecretOptions = {
  minLength?: number;
};

export function rejectUnsafeSecret(name: string, value: string | undefined, options: SecretOptions = {}) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${name} obrigatorio. Configure um valor real no ambiente.`);
  }
  if (UNSAFE_SECRET_VALUES.has(normalized)) {
    throw new Error(`${name} usa valor local/falso. Configure um valor real antes de iniciar.`);
  }
  if (options.minLength && normalized.length < options.minLength) {
    throw new Error(`${name} deve ter pelo menos ${options.minLength} caracteres.`);
  }
  return normalized;
}

export function getRequiredEnvValue(name: string, options: SecretOptions = {}) {
  return rejectUnsafeSecret(name, process.env[name], options);
}

export function getAdminPassword() {
  return getRequiredEnvValue('ADMIN_PASSWORD', { minLength: 8 });
}

export function getSessionSecret() {
  return rejectUnsafeSecret(
    'SESSION_SECRET',
    process.env.SESSION_SECRET || process.env.VENDOR_JWT_SECRET,
    { minLength: 32 }
  );
}

export function getSupabaseAnonKey() {
  return getRequiredEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', { minLength: 32 });
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnvValue('SUPABASE_SERVICE_ROLE_KEY', { minLength: 32 });
}
