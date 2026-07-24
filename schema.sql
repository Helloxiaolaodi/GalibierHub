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
  assembly_version TEXT NOT NULL,
  total_variants INTEGER DEFAULT 0,
  coverage NUMERIC DEFAULT 0,
  -- Phenotype / cohort metadata — optional, drives the metadata filter panel
  cohort TEXT,
  bmi NUMERIC,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'unknown') OR sex IS NULL),
  vcf_download_url TEXT,
  fasta_download_url TEXT,
  vcf_download_mode TEXT CHECK (vcf_download_mode IN ('direct', 'cli') OR vcf_download_mode IS NULL),
  fasta_download_mode TEXT CHECK (fasta_download_mode IN ('direct', 'cli') OR fasta_download_mode IS NULL),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Idempotent column upgrades
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS cohort TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS bmi NUMERIC;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS vcf_download_mode TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS fasta_download_mode TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS gb_download_url TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS bed_download_url TEXT;
ALTER TABLE genome_samples ADD COLUMN IF NOT EXISTS gff3_download_url TEXT;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genome_samples_sex_check'
  ) THEN
    ALTER TABLE genome_samples
      ADD CONSTRAINT genome_samples_sex_check
      CHECK (sex IN ('male', 'female', 'unknown') OR sex IS NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genome_samples_vcf_download_mode_check'
  ) THEN
    ALTER TABLE genome_samples
      ADD CONSTRAINT genome_samples_vcf_download_mode_check
      CHECK (vcf_download_mode IN ('direct', 'cli') OR vcf_download_mode IS NULL);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genome_samples_fasta_download_mode_check'
  ) THEN
    ALTER TABLE genome_samples
      ADD CONSTRAINT genome_samples_fasta_download_mode_check
      CHECK (fasta_download_mode IN ('direct', 'cli') OR fasta_download_mode IS NULL);
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
  tss_distance INTEGER,
  motif_sequence TEXT,
  evidence_level TEXT DEFAULT 'predicted',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Variant index (optional)
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

-- 4. Public site feedback
CREATE TABLE IF NOT EXISTS site_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  display_name TEXT NOT NULL,
  visitor_email TEXT,
  affiliation TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'issue', 'idea', 'data', 'collaboration')),
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  message TEXT NOT NULL,
  image_url TEXT,
  creator_reply TEXT,
  replied_at TIMESTAMPTZ,
  pinned BOOLEAN DEFAULT false,
  hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS visitor_email TEXT;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS creator_reply TEXT;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS visibility TEXT;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS image_url TEXT;
UPDATE site_feedback SET visibility = 'public' WHERE visibility IS NULL;
ALTER TABLE site_feedback ALTER COLUMN visibility SET DEFAULT 'public';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_feedback_visibility_check'
  ) THEN
    ALTER TABLE site_feedback
      ADD CONSTRAINT site_feedback_visibility_check
      CHECK (visibility IN ('public', 'private'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at ON site_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_feedback_category ON site_feedback (category);
CREATE INDEX IF NOT EXISTS idx_site_feedback_pinned ON site_feedback (pinned);

-- 5. Feedback comments (threaded replies from any visitor)
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES site_feedback(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  message TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_id ON feedback_comments (feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_created_at ON feedback_comments (created_at);

-- 6. Anonymous site reactions (per feedback entry)
CREATE TABLE IF NOT EXISTS site_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'bookmark')),
  fingerprint_hash TEXT NOT NULL,
  entry_id UUID REFERENCES site_feedback(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (reaction_type, fingerprint_hash, entry_id)
);
ALTER TABLE site_reactions DROP CONSTRAINT IF EXISTS site_reactions_reaction_type_fingerprint_hash_key;
ALTER TABLE site_reactions ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES site_feedback(id) ON DELETE CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_reactions_reaction_type_fingerprint_hash_entry_id_key')
  THEN ALTER TABLE site_reactions ADD CONSTRAINT site_reactions_reaction_type_fingerprint_hash_entry_id_key UNIQUE (reaction_type, fingerprint_hash, entry_id); END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_reactions_type ON site_reactions (reaction_type);
CREATE INDEX IF NOT EXISTS idx_site_reactions_entry ON site_reactions (entry_id);

-- Enable Row Level Security (RLS)
ALTER TABLE genome_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicted_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_reactions ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key can SELECT)
DROP POLICY IF EXISTS "Public read genome_samples"      ON genome_samples;
DROP POLICY IF EXISTS "Public read predicted_promoters" ON predicted_promoters;
DROP POLICY IF EXISTS "Public read variant_index"       ON variant_index;
DROP POLICY IF EXISTS "Public read site_feedback"       ON site_feedback;
DROP POLICY IF EXISTS "Public insert site_feedback"     ON site_feedback;
DROP POLICY IF EXISTS "Public read feedback_comments"   ON feedback_comments;
DROP POLICY IF EXISTS "Public insert feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Public read site_reactions"      ON site_reactions;
DROP POLICY IF EXISTS "Public insert site_reactions"    ON site_reactions;

CREATE POLICY "Public read genome_samples"      ON genome_samples      FOR SELECT TO anon USING (true);
CREATE POLICY "Public read predicted_promoters" ON predicted_promoters FOR SELECT TO anon USING (true);
CREATE POLICY "Public read variant_index"       ON variant_index       FOR SELECT TO anon USING (true);
CREATE POLICY "Public read site_feedback"       ON site_feedback       FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert site_feedback"     ON site_feedback       FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read feedback_comments"   ON feedback_comments   FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert feedback_comments" ON feedback_comments   FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read site_reactions"      ON site_reactions      FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert site_reactions"    ON site_reactions      FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Supabase Storage bucket for feedback images (optional)
-- Run this block separately in the Supabase SQL Editor
-- if image uploads are needed.
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', true)
-- ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Public read feedback images" ON storage.objects
--   FOR SELECT USING (bucket_id = 'feedback-images');
-- CREATE POLICY "Anyone can upload feedback images" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'feedback-images');
