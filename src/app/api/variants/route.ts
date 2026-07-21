import { NextResponse } from 'next/server';

// Demo API route for variant index queries
// In production, replace with real Supabase queries
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chrom = searchParams.get('chrom');
  const startPos = searchParams.get('start');
  const endPos = searchParams.get('end');
  const geneSymbol = searchParams.get('gene_symbol');
  const limit = parseInt(searchParams.get('limit') || '1000');

  // Demo data — replace with Supabase query:
  // let query = supabase.from('variant_index').select('*');
  // if (chrom) query = query.eq('chrom', chrom);
  // if (startPos && endPos) query = query.gte('pos', parseInt(startPos)).lte('pos', parseInt(endPos));
  // if (geneSymbol) query = query.ilike('gene_symbol', %%);
  // const { data, error } = await query.limit(limit);

  return NextResponse.json({
    data: [],
    total: 0,
    message: 'Variant index API ready. Configure Supabase to enable queries.',
  });
}
