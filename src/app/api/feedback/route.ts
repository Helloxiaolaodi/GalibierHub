import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";
import { getBearerToken, requireCreatorGithubAuth } from "@/lib/feedback-admin";

const VALID_CATEGORIES = new Set(["general", "issue", "idea", "data", "collaboration"]);

function formatFeedbackStorageError(message: string) {
  if (
    message.includes("public.site_feedback")
    || message.includes('relation "site_feedback" does not exist')
    || message.includes('relation "public.site_feedback" does not exist')
  ) {
    return "SeqEdge feedback is not initialized in the current Supabase project. Run the latest schema.sql so that site_feedback exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.";
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
      subject: `[SeqEdge] ${payload.title}`,
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
      subject: `[SeqEdge] Reply: ${payload.title}`,
      text: [
        `Hello ${payload.displayName},`,
        "",
        "The SeqEdge site Administrator has replied to your message.",
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
      subject: `[SeqEdge] New discussion reply: ${payload.threadTitle}`,
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

const COMMENTS_SELECT = "id, feedback_id, author_name, author_email, message, image_url, created_at";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Public feedback requires a real data source." },
      { status: 503 },
    );
  }

  const feedbackId = request.nextUrl.searchParams.get('feedback_id');
  if (feedbackId) {
    const sbComments = getSupabase();
    const { data: comments, error: commentsError } = await sbComments
      .from("feedback_comments")
      .select(COMMENTS_SELECT)
      .eq("feedback_id", feedbackId)
      .order("created_at", { ascending: true });
    if (commentsError) return NextResponse.json({ error: formatFeedbackStorageError(commentsError.message) }, { status: 500 });
    return NextResponse.json({ comments: comments || [] });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("site_feedback")
    .select("id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at, pinned, hidden")
    .order("created_at", { ascending: false })
    .limit(50);

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
      .select("id, title, display_name, visibility, created_at")
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
      .insert({ feedback_id: feedbackId, author_name: commentAuthor, message: commentMessage })
      .select("id, feedback_id, author_name, author_email, message, image_url, created_at")
      .single();
    if (commentErr) {
      return NextResponse.json({ error: formatFeedbackStorageError(commentErr.message) }, { status: 500 });
    }

    void sendCommentEmail({
      feedbackId,
      threadTitle: feedbackEntry.title || "Untitled thread",
      threadAuthor: feedbackEntry.display_name || "Visitor",
      commentAuthor,
      commentMessage,
      threadCreatedAt: feedbackEntry.created_at,
      commentCreatedAt: comment.created_at,
    }).catch((error) => {
      console.error("[feedback-email] sendCommentEmail failed:", error);
    });

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
 const visibility = typeof (body as { visibility?: unknown }).visibility === "string"
   ? (body as { visibility: string }).visibility.trim()
  : "public";
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

  if (visibility !== "public" && visibility !== "private") {
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
   .select("id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at, pinned, hidden")
   .single();

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  void sendFeedbackEmail({
    title,
    displayName,
    visitorEmail,
    affiliation: affiliation || null,
    category,
    rating,
    visibility: visibility as "public" | "private",
    message,
    createdAt: data.created_at,
  }).catch((error) => {
    console.error("[feedback-email] sendFeedbackEmail failed:", error);
  });

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

  if ((hasReply || hasPin || hasHide) && !adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: 401 });
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

  const sb = getSupabase();

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

 if (updateErr) {
   return NextResponse.json({ error: formatFeedbackStorageError(updateErr.message) }, { status: 500 });
 }

 const { data, error: fetchErr } = await sb
   .from("site_feedback")
   .select("id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at, pinned, hidden")
   .eq("id", id)
   .maybeSingle();

 if (fetchErr) {
   return NextResponse.json({ error: formatFeedbackStorageError(fetchErr.message) }, { status: 500 });
 }

  if (!data) {
    return NextResponse.json({ error: "Feedback entry not found." }, { status: 404 });
  }
  // Only send reply email when creatorReply was provided
  if (creatorReply !== undefined && data.visitor_email) {
    void sendReplyEmail({
      to: data.visitor_email,
      title: data.title || "SeqEdge message",
      displayName: data.display_name,
      creatorReply,
      category: data.category,
      message: data.message,
      createdAt: data.created_at,
    repliedAt: data.replied_at || new Date().toISOString(),
    }).catch((error) => {
      console.error("[feedback-email] sendReplyEmail failed:", error);
    });
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
  if (!id) {
    return NextResponse.json({ error: "Feedback id is required." }, { status: 400 });
  }

  const sb = getSupabase();
  const { error } = await sb
    .from("site_feedback")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
