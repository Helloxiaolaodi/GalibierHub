import { NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/utils/supabase';

const DEMO_SAMPLES: Record<string, Record<string, unknown>> = {
  'P-SAMPLE-001': { sample_id: 'P-SAMPLE-001', species: 'Homo sapiens', tissue: 'liver', sequencing_platform: 'Illumina NovaSeq', assembly_version: 'hg38', coverage: 30.5, cohort: 'P-Cohort', bmi: 22.4, age: 41, sex: 'female' },
  'P-SAMPLE-002': { sample_id: 'P-SAMPLE-002', species: 'Homo sapiens', tissue: 'brain', sequencing_platform: 'Illumina NovaSeq', assembly_version: 'hg38', coverage: 42.1, cohort: 'P-Cohort', bmi: 27.9, age: 58, sex: 'male' },
  'C-SAMPLE-003': { sample_id: 'C-SAMPLE-003', species: 'Oryza sativa', tissue: 'leaf', sequencing_platform: 'PacBio HiFi', assembly_version: 'IRGSP-1.0', coverage: 25.0, cohort: 'C-Cohort', bmi: null, age: null, sex: null },
  'P-SAMPLE-004': { sample_id: 'P-SAMPLE-004', species: 'Homo sapiens', tissue: 'breast', sequencing_platform: 'Illumina NovaSeq', assembly_version: 'hg38', coverage: 35.8, cohort: 'P-Cohort', bmi: 31.5, age: 63, sex: 'female' },
  'C-SAMPLE-005': { sample_id: 'C-SAMPLE-005', species: 'Oryza sativa', tissue: 'root', sequencing_platform: 'Nanopore', assembly_version: 'IRGSP-1.0', coverage: 28.3, cohort: 'C-Cohort', bmi: null, age: null, sex: null },
  'V-SAMPLE-006': { sample_id: 'V-SAMPLE-006', species: 'Escherichia coli', tissue: 'whole_cell', sequencing_platform: 'Illumina MiSeq', assembly_version: 'ASM584v2', coverage: 100.0, cohort: 'V-Validation', bmi: null, age: null, sex: null },
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
