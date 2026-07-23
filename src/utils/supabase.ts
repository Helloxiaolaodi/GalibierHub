import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

/** Check whether Supabase credentials are configured (non-placeholder). */
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseServerKey &&
  !supabaseUrl.includes("your-project") &&
  !supabaseServerKey.includes("your_anon_key") &&
  !supabaseServerKey.includes("your_service_role_key");

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseServerKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}
