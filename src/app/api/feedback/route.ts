import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import { getBearerToken, requireCreatorGithubAuth } from '@/lib/feedback-admin';

const VALID_CATEGORIES = new Set(['general', 'issue', 'idea', 'data', 'collaboration']);

function formatFeedbackStorageError(message: string) {
  if (
    message.includes("public.site_feedback")
    || message.includes('relation "site_feedback" does not exist')
    || message.includes('relation "public.site_feedback" does not exist')
  ) {
    return 'SeqEdge feedback is not initialized in the current Supabase project. Run the latest schema.sql so that site_feedback exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.';
  }

  return message;
}

function getOptionalEmailConfig() {
  const apiUrl = process.env.FEEDBACK_EMAIL_API_URL || '';
  const apiKey = process.env.FEEDBACK_EMAIL_API_KEY || '';
  const to = process.env.FEEDBACK_EMAIL_TO || process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';
  return { apiUrl, apiKey, to };
}

async function sendFeedbackEmail(payload: {
  title: string;
  displayName: string;
  visitorEmail: string;
  affiliation?: string | null;
  category: string;
  rating: number;
  visibility: 'public' | 'private';
  message: string;
  createdAt: string;
}) {
  const { apiUrl, apiKey, to } = getOptionalEmailConfig();
  if (!apiUrl || !apiKey || !to) {
    return;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to,
      subject: `[SeqEdge] ${payload.title}`,
      text: [
        `Title: ${payload.title}`,
        `Name: ${payload.displayName}`,
        `Visitor email: ${payload.visitorEmail}`,
        `Affiliation: ${payload.affiliation || 'Not provided'}`,
        `Category: ${payload.category}`,
        `Rating: ${payload.rating}/5`,
        `Visibility: ${payload.visibility}`,
        `Created at: ${payload.createdAt}`,
        '',
        payload.message,
      ].join('\n'),
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
  const { apiUrl, apiKey } = getOptionalEmailConfig();
  if (!apiUrl || !apiKey || !payload.to) {
    return;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: payload.to,
      subject: `[SeqEdge] Reply: ${payload.title}`,
      text: [
        `Hello ${payload.displayName},`,
        '',
        'The SeqEdge site creator has replied to your message.',
        '',
        `Title: ${payload.title}`,
        `Category: ${payload.category}`,
        `Original message time: ${payload.createdAt}`,
        `Reply time: ${payload.repliedAt}`,
        '',
        'Your message:',
        payload.message,
        '',
        'Reply:',
        payload.creatorReply,
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider responded with ${response.status}`);
  }
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Public feedback requires a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_feedback')
    .select('id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  const creatorAuth = await requireCreatorGithubAuth(getBearerToken(request));
  const isAdmin = creatorAuth.ok;
  const entries = (data || [])
    .filter((entry) => isAdmin || entry.visibility === 'public')
    .map((entry) => {
      if (isAdmin) {
        return entry;
      }
      return {
        ...entry,
        visitor_email: null,
      };
    });

  const totalComments = entries.length;
  const averageRating = totalComments > 0
    ? Number((entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / totalComments).toFixed(1))
    : 0;

  return NextResponse.json({
    entries,
    isAdmin,
    summary: {
      totalComments,
      averageRating,
    },
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Public feedback requires a real data source.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const displayName = typeof (body as { displayName?: unknown }).displayName === 'string'
    ? (body as { displayName: string }).displayName.trim()
    : '';
  const title = typeof (body as { title?: unknown }).title === 'string'
    ? (body as { title: string }).title.trim()
    : '';
  const affiliation = typeof (body as { affiliation?: unknown }).affiliation === 'string'
    ? (body as { affiliation: string }).affiliation.trim()
    : '';
  const category = typeof (body as { category?: unknown }).category === 'string'
    ? (body as { category: string }).category.trim()
    : '';
  const message = typeof (body as { message?: unknown }).message === 'string'
    ? (body as { message: string }).message.trim()
    : '';
  const visitorEmail = typeof (body as { visitorEmail?: unknown }).visitorEmail === 'string'
    ? (body as { visitorEmail: string }).visitorEmail.trim()
    : '';
  const visibility = typeof (body as { visibility?: unknown }).visibility === 'string'
    ? (body as { visibility: string }).visibility.trim()
    : 'public';
  const ratingRaw = (body as { rating?: unknown }).rating;
  const rating = typeof ratingRaw === 'number' ? ratingRaw : Number(ratingRaw);

  if (!displayName || displayName.length > 80) {
    return NextResponse.json({ error: 'Display name is required and must be 80 characters or less.' }, { status: 400 });
  }

  if (!title || title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: 'Title must be between 3 and 120 characters.' }, { status: 400 });
  }

  if (affiliation.length > 160) {
    return NextResponse.json({ error: 'Affiliation must be 160 characters or less.' }, { status: 400 });
  }

  if (!visitorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail) || visitorEmail.length > 160) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Invalid feedback category.' }, { status: 400 });
  }

  if (visibility !== 'public' && visibility !== 'private') {
    return NextResponse.json({ error: 'Visibility must be public or private.' }, { status: 400 });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5.' }, { status: 400 });
  }

  if (!message || message.length < 3 || message.length > 2000) {
    return NextResponse.json({ error: 'Message must be between 3 and 2000 characters.' }, { status: 400 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_feedback')
    .insert({
      title,
      display_name: displayName,
      visitor_email: visitorEmail,
      affiliation: affiliation || null,
      category,
      rating,
      visibility,
      message,
    })
    .select('id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at')
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
    visibility: visibility as 'public' | 'private',
    message,
    createdAt: data.created_at,
  }).catch(() => undefined);

  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Public feedback requires a real data source.' },
      { status: 503 },
    );
  }

  const adminCheck = await requireCreatorGithubAuth(getBearerToken(request));
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : '';
  const creatorReply = typeof (body as { creatorReply?: unknown }).creatorReply === 'string'
    ? (body as { creatorReply: string }).creatorReply.trim()
    : '';

  if (!id) {
    return NextResponse.json({ error: 'Feedback id is required.' }, { status: 400 });
  }

  if (!creatorReply || creatorReply.length < 3 || creatorReply.length > 2000) {
    return NextResponse.json({ error: 'Reply must be between 3 and 2000 characters.' }, { status: 400 });
  }

  const sb = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('site_feedback')
    .update({ creator_reply: creatorReply, replied_at: now })
    .eq('id', id)
    .select('id, title, display_name, visitor_email, affiliation, category, rating, visibility, message, creator_reply, replied_at, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: formatFeedbackStorageError(error.message) }, { status: 500 });
  }

  void sendReplyEmail({
    to: data.visitor_email,
    title: data.title || 'SeqEdge message',
    displayName: data.display_name,
    creatorReply,
    category: data.category,
    message: data.message,
    createdAt: data.created_at,
    repliedAt: data.replied_at || now,
  }).catch(() => undefined);

  return NextResponse.json({ entry: data });
}
