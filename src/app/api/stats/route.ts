import { NextResponse } from "next/server";
import { ALLOWED_SAMPLE_IDS } from "@/lib/sample-exclusions";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

const SCORE_BINS = [
  { range: "0.0-0.1", min: 0, max: 0.1 },
  { range: "0.1-0.2", min: 0.1, max: 0.2 },
  { range: "0.2-0.3", min: 0.2, max: 0.3 },
  { range: "0.3-0.4", min: 0.3, max: 0.4 },
  { range: "0.4-0.5", min: 0.4, max: 0.5 },
  { range: "0.5-0.6", min: 0.5, max: 0.6 },
  { range: "0.6-0.7", min: 0.6, max: 0.7 },
  { range: "0.7-0.8", min: 0.7, max: 0.8 },
  { range: "0.8-0.9", min: 0.8, max: 0.9 },
  { range: "0.9-1.0", min: 0.9, max: 1.0 },
] as const;

async function computeSpeciesDistribution(sb: ReturnType<typeof getSupabase>) {
  const { data: sampleData, error: sampleDataError } = await sb
    .from("genome_samples")
    .select("species, sample_id")
    .in("sample_id", ALLOWED_SAMPLE_IDS);

  if (sampleDataError) {
    return { error: sampleDataError.message };
  }

  const speciesDistribution: Record<string, number> = {};
  if (sampleData) {
    for (const row of sampleData) {
      const sp = row.species || "Unknown";
      speciesDistribution[sp] = (speciesDistribution[sp] || 0) + 1;
    }
  }

  return { speciesDistribution };
}

async function computeScoreDistribution(sb: ReturnType<typeof getSupabase>) {
  const { data: scores, error: fetchErr } = await sb
    .from("predicted_promoters")
    .select("score")
    .in("sample_id", ALLOWED_SAMPLE_IDS);

  if (fetchErr) {
    return { error: fetchErr.message };
  }

  const bins: Record<string, number> = {};
  for (const bin of SCORE_BINS) {
    bins[bin.range] = 0;
  }

  for (const row of scores || []) {
    const s = row.score as number;
    for (const bin of SCORE_BINS) {
      if (s >= bin.min && s < bin.max) {
        bins[bin.range] = (bins[bin.range] || 0) + 1;
        break;
      }
    }
  }

  const scoreDistribution = SCORE_BINS.map((bin) => ({
    range: bin.range,
    count: bins[bin.range] || 0,
  }));

  return { scoreDistribution };
}

function isMissingVisitorsTable(message: string | undefined) {
  if (!message) {
    return false;
  }

  return (
    message.includes('public.site_visitors')
    || message.includes('relation "site_visitors" does not exist')
    || message.includes('relation "public.site_visitors" does not exist')
  );
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Dashboard statistics require a real data source." },
      { status: 503 },
    );
  }

  const sb = getSupabase();
  const [
    { count: totalSamples, error: samplesError },
    { count: totalPromoters, error: promotersError },
    { count: totalVariants, error: variantsError },
  ] = await Promise.all([
    sb.from("genome_samples").select("*", { count: "exact", head: true }).in("sample_id", ALLOWED_SAMPLE_IDS),
    sb.from("predicted_promoters").select("*", { count: "exact", head: true }).in("sample_id", ALLOWED_SAMPLE_IDS),
    sb.from("variant_index").select("*", { count: "exact", head: true }).in("sample_id", ALLOWED_SAMPLE_IDS),
  ]);

  const statsQueryErrors = [samplesError, promotersError, variantsError]
    .filter((error) => Boolean(error))
    .map((error) => error!.message);

  if (statsQueryErrors.length > 0) {
    return NextResponse.json(
      { error: `Failed to load dashboard statistics from Supabase: ${statsQueryErrors.join(" | ")}` },
      { status: 500 },
    );
  }

  let totalVisitors = 0;
  const { count: visitorCount, error: visitorsError } = await sb
    .from("site_visitors")
    .select("*", { count: "exact", head: true });

  if (visitorsError && !isMissingVisitorsTable(visitorsError.message)) {
    return NextResponse.json(
      { error: `Failed to load visitor statistics from Supabase: ${visitorsError.message}` },
      { status: 500 },
    );
  }

  if (!visitorsError) {
    totalVisitors = visitorCount ?? 0;
  }

  const [speciesResult, scoreResult] = await Promise.all([
    computeSpeciesDistribution(sb),
    computeScoreDistribution(sb),
  ]);

  if (speciesResult.error) {
    return NextResponse.json(
      { error: `Failed to load species distribution from Supabase: ${speciesResult.error}` },
      { status: 500 },
    );
  }

  if (scoreResult.error) {
    return NextResponse.json(
      { error: `Failed to load promoter score distribution from Supabase: ${scoreResult.error}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      total_samples: totalSamples ?? 0,
      total_promoters: totalPromoters ?? 0,
      total_variants: totalVariants ?? 0,
      total_visitors: totalVisitors,
      species_distribution: speciesResult.speciesDistribution,
      score_distribution: scoreResult.scoreDistribution,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
