import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabase-env';

/**
 * Supabase admin client with service role key.
 * Use ONLY in API routes (server-side). Never expose to the browser.
 */
const supabaseUrl = getSupabaseUrl();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'invalid-service-role';

export const supabaseAdmin: any = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
