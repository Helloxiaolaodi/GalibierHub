import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Dashboard statistics require a real data source.' },
      { status: 503 },
    );
  }

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

  const speciesDistribution: Record<string, number> = {};
  if (sampleData) {
    for (const row of sampleData) {
      const sp = row.species || 'Unknown';
      speciesDistribution[sp] = (speciesDistribution[sp] || 0) + 1;
    }
  }

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
