import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

// WHO adult BMI classification (kg/m^2)
// Underweight <18.5 · Normal 18.5–24.9 · Overweight 25.0–29.9 · Obese >=30.0
const BMI_BANDS: Record<string, [number, number]> = {
  underweight: [0, 18.5],
  normal: [18.5, 25],
  overweight: [25, 30],
  obese: [30, 100],
};

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
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

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

  // Step 1 — if any sample-level filter is set, resolve matching sample_ids first.
  const needSampleFilter = species || tissue || cohort || bmiClass;
  let allowedSampleIds: string[] | null = null;

  if (needSampleFilter) {
    let sq = sb.from('genome_samples').select('sample_id');
    if (species) sq = sq.eq('species', species);
    if (tissue) sq = sq.eq('tissue', tissue);
    if (cohort) sq = sq.eq('cohort', cohort);
    if (bmiClass && BMI_BANDS[bmiClass]) {
      const [lo, hi] = BMI_BANDS[bmiClass];
      sq = sq.gte('bmi', lo).lt('bmi', hi);
    }
    const { data: samples, error: sErr } = await sq;
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    allowedSampleIds = (samples ?? []).map((r) => r.sample_id as string);
    if (allowedSampleIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, offset, limit });
    }
  }

  // Step 2 — promoter query with combined filters
  let query = sb.from('predicted_promoters').select('*', { count: 'exact' });
  if (chrom) query = query.eq('chrom', chrom);
  if (geneSymbol) query = query.ilike('gene_symbol', `%${geneSymbol}%`);
  if (minScore) query = query.gte('score', parseFloat(minScore));
  if (start) query = query.gte('start', parseInt(start));
  if (endPos) query = query.lte('end_pos', parseInt(endPos));
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

// Minimal demo data used when Supabase is not yet connected
const DEMO_PROMOTERS = [
  { id: '1', sample_id: 'P-SAMPLE-001', chrom: 'chr17', start: 43044295, end_pos: 43045800, score: 0.95, strand: '+', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
  { id: '2', sample_id: 'P-SAMPLE-001', chrom: 'chr17', start: 43050000, end_pos: 43051500, score: 0.88, strand: '-', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
  { id: '3', sample_id: 'P-SAMPLE-002', chrom: 'chr7', start: 55000000, end_pos: 55002000, score: 0.91, strand: '+', gene_symbol: 'EGFR', created_at: '2025-01-16' },
  { id: '4', sample_id: 'P-SAMPLE-002', chrom: 'chr7', start: 55010000, end_pos: 55011500, score: 0.73, strand: '-', gene_symbol: 'EGFR', created_at: '2025-01-16' },
  { id: '5', sample_id: 'C-SAMPLE-003', chrom: 'chr12', start: 25000000, end_pos: 25001800, score: 0.82, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
  { id: '6', sample_id: 'C-SAMPLE-003', chrom: 'chr12', start: 25005000, end_pos: 25006000, score: 0.67, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
  { id: '7', sample_id: 'P-SAMPLE-004', chrom: 'chr1', start: 150000000, end_pos: 150002000, score: 0.89, strand: '-', gene_symbol: 'TP53', created_at: '2025-01-18' },
  { id: '8', sample_id: 'P-SAMPLE-004', chrom: 'chr1', start: 150010000, end_pos: 150011500, score: 0.94, strand: '+', gene_symbol: 'TP53', created_at: '2025-01-18' },
  { id: '9', sample_id: 'C-SAMPLE-005', chrom: 'chr2', start: 47000000, end_pos: 47002500, score: 0.78, strand: '+', gene_symbol: 'MYCN', created_at: '2025-01-19' },
  { id: '10', sample_id: 'C-SAMPLE-005', chrom: 'chr2', start: 47008000, end_pos: 47009500, score: 0.86, strand: '-', gene_symbol: 'ALK', created_at: '2025-01-19' },
];
