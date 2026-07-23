import { NextResponse } from 'next/server';
import { EXCLUDED_SAMPLE_IDS, EXCLUDED_SAMPLE_IDS_FILTER } from '@/lib/sample-exclusions';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

const SCORE_BINS = [
  { range: '0.0-0.1', min: 0, max: 0.1 },
  { range: '0.1-0.2', min: 0.1, max: 0.2 },
  { range: '0.2-0.3', min: 0.2, max: 0.3 },
  { range: '0.3-0.4', min: 0.3, max: 0.4 },
  { range: '0.4-0.5', min: 0.4, max: 0.5 },
  { range: '0.5-0.6', min: 0.5, max: 0.6 },
  { range: '0.6-0.7', min: 0.6, max: 0.7 },
  { range: '0.7-0.8', min: 0.7, max: 0.8 },
  { range: '0.8-0.9', min: 0.8, max: 0.9 },
  { range: '0.9-1.0', min: 0.9, max: 1.0 },
] as const;

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Dashboard statistics require a real data source.' },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const [
    { count: totalSamples, error: samplesError },
    { count: totalPromoters, error: promotersError },
    { count: totalVariants, error: variantsError },
    { data: sampleData, error: sampleDataError },
  ] = await Promise.all([
    sb.from('genome_samples').select('*', { count: 'exact', head: true }).not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER),
    sb.from('predicted_promoters').select('*', { count: 'exact', head: true }).not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER),
    sb.from('variant_index').select('*', { count: 'exact', head: true }),
    sb.from('genome_samples').select('species, sample_id').not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER),
  ]);

  const statsQueryErrors = [samplesError, promotersError, variantsError, sampleDataError]
    .filter((error) => Boolean(error))
    .map((error) => error!.message);

  if (statsQueryErrors.length > 0) {
    return NextResponse.json(
      {
        error: `Failed to load dashboard statistics from Supabase: ${statsQueryErrors.join(' | ')}`,
      },
      { status: 500 },
    );
  }

  const speciesDistribution: Record<string, number> = {};
  if (sampleData) {
    for (const row of sampleData) {
      if (EXCLUDED_SAMPLE_IDS.includes(row.sample_id)) {
        continue;
      }
      const sp = row.species || 'Unknown';
      speciesDistribution[sp] = (speciesDistribution[sp] || 0) + 1;
    }
  }

  const scoreDistributionResults = await Promise.all(
    SCORE_BINS.map(async (bin, index) => {
      let query = sb
        .from('predicted_promoters')
        .select('*', { count: 'exact', head: true })
        .not('sample_id', 'in', EXCLUDED_SAMPLE_IDS_FILTER)
        .gte('score', bin.min);

      query = index === SCORE_BINS.length - 1 ? query.lte('score', bin.max) : query.lt('score', bin.max);

      const { count, error } = await query;
      return {
        range: bin.range,
        count: count ?? 0,
        error,
      };
    }),
  );

  const scoreDataError = scoreDistributionResults.find((result) => result.error)?.error;

  if (scoreDataError) {
    return NextResponse.json(
      {
        error: `Failed to load promoter score distribution from Supabase: ${scoreDataError.message}`,
      },
      { status: 500 },
    );
  }

  const scoreDistribution = scoreDistributionResults.map(({ range, count }) => ({ range, count }));

  return NextResponse.json({
    total_samples: totalSamples ?? 0,
    total_promoters: totalPromoters ?? 0,
    total_variants: totalVariants ?? 0,
    species_distribution: speciesDistribution,
    score_distribution: scoreDistribution,
  });
}
