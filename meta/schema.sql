-- ============================================================
-- GalibierHub Ã¢â‚¬â€ Supabase Database Schema
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
ALTER TABLE site_feedback ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
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
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read genome_samples' AND tablename = 'genome_samples') THEN
    CREATE POLICY "Public read genome_samples" ON genome_samples FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read predicted_promoters' AND tablename = 'predicted_promoters') THEN
    CREATE POLICY "Public read predicted_promoters" ON predicted_promoters FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read variant_index' AND tablename = 'variant_index') THEN
    CREATE POLICY "Public read variant_index" ON variant_index FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Public read site_feedback" ON site_feedback FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Public insert site_feedback" ON site_feedback FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read feedback_comments' AND tablename = 'feedback_comments') THEN
    CREATE POLICY "Public read feedback_comments" ON feedback_comments FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert feedback_comments' AND tablename = 'feedback_comments') THEN
    CREATE POLICY "Public insert feedback_comments" ON feedback_comments FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read site_reactions' AND tablename = 'site_reactions') THEN
    CREATE POLICY "Public read site_reactions" ON site_reactions FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert site_reactions' AND tablename = 'site_reactions') THEN
    CREATE POLICY "Public insert site_reactions" ON site_reactions FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read site_visitors' AND tablename = 'site_visitors') THEN
    CREATE POLICY "Public read site_visitors" ON site_visitors FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public insert site_visitors' AND tablename = 'site_visitors') THEN
    CREATE POLICY "Public insert site_visitors" ON site_visitors FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- Supabase Storage bucket for feedback images (REQUIRED)
-- Run this block in the Supabase SQL Editor to enable image uploads.
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Badge auto-award triggers
-- ============================================================

-- Add user_id to site_reactions for badge tracking
ALTER TABLE site_reactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Function to safely award a badge (idempotent)
CREATE OR REPLACE FUNCTION award_badge(p_user_id UUID, p_badge_id TEXT, p_discussion_id TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  badge_name TEXT;
  badge_icon TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id) THEN
    RETURN;
  END IF;
  INSERT INTO user_badges (user_id, badge_id, discussion_id) VALUES (p_user_id, p_badge_id, p_discussion_id);
  SELECT name, icon INTO badge_name, badge_icon FROM badge_definitions WHERE id = p_badge_id;
  IF badge_name IS NOT NULL THEN
    INSERT INTO site_notifications (recipient_id, discussion_id, actor_name, preview_text, is_read)
    VALUES (p_user_id, COALESCE(p_discussion_id, 'badges'), 'GalibierHub',
            COALESCE(badge_icon, '🏅') || ' You earned the "' || badge_name || '" badge!', false);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'award_badge error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on site_feedback INSERT
