import { NextResponse } from 'next/server';
import { EXCLUDED_SAMPLE_IDS_FILTER } from '@/lib/sample-exclusions';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chrom = searchParams.get('chrom');
  const startPos = searchParams.get('start');
  const endPos = searchParams.get('end');
  const geneSymbol = searchParams.get('gene_symbol');
  const limit = Number.parseInt(searchParams.get('limit') || '1000');

  // Return empty when Supabase is not configured
  if (!isSupabaseConfigured) {
    return NextResponse.json({
      data: [],
      total: 0,
      message: 'Variant index API ready. Configure Supabase to enable queries.',
    });
  }

  let query = getSupabase()
    .from('variant_index')
    .select('*', { count: 'exact' })
    .not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER);

  if (chrom) query = query.eq('chrom', chrom);
  if (startPos && endPos) {
    query = query.gte('pos', Number.parseInt(startPos)).lte('pos', Number.parseInt(endPos));
  }
  if (geneSymbol) query = query.ilike('gene_symbol', `%${geneSymbol}%`);

  const { data, error, count } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
  });
}
