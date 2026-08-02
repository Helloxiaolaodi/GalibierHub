import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { getBearerToken } from "@/lib/feedback-admin";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sb = getSupabase();
  const { data: { user }, error: userError } = await sb.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const userId = user.id;
  const type = request.nextUrl.searchParams.get("type") || "all";

  let following: Array<Record<string, unknown>> = [];
  let followers: Array<Record<string, unknown>> = [];

  try {
    if (type === "all" || type === "following") {
      const { data: fRows, error: fErr } = await sb
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      if (!fErr && fRows) {
        const ids = [...new Set((fRows).map((r: Record<string, unknown>) => String(r.following_id)).filter(Boolean))];
        if (ids.length > 0) {
          const { data: profiles, error: pErr } = await sb
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", ids);
          if (!pErr && profiles) {
            const profileMap = new Map((profiles as Array<Record<string, unknown>>).map(p => [String(p.id), p]));
            following = ids.map(id => profileMap.get(id)).filter(Boolean) as Array<Record<string, unknown>>;
          }
        }
      }
    }

    if (type === "all" || type === "followers") {
      const { data: fRows, error: fErr } = await sb
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId);
      if (!fErr && fRows) {
        const ids = [...new Set((fRows).map((r: Record<string, unknown>) => String(r.follower_id)).filter(Boolean))];
        if (ids.length > 0) {
          const { data: profiles, error: pErr } = await sb
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", ids);
          if (!pErr && profiles) {
            const profileMap = new Map((profiles as Array<Record<string, unknown>>).map(p => [String(p.id), p]));
            followers = ids.map(id => profileMap.get(id)).filter(Boolean) as Array<Record<string, unknown>>;
          }
        }
      }
    }

    return NextResponse.json({ following, followers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}