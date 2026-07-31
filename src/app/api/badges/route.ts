import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import { getBearerToken, requireCreatorGithubAuth } from '@/lib/feedback-admin';
import { getServiceSupabase, hasSupabaseServiceRole } from '@/utils/supabase';

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const userId = request.nextUrl.searchParams.get('user_id');
  const sb = getSupabase();

  if (userId) {
    // Get badges for a specific user
    const { data, error } = await sb
      .from('user_badges')
      .select('badge_id, awarded_at, badge_definitions!inner(name, description, icon, tier, category)')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ badges: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ badges: data || [] });
  }

  // Get all badge definitions
  const { data, error } = await sb
    .from('badge_definitions')
    .select('*')
    .order('tier', { ascending: false });

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ definitions: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ definitions: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const adminAuth = await requireCreatorGithubAuth(getBearerToken(request));
  if (!adminAuth.ok) {
    return NextResponse.json({ error: adminAuth.error }, { status: 401 });
  }

  if (!hasSupabaseServiceRole) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for manual badge awards.' }, { status: 503 });
  }

  let body: { user_id?: string; badge_id?: string; discussion_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.user_id || !body.badge_id) {
    return NextResponse.json({ error: 'user_id and badge_id required' }, { status: 400 });
  }

  const sb = getServiceSupabase();

  // Only manual badges may be awarded through this API. Every other badge is
  // awarded by database triggers so the award logic cannot be tampered with.
  const { data: badgeDef } = await sb
    .from('badge_definitions')
    .select('id, name, icon, manual_only')
    .eq('id', body.badge_id)
    .single();

  if (!badgeDef) {
    return NextResponse.json({ error: 'Badge definition not found.' }, { status: 404 });
  }

  if (!badgeDef.manual_only) {
    return NextResponse.json({ error: 'This badge is awarded automatically by the server.' }, { status: 403 });
  }

  // Check if already awarded
  const { data: existing } = await sb
    .from('user_badges')
    .select('id')
    .eq('user_id', body.user_id)
    .eq('badge_id', body.badge_id)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json({ already_awarded: true });
  }

  const { data, error } = await sb
    .from('user_badges')
    .insert({
      user_id: body.user_id,
      badge_id: body.badge_id,
      discussion_id: body.discussion_id || null,
    })
    .select('id, badge_id, awarded_at')
    .single();

  if (error) {
    if (error.message.includes('does not exist')) {
      return NextResponse.json({ error: 'Badges system not initialized. Run the latest schema.sql.' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also insert a notification
  try {
    await sb.from('site_notifications').insert({
      recipient_id: body.user_id,
      discussion_id: body.discussion_id || 'badges',
      actor_name: 'GalibierHub',
      preview_text: badgeDef.icon + ' You earned the "' + badgeDef.name + '" badge!',
      is_read: false,
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ awarded: data }, { status: 201 });
}
