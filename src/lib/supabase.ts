import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './supabase-env';
import { getSupabaseAnonKey } from './runtime-config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

export const supabase: any = createClient(supabaseUrl, supabaseAnonKey);
