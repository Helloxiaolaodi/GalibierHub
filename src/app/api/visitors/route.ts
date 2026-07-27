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

function getReadClient() {
  return hasSupabaseServiceRole ? getServiceSupabase() : getSupabase();
}

async function readVisitorCount() {
  const sb = getReadClient();
  const { count, error } = await sb
    .from('site_visitors')
    .select('*', { count: 'exact', head: true });

  return { count: count ?? 0, error };
}

async function readVisitorByFingerprint(fingerprintHash: string) {
  const sb = getReadClient();
  const { data, error } = await sb
    .from('site_visitors')
    .select('id')
    .eq('fingerprint_hash', fingerprintHash)
    .maybeSingle();

  return { data, error };
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Visitor counting requires a real data source.' },
      { status: 503 },
    );
  }

  const { count, error } = await readVisitorCount();

  if (error) {
    return NextResponse.json({ error: formatVisitorStorageError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ totalVisitors: count, source: hasSupabaseServiceRole ? 'service_role' : 'anon' });
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
  const { count: currentCount, error: countError } = await readVisitorCount();

  if (countError) {
    return NextResponse.json({ error: formatVisitorStorageError(countError.message) }, { status: 500 });
  }

  const writable = hasSupabaseServiceRole ? getServiceSupabase() : getSupabase();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await readVisitorByFingerprint(fingerprintHash);

  if (existingError) {
    return NextResponse.json({ error: formatVisitorStorageError(existingError.message) }, { status: 500 });
  }

  if (existing?.id) {
    if (!hasSupabaseServiceRole) {
      return NextResponse.json({
        totalVisitors: currentCount,
        counted: false,
        source: 'anon',
      });
    }

    const { error: updateError } = await writable
      .from('site_visitors')
      .update({ last_seen_at: now })
      .eq('id', existing.id);

    if (updateError) {
      return NextResponse.json({ error: formatVisitorStorageError(updateError.message) }, { status: 500 });
    }

    return NextResponse.json({
      totalVisitors: currentCount,
      counted: false,
      source: hasSupabaseServiceRole ? 'service_role' : 'anon',
    });
  }

  const { error: insertError } = await writable
    .from('site_visitors')
    .insert({ fingerprint_hash: fingerprintHash, first_seen_at: now, last_seen_at: now });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({
        totalVisitors: currentCount,
        counted: false,
        source: hasSupabaseServiceRole ? 'service_role' : 'anon',
      });
    }
    return NextResponse.json({ error: formatVisitorStorageError(insertError.message) }, { status: 500 });
  }

  return NextResponse.json({
    totalVisitors: currentCount + 1,
    counted: true,
    source: hasSupabaseServiceRole ? 'service_role' : 'anon',
  }, { status: 201 });
}
