import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase, getSupabase, hasSupabaseServiceRole, isSupabaseConfigured } from "@/utils/supabase";
import { getBearerToken, requireCreatorGithubAuth } from "@/lib/feedback-admin";

const VALID_CATEGORIES = new Set(["general", "issue", "idea", "data", "collaboration"]);

function normalizeVisibility(value: unknown): "public" | "private" | null {
  if (typeof value !== "string") {
    return "public";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "public";
  }

  if (normalized === "public") {
    return "public";
  }

  if (
    normalized === "private"
    || normalized === "administrator only"
    || normalized === "admin only"
    || normalized === "creator only"
    || normalized === "administrator_only"
    || normalized === "admin_only"
    || normalized === "creator_only"
  ) {
    return "private";
  }

  return null;
}

function formatFeedbackStorageError(message: string) {
  if (
    message.includes("public.site_feedback")
    || message.includes('relation "site_feedback" does not exist')
    || message.includes('relation "public.site_feedback" does not exist')
  ) {
    return "GalibierHub feedback is not initialized in the current Supabase project. Run the latest schema.sql so that site_feedback exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.";
  }

  return message;
}

function getOptionalEmailConfig() {
  const apiUrl = process.env.FEEDBACK_EMAIL_API_URL || "";
  const apiKey = process.env.FEEDBACK_EMAIL_API_KEY || "";
  const to = process.env.FEEDBACK_EMAIL_TO || process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
  const from = process.env.FEEDBACK_EMAIL_FROM || "onboarding@resend.dev";
  return { apiUrl, apiKey, to, from };
}

async function sendFeedbackEmail(payload: {
  title: string;
  displayName: string;
  visitorEmail: string;
  affiliation?: string | null;
  category: string;
  rating: number;
  visibility: "public" | "private";
  message: string;
  createdAt: string;
}) {
  const { apiUrl, apiKey, to, from } = getOptionalEmailConfig();
  if (!apiUrl || !apiKey || !to) {
    console.warn("[feedback-email] sendFeedbackEmail skipped: missing FEEDBACK_EMAIL_API_URL, FEEDBACK_EMAIL_API_KEY, or FEEDBACK_EMAIL_TO.");
    return;
  }

  if (!from) {
    console.warn("[feedback-email] FEEDBACK_EMAIL_FROM is empty; Resend requires a `from` sender. Skipping.");
    return;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to,
      from,
      subject: `[GalibierHub] ${payload.title}`,
      text: [
        `Title: ${payload.title}`,
        `Name: ${payload.displayName}`,
        `Visitor email: ${payload.visitorEmail}`,
        `Affiliation: ${payload.affiliation || "Not provided"}`,
        `Category: ${payload.category}`,
        `Rating: ${payload.rating}/5`,
        `Visibility: ${payload.visibility}`,
        `Created at: ${payload.createdAt}`,
        "",
        payload.message,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider responded with ${response.status}`);
  }
}

async function sendReplyEmail(payload: {
  to: string;
  title: string;
  displayName: string;
  creatorReply: string;
  category: string;
  message: string;
  createdAt: string;
  repliedAt: string;
}) {
  const { apiUrl, apiKey, from } = getOptionalEmailConfig();
  if (!apiUrl || !apiKey || !payload.to) {
    console.warn("[feedback-email] sendReplyEmail skipped: missing FEEDBACK_EMAIL_API_URL, FEEDBACK_EMAIL_API_KEY, or visitor email.");
    return;
  }

  if (!from) {
    console.warn("[feedback-email] FEEDBACK_EMAIL_FROM is empty; Resend requires a `from` sender. Skipping.");
    return;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: payload.to,
      from,
      subject: `[GalibierHub] Reply: ${payload.title}`,
      text: [
        `Hello ${payload.displayName},`,
        "",
        "The GalibierHub site Administrator has replied to your message.",
        "",
        `Title: ${payload.title}`,
        `Category: ${payload.category}`,
        `Original message time: ${payload.createdAt}`,
        `Reply time: ${payload.repliedAt}`,
        "",
        "Your message:",
        payload.message,
        "",
        "Reply:",
        payload.creatorReply,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider responded with ${response.status}`);
  }
}

