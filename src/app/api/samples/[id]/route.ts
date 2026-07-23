import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

const DEMO_SAMPLES: Record<string, Record<string, unknown>> = {
  'SCOV2-REF-001': {
    sample_id: 'SCOV2-REF-001',
    species: 'Severe acute respiratory syndrome coronavirus 2',
    tissue: 'nasopharyngeal swab',
    sequencing_platform: 'Illumina',
    assembly_version: 'NC_045512.2',
    coverage: 100.0,
    cohort: 'Reference genome',
    bmi: null,
    age: null,
    sex: null,
  },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!isSupabaseConfigured) {
    const demo = DEMO_SAMPLES[id];
    if (!demo) return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
    return NextResponse.json({ ...demo, _demo: true });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('genome_samples')
    .select('sample_id, species, tissue, sequencing_platform, assembly_version, coverage, cohort, bmi, age, sex')
    .eq('sample_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Sample not found' }, { status: 404 });

  return NextResponse.json(data);
}
