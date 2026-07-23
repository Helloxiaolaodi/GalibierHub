import { NextResponse } from 'next/server';
import { SiteConfig } from '@/site-config';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
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
    return NextResponse.json({
      data: DEMO_PROMOTERS.slice(offset, offset + limit),
      total: DEMO_PROMOTERS.length,
      offset,
      limit,
      _demo: true,
    });
  }

  const sb = getSupabase();

  // Step 1 - if any sample-level filter is set, resolve matching sample_ids first.
  const needSampleFilter = species || tissue || cohort || bmiClass;
  let allowedSampleIds: string[] | null = null;

  if (needSampleFilter) {
    let sq = sb.from('genome_samples').select('sample_id');
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
  if (chrom) query = query.eq('chrom', chrom);
  if (geneSymbol) query = query.ilike('gene_symbol', `%${geneSymbol}%`);
  if (minScore) query = query.gte('score', Number.parseFloat(minScore));
  if (start) query = query.gte('start', Number.parseInt(start));
  if (endPos) query = query.lte('end_pos', Number.parseInt(endPos));
  if (sampleId) query = query.eq('sample_id', sampleId);
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

const DEMO_PROMOTERS = [
  { id: '1', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 266, end_pos: 21555, score: 0.98, strand: '+', gene_symbol: 'ORF1ab', created_at: '2025-01-15' },
  { id: '2', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 21563, end_pos: 25384, score: 0.97, strand: '+', gene_symbol: 'S', created_at: '2025-01-15' },
  { id: '3', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 25393, end_pos: 26220, score: 0.9, strand: '+', gene_symbol: 'ORF3a', created_at: '2025-01-16' },
  { id: '4', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 26245, end_pos: 26472, score: 0.84, strand: '+', gene_symbol: 'E', created_at: '2025-01-16' },
  { id: '5', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 26523, end_pos: 27191, score: 0.92, strand: '+', gene_symbol: 'M', created_at: '2025-01-17' },
  { id: '6', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27202, end_pos: 27387, score: 0.76, strand: '+', gene_symbol: 'ORF6', created_at: '2025-01-17' },
  { id: '7', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27394, end_pos: 27759, score: 0.82, strand: '+', gene_symbol: 'ORF7a', created_at: '2025-01-18' },
  { id: '8', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27756, end_pos: 27887, score: 0.71, strand: '+', gene_symbol: 'ORF7b', created_at: '2025-01-18' },
  { id: '9', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27894, end_pos: 28259, score: 0.8, strand: '+', gene_symbol: 'ORF8', created_at: '2025-01-19' },
  { id: '10', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 28274, end_pos: 29533, score: 0.95, strand: '+', gene_symbol: 'N', created_at: '2025-01-19' },
  { id: '11', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 29558, end_pos: 29674, score: 0.68, strand: '+', gene_symbol: 'ORF10', created_at: '2025-01-20' },
];
