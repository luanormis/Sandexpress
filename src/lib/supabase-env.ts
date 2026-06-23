export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL obrigatorio. Configure a URL real do projeto Supabase.');
  }

  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return value;
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL invalido. Use https://SEU-PROJETO.supabase.co.');
  }

  throw new Error('NEXT_PUBLIC_SUPABASE_URL invalido. Use https://SEU-PROJETO.supabase.co.');
}

export function isSupabaseUrlConfigured() {
  try {
    getSupabaseUrl();
    return true;
  } catch {
    return false;
  }
}
