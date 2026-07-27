import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, getSupabase, hasSupabaseServiceRole, isSupabaseConfigured } from '@/utils/supabase';
import { hashVisitorFingerprint } from '@/lib/feedback-admin';

function formatVisitorStorageError(message: string) {
  if (
    message.includes('public.site_visitors')
    || message.includes('relation "site_visitors" does not exist')
    || message.includes('relation "public.site_visitors" does not exist')
  ) {
    return 'SeqEdge visitor counting is not initialized in the current Supabase project. Run the latest schema.sql so that site_visitors exists, then confirm Vercel is using the same NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY values.';
  }

  return message;
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Visitor counting requires a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const { count, error } = await sb
    .from('site_visitors')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ error: formatVisitorStorageError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ totalVisitors: count ?? 0 });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Visitor counting requires a real data source.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const fingerprint = typeof (body as { fingerprint?: unknown }).fingerprint === 'string'
    ? (body as { fingerprint: string }).fingerprint.trim()
    : '';

  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: 'Browser fingerprint is required.' }, { status: 400 });
  }

  const fingerprintHash = hashVisitorFingerprint(fingerprint);
  const readable = getSupabase();
  const { count: currentCount, error: countError } = await readable
    .from('site_visitors')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    return NextResponse.json({ error: formatVisitorStorageError(countError.message) }, { status: 500 });
  }

  if (!hasSupabaseServiceRole) {
    return NextResponse.json({
      totalVisitors: currentCount ?? 0,
      counted: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for server-side visitor counting writes.',
    }, { status: 503 });
  }

  const writable = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await writable
    .from('site_visitors')
    .select('id')
    .eq('fingerprint_hash', fingerprintHash)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: formatVisitorStorageError(existingError.message) }, { status: 500 });
  }

  if (existing?.id) {
    const { error: updateError } = await writable
      .from('site_visitors')
      .update({ last_seen_at: now })
      .eq('id', existing.id);

    if (updateError) {
      return NextResponse.json({ error: formatVisitorStorageError(updateError.message) }, { status: 500 });
    }

    return NextResponse.json({ totalVisitors: currentCount ?? 0, counted: false });
  }

  const { error: insertError } = await writable
    .from('site_visitors')
    .insert({ fingerprint_hash: fingerprintHash, first_seen_at: now, last_seen_at: now });

  if (insertError) {
    return NextResponse.json({ error: formatVisitorStorageError(insertError.message) }, { status: 500 });
  }

  return NextResponse.json({ totalVisitors: (currentCount ?? 0) + 1, counted: true }, { status: 201 });
}
