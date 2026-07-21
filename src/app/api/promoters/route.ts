import { NextResponse } from 'next/server';

// Demo API route for promoters
// In production, replace with real Supabase queries
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chrom = searchParams.get('chrom');
  const geneSymbol = searchParams.get('gene_symbol');
  const minScore = searchParams.get('min_score');
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const sampleId = searchParams.get('sample_id');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Demo data — replace with Supabase query in production:
  //
  // const supabase = createClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  // );
  // let query = supabase.from('predicted_promoters').select('*');
  // if (chrom) query = query.eq('chrom', chrom);
  // if (geneSymbol) query = query.ilike('gene_symbol', %%);
  // if (minScore) query = query.gte('score', parseFloat(minScore));
  // if (start) query = query.gte('start', parseInt(start));
  // if (end) query = query.lte('end', parseInt(end));
  // if (sampleId) query = query.eq('sample_id', sampleId);
  // const { data, error } = await query.range(offset, offset + limit - 1);

  const DEMO_PROMOTERS = [
    { id: '1', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43044295, end: 43045800, score: 0.95, strand: '+', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
    { id: '2', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43050000, end: 43051500, score: 0.88, strand: '-', gene_symbol: 'BRCA1', created_at: '2025-01-15' },
    { id: '3', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55000000, end: 55002000, score: 0.91, strand: '+', gene_symbol: 'EGFR', created_at: '2025-01-16' },
    { id: '4', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55010000, end: 55011500, score: 0.73, strand: '-', gene_symbol: 'EGFR', created_at: '2025-01-16' },
    { id: '5', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25000000, end: 25001800, score: 0.82, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
    { id: '6', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25005000, end: 25006000, score: 0.67, strand: '+', gene_symbol: 'KRAS', created_at: '2025-01-17' },
    { id: '7', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150000000, end: 150002000, score: 0.89, strand: '-', gene_symbol: 'TP53', created_at: '2025-01-18' },
    { id: '8', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150010000, end: 150011500, score: 0.94, strand: '+', gene_symbol: 'TP53', created_at: '2025-01-18' },
    { id: '9', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47000000, end: 47002500, score: 0.78, strand: '+', gene_symbol: 'MYCN', created_at: '2025-01-19' },
    { id: '10', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47008000, end: 47009500, score: 0.86, strand: '-', gene_symbol: 'ALK', created_at: '2025-01-19' },
  ];

  let filtered = [...DEMO_PROMOTERS];
  if (chrom) filtered = filtered.filter(p => p.chrom === chrom);
  if (geneSymbol) filtered = filtered.filter(p => p.gene_symbol?.toLowerCase().includes(geneSymbol.toLowerCase()));
  if (minScore) filtered = filtered.filter(p => p.score >= parseFloat(minScore));
  if (start) filtered = filtered.filter(p => p.start >= parseInt(start));
  if (end) filtered = filtered.filter(p => p.end <= parseInt(end));
  if (sampleId) filtered = filtered.filter(p => p.sample_id.toLowerCase().includes(sampleId.toLowerCase()));

  return NextResponse.json({
    data: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    limit,
  });
}
