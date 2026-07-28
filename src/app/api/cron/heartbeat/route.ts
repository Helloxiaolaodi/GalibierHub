import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

// ============================================================
// Vercel Cron: Supabase Keep-Alive
// ============================================================
// Free Supabase projects auto-suspend after 7 days of inactivity.
// This endpoint is called by Vercel Cron (daily) to run a trivial
// SELECT query, keeping the database from freezing.
//
// Setup: Add this to vercel.json:
//   {
//     "crons": [{
//       "path": "/api/cron/heartbeat",
//       "schedule": "0 6 * * *"
//     }]
//   }
//
// The cron job runs via a GET request secured by a shared secret.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Authenticate cron request
  const authHeader = request.headers.get("authorization");
  if (
    CRON_SECRET &&
    (!authHeader || authHeader !== "Bearer " + CRON_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { status: "skipped", reason: "Supabase not configured" },
      { status: 200 },
    );
  }

  try {
    const sb = getSupabase();
    const { error } = await sb
      .from("genome_samples")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
