import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserSupabase: SupabaseClient | null = null;
let initAttempted = false;

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    initAttempted = true;
  }

  return browserSupabase;
}

// Eagerly initialize on module load so OAuth redirect tokens are captured
if (typeof window !== 'undefined') {
  getBrowserSupabase();
}