async function sendCommentEmail(payload: {
  feedbackId: string;
  threadTitle: string;
  threadAuthor: string;
  commentAuthor: string;
  commentMessage: string;
  threadCreatedAt: string;
  commentCreatedAt: string;
}) {
  const { apiUrl, apiKey, to, from } = getOptionalEmailConfig();
  if (!apiUrl || !apiKey || !to) {
    console.warn("[feedback-email] sendCommentEmail skipped: missing FEEDBACK_EMAIL_API_URL, FEEDBACK_EMAIL_API_KEY, or FEEDBACK_EMAIL_TO.");
    return;
  }

  if (!from) {
    console.warn("[feedback-email] FEEDBACK_EMAIL_FROM is empty; Resend requires a `from` sender. Skipping.");
    return;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to,
      from,
      subject: `[GalibierHub] New discussion reply: ${payload.threadTitle}`,
      text: [
        `Thread id: ${payload.feedbackId}`,
        `Thread title: ${payload.threadTitle}`,
        `Thread author: ${payload.threadAuthor}`,
        `Comment author: ${payload.commentAuthor}`,
        `Thread created at: ${payload.threadCreatedAt}`,
        `Comment created at: ${payload.commentCreatedAt}`,
        "",
        "Comment:",
        payload.commentMessage,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider responded with ${response.status}`);
  }
}

async function trySendEmail(label: string, send: () => Promise<void>) {
  try {
    await send();
  } catch (error) {
    console.error(`[feedback-email] ${label} failed:`, error);
  }
}

const COMMENTS_SELECT = "id, feedback_id, author_name, author_email, message, image_url, created_at, hidden, user_id";
const COMMENTS_SELECT_NO_HIDDEN = "id, feedback_id, author_name, author_email, message, image_url, created_at, user_id";
const FEEDBACK_SELECT = "id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at, pinned, hidden, user_id";
const FEEDBACK_SELECT_NO_HIDDEN = "id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at, user_id";

function getAdminWritableSupabase() {
  if (!hasSupabaseServiceRole) {
    return {
      ok: false as const,
      error: "SUPABASE_SERVICE_ROLE_KEY is required for administrator discussion actions.",
    };
  }

  return { ok: true as const, client: getServiceSupabase() };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Public feedback requires a real data source." },
      { status: 503 },
    );
  }

  const feedbackId = request.nextUrl.searchParams.get('feedback_id');
  if (feedbackId) {
    const creatorAuth = await requireCreatorGithubAuth(getBearerToken(request));
    const isAdmin = creatorAuth.ok;
    const sbComments = getSupabase();
    let { data: comments, error: commentsError } = await sbComments
      .from("feedback_comments")
      .select(COMMENTS_SELECT)
      .eq("feedback_id", feedbackId)
      .order("created_at", { ascending: true });
    if (commentsError && commentsError.message?.includes("hidden")) {
      const fallback = await sbComments
        .from("feedback_comments")
        .select(COMMENTS_SELECT_NO_HIDDEN)
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });
      comments = (fallback.data ?? []).map((c: Record<string, unknown>) => ({ ...c, hidden: false })) as typeof comments;
      commentsError = fallback.error;
    }
    if (commentsError) return NextResponse.json({ error: formatFeedbackStorageError(commentsError.message) }, { status: 500 });
    return NextResponse.json({
      comments: (comments || []).filter((comment: Record<string, unknown>) => isAdmin || !comment.hidden),
      isAdmin,
    });
  }

  const sb = getSupabase();
  let { data, error } = await sb
    .from("site_feedback")
    .select(FEEDBACK_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error && error.message?.includes("hidden")) {
    const fallback = await sb
      .from("site_feedback")
      .select(FEEDBACK_SELECT_NO_HIDDEN)
      .order("created_at", { ascending: false })
      .limit(50);
    data = (fallback.data ?? []).map((e: Record<string, unknown>) => ({ ...e, pinned: false, hidden: false })) as typeof data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  const creatorAuth = await requireCreatorGithubAuth(getBearerToken(request));
  const isAdmin = creatorAuth.ok;
  const entries = (data || [])
    .filter((entry) => isAdmin || entry.visibility === "public")
    .map((entry) => {
      if (isAdmin) {
        return entry;
      }
      return {
        ...entry,
        visitor_email: null,
      };
    });

  const totalThreads = entries.length;
  const averageRating = totalThreads > 0
    ? Number((entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / totalThreads).toFixed(1))
    : 0;

  return NextResponse.json({
    entries,
    isAdmin,
    summary: {
      totalThreads,
      averageRating,
    },
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Public feedback requires a real data source." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Handle comment submission (POST to a specific feedback entry)
  const feedbackId = typeof (body as { feedbackId?: unknown }).feedbackId === 'string'
    ? (body as { feedbackId: string }).feedbackId.trim() : '';
  if (feedbackId) {
    const commentMessage = typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message.trim() : '';
    const commentAuthor = typeof (body as { authorName?: unknown }).authorName === 'string'
      ? (body as { authorName: string }).authorName.trim() : 'Visitor';
    if (!commentMessage || commentMessage.length < 1 || commentMessage.length > 2000) {
      return NextResponse.json({ error: "Comment message must be between 1 and 2000 characters." }, { status: 400 });
    }
    const sbComments = getSupabase();
    const { data: feedbackEntry, error: feedbackLookupErr } = await sbComments
      .from("site_feedback")
      .select("id, title, display_name, visibility, created_at, user_id")
      .eq("id", feedbackId)
      .maybeSingle();
    if (feedbackLookupErr) {
      return NextResponse.json({ error: formatFeedbackStorageError(feedbackLookupErr.message) }, { status: 500 });
    }
    if (!feedbackEntry) {
      return NextResponse.json({ error: "Feedback entry not found." }, { status: 404 });
    }

    const { data: comment, error: commentErr } = await sbComments
      .from("feedback_comments")
      .insert({ feedback_id: feedbackId, author_name: commentAuthor, message: commentMessage, user_id: (typeof body === "object" && body !== null && "userId" in body ? (body as Record<string,unknown>).userId : null) })
      .select("id, feedback_id, author_name, author_email, message, image_url, created_at, user_id")
      .single();
    if (commentErr) {
      return NextResponse.json({ error: formatFeedbackStorageError(commentErr.message) }, { status: 500 });
    }

    await trySendEmail("sendCommentEmail", () => sendCommentEmail({
      feedbackId,
      threadTitle: feedbackEntry.title || "Untitled discussion",
      threadAuthor: feedbackEntry.display_name || "Visitor",
      commentAuthor,
      commentMessage,
      threadCreatedAt: feedbackEntry.created_at,
      commentCreatedAt: comment.created_at,
    }));

        try {
      const fbEntry = feedbackEntry as Record<string, unknown>;
      const posterUserId = fbEntry.user_id as string | null | undefined;
      if (posterUserId) {
        await sbComments.from('site_notifications').insert({
          recipient_id: posterUserId,
          discussion_id: feedbackId,
          actor_name: commentAuthor,
          preview_text: commentMessage.substring(0, 80) + (commentMessage.length > 80 ? '...' : ''),
          is_read: false,
        });
      }
    } catch { /* notification insert is best-effort */ }

    // Handle @mentions in comment text - look up mentioned users and notify them
    try {
      const mentionMatches = commentMessage.match(/@(\w[\w-]{0,39})/g);
      if (mentionMatches) {
        const mentionedNames = [...new Set(mentionMatches.map((m: string) => m.slice(1)))];
        const { data: mentionedUsers } = await sbComments.from('site_feedback')
          .select('user_id, display_name').in('display_name', mentionedNames);
        if (mentionedUsers) {
          const notifiedUserIds = new Set<string>();
          const fbEntry2 = feedbackEntry as Record<string, unknown>;
          const pUid = fbEntry2.user_id as string | null;
          for (const mu of mentionedUsers) {
            const r = mu as Record<string, unknown>;
            const uid = r.user_id as string | null;
            if (uid && uid !== pUid && !notifiedUserIds.has(uid)) {
              notifiedUserIds.add(uid);
              await sbComments.from('site_notifications').insert({
                recipient_id: uid,
                discussion_id: feedbackId,
                actor_name: commentAuthor,
                preview_text: 'You were mentioned in a reply',
                is_read: false,
              });
            }
          }
        }
      }
    } catch { /* mentions are best-effort */ }

    return NextResponse.json({ comment }, { status: 201 });
  }

  const displayName = typeof (body as { displayName?: unknown }).displayName === "string"
    ? (body as { displayName: string }).displayName.trim()
    : "";
  const title = typeof (body as { title?: unknown }).title === "string"
    ? (body as { title: string }).title.trim()
    : "";
  const affiliation = typeof (body as { affiliation?: unknown }).affiliation === "string"
    ? (body as { affiliation: string }).affiliation.trim()
  : "";
  let category = typeof (body as { category?: unknown }).category === "string"
    ? (body as { category: string }).category.trim()
    : "";
  const message = typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message.trim()
    : "";
 const visitorEmail = typeof (body as { visitorEmail?: unknown }).visitorEmail === "string"
   ? (body as { visitorEmail: string }).visitorEmail.trim()
   : "";
  const imageUrl = typeof (body as { imageUrl?: unknown }).imageUrl === "string"
    ? (body as { imageUrl: string }).imageUrl.trim()
    : "";
  const visibility = normalizeVisibility((body as { visibility?: unknown }).visibility);
  const ratingRaw = (body as { rating?: unknown }).rating;
  let rating = typeof ratingRaw === "number" ? ratingRaw : Number(ratingRaw);

  if (!displayName || displayName.length > 80) {
    return NextResponse.json({ error: "Display name is required and must be 80 characters or less." }, { status: 400 });
  }

  if (!title || title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: "Title must be between 3 and 120 characters." }, { status: 400 });
  }

  if (affiliation.length > 160) {
    return NextResponse.json({ error: "Affiliation must be 160 characters or less." }, { status: 400 });
  }

  if (visitorEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (visitorEmail.length > 160) {
      return NextResponse.json({ error: "Email must be 160 characters or less." }, { status: 400 });
    }
  }

 if (!VALID_CATEGORIES.has(category)) {
    category = "general";
 }

  if (!visibility) {
    return NextResponse.json({ error: "Visibility must be public or private." }, { status: 400 });
  }

 if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    rating = 5;
 }

  if (!message || message.length < 3 || message.length > 2000) {
    return NextResponse.json({ error: "Message must be between 3 and 2000 characters." }, { status: 400 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("site_feedback")
   .insert({
     title,
     display_name: displayName,
     visitor_email: visitorEmail,
     affiliation: affiliation || null,
    category,
    rating,
    visibility,
     message,
      image_url: imageUrl || null,
   })
   .select(FEEDBACK_SELECT)
   .single();

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  await trySendEmail("sendFeedbackEmail", () => sendFeedbackEmail({
    title,
    displayName,
    visitorEmail,
    affiliation: affiliation || null,
    category,
    rating,
    visibility,
    message,
    createdAt: data.created_at,
  }));

  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Public feedback requires a real data source." },
      { status: 503 },
    );
  }

  const token = getBearerToken(request);
  const adminCheck = await requireCreatorGithubAuth(token);

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const hasReply = typeof payload.creatorReply === "string";
  const hasPin = typeof payload.pinned === "boolean";
  const hasHide = typeof payload.hidden === "boolean";
  const commentId = typeof payload.commentId === "string" ? payload.commentId.trim() : "";
  const hasCommentHide = typeof payload.commentHidden === "boolean";

  if ((hasReply || hasPin || hasHide || hasCommentHide || !!commentId) && !adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: 401 });
  }

  if (commentId) {
    const commentHidden = typeof payload.commentHidden === "boolean" ? payload.commentHidden : undefined;
    if (commentHidden === undefined) {
      return NextResponse.json({ error: "commentHidden must be a boolean when commentId is provided." }, { status: 400 });
    }

    const writable = getAdminWritableSupabase();
    if (!writable.ok) {
      return NextResponse.json({ error: writable.error }, { status: 503 });
    }

    const { data, error } = await writable.client
      .from("feedback_comments")
      .update({ hidden: commentHidden })
      .eq("id", commentId)
      .select(COMMENTS_SELECT)
      .maybeSingle();

    if (error && error.message?.includes("hidden")) {
      const fallback = await writable.client
        .from("feedback_comments")
        .update({})
        .eq("id", commentId)
        .select(COMMENTS_SELECT_NO_HIDDEN)
        .maybeSingle();
      return NextResponse.json({ comment: fallback.data ? { ...fallback.data, hidden: commentHidden } : null });
    }

    if (error) {
      return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }

    return NextResponse.json({ comment: data });
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const creatorReply = typeof payload.creatorReply === "string"
    ? payload.creatorReply.trim()
    : undefined;
  const pinned = typeof payload.pinned === "boolean"
    ? payload.pinned
    : undefined;
  const hidden = typeof payload.hidden === "boolean"
    ? payload.hidden
    : undefined;

  if (!id) {
    return NextResponse.json({ error: "Feedback id is required." }, { status: 400 });
  }

  if (creatorReply === undefined && pinned === undefined && hidden === undefined) {
    return NextResponse.json({ error: "At least one of creatorReply, pinned, or hidden is required." }, { status: 400 });
  }

  if (creatorReply !== undefined) {
    if (!creatorReply || creatorReply.length < 3 || creatorReply.length > 2000) {
      return NextResponse.json({ error: "Reply must be between 3 and 2000 characters." }, { status: 400 });
    }
  }

  if (pinned !== undefined && typeof pinned !== "boolean") {
    return NextResponse.json({ error: "pinned must be a boolean." }, { status: 400 });
  }

  if (hidden !== undefined && typeof hidden !== "boolean") {
    return NextResponse.json({ error: "hidden must be a boolean." }, { status: 400 });
  }

  const writable = getAdminWritableSupabase();
  if (!writable.ok) {
    return NextResponse.json({ error: writable.error }, { status: 503 });
  }

  const sb = writable.client;

  // Enforce max 3 pinned when pinning an entry
  if (pinned === true) {
    const { data: pinnedEntries, error: countError } = await sb
      .from("site_feedback")
      .select("id")
      .eq("pinned", true);

    if (countError) {
      return NextResponse.json({ error: formatFeedbackStorageError(countError.message) }, { status: 500 });
    }

    if (pinnedEntries && pinnedEntries.filter((e) => e.id !== id).length >= 3) {
      return NextResponse.json({ error: "A maximum of 3 entries can be pinned at once. Unpin another entry first." }, { status: 400 });
    }
  }

  // Build the update object dynamically
  const updatePayload: Record<string, unknown> = {};
  if (creatorReply !== undefined) {
    updatePayload.creator_reply = creatorReply;
    updatePayload.replied_at = new Date().toISOString();
  }
  if (pinned !== undefined) {
    updatePayload.pinned = pinned;
  }
  if (hidden !== undefined) {
    updatePayload.hidden = hidden;
  }

 const { error: updateErr } = await sb
   .from("site_feedback")
   .update(updatePayload)
   .eq("id", id);

 if (updateErr && updateErr.message?.includes("column") && (updateErr.message.includes("hidden") || updateErr.message.includes("pinned"))) {
    const safePayload: Record<string, unknown> = { ...updatePayload };
    delete safePayload.hidden;
    delete safePayload.pinned;
    const { error: retryErr } = await sb
      .from("site_feedback")
      .update(safePayload)
      .eq("id", id);
    if (retryErr) {
      return NextResponse.json({ error: formatFeedbackStorageError(retryErr.message) }, { status: 500 });
    }
 } else if (updateErr) {
   return NextResponse.json({ error: formatFeedbackStorageError(updateErr.message) }, { status: 500 });
 }

 let { data, error: fetchErr } = await sb
   .from("site_feedback")
   .select(FEEDBACK_SELECT)
   .eq("id", id)
   .maybeSingle();

 if (fetchErr && fetchErr.message?.includes("hidden")) {
    const fallback = await sb
      .from("site_feedback")
      .select(FEEDBACK_SELECT_NO_HIDDEN)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data ? { ...fallback.data, pinned: false, hidden: false } : null;
    fetchErr = fallback.error;
 }

 if (fetchErr) {
   return NextResponse.json({ error: formatFeedbackStorageError(fetchErr.message) }, { status: 500 });
 }

  if (!data) {
    return NextResponse.json({ error: "Feedback entry not found." }, { status: 404 });
  }
  // Only send reply email when creatorReply was provided
  if (creatorReply !== undefined && data.visitor_email) {
    await trySendEmail("sendReplyEmail", () => sendReplyEmail({
      to: data.visitor_email,
      title: data.title || "GalibierHub message",
      displayName: data.display_name,
      creatorReply,
      category: data.category,
      message: data.message,
      createdAt: data.created_at,
      repliedAt: data.replied_at || new Date().toISOString(),
    }));
  }

  return NextResponse.json({ entry: data });
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const token = getBearerToken(request);
  const adminCheck = await requireCreatorGithubAuth(token);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  const commentId = request.nextUrl.searchParams.get('comment_id');
  if (!id && !commentId) {
    return NextResponse.json({ error: "Feedback id or comment_id is required." }, { status: 400 });
  }

  const writable = getAdminWritableSupabase();
  if (!writable.ok) {
    return NextResponse.json({ error: writable.error }, { status: 503 });
  }

  const sb = writable.client;

  if (commentId) {
    const { error } = await sb
      .from("feedback_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error } = await sb
    .from("site_feedback")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
