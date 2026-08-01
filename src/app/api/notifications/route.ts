import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { getServiceSupabase, hasSupabaseServiceRole } from "@/utils/supabase";
import { getBearerToken } from "@/lib/feedback-admin";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabase();
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
  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabase();
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

  if (error && !error.message.includes("does not exist")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications: Array<{ id: string; discussion_id: string; actor_name: string; preview_text: string; is_read: boolean; created_at: string }> = [
    ...(data || []),
  ];
  const baseKeys = new Set(notifications.map((n) => `${n.discussion_id}:${n.preview_text}`));

  try {
    const { data: myPosts } = await sb.from("site_feedback").select("id").eq("user_id", user.id);
    const postIds = [...new Set((myPosts || []).map((post) => String(post.id)).filter(Boolean))];
    if (postIds.length > 0) {
      const { data: comments } = await sb.from("feedback_comments")
        .select("id, feedback_id, author_name, created_at")
        .in("feedback_id", postIds)
        .order("created_at", { ascending: false })
        .limit(50);
      for (const comment of comments || []) {
        const key = `${comment.feedback_id}:replied to your discussion`;
        if (!baseKeys.has(key)) {
          baseKeys.add(key);
          notifications.push({
            id: "reply-" + comment.id,
            discussion_id: comment.feedback_id,
            actor_name: comment.author_name || "Someone",
            preview_text: "replied to your discussion",
            is_read: false,
            created_at: comment.created_at,
          });
        }
      }

      const commentIds = [...new Set((comments || []).map((comment) => String(comment.id)).filter(Boolean))];
      const { data: entryReactions } = await sb.from("site_reactions")
        .select("entry_id")
        .eq("reaction_type", "like")
        .in("entry_id", postIds);
      for (const reaction of entryReactions || []) {
        const key = `${reaction.entry_id}:liked your post`;
        if (!baseKeys.has(key)) {
          baseKeys.add(key);
          notifications.push({
            id: "like-entry-" + reaction.entry_id,
            discussion_id: reaction.entry_id,
            actor_name: "Someone",
            preview_text: "liked your post",
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }

      if (commentIds.length > 0) {
        const { data: commentReactions } = await sb.from("site_reactions")
          .select("comment_id")
          .eq("reaction_type", "like")
          .in("comment_id", commentIds);
        const commentFeedbackMap = new Map((comments || []).map((comment) => [String(comment.id), comment.feedback_id]));
        for (const reaction of commentReactions || []) {
          const feedbackId = commentFeedbackMap.get(String(reaction.comment_id));
          if (!feedbackId) continue;
          const key = `${feedbackId}:liked your reply`;
          if (!baseKeys.has(key)) {
            baseKeys.add(key);
            notifications.push({
              id: "like-comment-" + reaction.comment_id,
              discussion_id: feedbackId,
              actor_name: "Someone",
              preview_text: "liked your reply",
              is_read: false,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {
    // Derived replies/likes are best-effort; base notifications are still returned.
  }

  notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json({ notifications: notifications.slice(0, 100) });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabase();
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
