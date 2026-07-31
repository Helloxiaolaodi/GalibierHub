-- GalibierHub Badge System v2
-- This migration is idempotent and reconciles the two earlier badge schemas.
-- Awarding is performed by database triggers only; the frontend only reads.

ALTER TABLE public.badge_definitions ADD COLUMN IF NOT EXISTS criteria TEXT NOT NULL DEFAULT '';
ALTER TABLE public.badge_definitions ADD COLUMN IF NOT EXISTS manual_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_badges ADD COLUMN IF NOT EXISTS discussion_id TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'download_events') THEN
    ALTER TABLE public.download_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.site_reactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.site_reactions ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.feedback_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_site_reactions_comment ON public.site_reactions(comment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_reactions_type_fp_comment
  ON public.site_reactions (reaction_type, fingerprint_hash, comment_id)
  WHERE comment_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'badge_definitions_tier_check' AND conrelid = 'public.badge_definitions'::regclass
  ) THEN
    ALTER TABLE public.badge_definitions DROP CONSTRAINT badge_definitions_tier_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'badge_definitions_tier_check' AND conrelid = 'public.badge_definitions'::regclass
  ) THEN
    ALTER TABLE public.badge_definitions ADD CONSTRAINT badge_definitions_tier_check CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges(badge_id);

