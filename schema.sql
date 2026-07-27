-- ============================================================
-- SeqEdge â€” Supabase Database Schema
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
  -- Phenotype / cohort metadata â€” optional, drives the metadata filter panel
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
  hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS author_email TEXT;
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
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

-- 7. Site visitors (browser-level cumulative visitor counter)
CREATE TABLE IF NOT EXISTS site_visitors (
  id BIGSERIAL PRIMARY KEY,
  fingerprint_hash TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_visitors ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
ALTER TABLE site_visitors ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE site_visitors ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_visitors_fingerprint_hash_key'
  ) THEN
    ALTER TABLE site_visitors ADD CONSTRAINT site_visitors_fingerprint_hash_key UNIQUE (fingerprint_hash);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen_at ON site_visitors (last_seen_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE genome_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicted_promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Public read site_visitors"       ON site_visitors;
DROP POLICY IF EXISTS "Public insert site_visitors"     ON site_visitors;

CREATE POLICY "Public read genome_samples"      ON genome_samples      FOR SELECT TO anon USING (true);
CREATE POLICY "Public read predicted_promoters" ON predicted_promoters FOR SELECT TO anon USING (true);
CREATE POLICY "Public read variant_index"       ON variant_index       FOR SELECT TO anon USING (true);
CREATE POLICY "Public read site_feedback"       ON site_feedback       FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert site_feedback"     ON site_feedback       FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read feedback_comments"   ON feedback_comments   FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert feedback_comments" ON feedback_comments   FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read site_reactions"      ON site_reactions      FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert site_reactions"    ON site_reactions      FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Public read site_visitors"       ON site_visitors       FOR SELECT TO anon USING (true);
CREATE POLICY "Public insert site_visitors"     ON site_visitors       FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Supabase Storage bucket for feedback images (REQUIRED)
-- Run this block in the Supabase SQL Editor to enable image uploads.
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public read feedback images" ON storage.objects;
CREATE POLICY "Public read feedback images" ON storage.objects
  FOR SELECT USING (bucket_id = 'feedback-images');
DROP POLICY IF EXISTS "Anyone can upload feedback images" ON storage.objects;
CREATE POLICY "Anyone can upload feedback images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'feedback-images');

-- ============================================================
-- DELETE policies for reactions and feedback entries
-- ============================================================
DROP POLICY IF EXISTS "Public delete site_reactions" ON site_reactions;
CREATE POLICY "Public delete site_reactions" ON site_reactions FOR DELETE TO anon USING (true);
DROP POLICY IF EXISTS "Service delete site_feedback" ON site_feedback;
CREATE POLICY "Service delete site_feedback" ON site_feedback FOR DELETE TO anon USING (true);
-- ============================================================
-- UPDATE policies for feedback-related tables
-- ============================================================
DROP POLICY IF EXISTS "Public update site_feedback" ON site_feedback;
CREATE POLICY "Public update site_feedback" ON site_feedback FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "Public update feedback_comments" ON feedback_comments;
CREATE POLICY "Public update feedback_comments" ON feedback_comments FOR UPDATE TO anon USING (true);

-- ============================================================
-- Download metadata (Administrator-edited file info, hide/password) and download count
-- ============================================================
CREATE TABLE IF NOT EXISTS download_metadata (
  download_key TEXT PRIMARY KEY,
  custom_label TEXT,
  custom_size_bytes BIGINT,
  custom_file_type TEXT,
  custom_description TEXT,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'public_url',
  storage_bucket TEXT,
  storage_path TEXT,
  signed_url_ttl_seconds INTEGER NOT NULL DEFAULT 900,
  md5_checksum TEXT,
  sha256_checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS custom_label TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS custom_size_bytes BIGINT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS custom_file_type TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS custom_description TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'public_url';
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS signed_url_ttl_seconds INTEGER NOT NULL DEFAULT 900;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS md5_checksum TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS sha256_checksum TEXT;
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE download_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_metadata_storage_provider_check'
  ) THEN
    ALTER TABLE download_metadata
      ADD CONSTRAINT download_metadata_storage_provider_check
      CHECK (storage_provider IN ('public_url', 'supabase_private'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_metadata_signed_url_ttl_seconds_check'
  ) THEN
    ALTER TABLE download_metadata
      ADD CONSTRAINT download_metadata_signed_url_ttl_seconds_check
      CHECK (signed_url_ttl_seconds BETWEEN 60 AND 86400);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_metadata_private_storage_check'
  ) THEN
    ALTER TABLE download_metadata
      ADD CONSTRAINT download_metadata_private_storage_check
      CHECK (
        storage_provider <> 'supabase_private'
        OR (
          storage_bucket IS NOT NULL AND btrim(storage_bucket) <> ''
          AND storage_path IS NOT NULL AND btrim(storage_path) <> ''
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS download_events (
  id BIGSERIAL PRIMARY KEY,
  download_key TEXT NOT NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE download_events ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE download_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS download_events_key_idx ON download_events (download_key);

ALTER TABLE download_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read download_metadata" ON download_metadata;
CREATE POLICY "Public read download_metadata" ON download_metadata FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Public insert download_metadata" ON download_metadata;
DROP POLICY IF EXISTS "Service insert download_metadata" ON download_metadata;
CREATE POLICY "Service insert download_metadata" ON download_metadata FOR INSERT TO authenticated WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public update download_metadata" ON download_metadata;
DROP POLICY IF EXISTS "Service update download_metadata" ON download_metadata;
CREATE POLICY "Service update download_metadata" ON download_metadata FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public read download_events" ON download_events;
DROP POLICY IF EXISTS "Service read download_events" ON download_events;
CREATE POLICY "Service read download_events" ON download_events FOR SELECT TO authenticated USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public insert download_events" ON download_events;
DROP POLICY IF EXISTS "Service insert download_events" ON download_events;
CREATE POLICY "Service insert download_events" ON download_events FOR INSERT TO authenticated WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Safer RLS for feedback writes: public reads remain open, but
-- Administrator/admin mutations are expected to use the server-side
-- SUPABASE_SERVICE_ROLE_KEY configured in the application.
-- ============================================================
DROP POLICY IF EXISTS "Public update site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Public delete site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Service update site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Service delete site_feedback" ON site_feedback;
CREATE POLICY "Service update site_feedback" ON site_feedback FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service delete site_feedback" ON site_feedback FOR DELETE TO authenticated USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public update feedback_comments" ON feedback_comments;

DROP POLICY IF EXISTS "Public delete site_reactions" ON site_reactions;
DROP POLICY IF EXISTS "Service delete site_reactions" ON site_reactions;
CREATE POLICY "Service delete site_reactions" ON site_reactions FOR DELETE TO authenticated USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public update site_visitors" ON site_visitors;
DROP POLICY IF EXISTS "Service update site_visitors" ON site_visitors;
CREATE POLICY "Service update site_visitors" ON site_visitors FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Public delete feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Service update feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Service delete feedback_comments" ON feedback_comments;
CREATE POLICY "Service update feedback_comments" ON feedback_comments FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service delete feedback_comments" ON feedback_comments FOR DELETE TO authenticated USING (auth.role() = 'service_role');
