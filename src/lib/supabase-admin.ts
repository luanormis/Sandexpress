import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Supabase admin client with service role key.
 * Use ONLY in API routes (server-side). Never expose to the browser.
 */
/** Sem URL/chave reais as rotas de API falham ao consultar o banco — configure no deploy. */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://invalid.local';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'invalid-service-role';

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
