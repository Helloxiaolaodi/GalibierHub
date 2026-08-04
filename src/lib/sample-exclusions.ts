export const ALLOWED_SAMPLE_IDS: string[] = [
  'CNhs13076',
  'CNhs13080',
  'CNhs13195',
  'CNhs13202',
  'CNhs13203',
  'CNhs13204',
  'CNhs13205',
  'CNhs13206',
  'CNhs13207',
  'CNhs13208',
  'CNhs13215',
  'CNhs13216',
];

const quotedIds = ALLOWED_SAMPLE_IDS.map((id) => `"${id}"`).join(',');

export const ALLOWED_SAMPLE_IDS_FILTER = `(${quotedIds})`;

export function isAllowedSampleId(sampleId: string | null | undefined): boolean {
  return !!sampleId && ALLOWED_SAMPLE_IDS.includes(sampleId);
}

export function isExcludedSampleId(sampleId: string | null | undefined): boolean {
  return !isAllowedSampleId(sampleId);
}
