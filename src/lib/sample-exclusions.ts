export const EXCLUDED_SAMPLE_IDS = [
  'SCOV2-REF-001',
  'SAMPLE-001',
  'SAMPLE-002',
  'SAMPLE-003',
  'SAMPLE-004',
  'SAMPLE-005',
  'SAMPLE-006',
] as const;

const quotedIds = EXCLUDED_SAMPLE_IDS.map((id) => `"${id}"`).join(',');

export const EXCLUDED_SAMPLE_IDS_FILTER = `(${quotedIds})`;

export function isExcludedSampleId(sampleId: string | null | undefined): boolean {
  return !!sampleId && EXCLUDED_SAMPLE_IDS.includes(sampleId as (typeof EXCLUDED_SAMPLE_IDS)[number]);
}
