-- Fix follows table, notification RLS, and retroactive user_id backfill.

ALTER TABLE public.site_notifications ALTER COLUMN discussion_id DROP NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.site_notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.site_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read follows" ON public.follows;
CREATE POLICY "Users can read follows"
  ON public.follows
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert follows" ON public.follows;
CREATE POLICY "Users can insert follows"
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete follows" ON public.follows;
CREATE POLICY "Users can delete follows"
  ON public.follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id, follower_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'follows'
  ) THEN
    RETURN;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    UPDATE public.site_feedback sf
    SET user_id = p.id
    FROM public.profiles p
    WHERE sf.user_id IS NULL
      AND (
        lower(sf.display_name) = lower(p.display_name)
        OR lower(sf.display_name) = lower(p.username)
      );

    UPDATE public.feedback_comments fc
    SET user_id = p.id
    FROM public.profiles p
    WHERE fc.user_id IS NULL
      AND (
        lower(fc.author_name) = lower(p.display_name)
        OR lower(fc.author_name) = lower(p.username)
      );
  END IF;
END $$;
