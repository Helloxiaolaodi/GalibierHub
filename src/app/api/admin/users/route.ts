import { NextResponse } from "next/server";
import { getServiceSupabase, getSupabase, hasSupabaseServiceRole } from "@/utils/supabase";

type ProfileLike = {
  id: string;
  display_name?: string | null;
  email?: string | null;
  provider?: string | null;
  created_at?: string | null;
};

function providerFor(user: { app_metadata?: Record<string, unknown> | null; email?: string | null }): string {
  const provider = user.app_metadata?.provider;
  if (typeof provider === "string") return provider;
  return user.email ? "email" : "unknown";
}

export async function GET() {
  try {
    const sb = getSupabase();

    let totalUsers = 0;
    let githubUsers = 0;
    let emailUsers = 0;
    let usersThisWeek = 0;
    let recentSignups: ProfileLike[] = [];
    let note: string | undefined;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { count: profileCount, error: countError } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (!countError && typeof profileCount === "number") {
        totalUsers = profileCount;
      }

      const { count: weekCount, error: weekError } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo);
      if (!weekError && typeof weekCount === "number") {
        usersThisWeek = weekCount;
      }

      try {
        const { count: githubCount, error: githubError } = await sb
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("provider", "github");
        if (!githubError && typeof githubCount === "number") githubUsers = githubCount;
      } catch {
        // provider column may not exist
      }

      try {
        const { count: emailCount, error: emailError } = await sb
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .neq("provider", "github");
        if (!emailError && typeof emailCount === "number") emailUsers = emailCount;
      } catch {
        // provider column may not exist
      }

      try {
        const { data: profiles, error: profilesError } = await sb
          .from("profiles")
          .select("id, display_name, email, provider, created_at")
          .order("created_at", { ascending: false })
          .limit(10);
        if (!profilesError && profiles) {
          recentSignups = profiles as ProfileLike[];
        }
      } catch {
        try {
          const { data: profiles, error: profilesError } = await sb
            .from("profiles")
            .select("id, display_name, created_at")
            .order("created_at", { ascending: false })
            .limit(10);
          if (!profilesError && profiles) {
            recentSignups = profiles as ProfileLike[];
          }
        } catch {
          // profiles table may not exist
        }
      }
    } catch {
      note = "User counts require the profiles table with an auth trigger. Create public.profiles and a trigger on auth.users to populate it.";
    }

    if (totalUsers === 0 && hasSupabaseServiceRole) {
      try {
        const serviceSb = getServiceSupabase();
        const { data: authUsers, error: authError } = await serviceSb.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (!authError && authUsers?.users) {
          totalUsers = authUsers.users.length;
          authUsers.users.forEach((user) => {
            const provider = providerFor(user);
            if (provider === "github") githubUsers++;
            else if (provider === "email") emailUsers++;
            if (user.created_at && user.created_at >= weekAgo) usersThisWeek++;
          });
          recentSignups = authUsers.users.slice(0, 10).map((user) => {
            const provider = providerFor(user);
            return {
              id: user.id,
              display_name: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || null,
              email: user.email || null,
              provider,
              created_at: user.created_at || null,
            };
          });
          note = undefined;
        }
      } catch {
        // service role not available
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
      const { count: visitorCount, error: visitorCountError } = await sb
        .from("site_visitors")
        .select("*", { count: "exact", head: true });
      if (!visitorCountError && typeof visitorCount === "number") {
        totalVisitors = visitorCount;
      }
      const { data: visitors } = await sb
        .from("site_visitors")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(5);
      if (visitors) {
        recentVisitors = visitors as typeof recentVisitors;
      }
    } catch {
      // Silent fail
    }

    return NextResponse.json({
      total_users: totalUsers,
      github_users: githubUsers,
      email_users: emailUsers,
      users_this_week: usersThisWeek,
      total_discussions: totalDiscussions ?? 0,
      total_comments: totalComments ?? 0,
      total_downloads: totalDownloads,
      total_visitors: totalVisitors,
      recent_signups: recentSignups,
      recent_visitors: recentVisitors,
      note,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load admin stats" },
      { status: 500 },
    );
  }
}
