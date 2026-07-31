import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import { hashVisitorFingerprint } from '@/lib/feedback-admin';

type ReactionType = 'like' | 'bookmark';

function formatReactionStorageError(message: string) {
  if (
    message.includes("public.site_reactions")
    || message.includes('relation "site_reactions" does not exist')
    || message.includes('relation "public.site_reactions" does not exist')
  ) {
    return 'GalibierHub reactions are not initialized in the current Supabase project. Run the latest schema.sql so that site_reactions exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.';
  }

  return message;
}

function isReactionType(value: string): value is ReactionType {
  return value === 'like' || value === 'bookmark';
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Site reactions require a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('site_reactions')
    .select('reaction_type, entry_id, comment_id');

  if (error) {
    return NextResponse.json({ error: formatReactionStorageError(error.message) }, { status: 500 });
  }

  const counts = {
    like: 0,
    bookmark: 0,
  };
  const entries: Record<string, { like: number; bookmark: number }> = {};

  for (const row of data || []) {
    if (row.reaction_type === 'like') counts.like += 1;
    if (row.reaction_type === 'bookmark') counts.bookmark += 1;
    if (row.entry_id) {
      const entryKey = row.entry_id as string;
      if (!entries[entryKey]) entries[entryKey] = { like: 0, bookmark: 0 };
      if (row.reaction_type === 'like') entries[entryKey].like += 1;
      if (row.reaction_type === 'bookmark') entries[entryKey].bookmark += 1;
    }
    if (row.comment_id) {
      const commentKey = row.comment_id as string;
      if (!entries[commentKey]) entries[commentKey] = { like: 0, bookmark: 0 };
      if (row.reaction_type === 'like') entries[commentKey].like += 1;
      if (row.reaction_type === 'bookmark') entries[commentKey].bookmark += 1;
    }
  }

  return NextResponse.json({ counts, entries });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Site reactions require a real data source.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const reactionType = typeof (body as { reactionType?: unknown }).reactionType === 'string'
    ? (body as { reactionType: string }).reactionType.trim()
    : '';
 const fingerprint = typeof (body as { fingerprint?: unknown }).fingerprint === 'string'
   ? (body as { fingerprint: string }).fingerprint.trim()
   : '';
  const entryId = typeof (body as { entryId?: unknown }).entryId === 'string'
    ? (body as { entryId: string }).entryId.trim()
    : null;
  const commentId = typeof (body as { commentId?: unknown }).commentId === 'string'
    ? (body as { commentId: string }).commentId.trim()
    : null;
  const userId = typeof (body as { userId?: unknown }).userId === 'string'
    ? (body as { userId: string }).userId.trim()
    : null;

  if (!isReactionType(reactionType)) {
    return NextResponse.json({ error: 'Reaction type must be like or bookmark.' }, { status: 400 });
  }

  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: 'Browser fingerprint is required.' }, { status: 400 });
  }

  const fingerprintHash = hashVisitorFingerprint(fingerprint);
  const sb = getSupabase();

  let existingQuery = sb
    .from('site_reactions')
    .select('id')
    .eq('reaction_type', reactionType)
    .eq('fingerprint_hash', fingerprintHash);

  if (commentId) {
    existingQuery = existingQuery.eq('comment_id', commentId);
  } else if (entryId) {
    existingQuery = existingQuery.eq('entry_id', entryId);
  } else {
    existingQuery = existingQuery.is('entry_id', null);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: formatReactionStorageError(existingError.message) }, { status: 500 });
  }

  if (existing?.id) {
    const { error: deleteError } = await sb
      .from('site_reactions')
      .delete()
      .eq('id', existing.id);

    if (deleteError) {
      return NextResponse.json({ error: formatReactionStorageError(deleteError.message) }, { status: 500 });
    }

    return NextResponse.json({ active: false });
  }

  const { error: insertError } = await sb
    .from('site_reactions')
    .insert({
      reaction_type: reactionType,
      fingerprint_hash: fingerprintHash,
      entry_id: entryId || null,
      comment_id: commentId || null,
      user_id: userId || null,
    });

  if (insertError) {
    return NextResponse.json({ error: formatReactionStorageError(insertError.message) }, { status: 500 });
  }

  // Notify the entry author when their post is liked (best-effort)
  if (reactionType === 'like' && (entryId || commentId)) {
    try {
      const targetId = commentId || entryId;
      let recipientId: string | null | undefined = null;
      if (commentId) {
        const { data: likedComment } = await sb
          .from('feedback_comments')
          .select('user_id')
          .eq('id', commentId)
          .maybeSingle();
        recipientId = likedComment?.user_id as string | null | undefined;
      } else {
        const { data: likedEntry } = await sb
          .from('site_feedback')
          .select('user_id')
          .eq('id', entryId)
          .maybeSingle();
        recipientId = likedEntry?.user_id as string | null | undefined;
      }
      if (recipientId) {
        const actorName = typeof (body as { actorName?: unknown }).actorName === 'string'
          ? (body as { actorName: string }).actorName
          : 'Someone';
        await sb.from('site_notifications').insert({
          recipient_id: recipientId,
          discussion_id: targetId,
          actor_name: actorName,
          preview_text: commentId ? 'liked your reply' : 'liked your discussion',
          is_read: false,
        });
      }
    } catch { /* notification insert is best-effort */ }
  }

  return NextResponse.json({ active: true }, { status: 201 });
}
