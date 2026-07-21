import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chrom = searchParams.get('chrom');
  const geneSymbol = searchParams.get('gene_symbol');
  const minScore = searchParams.get('min_score');
  const start = searchParams.get('start');
  const endPos = searchParams.get('end_pos');
  const sampleId = searchParams.get('sample_id');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Return fallback demo data when Supabase is not configured
  if (!isSupabaseConfigured) {
    return NextResponse.json({
      data: DEMO_PROMOTERS.slice(offset, offset + limit),
      total: DEMO_PROMOTERS.length,
      offset,
      limit,
      _demo: true,
    });
  }

  let query = supabase
    .from('predicted_promoters')
    .select('*', { count: 'exact' });

  if (chrom) query = query.eq('chrom', chrom);
  if (geneSymbol) query = query.ilike('gene_symbol', `%${geneSymbol}%`);
  if (minScore) query = query.gte('score', parseFloat(minScore));
  if (start) query = query.gte('start', parseInt(start));
  if (endPos) query = query.lte('end_pos', parseInt(endPos));
  if (sampleId) query = query.eq('sample_id', sampleId);

  const { data, error, count } = await query
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    offset,
    limit,
  });
}

// Minimal demo data used when Supabase is not yet connected
const DEMO_PROMOTERS = [
  { id: '1', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43044295, end_pos: 43045800, score: 0.95, strand: '+', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
  { id: '2', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43050000, end_pos: 43051500, score: 0.88, strand: '-', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
  { id: '3', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55000000, end_pos: 55002000, score: 0.91, strand: '+', gene_symbol: 'EGFR', created_at: '2025-01-16' },
  { id: '4', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55010000, end_pos: 55011500, score: 0.73, strand: '-', gene_symbol: 'EGFR', created_at: '2025-01-16' },
  { id: '5', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25000000, end_pos: 25001800, score: 0.82, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
  { id: '6', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25005000, end_pos: 25006000, score: 0.67, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
  { id: '7', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150000000, end_pos: 150002000, score: 0.89, strand: '-', gene_symbol: 'TP53', created_at: '2025-01-18' },
  { id: '8', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150010000, end_pos: 150011500, score: 0.94, strand: '+', gene_symbol: 'TP53', created_at: '2025-01-18' },
  { id: '9', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47000000, end_pos: 47002500, score: 0.78, strand: '+', gene_symbol: 'MYCN', created_at: '2025-01-19' },
  { id: '10', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47008000, end_pos: 47009500, score: 0.86, strand: '-', gene_symbol: 'ALK', created_at: '2025-01-19' },
];
