-- Pre-aggregated overview statistics for the GalibierHub dashboard.
-- These views avoid expensive COUNT/GROUP BY work on the hot request path.

CREATE OR REPLACE VIEW public.overview_species_stats AS
SELECT
  species,
  COUNT(*) AS count
FROM public.genome_samples
WHERE sample_id NOT IN (
  'SCOV2-REF-001',
  'SAMPLE-001',
  'SAMPLE-002',
  'SAMPLE-003',
  'SAMPLE-004',
  'SAMPLE-005',
  'SAMPLE-006',
  'P-SAMPLE-001',
  'P-SAMPLE-002',
  'P-SAMPLE-004',
  'C-SAMPLE-003',
  'C-SAMPLE-005',
  'V-SAMPLE-006'
)
GROUP BY species;

CREATE OR REPLACE VIEW public.overview_score_stats AS
SELECT
  CASE
    WHEN score >= 0.0 AND score < 0.1 THEN '0.0-0.1'
    WHEN score >= 0.1 AND score < 0.2 THEN '0.1-0.2'
    WHEN score >= 0.2 AND score < 0.3 THEN '0.2-0.3'
    WHEN score >= 0.3 AND score < 0.4 THEN '0.3-0.4'
    WHEN score >= 0.4 AND score < 0.5 THEN '0.4-0.5'
    WHEN score >= 0.5 AND score < 0.6 THEN '0.5-0.6'
    WHEN score >= 0.6 AND score < 0.7 THEN '0.6-0.7'
    WHEN score >= 0.7 AND score < 0.8 THEN '0.7-0.8'
    WHEN score >= 0.8 AND score < 0.9 THEN '0.8-0.9'
    WHEN score >= 0.9 AND score <= 1.0 THEN '0.9-1.0'
  END AS score_bucket,
  COUNT(*) AS count
FROM public.predicted_promoters
WHERE sample_id NOT IN (
  'SCOV2-REF-001',
  'SAMPLE-001',
  'SAMPLE-002',
  'SAMPLE-003',
  'SAMPLE-004',
  'SAMPLE-005',
  'SAMPLE-006',
  'P-SAMPLE-001',
  'P-SAMPLE-002',
  'P-SAMPLE-004',
  'C-SAMPLE-003',
  'C-SAMPLE-005',
  'V-SAMPLE-006'
)
GROUP BY score_bucket;

CREATE INDEX IF NOT EXISTS idx_genome_samples_species
  ON public.genome_samples (species);

CREATE INDEX IF NOT EXISTS idx_predicted_promoters_score
  ON public.predicted_promoters (score);
