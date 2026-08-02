import { NextRequest, NextResponse } from "next/server";
import {
  getServiceSupabase,
  getSupabaseWithAuth,
  hasSupabaseServiceRole,
  isSupabaseConfigured,
} from "@/utils/supabase";
import { getBearerToken } from "@/lib/feedback-admin";

type NotificationKind = "general" | "replies" | "likes";

type NotificationItem = {
  id: string;
  discussion_id: string;
  actor_name: string;
  preview_text: string;
  is_read: boolean;
  created_at: string;
  kind?: NotificationKind;
  message?: string;
  title?: string;
  comment_id?: string;
};

function notificationKind(notification: {
  id: string;
  discussion_id: string;
  preview_text: string;
}): NotificationKind {
  const id = (notification.id || "").toLowerCase();
  const text = (notification.preview_text || "").toLowerCase();
  if (id.startsWith("like-") || text.includes("liked your")) return "likes";
  if (
    id.startsWith("reply-") ||
    text.includes("mention") ||
    (notification.discussion_id && !text.includes("badge") && !text.includes("follow"))
  ) {
    return "replies";
  }
  return "general";
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabaseWithAuth(token);
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
  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabaseWithAuth(token);
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

  const notifications: NotificationItem[] = (data || []).map((n) => ({
    ...n,
    discussion_id: n.discussion_id ? String(n.discussion_id) : "",
  }));
  const baseIds = new Set(notifications.map((n) => n.id));

  try {
    const { data: myPosts } = await sb.from("site_feedback").select("id, title").eq("user_id", user.id);
    const postIds = [...new Set((myPosts || []).map((post) => String(post.id)).filter(Boolean))];
    const { data: authoredComments } = await sb.from("feedback_comments")
      .select("id, feedback_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const myComments = (authoredComments || []) as Array<{ id: unknown; feedback_id: unknown }>;
    const myCommentIds = [...new Set(
      myComments.map((comment) => (comment.id ? String(comment.id) : "")).filter(Boolean),
    )];
    const allFeedbackIds = [...new Set([
      ...postIds,
      ...myComments.map((comment) => (comment.feedback_id ? String(comment.feedback_id) : "")).filter(Boolean),
    ])];
    const titleMap = new Map<string, string>();
    if (allFeedbackIds.length > 0) {
      const { data: threads } = await sb.from("site_feedback").select("id, title").in("id", allFeedbackIds);
      for (const thread of threads || []) {
        titleMap.set(String(thread.id), String((thread as { title?: unknown }).title || "Your discussion"));
      }
    }
    if (postIds.length > 0) {
      const { data: comments } = await sb.from("feedback_comments")
        .select("id, feedback_id, author_name, message, created_at")
        .in("feedback_id", postIds)
        .order("created_at", { ascending: false })
        .limit(50);

      for (const n of notifications) {
        if (n.discussion_id && !n.title) {
          n.title = titleMap.get(n.discussion_id) || n.title;
        }
        if (n.discussion_id && !n.comment_id && !n.message) {
          const prefix = (n.preview_text || "").replace(/\.\.\.\s*$/, "").trim();
          if (prefix) {
            const match = (comments || []).find(
              (c) => String(c.feedback_id) === n.discussion_id && String(c.message || "").startsWith(prefix),
            );
            if (match) {
              n.comment_id = String(match.id);
              n.message = String(match.message || "");
              n.title = titleMap.get(n.discussion_id) || n.title;
            }
          }
        }
      }

      for (const comment of comments || []) {
        const feedbackId = String(comment.feedback_id);
        const message = typeof comment.message === "string" ? comment.message : "";
        const duplicateReply = notifications.some(
          (n) => n.discussion_id === feedbackId &&
            n.actor_name === (comment.author_name || "Someone") &&
            n.preview_text?.startsWith(message.slice(0, 20)),
        );
        const id = "reply-" + comment.id;
        if (!baseIds.has(id) && !duplicateReply) {
          baseIds.add(id);
          notifications.push({
            id,
            discussion_id: feedbackId,
            actor_name: comment.author_name || "Someone",
            preview_text: "replied to your discussion",
            message,
            title: titleMap.get(feedbackId) || "Your discussion",
            comment_id: String(comment.id),
            kind: "replies",
            is_read: false,
            created_at: comment.created_at,
          });
        }
      }
    }

    const { data: entryReactions } = postIds.length > 0
      ? await sb.from("site_reactions")
          .select("id, entry_id, created_at, user_id")
          .eq("reaction_type", "like")
          .in("entry_id", postIds)
      : { data: null };
    let commentReactions: Array<{ id: string; comment_id: string; created_at?: string; user_id?: string | null }> = [];
    if (myCommentIds.length > 0) {
      const { data } = await sb.from("site_reactions")
        .select("id, comment_id, created_at, user_id")
        .eq("reaction_type", "like")
        .in("comment_id", myCommentIds);
      commentReactions = (data || []) as typeof commentReactions;
    }
    const actorIds = [
      ...new Set([
        ...(entryReactions || []).map((r) => r.user_id),
        ...commentReactions.map((r) => r.user_id),
      ].filter(Boolean).map(String)),
    ];
    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: actorProfiles } = await sb
        .from("profiles")
        .select("id, display_name, username")
        .in("id", actorIds);
      for (const profile of actorProfiles || []) {
        actorNames.set(
          String(profile.id),
          String((profile as { display_name?: unknown }).display_name || (profile as { username?: unknown }).username || "Someone"),
        );
      }
    }
    const actorNameFor = (userId?: string | null) =>
      userId ? actorNames.get(String(userId)) || "Someone" : "Someone";

    for (const reaction of entryReactions || []) {
      const entryId = String(reaction.entry_id);
      const actor = actorNameFor(reaction.user_id);
      const duplicateEntryLike = notifications.some(
        (n) => n.discussion_id === entryId &&
          n.actor_name === actor &&
          /liked your (post|discussion)/.test((n.preview_text || "").toLowerCase()),
      );
      const id = "like-entry-" + reaction.id;
      if (!baseIds.has(id) && !duplicateEntryLike) {
        baseIds.add(id);
        notifications.push({
          id,
          discussion_id: entryId,
          actor_name: actor,
          preview_text: "liked your post",
          title: titleMap.get(entryId) || "Your discussion",
          kind: "likes",
          is_read: false,
          created_at: reaction.created_at ? String(reaction.created_at) : new Date().toISOString(),
        });
      }
    }

    if (commentReactions.length > 0) {
      const commentFeedbackMap = new Map(myComments.map((comment) => [String(comment.id), String(comment.feedback_id)]));
      for (const reaction of commentReactions || []) {
        const feedbackId = commentFeedbackMap.get(String(reaction.comment_id));
        if (!feedbackId) continue;
        const actor = actorNameFor(reaction.user_id);
        const duplicateCommentLike = notifications.some(
          (n) => n.discussion_id === feedbackId &&
            n.actor_name === actor &&
            (n.preview_text || "").toLowerCase().includes("liked your reply"),
        );
        const id = "like-comment-" + reaction.id;
        if (!baseIds.has(id) && !duplicateCommentLike) {
          baseIds.add(id);
          notifications.push({
            id,
            discussion_id: feedbackId,
            actor_name: actor,
            preview_text: "liked your reply",
            title: titleMap.get(feedbackId) || "Your discussion",
            comment_id: String(reaction.comment_id),
            kind: "likes",
            is_read: false,
            created_at: reaction.created_at ? String(reaction.created_at) : new Date().toISOString(),
          });
        }
      }
    }
  } catch {
    // Derived replies/likes are best-effort; base notifications are still returned.
  }

  const requestedType = request.nextUrl.searchParams.get("type") || "all";
  const categorized = notifications.map((n) => ({
    ...n,
    kind: n.kind || notificationKind(n),
  }));
  const visible = requestedType === "all"
    ? categorized
    : categorized.filter((n) => n.kind === requestedType);
  visible.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json({ notifications: visible.slice(0, 100) });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sb = hasSupabaseServiceRole ? getServiceSupabase() : getSupabaseWithAuth(token);
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
