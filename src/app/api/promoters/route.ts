import { NextResponse } from 'next/server';
import { SiteConfig } from '@/site-config';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

const TEMPLATE_SAMPLE_ID = 'SCOV2-REF-001';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const chrom = searchParams.get('chrom');
  const geneSymbol = searchParams.get('gene_symbol');
  const minScore = searchParams.get('min_score');
  const start = searchParams.get('start');
  const endPos = searchParams.get('end_pos');
  const sampleId = searchParams.get('sample_id');
  const species = searchParams.get('species');
  const tissue = searchParams.get('tissue');
  const cohort = searchParams.get('cohort');
  const bmiClass = searchParams.get('bmi_class');
  const limit = Number.parseInt(searchParams.get('limit') || '100');
  const offset = Number.parseInt(searchParams.get('offset') || '0');

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Promoter queries require a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();

  // Step 1 - if any sample-level filter is set, resolve matching sample_ids first.
  const needSampleFilter = species || tissue || cohort || bmiClass;
  let allowedSampleIds: string[] | null = null;

  if (needSampleFilter) {
    let sq = sb.from('genome_samples').select('sample_id');
    sq = sq.neq('sample_id', TEMPLATE_SAMPLE_ID);
    if (species) sq = sq.eq('species', species);
    if (tissue) sq = sq.eq('tissue', tissue);
    if (cohort) sq = sq.eq('cohort', cohort);
    if (bmiClass && bmiClass in SiteConfig.bmiBands) {
      const [lo, hi] = SiteConfig.bmiBands[bmiClass as keyof typeof SiteConfig.bmiBands];
      sq = sq.gte('bmi', lo).lt('bmi', hi);
    }
    const { data: samples, error: sErr } = await sq;
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    allowedSampleIds = (samples ?? []).map((r) => r.sample_id as string);
    if (allowedSampleIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, offset, limit });
    }
  }

  // Step 2 - promoter query with combined filters.
  let query = sb.from('predicted_promoters').select('*', { count: 'exact' });
  query = query.neq('sample_id', TEMPLATE_SAMPLE_ID);
  if (id) query = query.eq('id', id);
  if (chrom) query = query.eq('chrom', chrom);
  if (geneSymbol) query = query.ilike('gene_symbol', `%${geneSymbol}%`);
  if (minScore) query = query.gte('score', Number.parseFloat(minScore));
  if (start) query = query.gte('start', Number.parseInt(start));
  if (endPos) query = query.lte('end_pos', Number.parseInt(endPos));
  if (sampleId) {
    if (sampleId === TEMPLATE_SAMPLE_ID) {
      return NextResponse.json({ data: [], total: 0, offset, limit });
    }
    query = query.eq('sample_id', sampleId);
  }
  if (allowedSampleIds) query = query.in('sample_id', allowedSampleIds);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    offset,
    limit,
  });
}
