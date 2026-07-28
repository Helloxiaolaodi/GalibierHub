import { NextResponse } from 'next/server';
import { SiteConfig } from '@/site-config';
import { EXCLUDED_SAMPLE_IDS_FILTER, isExcludedSampleId } from '@/lib/sample-exclusions';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';
import { promotersQuerySchema, parseAndValidate } from '@/lib/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // ---- Zod validation: reject malformed params before touching DB ----
  const rawParams: Record<string, string> = {};
  searchParams.forEach((value, key) => { rawParams[key] = value; });
  const parsed = parseAndValidate(promotersQuerySchema, rawParams, "Invalid query parameters");
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const {
    id, chrom, gene_symbol, min_score, start, end_pos,
    sample_id, species, tissue, cohort, bmi_class,
    sort_by, limit = 100, offset = 0, cursor,
  } = parsed.data as Record<string, unknown> & {
    id?: string; chrom?: string; gene_symbol?: string;
    min_score?: string; start?: string; end_pos?: string;
    sample_id?: string; species?: string; tissue?: string; cohort?: string;
    bmi_class?: string; sort_by?: string; limit?: number; offset?: number; cursor?: string;
  };

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Promoter queries require a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();

  // Step 1 - if any sample-level filter is set, resolve matching sample_ids first.
  const needSampleFilter = species || tissue || cohort || bmi_class;
  let allowedSampleIds: string[] | null = null;

  if (needSampleFilter) {
    let sq = sb.from('genome_samples').select('sample_id');
    sq = sq.not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER);
    if (species) sq = sq.eq('species', species);
    if (tissue) sq = sq.eq('tissue', tissue);
    if (cohort) sq = sq.eq('cohort', cohort);
    if (bmi_class && bmi_class in SiteConfig.bmiBands) {
      const [lo, hi] = SiteConfig.bmiBands[bmi_class as keyof typeof SiteConfig.bmiBands];
      sq = sq.gte('bmi', lo).lt('bmi', hi);
    }
    const { data: samples, error: sErr } = await sq;
    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    allowedSampleIds = (samples ?? []).map((r) => r.sample_id as string);
    if (allowedSampleIds.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit,
        offset,
        nextCursor: null,
        cursor: cursor ?? null,
      });
    }
  }

  // Step 2 - promoter query with combined filters.
  let query = sb.from('predicted_promoters').select('*', { count: 'exact' });
  query = query.not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER);
  if (id) query = query.eq('id', id);
  if (chrom) query = query.eq('chrom', chrom);
  if (gene_symbol) query = query.ilike('gene_symbol', `%${gene_symbol}%`);
  if (min_score) query = query.gte('score', Number.parseFloat(min_score));
  if (start) query = query.gte('start', Number.parseInt(start));
  if (end_pos) query = query.lte('end_pos', Number.parseInt(end_pos));
  if (sample_id) {
    if (isExcludedSampleId(sample_id)) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit,
        offset,
        nextCursor: null,
        cursor: cursor ?? null,
      });
    }
    query = query.eq('sample_id', sample_id);
  }
  if (allowedSampleIds) query = query.in('sample_id', allowedSampleIds);

  // Cursor-based pagination: prefer id > cursor over offset
  if (cursor) {
    query = query.gt('id', cursor);
  }

  switch (sort_by) {
    case 'score_asc':
      query = query.order('score', { ascending: true, nullsFirst: false })
        .order('chrom', { ascending: true, nullsFirst: false })
        .order('start', { ascending: true, nullsFirst: false });
      break;
    case 'chrom_start':
      query = query.order('chrom', { ascending: true, nullsFirst: false })
        .order('start', { ascending: true, nullsFirst: false })
        .order('end_pos', { ascending: true, nullsFirst: false })
        .order('score', { ascending: false, nullsFirst: false });
      break;
    case 'sample_id':
      query = query.order('sample_id', { ascending: true, nullsFirst: false })
        .order('score', { ascending: false, nullsFirst: false })
        .order('chrom', { ascending: true, nullsFirst: false })
        .order('start', { ascending: true, nullsFirst: false });
      break;
    case 'score_desc':
    default:
      query = query.order('score', { ascending: false, nullsFirst: false })
        .order('chrom', { ascending: true, nullsFirst: false })
        .order('start', { ascending: true, nullsFirst: false });
      break;
  }

  if (!cursor) {
    query = query.range(offset, offset + limit - 1);
  } else {
    query = query.limit(limit);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const lastRow = rows.length > 0 && rows.length >= limit ? rows[rows.length - 1] : null;
  const nextCursor = (lastRow && 'id' in lastRow) ? String(lastRow.id) : null;

  return NextResponse.json({
    data: rows,
    total: count ?? 0,
    limit,
    offset,
    nextCursor,
    cursor: cursor ?? null,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
