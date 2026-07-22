import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Check whether Supabase credentials are configured (non-placeholder). */
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes("your-project") &&
  !supabaseAnonKey.includes("your_anon_key");

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}
