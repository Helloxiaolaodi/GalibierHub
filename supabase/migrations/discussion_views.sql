CREATE TABLE IF NOT EXISTS public.discussion_views (
  entry_id UUID PRIMARY KEY REFERENCES public.site_feedback(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.increment_discussion_view(p_entry_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.discussion_views (entry_id, view_count, last_viewed_at)
  VALUES (p_entry_id, 1, NOW())
  ON CONFLICT (entry_id)
  DO UPDATE SET
    view_count = public.discussion_views.view_count + 1,
    last_viewed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
