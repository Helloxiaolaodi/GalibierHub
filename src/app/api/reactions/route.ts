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
    return 'SeqEdge reactions are not initialized in the current Supabase project. Run the latest schema.sql so that site_reactions exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.';
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
    .select('reaction_type');

  if (error) {
    return NextResponse.json({ error: formatReactionStorageError(error.message) }, { status: 500 });
  }

  const counts = {
    like: 0,
    bookmark: 0,
  };

  for (const row of data || []) {
    if (row.reaction_type === 'like') counts.like += 1;
    if (row.reaction_type === 'bookmark') counts.bookmark += 1;
  }

  return NextResponse.json({ counts });
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

  if (!isReactionType(reactionType)) {
    return NextResponse.json({ error: 'Reaction type must be like or bookmark.' }, { status: 400 });
  }

  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: 'Browser fingerprint is required.' }, { status: 400 });
  }

  const fingerprintHash = hashVisitorFingerprint(fingerprint);
  const sb = getSupabase();

  const { data: existing, error: existingError } = await sb
    .from('site_reactions')
    .select('id')
    .eq('reaction_type', reactionType)
    .eq('fingerprint_hash', fingerprintHash)
    .maybeSingle();

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
    .insert({ reaction_type: reactionType, fingerprint_hash: fingerprintHash });

  if (insertError) {
    return NextResponse.json({ error: formatReactionStorageError(insertError.message) }, { status: 500 });
  }

  return NextResponse.json({ active: true }, { status: 201 });
}
