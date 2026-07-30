import { NextResponse } from "next/server";
import { getSupabase } from "@/utils/supabase";

export async function GET() {
  try {
    const sb = getSupabase();

    // Try to get registered user count from auth.users via RPC or direct query
    // This requires the service_role key for admin access
    let totalUsers = 0;
    let githubUsers = 0;
    let emailUsers = 0;
    let recentSignups: Array<{ id: string; email: string; created_at: string; provider: string }> = [];

    try {
      // Try getting user metadata from a profiles table if it exists
      const { data: profiles, error: profilesError } = await sb
        .from("profiles")
        .select("id, email, provider, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!profilesError && profiles) {
        totalUsers = profiles.length;
        profiles.forEach((p) => {
          if (p.provider === "github") githubUsers++;
          else emailUsers++;
        });
        recentSignups = profiles.slice(0, 10) as typeof recentSignups;
      }
    } catch {
      // profiles table may not exist, fall back gracefully
    }

    // If we can't get from profiles, try supabase auth admin
    if (totalUsers === 0) {
      try {
        const { data: authUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
        // This won't work without service role key, so we try the safe approach
      } catch {
        // Silent fail - admin access requires service_role key
      }
    }

    // Get discussion counts
    const { count: totalDiscussions } = await sb
      .from("site_feedback")
      .select("*", { count: "exact", head: true })
      .eq("visibility", "public");

    const { count: totalComments } = await sb
      .from("feedback_comments")
      .select("*", { count: "exact", head: true });

    // Get download stats
    let totalDownloads = 0;
    try {
      const { data: dlMeta } = await sb
        .from("download_metadata")
        .select("download_count");
      if (dlMeta) {
        totalDownloads = dlMeta.reduce((sum, row) => sum + (row.download_count || 0), 0);
      }
    } catch {
      // download_metadata table may not exist
    }

    // Get visitor stats
    let totalVisitors = 0;
    let recentVisitors: Array<{ id: string; ip: string; path: string; timestamp: string }> = [];
    try {
      const { data: visitors } = await sb
        .from("site_visitors")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(10);
      if (visitors) {
        totalVisitors = visitors.length;
        recentVisitors = visitors as typeof recentVisitors;
      }
    } catch {
      // Silent fail
    }

    return NextResponse.json({
      total_users: totalUsers,
      github_users: githubUsers,
      email_users: emailUsers,
      total_discussions: totalDiscussions ?? 0,
      total_comments: totalComments ?? 0,
      total_downloads: totalDownloads,
      total_visitors: totalVisitors,
      recent_signups: recentSignups,
      recent_visitors: recentVisitors,
      note: totalUsers === 0
        ? "User counts require the profiles table with an auth trigger. Create public.profiles and a trigger on auth.users to populate it."
        : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load admin stats" },
      { status: 500 },
    );
  }
}
