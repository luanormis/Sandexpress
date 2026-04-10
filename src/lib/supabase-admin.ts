import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Supabase admin client with service role key.
 * Use ONLY in API routes (server-side). Never expose to the browser.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
