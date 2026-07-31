import { NextRequest, NextResponse } from "next/server";
import { getBearerToken, requireCreatorGithubAuth } from "@/lib/feedback-admin";
import { getServiceSupabase, hasSupabaseServiceRole } from "@/utils/supabase";

type BadgeRow = {
  badge_id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  category: string;
  criteria: string;
  manual_only: boolean;
  total_holders: number;
  last_awarded_at: string | null;
};

type ProfileMatch = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

export async function GET(request: NextRequest) {
  const adminAuth = await requireCreatorGithubAuth(getBearerToken(request));
  if (!adminAuth.ok) {
    return NextResponse.json({ error: adminAuth.error }, { status: 401 });
  }

  if (!hasSupabaseServiceRole) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for admin badge statistics." }, { status: 503 });
  }

  const sb = getServiceSupabase();
  const query = (request.nextUrl.searchParams.get("query") || "").trim();
  const badgeId = (request.nextUrl.searchParams.get("badge_id") || "").trim();

  if (query) {
    const escaped = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const { data, error } = await sb
      .from("profiles")
      .select("id, username, display_name, email, avatar_url, created_at")
      .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: (data || []) as ProfileMatch[] });
  }

  if (badgeId) {
    const { data: holders, error: holdersError } = await sb
      .from("user_badges")
      .select("user_id, awarded_at, profiles(id, username, display_name, avatar_url)")
      .eq("badge_id", badgeId)
      .order("awarded_at", { ascending: false })
      .limit(100);

    if (holdersError) {
      return NextResponse.json({ error: holdersError.message }, { status: 500 });
    }

    return NextResponse.json({ holders: holders || [] });
  }

  const { data: rows, error: viewError } = await sb
    .from("admin_badge_stats")
    .select("*")
    .order("tier", { ascending: false });

  if (viewError) {
    return NextResponse.json(
      { error: viewError.message.includes("does not exist") ? "Badge analytics view has not been deployed yet." : viewError.message },
      { status: 500 },
    );
  }

  const definitions = (rows || []).map((row: Record<string, unknown>) => ({
    ...row,
    total_holders: Number(row.total_holders || 0),
  })) as BadgeRow[];

  const { count: totalUsers, error: userCountError } = await sb
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (userCountError) {
    return NextResponse.json({ error: userCountError.message }, { status: 500 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: awardedThisWeek, error: weekError } = await sb
    .from("user_badges")
    .select("*", { count: "exact", head: true })
    .gte("awarded_at", weekAgo);
  if (weekError) {
    return NextResponse.json({ error: weekError.message }, { status: 500 });
  }

  const { data: allBadges, error: holdersError } = await sb
    .from("user_badges")
    .select("user_id");
  if (holdersError) {
    return NextResponse.json({ error: holdersError.message }, { status: 500 });
  }

  const activeCollectors = new Set((allBadges || []).map((item: { user_id: string }) => item.user_id)).size;
  const totalAwarded = definitions.reduce((sum, badge) => sum + badge.total_holders, 0);
  const unlocked = definitions.filter((badge) => badge.total_holders > 0);
  const automatic = definitions.filter((badge) => !badge.manual_only);
  const mostUnlocked = unlocked.length
    ? unlocked.reduce((best, badge) => (badge.total_holders > best.total_holders ? badge : best), unlocked[0])
    : null;
  const rarestArtifact = automatic.length
    ? automatic.reduce((best, badge) => (badge.total_holders < best.total_holders ? badge : best), automatic[0])
    : null;

  const rarityOrder = ["platinum", "gold", "silver", "bronze"];
  const rarityDistribution = rarityOrder.map((tier) => ({
    tier,
    holders: definitions.filter((badge) => badge.tier === tier).reduce((sum, badge) => sum + badge.total_holders, 0),
  })).filter((item) => item.holders > 0);

  return NextResponse.json({
    total_awarded: totalAwarded,
    awarded_this_week: awardedThisWeek || 0,
    total_users: totalUsers || 0,
    active_collectors: activeCollectors,
    active_collector_rate: totalUsers ? activeCollectors / totalUsers : 0,
    most_unlocked: mostUnlocked,
    rarest_artifact: rarestArtifact,
    rarity_distribution: rarityDistribution,
    definitions,
  });
}
