import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabase-env';
import { getSupabaseServiceRoleKey } from './runtime-config';

/**
 * Supabase admin client with service role key.
 * Use ONLY in API routes (server-side). Never expose to the browser.
 */
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = getSupabaseServiceRoleKey();

export const supabaseAdmin: any = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
