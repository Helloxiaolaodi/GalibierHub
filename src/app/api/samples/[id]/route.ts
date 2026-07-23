import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

const TEMPLATE_SAMPLE_ID = 'SCOV2-REF-001';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (id === TEMPLATE_SAMPLE_ID) {
    return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Sample metadata requires a real data source.' },
      { status: 503 },
    );
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
