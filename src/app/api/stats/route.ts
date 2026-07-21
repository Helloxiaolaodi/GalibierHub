import { NextResponse } from 'next/server';

// Demo API route for dashboard statistics
// In production, replace with real Supabase aggregation queries
export async function GET() {
  // Demo data — replace with Supabase queries in production:
  //
  // const supabase = createClient(...);
  // const { count: totalSamples } = await supabase.from('genome_samples').select('*', { count: 'exact', head: true });
  // const { count: totalPromoters } = await supabase.from('predicted_promoters').select('*', { count: 'exact', head: true });
  // etc.

  return NextResponse.json({
    total_samples: 6,
    total_promoters: 125430,
    total_variants: 8947521,
    species_distribution: {
      'Homo sapiens': 3,
      'Oryza sativa': 2,
      'Escherichia coli': 1,
    },
    score_distribution: [
      { range: '0.0-0.1', count: 1204 },
      { range: '0.1-0.2', count: 3456 },
      { range: '0.2-0.3', count: 8901 },
      { range: '0.3-0.4', count: 15230 },
      { range: '0.4-0.5', count: 22340 },
      { range: '0.5-0.6', count: 28910 },
      { range: '0.6-0.7', count: 19870 },
      { range: '0.7-0.8', count: 14560 },
      { range: '0.8-0.9', count: 7890 },
      { range: '0.9-1.0', count: 1069 },
    ],
  });
}
