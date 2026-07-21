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
  vcf_download_url TEXT,
  fasta_download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Predicted promoters (the core table)
CREATE TABLE IF NOT EXISTS predicted_promoters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id TEXT REFERENCES genome_samples(sample_id),
  chrom TEXT NOT NULL,
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_promoters_range ON predicted_promoters (chrom, start, end);
CREATE INDEX IF NOT EXISTS idx_promoters_strand ON predicted_promoters (strand);
CREATE INDEX IF NOT EXISTS idx_variants_chrom_pos ON variant_index (chrom, pos);
CREATE INDEX IF NOT EXISTS idx_variants_gene ON variant_index (gene_symbol);

-- Enable Row Level Security (RLS)
ALTER TABLE genome_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicted_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_index ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key can SELECT)
CREATE POLICY "Public read genome_samples" ON genome_samples FOR SELECT TO anon USING (true);
CREATE POLICY "Public read predicted_promoters" ON predicted_promoters FOR SELECT TO anon USING (true);
CREATE POLICY "Public read variant_index" ON variant_index FOR SELECT TO anon USING (true);

-- ============================================================
-- Sample data (remove in production)
-- ============================================================
INSERT INTO genome_samples (sample_id, species, tissue, sequencing_platform, assembly_version, total_variants, coverage) VALUES
  ('SAMPLE-001', 'Homo sapiens', 'liver', 'Illumina NovaSeq', 'hg38', 4523000, 30.5),
  ('SAMPLE-002', 'Homo sapiens', 'brain', 'Illumina NovaSeq', 'hg38', 3890000, 42.1),
  ('SAMPLE-003', 'Oryza sativa', 'leaf', 'PacBio HiFi', 'IRGSP-1.0', 2100000, 25.0),
  ('SAMPLE-004', 'Homo sapiens', 'breast', 'Illumina NovaSeq', 'hg38', 5100000, 35.8),
  ('SAMPLE-005', 'Oryza sativa', 'root', 'Nanopore', 'IRGSP-1.0', 1780000, 28.3),
  ('SAMPLE-006', 'Escherichia coli', 'whole_cell', 'Illumina MiSeq', 'ASM584v2', 892000, 100.0);

INSERT INTO predicted_promoters (sample_id, chrom, start, end, score, strand, gene_symbol, sequence) VALUES
  ('SAMPLE-001', 'chr17', 43044295, 43045800, 0.95, '+', 'BRCA1', 'ATGCGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCATCGATCG'),
  ('SAMPLE-001', 'chr17', 43050000, 43051500, 0.88, '-', 'BRCA1', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-002', 'chr7', 55000000, 55002000, 0.91, '+', 'EGFR', 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC'),
  ('SAMPLE-002', 'chr7', 55010000, 55011500, 0.73, '-', 'EGFR', 'TTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC'),
  ('SAMPLE-003', 'chr12', 25000000, 25001800, 0.82, '+', 'KRAS', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-003', 'chr12', 25005000, 25006000, 0.67, '+', 'KRAS', 'AACGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-004', 'chr1', 150000000, 150002000, 0.89, '-', 'TP53', 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-004', 'chr1', 150010000, 150011500, 0.94, '+', 'TP53', 'GCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-005', 'chr2', 47000000, 47002500, 0.78, '+', 'MYCN', 'TTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-005', 'chr2', 47008000, 47009500, 0.86, '-', 'ALK', 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG'),
  ('SAMPLE-006', 'chr3', 178000000, 178002000, 0.71, '+', 'PIK3CA', NULL),
  ('SAMPLE-006', 'chr3', 178010000, 178012000, 0.83, '-', 'PIK3CA', NULL);
