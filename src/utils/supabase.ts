import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isConfiguredKey(value: string, placeholderFragments: string[]): boolean {
  return !!value && !placeholderFragments.some((fragment) => value.includes(fragment));
}

/** Check whether Supabase credentials are configured (non-placeholder). */
export const isSupabaseConfigured =
  !!supabaseUrl &&
  isConfiguredKey(supabaseAnonKey, ["your_anon_key"]) &&
  !supabaseUrl.includes("your-project") &&
  !supabaseUrl.includes("your-project-ref");

export const hasSupabaseServiceRole =
  !!supabaseUrl &&
  isConfiguredKey(supabaseServiceRoleKey, ["your_service_role_key"]);

let _supabase: SupabaseClient | null = null;
let _supabaseService: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}

export function getServiceSupabase(): SupabaseClient {
  if (!hasSupabaseServiceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged server-side writes.");
  }
  if (!_supabaseService) {
    _supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseService;
}
