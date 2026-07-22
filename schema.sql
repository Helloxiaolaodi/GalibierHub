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
  assembly_version TEXT NOT NULL DEFAULT 'hg38',
  total_variants INTEGER DEFAULT 0,
  coverage NUMERIC DEFAULT 0,
  -- Phenotype / cohort metadata — optional, drives the metadata filter panel
  cohort TEXT,                -- e.g. 'P-Cohort' (primary), 'C-Cohort' (control), 'V-Validation'
  bmi NUMERIC,                -- WHO adult BMI reference: <18.5 underweight, 18.5-24.9 normal, 25-29.9 overweight, >=30 obese
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
-- Idempotent seed for the samples table — ON CONFLICT lets you re-run this
-- schema on a database that already has SAMPLE-001…SAMPLE-006 rows without
-- BMI / cohort metadata, and get the phenotype columns back-filled.
INSERT INTO genome_samples (sample_id, species, tissue, sequencing_platform, assembly_version, total_variants, coverage, cohort, bmi, age, sex) VALUES
  ('P-SAMPLE-001', 'Homo sapiens',     'liver',      'Illumina NovaSeq', 'hg38',      4523000, 30.5,  'P-Cohort',     22.4, 41,   'female'),
  ('P-SAMPLE-002', 'Homo sapiens',     'brain',      'Illumina NovaSeq', 'hg38',      3890000, 42.1,  'P-Cohort',     27.9, 58,   'male'),
  ('C-SAMPLE-003', 'Oryza sativa',     'leaf',       'PacBio HiFi',      'IRGSP-1.0', 2100000, 25.0,  'C-Cohort',     NULL, NULL, NULL),
  ('P-SAMPLE-004', 'Homo sapiens',     'breast',     'Illumina NovaSeq', 'hg38',      5100000, 35.8,  'P-Cohort',     31.5, 63,   'female'),
  ('C-SAMPLE-005', 'Oryza sativa',     'root',       'Nanopore',         'IRGSP-1.0', 1780000, 28.3,  'C-Cohort',     NULL, NULL, NULL),
  ('V-SAMPLE-006', 'Escherichia coli', 'whole_cell', 'Illumina MiSeq',   'ASM584v2',  892000,  100.0, 'V-Validation', NULL, NULL, NULL)
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
  ('P-SAMPLE-001', 'chr17', 43044295, 43045800, 0.95, '+', 'BRCA1', 'ATGCGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCATCGATCG'),
  ('P-SAMPLE-001', 'chr17', 43050000, 43051500, 0.88, '-', 'BRCA1', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('P-SAMPLE-002', 'chr7', 55000000, 55002000, 0.91, '+', 'EGFR', 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC'),
  ('P-SAMPLE-002', 'chr7', 55010000, 55011500, 0.73, '-', 'EGFR', 'TTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC'),
  ('C-SAMPLE-003', 'chr12', 25000000, 25001800, 0.82, '+', 'KRAS', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('C-SAMPLE-003', 'chr12', 25005000, 25006000, 0.67, '+', 'KRAS', 'AACGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('P-SAMPLE-004', 'chr1', 150000000, 150002000, 0.89, '-', 'TP53', 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('P-SAMPLE-004', 'chr1', 150010000, 150011500, 0.94, '+', 'TP53', 'GCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('C-SAMPLE-005', 'chr2', 47000000, 47002500, 0.78, '+', 'MYCN', 'TTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('C-SAMPLE-005', 'chr2', 47008000, 47009500, 0.86, '-', 'ALK', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('V-SAMPLE-006', 'chr3', 178000000, 178002000, 0.71, '+', 'PIK3CA', NULL),
  ('V-SAMPLE-006', 'chr3', 178010000, 178012000, 0.83, '-', 'PIK3CA', NULL);
