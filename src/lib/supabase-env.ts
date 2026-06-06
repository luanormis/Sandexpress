const FALLBACK_SUPABASE_URL = 'https://invalid.supabase.co';

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return FALLBACK_SUPABASE_URL;

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return value;
  } catch {
    // The health route reports the exact setup problem without breaking build.
  }

  return FALLBACK_SUPABASE_URL;
}

export function isSupabaseUrlConfigured() {
  return getSupabaseUrl() !== FALLBACK_SUPABASE_URL;
}