CREATE OR REPLACE FUNCTION trg_feedback_badges()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_badge(NEW.user_id, 'ice_breaker', NEW.id::text);
  IF NEW.message ~ '```' THEN
    PERFORM award_badge(NEW.user_id, 'markdown_master', NEW.id::text);
  END IF;
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    PERFORM award_badge(NEW.user_id, 'data_visualizer', NEW.id::text);
  END IF;
  IF NEW.message ~ 'github\.com/[^\s]+' THEN
    PERFORM award_badge(NEW.user_id, 'open_science', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_badges_trigger ON site_feedback;
CREATE TRIGGER trg_feedback_badges_trigger
  AFTER INSERT ON site_feedback
  FOR EACH ROW EXECUTE FUNCTION trg_feedback_badges();

-- Trigger on feedback_comments INSERT
CREATE OR REPLACE FUNCTION trg_comment_badges()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_badge(NEW.user_id, 'ice_breaker');
  IF NEW.message ~ '```' THEN
    PERFORM award_badge(NEW.user_id, 'markdown_master');
  END IF;
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    PERFORM award_badge(NEW.user_id, 'data_visualizer');
  END IF;
  IF NEW.message ~ 'github\.com/[^\s]+' THEN
    PERFORM award_badge(NEW.user_id, 'open_science');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_badges_trigger ON feedback_comments;
CREATE TRIGGER trg_comment_badges_trigger
  AFTER INSERT ON feedback_comments
  FOR EACH ROW EXECUTE FUNCTION trg_comment_badges();

-- Trigger on site_reactions INSERT
CREATE OR REPLACE FUNCTION trg_reaction_badges()
RETURNS TRIGGER AS $$
DECLARE
  feedback_author UUID;
  feedback_id UUID;
  reply_author UUID;
  total_likes INT;
  distinct_posts INT;
  likes_given INT;
  likes_received INT;
BEGIN
  IF NEW.reaction_type != 'like' THEN RETURN NEW; END IF;
  PERFORM award_badge(NEW.user_id, 'first_like');
  feedback_id := NEW.entry_id;
  BEGIN
    SELECT user_id, feedback_id INTO reply_author, feedback_id
    FROM feedback_comments WHERE id = NEW.entry_id;
    IF reply_author IS NOT NULL THEN
      SELECT COUNT(*) INTO total_likes FROM site_reactions
      WHERE reaction_type = 'like' AND entry_id = NEW.entry_id;
      IF total_likes >= 10 THEN
        PERFORM award_badge(reply_author, 'nice_reply', feedback_id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      SELECT user_id INTO feedback_author FROM site_feedback WHERE id = NEW.entry_id;
      IF feedback_author IS NOT NULL THEN
        SELECT COUNT(*) INTO total_likes FROM site_reactions
        WHERE reaction_type = 'like' AND entry_id = NEW.entry_id;
        IF total_likes = 1 THEN
          PERFORM award_badge(feedback_author, 'welcome', NEW.entry_id::text);
        END IF;
        IF total_likes >= 10 THEN
          PERFORM award_badge(feedback_author, 'nice_topic', NEW.entry_id::text);
        END IF;
        SELECT COUNT(DISTINCT entry_id) INTO distinct_posts FROM site_reactions
        WHERE reaction_type = 'like' AND entry_id IN (
          SELECT id FROM site_feedback WHERE user_id = feedback_author
        );
        IF distinct_posts >= 20 THEN
          PERFORM award_badge(feedback_author, 'appreciated');
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;
  IF NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO likes_given FROM site_reactions WHERE reaction_type = 'like' AND user_id = NEW.user_id;
    SELECT COUNT(*) INTO likes_received FROM site_reactions WHERE reaction_type = 'like' AND entry_id IN (
      SELECT id FROM site_feedback WHERE user_id = NEW.user_id
    );
    IF likes_given >= 10 AND likes_received >= 20 THEN
      PERFORM award_badge(NEW.user_id, 'thank_you');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reaction_badges_trigger ON site_reactions;
CREATE TRIGGER trg_reaction_badges_trigger
  AFTER INSERT ON site_reactions
  FOR EACH ROW EXECUTE FUNCTION trg_reaction_badges();

DROP POLICY IF EXISTS "Public read feedback images" ON storage.objects;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read feedback images' AND tablename = 'storage.objects') THEN
    CREATE POLICY "Public read feedback images" ON storage.objects FOR SELECT USING (bucket_id = 'feedback-images');
  END IF;
END $$;
DROP POLICY IF EXISTS "Anyone can upload feedback images" ON storage.objects;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload feedback images' AND tablename = 'storage.objects') THEN
    CREATE POLICY "Anyone can upload feedback images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'feedback-images');
  END IF;
END $$;

-- ============================================================
-- DELETE policies for reactions and feedback entries
-- ============================================================
DROP POLICY IF EXISTS "Public delete site_reactions" ON site_reactions;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public delete site_reactions' AND tablename = 'site_reactions') THEN
    CREATE POLICY "Public delete site_reactions" ON site_reactions FOR DELETE TO anon USING (true);
  END IF;
END $$;
DROP POLICY IF EXISTS "Service delete site_feedback" ON site_feedback;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service delete site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Service delete site_feedback" ON site_feedback FOR DELETE TO anon USING (true);
  END IF;
END $$;
-- ============================================================
-- UPDATE policies for feedback-related tables
-- ============================================================
DROP POLICY IF EXISTS "Public update site_feedback" ON site_feedback;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Public update site_feedback" ON site_feedback FOR UPDATE TO anon USING (true);
  END IF;
END $$;
DROP POLICY IF EXISTS "Public update feedback_comments" ON feedback_comments;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update feedback_comments' AND tablename = 'feedback_comments') THEN
    CREATE POLICY "Public update feedback_comments" ON feedback_comments FOR UPDATE TO anon USING (true);
  END IF;
END $$;

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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read download_metadata' AND tablename = 'download_metadata') THEN
    CREATE POLICY "Public read download_metadata" ON download_metadata FOR SELECT TO anon USING (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "Public insert download_metadata" ON download_metadata;
DROP POLICY IF EXISTS "Service insert download_metadata" ON download_metadata;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service insert download_metadata' AND tablename = 'download_metadata') THEN
    CREATE POLICY "Service insert download_metadata" ON download_metadata FOR INSERT TO authenticated WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public update download_metadata" ON download_metadata;
DROP POLICY IF EXISTS "Service update download_metadata" ON download_metadata;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service update download_metadata' AND tablename = 'download_metadata') THEN
    CREATE POLICY "Service update download_metadata" ON download_metadata FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public read download_events" ON download_events;
DROP POLICY IF EXISTS "Service read download_events" ON download_events;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service read download_events' AND tablename = 'download_events') THEN
    CREATE POLICY "Service read download_events" ON download_events FOR SELECT TO authenticated USING (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public insert download_events" ON download_events;
DROP POLICY IF EXISTS "Service insert download_events" ON download_events;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service insert download_events' AND tablename = 'download_events') THEN
    CREATE POLICY "Service insert download_events" ON download_events FOR INSERT TO authenticated WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- Safer RLS for feedback writes: public reads remain open, but
-- Administrator/admin mutations are expected to use the server-side
-- SUPABASE_SERVICE_ROLE_KEY configured in the application.
-- ============================================================
DROP POLICY IF EXISTS "Public update site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Public delete site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Service update site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Service delete site_feedback" ON site_feedback;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service update site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Service update site_feedback" ON site_feedback FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service delete site_feedback' AND tablename = 'site_feedback') THEN
    CREATE POLICY "Service delete site_feedback" ON site_feedback FOR DELETE TO authenticated USING (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public update feedback_comments" ON feedback_comments;

DROP POLICY IF EXISTS "Public delete site_reactions" ON site_reactions;
DROP POLICY IF EXISTS "Service delete site_reactions" ON site_reactions;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service delete site_reactions' AND tablename = 'site_reactions') THEN
    CREATE POLICY "Service delete site_reactions" ON site_reactions FOR DELETE TO authenticated USING (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public update site_visitors" ON site_visitors;
DROP POLICY IF EXISTS "Service update site_visitors" ON site_visitors;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service update site_visitors' AND tablename = 'site_visitors') THEN
    CREATE POLICY "Service update site_visitors" ON site_visitors FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DROP POLICY IF EXISTS "Public delete feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Service update feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Service delete feedback_comments" ON feedback_comments;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service update feedback_comments' AND tablename = 'feedback_comments') THEN
    CREATE POLICY "Service update feedback_comments" ON feedback_comments FOR UPDATE TO authenticated USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service delete feedback_comments' AND tablename = 'feedback_comments') THEN
    CREATE POLICY "Service delete feedback_comments" ON feedback_comments FOR DELETE TO authenticated USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- API Keys for programmatic access (machine-to-machine)
-- ============================================================
-- Allows bulk metadata export / automated retrieval for
-- authorized researchers without going through Turnstile.
-- API key traffic is rate-limited per-key (see middleware).

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  label TEXT,
  contact_email TEXT,
  rate_limit_rpm INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write api_keys (never expose to anon)
DROP POLICY IF EXISTS "Service manage api_keys" ON api_keys;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service manage api_keys' AND tablename = 'api_keys') THEN
    CREATE POLICY "Service manage api_keys" ON api_keys FOR ALL TO authenticated USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;


-- ============================================================
-- In-App Notifications Table
-- Run this SQL in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS site_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  discussion_id text NOT NULL,
  actor_name text,
  preview_text text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE site_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON site_notifications;
CREATE POLICY "Users can view own notifications" ON site_notifications FOR SELECT USING (auth.uid() = recipient_id);

-- Users can only update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON site_notifications;
CREATE POLICY "Users can update own notifications" ON site_notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- Server-side insert (use service role key)
DROP POLICY IF EXISTS "Service role can insert notifications" ON site_notifications;
CREATE POLICY "Service role can insert notifications" ON site_notifications FOR INSERT WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON site_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON site_notifications(recipient_id, is_read) WHERE is_read = false;


-- ============================================================
-- Badges system for gamification
-- ============================================================

-- Badge definitions table
CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'engagement',
  icon TEXT DEFAULT '',
  tier TEXT DEFAULT 'bronze',  -- bronze, silver, gold, platinum
  criteria TEXT NOT NULL       -- human-readable criteria
);

-- User badges (awarded badges)
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES badge_definitions(id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  discussion_id TEXT,          -- the discussion that triggered this badge
  UNIQUE(user_id, badge_id)    -- each badge awarded only once
);

-- RLS for user_badges
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view badges" ON user_badges;
CREATE POLICY "Anyone can view badges" ON user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can insert badges" ON user_badges;
CREATE POLICY "Service role can insert badges" ON user_badges FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

-- Seed badge definitions
INSERT INTO badge_definitions (id, name, description, category, icon, tier, criteria) VALUES
('ice_breaker', 'Ice Breaker', 'Posted your first discussion or reply', 'onboarding', '❄️', 'bronze', 'First comment or discussion'),
('first_like', 'First Like', 'Liked someone else''s post for the first time', 'onboarding', '👍', 'bronze', 'First like given'),
('welcome', 'Welcome', 'Your post received its first like', 'onboarding', '👋', 'bronze', 'Received first like on a post'),
('nice_reply', 'Nice Reply', 'A single reply earned 10 likes', 'engagement', '💬', 'silver', 'Single reply reaches 10 likes'),
('nice_topic', 'Nice Topic', 'A single discussion earned 10 likes', 'engagement', '📝', 'silver', 'Single topic reaches 10 likes'),
('enthusiast', 'Enthusiast', 'Visited Discussions for 10 consecutive days', 'engagement', '🔥', 'silver', '10-day activity streak'),
('appreciated', 'Appreciated', 'Received likes on 20 different posts', 'engagement', '⭐', 'gold', 'Liked on 20 different posts'),
('thank_you', 'Thank You', 'Gave 10 likes and received 20 likes', 'engagement', '🙏', 'gold', '10 given + 20 received likes'),
('markdown_master', 'Markdown Master', 'Used code blocks in a discussion', 'tech', '💻', 'bronze', 'Used code block syntax'),
('cli_maestro', 'CLI Maestro', 'Shared download CLI commands that earned 5 likes', 'tech', '🖥️', 'silver', 'CLI script with 5 likes'),
('data_visualizer', 'Data Visualizer', 'Uploaded a data visualization image', 'tech', '📊', 'silver', 'Uploaded visualization'),
('open_science', 'Open Science Advocate', 'Shared a GitHub/ repository link', 'tech', '🔬', 'bronze', 'Shared external repo link'),
('great_topic', 'Great Topic', 'Discussion reached 1000+ views and 20+ replies', 'milestone', '🏆', 'gold', '1000 views + 20 replies'),
('top_contributor', 'Top Contributor', 'Among top 5% most-liked users this year', 'milestone', '👑', 'platinum', 'Top 5% annual likes'),
('community_curator', 'Community Curator', 'Reply marked as official answer by admin', 'exclusive', '✅', 'gold', 'Official answer marked'),
('bug_hunter', 'Bug Hunter', 'Reported a valid bug that was resolved', 'exclusive', '🐛', 'gold', 'Bug report resolved')
ON CONFLICT (id) DO NOTHING;
