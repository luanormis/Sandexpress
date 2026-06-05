import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://invalid.local';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'invalid-anon-key';

export const supabase: any = createClient(supabaseUrl, supabaseAnonKey);
