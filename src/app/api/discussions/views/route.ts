import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

// GET: fetch view counts for all discussion entries
export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ viewCounts: {} });
  }

  try {
    const sb = getSupabase();
    // Try to fetch from discussion_views table
    const { data, error } = await sb
      .from('discussion_views')
      .select('entry_id, view_count');

    if (error) {
      return NextResponse.json({ viewCounts: {}, note: 'discussion_views table not yet created' });
    }

    const viewCounts: Record<string, number> = {};
    if (data) {
      for (const row of data) {
        viewCounts[row.entry_id] = row.view_count;
      }
    }

    return NextResponse.json({ viewCounts });
  } catch {
    return NextResponse.json({ viewCounts: {} });
  }
}

// POST: record a view for a specific discussion entry
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, reason: 'Supabase not configured' });
  }

  try {
    const body = await request.json() as { entryId?: string };
    const entryId = body?.entryId;
    if (!entryId) {
      return NextResponse.json({ ok: false, reason: 'entryId required' }, { status: 400 });
    }

    const sb = getSupabase();

    // Try to upsert into discussion_views
    const { error } = await sb.rpc('increment_discussion_view', { p_entry_id: entryId });

    if (error) {
      // Fallback: try direct upsert
      const { error: upsertErr } = await sb
        .from('discussion_views')
        .upsert({ entry_id: entryId, view_count: 1, last_viewed_at: new Date().toISOString() }, { onConflict: 'entry_id', ignoreDuplicates: false });

      if (upsertErr) {
        return NextResponse.json({ ok: false, reason: 'table not available', note: 'Run the schema SQL to create discussion_views table' });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
