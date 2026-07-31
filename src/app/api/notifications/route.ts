import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { getBearerToken } from "@/lib/feedback-admin";

export async function POST(request: NextRequest) {
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

  let body: { recipient_id?: string; discussion_id?: string; actor_name?: string; preview_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.recipient_id || !body.actor_name) {
    return NextResponse.json({ error: "recipient_id and actor_name are required" }, { status: 400 });
  }

  const { error: insertError } = await sb
    .from("site_notifications")
    .insert({
      recipient_id: body.recipient_id,
      discussion_id: body.discussion_id || null,
      actor_name: body.actor_name,
      preview_text: body.preview_text || "",
      is_read: false,
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Get user from token using Supabase
  const sb = getSupabase();
  const { data: { user }, error: userError } = await sb.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data, error } = await sb
    .from("site_notifications")
    .select("id, discussion_id, actor_name, preview_text, is_read, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // Table might not exist yet
    if (error.message.includes("does not exist")) {
      return NextResponse.json({ notifications: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications: data || [] });
}

export async function PATCH(request: NextRequest) {
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

  let body: { id?: string; is_read?: boolean; mark_all_read?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.mark_all_read) {
    const { error } = await sb
      .from("site_notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Notification id is required" }, { status: 400 });
  }

  const { error } = await sb
    .from("site_notifications")
    .update({ is_read: body.is_read ?? true })
    .eq("id", body.id)
    .eq("recipient_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
