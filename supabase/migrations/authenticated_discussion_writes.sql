-- Migration: authenticated_discussion_writes
-- Replace anonymous/public write policies with authenticated-only policies
-- Delete anonymous reaction records and notification records

-- 1. Clean up anonymous records
DELETE FROM public.site_reactions WHERE user_id IS NULL;

-- 2. Delete notification records from anonymous actors
DELETE FROM public.site_notifications 
  WHERE actor_name = 'Someone' 
  OR preview_text IN ('liked your reply', 'liked your discussion');

-- 3. Drop old public insert/update/delete policies on site_feedback
DROP POLICY IF EXISTS "Public insert site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Public update site_feedback" ON site_feedback;
DROP POLICY IF EXISTS "Public delete site_feedback" ON site_feedback;

-- 4. Drop old public insert/update/delete policies on feedback_comments
DROP POLICY IF EXISTS "Public insert feedback_comments" ON feedback_comments;
DROP POLICY IF EXISTS "Public update feedback_comments" ON feedback_comments;

-- 5. Drop old public insert/delete policies on site_reactions
DROP POLICY IF EXISTS "Public insert site_reactions" ON site_reactions;
DROP POLICY IF EXISTS "Public delete site_reactions" ON site_reactions;

-- 6. Create authenticated-only write policies for site_feedback
CREATE POLICY "Authenticated insert site_feedback" ON site_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Create authenticated-only write policies for feedback_comments
CREATE POLICY "Authenticated insert feedback_comments" ON feedback_comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- 8. Create authenticated-only write policies for site_reactions
CREATE POLICY "Authenticated insert site_reactions" ON site_reactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated delete site_reactions" ON site_reactions
  FOR DELETE TO authenticated USING (true);

-- 9. Keep existing read policies (public read remains)
-- "Public read site_feedback", "Public read feedback_comments", "Public read site_reactions" are unchanged.

-- 10. Keep service-role admin policies (Service update/delete site_feedback, etc.) unchanged.
