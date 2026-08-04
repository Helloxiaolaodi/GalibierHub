import { NextResponse } from "next/server";
import { isAllowedSampleId } from "@/lib/sample-exclusions";
import { getSupabase, isSupabaseConfigured } from "@/utils/supabase";

const DOWNLOAD_FIELDS =
  "sample_id, vcf_download_url, fasta_download_url, gb_download_url, bed_download_url, gff3_download_url";

const MAX_BATCH_IDS = 200;

function sanitizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || !isAllowedSampleId(id) || seen.has(id)) continue;
    seen.add(id);
    if (seen.size >= MAX_BATCH_IDS) break;
  }
  return [...seen];
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured. Sample metadata requires a real data source." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ids = sanitizeIds((body as { sample_ids?: unknown }).sample_ids);
  if (ids.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("genome_samples")
    .select(DOWNLOAD_FIELDS)
    .in("sample_id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byId = new Map<string, unknown>();
  for (const row of data ?? []) {
    if (row && typeof row.sample_id === "string") byId.set(row.sample_id, row);
  }
  const results = ids.map((id) => byId.get(id) ?? { sample_id: id });

  return NextResponse.json({ results });
}
