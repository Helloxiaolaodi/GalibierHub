-- ============================================================
-- SeqEdge — Supabase Database Schema
-- ============================================================
-- Run this SQL in your Supabase SQL Editor to create all
-- required tables, indexes, and sample data.

-- 1. Genome samples metadata
CREATE TABLE IF NOT EXISTS genome_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id TEXT UNIQUE NOT NULL,
  species TEXT NOT NULL,
  tissue TEXT,
  sequencing_platform TEXT,
  assembly_version TEXT NOT NULL DEFAULT 'NC_045512.2',
  total_variants INTEGER DEFAULT 0,
  coverage NUMERIC DEFAULT 0,
  -- Phenotype / cohort metadata — optional, drives the metadata filter panel
  cohort TEXT,
  bmi NUMERIC,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'unknown') OR sex IS NULL),
  vcf_download_url TEXT,
  fasta_download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Idempotent column upgrades — safe to re-run when the table already exists
-- from an earlier schema version that didn't have cohort / BMI / age / sex.
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS cohort TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS bmi NUMERIC;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS sex TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genome_samples_sex_check'
  ) THEN
    ALTER TABLE genome_samples
      ADD CONSTRAINT genome_samples_sex_check
      CHECK (sex IN ('male', 'female', 'unknown') OR sex IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_samples_species ON genome_samples (species);
CREATE INDEX IF NOT EXISTS idx_samples_cohort ON genome_samples (cohort);
CREATE INDEX IF NOT EXISTS idx_samples_bmi ON genome_samples (bmi);

-- 2. Predicted promoters (the core table)
CREATE TABLE IF NOT EXISTS predicted_promoters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id TEXT REFERENCES genome_samples(sample_id),
  chrom TEXT NOT NULL,
  start INTEGER NOT NULL,
  end_pos INTEGER NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 1),
  strand TEXT NOT NULL CHECK (strand IN ('+', '-')),
  gene_symbol TEXT,
  sequence TEXT,
  tss_distance INTEGER,           -- distance to transcription start site
  motif_sequence TEXT,             -- e.g. TATA-box motif
  evidence_level TEXT DEFAULT 'predicted',  -- predicted, validated, curated
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Variant index (optional — for large-scale variant search)
CREATE TABLE IF NOT EXISTS variant_index (
  id BIGSERIAL PRIMARY KEY,
  chrom TEXT NOT NULL,
  pos INTEGER NOT NULL,
  ref_allele TEXT NOT NULL,
  alt_allele TEXT NOT NULL,
  quality NUMERIC,
  gene_symbol TEXT,
  consequence TEXT,
  sample_id TEXT REFERENCES genome_samples(sample_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_promoters_chrom ON predicted_promoters (chrom);
CREATE INDEX IF NOT EXISTS idx_promoters_gene ON predicted_promoters (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_promoters_score ON predicted_promoters (score);
CREATE INDEX IF NOT EXISTS idx_promoters_sample ON predicted_promoters (sample_id);
CREATE INDEX IF NOT EXISTS idx_promoters_range ON predicted_promoters (chrom, start, end_pos);
CREATE INDEX IF NOT EXISTS idx_promoters_strand ON predicted_promoters (strand);
CREATE INDEX IF NOT EXISTS idx_variants_chrom_pos ON variant_index (chrom, pos);
CREATE INDEX IF NOT EXISTS idx_variants_gene ON variant_index (gene_symbol);

-- Enable Row Level Security (RLS)
ALTER TABLE genome_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicted_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_index ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key can SELECT).
-- Postgres' CREATE POLICY does not support IF NOT EXISTS, so we drop first
-- to make this script idempotent for re-runs.
DROP POLICY IF EXISTS "Public read genome_samples"      ON genome_samples;
DROP POLICY IF EXISTS "Public read predicted_promoters" ON predicted_promoters;
DROP POLICY IF EXISTS "Public read variant_index"       ON variant_index;

CREATE POLICY "Public read genome_samples"      ON genome_samples      FOR SELECT TO anon USING (true);
CREATE POLICY "Public read predicted_promoters" ON predicted_promoters FOR SELECT TO anon USING (true);
CREATE POLICY "Public read variant_index"       ON variant_index       FOR SELECT TO anon USING (true);

-- ============================================================
-- Sample data (remove in production)
-- ============================================================
-- Idempotent seed for the samples table using the bundled public SARS-CoV-2
-- reference assembly and annotations.
INSERT INTO genome_samples (sample_id, species, tissue, sequencing_platform, assembly_version, total_variants, coverage, cohort, bmi, age, sex) VALUES
  ('SCOV2-REF-001', 'Severe acute respiratory syndrome coronavirus 2', 'nasopharyngeal swab', 'Illumina', 'NC_045512.2', 0, 100.0, 'Reference genome', NULL, NULL, NULL)
ON CONFLICT (sample_id) DO UPDATE SET
  species             = EXCLUDED.species,
  tissue              = EXCLUDED.tissue,
  sequencing_platform = EXCLUDED.sequencing_platform,
  assembly_version    = EXCLUDED.assembly_version,
  total_variants      = EXCLUDED.total_variants,
  coverage            = EXCLUDED.coverage,
  cohort              = EXCLUDED.cohort,
  bmi                 = EXCLUDED.bmi,
  age                 = EXCLUDED.age,
  sex                 = EXCLUDED.sex;

-- Promoter seed rows — safe on a fresh database. Skip this block if
-- predicted_promoters already contains data you want to keep.
INSERT INTO predicted_promoters (sample_id, chrom, start, end_pos, score, strand, gene_symbol, sequence) VALUES
  ('SCOV2-REF-001', 'NC_045512.2', 266, 21555, 0.98, '+', 'ORF1ab', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 21563, 25384, 0.97, '+', 'S', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 25393, 26220, 0.90, '+', 'ORF3a', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 26245, 26472, 0.84, '+', 'E', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 26523, 27191, 0.92, '+', 'M', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 27202, 27387, 0.76, '+', 'ORF6', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 27394, 27759, 0.82, '+', 'ORF7a', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 27756, 27887, 0.71, '+', 'ORF7b', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 27894, 28259, 0.80, '+', 'ORF8', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 28274, 29533, 0.95, '+', 'N', NULL),
  ('SCOV2-REF-001', 'NC_045512.2', 29558, 29674, 0.68, '+', 'ORF10', NULL);