INSERT INTO public.badge_definitions (id, name, description, icon, tier, category, criteria, manual_only) VALUES
('basecamp', 'Basecamp', 'Posted your first discussion topic', 'BC', 'bronze', 'discussions', 'Post your first discussion topic', false),
('hello_world', 'Hello World', 'Shared your first code snippet', 'HW', 'bronze', 'code', 'Share R or Python code in a discussion', false),
('profile_setup', 'The Peloton', 'Completed your public profile', 'PP', 'bronze', 'general', 'Complete your public profile', false),
('sherpa', 'The Sherpa', 'Received 5 or more likes on your replies', 'SH', 'silver', 'discussions', 'Earn 5 likes on replies', false),
('data_miner', 'Data Miner', 'Downloaded or uploaded a dataset', 'DM', 'silver', 'downloads', 'Download or upload a dataset', false),
('high_performance', 'High Performance', 'Discussed HPC, cluster, or pipeline topics', 'HP', 'silver', 'code', 'Discuss HPC or pipeline topics', false),
('helpful', 'Helpful', 'A reply was marked as helpful', 'HF', 'silver', 'discussions', 'Get a reply marked as helpful', false),
('hc', 'Hors Categorie', 'Reached the top 5 percent reputation', 'HC', 'gold', 'reputation', 'Reach the top 5 percent reputation', false),
('polka_dot', 'Polka Dot', 'Most liked author of the year', 'PD', 'gold', 'reputation', 'Be the most liked author of the year', false),
('pi', 'Principal Investigator', 'Certified research scholar', 'PI', 'gold', 'special', 'Awarded manually by GalibierHub admins', true),
('founder', 'Founder', 'GalibierHub founding member', 'FD', 'platinum', 'special', 'Awarded manually by GalibierHub admins', true),
('ice_breaker', 'Ice Breaker', 'Posted your first discussion or reply', 'IB', 'bronze', 'onboarding', 'First comment or discussion', false),
('first_like', 'First Like', 'Liked another post for the first time', 'FL', 'bronze', 'onboarding', 'Give your first like', false),
('welcome', 'Welcome', 'Your post received its first like', 'WL', 'bronze', 'onboarding', 'Receive your first like', false),
('nice_reply', 'Nice Reply', 'A single reply earned 10 likes', 'NR', 'silver', 'engagement', 'Earn 10 likes on one reply', false),
('nice_topic', 'Nice Topic', 'A single discussion earned 10 likes', 'NT', 'silver', 'engagement', 'Earn 10 likes on one topic', false),
('appreciated', 'Appreciated', 'Received likes on 20 different posts', 'AP', 'gold', 'engagement', 'Receive likes on 20 different posts', false),
('thank_you', 'Thank You', 'Gave 10 likes and received 20 likes', 'TY', 'gold', 'engagement', 'Give 10 likes and receive 20 likes', false),
('markdown_master', 'Markdown Master', 'Used code blocks in a discussion', 'MM', 'bronze', 'tech', 'Use code block syntax', false),
('data_visualizer', 'Data Visualizer', 'Uploaded a data visualization image', 'DV', 'silver', 'tech', 'Upload a visualization', false),
('open_science', 'Open Science Advocate', 'Shared a repository link', 'OS', 'bronze', 'tech', 'Share an external repository link', false),
('cli_maestro', 'CLI Maestro', 'Shared download CLI commands that earned 5 likes', 'CM', 'silver', 'tech', 'Share CLI commands that earn 5 likes', false),
('great_topic', 'Great Topic', 'Discussion reached 1000+ views and 20+ replies', 'GT', 'gold', 'milestone', 'Reach 1000 views and 20 replies', false),
('top_contributor', 'Top Contributor', 'Among top 5% most-liked users this year', 'TC', 'platinum', 'milestone', 'Be among the top 5% most-liked users this year', false),
('community_curator', 'Community Curator', 'Reply marked as an official answer by an admin', 'CC', 'gold', 'exclusive', 'Have a reply marked as an official answer', false),
('bug_hunter', 'Bug Hunter', 'Reported a valid bug that was resolved', 'BH', 'gold', 'exclusive', 'Report a bug that gets resolved', false),
('enthusiast', 'Enthusiast', 'Visited Discussions for 10 consecutive days', 'EN', 'silver', 'engagement', 'Visit Discussions 10 days in a row', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  tier = EXCLUDED.tier,
  category = EXCLUDED.category,
  criteria = EXCLUDED.criteria,
  manual_only = EXCLUDED.manual_only;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read badge definitions" ON public.badge_definitions;
DROP POLICY IF EXISTS "Anyone can read user badges" ON public.user_badges;
DROP POLICY IF EXISTS "Service can insert badges" ON public.user_badges;
DROP POLICY IF EXISTS "Anyone can view badges" ON public.user_badges;
DROP POLICY IF EXISTS "Service role can insert badges" ON public.user_badges;

CREATE POLICY "Anyone can read badge definitions" ON public.badge_definitions FOR SELECT USING (true);
CREATE POLICY "Anyone can read user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Service can insert badges" ON public.user_badges FOR INSERT TO service_role WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_badges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.award_badge(p_user_id UUID, p_badge_id TEXT, p_discussion_id TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  badge_name TEXT;
  badge_icon TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT name, icon INTO badge_name, badge_icon
  FROM public.badge_definitions
  WHERE id = p_badge_id;

  IF badge_name IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO public.user_badges (user_id, badge_id, discussion_id)
    VALUES (p_user_id, p_badge_id, p_discussion_id)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'award_badge insert error for %: %', p_badge_id, SQLERRM;
    RETURN;
  END;

  BEGIN
    INSERT INTO public.site_notifications (recipient_id, discussion_id, actor_name, preview_text, is_read)
    VALUES (p_user_id, COALESCE(p_discussion_id, 'badges'), 'GalibierHub', COALESCE(badge_icon, '') || ' You earned the "' || badge_name || '" badge!', false);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_feedback_badges()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_badge(NEW.user_id, 'basecamp', NEW.id::text);
  PERFORM public.award_badge(NEW.user_id, 'ice_breaker', NEW.id::text);
  IF NEW.message ~ '```' OR lower(NEW.message) ~ '(python|rscript|qiime2|maaslin|slurm|snakemake|nextflow)' THEN
    PERFORM public.award_badge(NEW.user_id, 'hello_world', NEW.id::text);
  END IF;
  IF NEW.message ~ '```' THEN
    PERFORM public.award_badge(NEW.user_id, 'markdown_master', NEW.id::text);
  END IF;
  IF NEW.message ~ 'github\.com/[^\s]+' THEN
    PERFORM public.award_badge(NEW.user_id, 'open_science', NEW.id::text);
  END IF;
  IF lower(coalesce(NEW.title, '') || ' ' || NEW.message) ~ '(hpc|slurm|cluster|pipeline|qiime|maaslin|nextflow|snakemake)' THEN
    PERFORM public.award_badge(NEW.user_id, 'high_performance', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feedback_badges_trigger ON public.site_feedback;
DROP TRIGGER IF EXISTS on_first_discussion ON public.site_feedback;
CREATE TRIGGER trg_feedback_badges_trigger
  AFTER INSERT ON public.site_feedback
  FOR EACH ROW EXECUTE FUNCTION public.trg_feedback_badges();

CREATE OR REPLACE FUNCTION public.trg_comment_badges()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.award_badge(NEW.user_id, 'ice_breaker', NEW.feedback_id::text);
  IF NEW.message ~ '```' OR lower(NEW.message) ~ '(python|rscript|qiime2|maaslin|slurm|snakemake|nextflow)' THEN
    PERFORM public.award_badge(NEW.user_id, 'hello_world', NEW.feedback_id::text);
  END IF;
  IF NEW.message ~ '```' THEN
    PERFORM public.award_badge(NEW.user_id, 'markdown_master', NEW.feedback_id::text);
  END IF;
  IF NEW.message ~ 'github\.com/[^\s]+' THEN
    PERFORM public.award_badge(NEW.user_id, 'open_science', NEW.feedback_id::text);
  END IF;
  IF lower(NEW.message) ~ '(hpc|slurm|cluster|pipeline|qiime|maaslin|nextflow|snakemake)' THEN
    PERFORM public.award_badge(NEW.user_id, 'high_performance', NEW.feedback_id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_badges_trigger ON public.feedback_comments;
CREATE TRIGGER trg_comment_badges_trigger
  AFTER INSERT ON public.feedback_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_comment_badges();

CREATE OR REPLACE FUNCTION public.trg_profile_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS NOT NULL AND (coalesce(NEW.display_name, '') <> '' OR coalesce(NEW.username, '') <> '' OR coalesce(NEW.bio, '') <> '') THEN
    PERFORM public.award_badge(NEW.id, 'profile_setup');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_badges_trigger ON public.profiles;
CREATE TRIGGER trg_profile_badges_trigger
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_badges();

CREATE OR REPLACE FUNCTION public.trg_download_badges()
RETURNS TRIGGER AS $$
DECLARE
  downloader_id UUID;
BEGIN
  downloader_id := NEW.user_id;
  IF downloader_id IS NULL THEN
    BEGIN
      downloader_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      downloader_id := NULL;
    END;
  END IF;
  IF downloader_id IS NOT NULL THEN
    PERFORM public.award_badge(downloader_id, 'data_miner');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_download_badges_trigger ON public.download_events;
CREATE TRIGGER trg_download_badges_trigger
  AFTER INSERT ON public.download_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_download_badges();

CREATE OR REPLACE FUNCTION public.trg_reaction_badges()
RETURNS TRIGGER AS $$
DECLARE
  feedback_author UUID;
  reply_author UUID;
  feedback_id UUID;
  total_likes INT;
  distinct_posts INT;
  likes_given INT;
  likes_received INT;
BEGIN
  IF NEW.reaction_type != 'like' THEN RETURN NEW; END IF;

  PERFORM public.award_badge(NEW.user_id, 'first_like');

  IF NEW.comment_id IS NOT NULL THEN
    BEGIN
      SELECT user_id, feedback_id INTO reply_author, feedback_id
      FROM public.feedback_comments
      WHERE id = NEW.comment_id;
      IF reply_author IS NOT NULL THEN
        SELECT COUNT(*) INTO total_likes FROM public.site_reactions
        WHERE reaction_type = 'like' AND comment_id = NEW.comment_id;
        IF total_likes >= 5 THEN
          PERFORM public.award_badge(reply_author, 'sherpa', feedback_id::text);
        END IF;
        IF total_likes >= 10 THEN
          PERFORM public.award_badge(reply_author, 'nice_reply', feedback_id::text);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NEW.entry_id IS NOT NULL THEN
    BEGIN
      SELECT user_id INTO feedback_author FROM public.site_feedback WHERE id = NEW.entry_id;
      IF feedback_author IS NOT NULL THEN
        SELECT COUNT(*) INTO total_likes FROM public.site_reactions
        WHERE reaction_type = 'like' AND entry_id = NEW.entry_id;
        IF total_likes = 1 THEN
          PERFORM public.award_badge(feedback_author, 'welcome', NEW.entry_id::text);
        END IF;
        IF total_likes >= 10 THEN
          PERFORM public.award_badge(feedback_author, 'nice_topic', NEW.entry_id::text);
        END IF;
        SELECT COUNT(DISTINCT entry_id) INTO distinct_posts FROM public.site_reactions
        WHERE reaction_type = 'like' AND entry_id IN (
          SELECT id FROM public.site_feedback WHERE user_id = feedback_author
        );
        IF distinct_posts >= 20 THEN
          PERFORM public.award_badge(feedback_author, 'appreciated');
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    BEGIN
      SELECT COUNT(*) INTO likes_given FROM public.site_reactions WHERE reaction_type = 'like' AND user_id = NEW.user_id;
      SELECT COUNT(*) INTO likes_received FROM public.site_reactions
      WHERE reaction_type = 'like'
        AND (
          (entry_id IS NOT NULL AND entry_id IN (SELECT id FROM public.site_feedback WHERE user_id = NEW.user_id))
          OR (comment_id IS NOT NULL AND comment_id IN (SELECT id FROM public.feedback_comments WHERE user_id = NEW.user_id))
        );
      IF likes_given >= 10 AND likes_received >= 20 THEN
        PERFORM public.award_badge(NEW.user_id, 'thank_you');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reaction_badges_trigger ON public.site_reactions;
CREATE TRIGGER trg_reaction_badges_trigger
  AFTER INSERT ON public.site_reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_reaction_badges();

DROP VIEW IF EXISTS public.admin_badge_stats;
CREATE OR REPLACE VIEW public.admin_badge_stats AS
SELECT
  bd.id AS badge_id,
  bd.name,
  bd.description,
  bd.icon,
  bd.tier,
  bd.category,
  bd.criteria,
  bd.manual_only,
  COUNT(ub.user_id) AS total_holders,
  MAX(ub.awarded_at) AS last_awarded_at
FROM public.badge_definitions bd
LEFT JOIN public.user_badges ub ON ub.badge_id = bd.id
GROUP BY bd.id, bd.name, bd.description, bd.icon, bd.tier, bd.category, bd.criteria, bd.manual_only
ORDER BY
  CASE bd.tier
    WHEN 'gold' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 3
    ELSE 4
  END,
  total_holders DESC;
