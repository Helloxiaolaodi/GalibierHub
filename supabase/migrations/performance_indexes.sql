-- Performance indexes for the Discussions and Downloads surfaces.
-- These indexes are safe to run repeatedly.

CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at
  ON public.site_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_feedback_category_created_at
  ON public.site_feedback (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_feedback_created_at
  ON public.feedback_comments (feedback_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_feedback_comments_user_created_at
  ON public.feedback_comments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_reactions_entry_reaction
  ON public.site_reactions (entry_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_site_reactions_comment_reaction
  ON public.site_reactions (comment_id, reaction_type);
