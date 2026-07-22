import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

export async function GET() {
  // Return fallback demo data when Supabase is not configured
  if (!isSupabaseConfigured) {
    return NextResponse.json(DEMO_STATS);
  }

  // Fetch counts from Supabase
  const sb = getSupabase();
  const [
    { count: totalSamples },
    { count: totalPromoters },
    { count: totalVariants },
    { data: sampleData },
  ] = await Promise.all([
    sb.from('genome_samples').select('*', { count: 'exact', head: true }),
    sb.from('predicted_promoters').select('*', { count: 'exact', head: true }),
    sb.from('variant_index').select('*', { count: 'exact', head: true }),
    sb.from('genome_samples').select('species'),
  ]);

  // Build species distribution from sample data
  const speciesDistribution: Record<string, number> = {};
  if (sampleData) {
    for (const row of sampleData) {
      const sp = row.species || 'Unknown';
      speciesDistribution[sp] = (speciesDistribution[sp] || 0) + 1;
    }
  }

  // Compute score distribution via Supabase
  const { data: scoreData } = await getSupabase()
    .from('predicted_promoters')
    .select('score');

  const bins = [
    { range: '0.0-0.1', min: 0, max: 0.1 },
    { range: '0.1-0.2', min: 0.1, max: 0.2 },
    { range: '0.2-0.3', min: 0.2, max: 0.3 },
    { range: '0.3-0.4', min: 0.3, max: 0.4 },
    { range: '0.4-0.5', min: 0.4, max: 0.5 },
    { range: '0.5-0.6', min: 0.5, max: 0.6 },
    { range: '0.6-0.7', min: 0.6, max: 0.7 },
    { range: '0.7-0.8', min: 0.7, max: 0.8 },
    { range: '0.8-0.9', min: 0.8, max: 0.9 },
    { range: '0.9-1.0', min: 0.9, max: 1.01 },
  ];

  const scoreDistribution = bins.map((bin) => ({
    range: bin.range,
    count: scoreData
      ? scoreData.filter((row: { score: number }) => row.score >= bin.min && row.score < bin.max).length
      : 0,
  }));

  return NextResponse.json({
    total_samples: totalSamples ?? 0,
    total_promoters: totalPromoters ?? 0,
    total_variants: totalVariants ?? 0,
    species_distribution: speciesDistribution,
    score_distribution: scoreDistribution,
  });
}

// Minimal demo data used when Supabase is not yet connected
const DEMO_STATS = {
  total_samples: 6,
  total_promoters: 125430,
  total_variants: 8947521,
  species_distribution: {
    'Homo sapiens': 3,
    'Oryza sativa': 2,
    'Escherichia coli': 1,
  } as Record<string, number>,
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
};
