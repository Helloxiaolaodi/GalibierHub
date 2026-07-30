-- GalibierHub Badge System
CREATE TABLE IF NOT EXISTS public.badge_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    category TEXT NOT NULL DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT REFERENCES public.badge_definitions(id) ON DELETE CASCADE NOT NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

INSERT INTO public.badge_definitions (id, name, description, icon, tier, category) VALUES
('basecamp', 'Basecamp', 'Posted your first discussion topic', '', 'bronze', 'discussions'),
('hello_world', 'Hello World', 'Shared your first code snippet', '', 'bronze', 'code'),
('early_adopter', 'Early Adopter', 'Joined GalibierHub early', '', 'bronze', 'general'),
('profile_setup', 'The Peloton', 'Completed onboarding profile', '', 'bronze', 'general'),
('sherpa', 'The Sherpa', 'Received 5+ likes on replies', '', 'silver', 'discussions'),
('data_miner', 'Data Miner', 'Downloaded or uploaded a dataset', '', 'silver', 'downloads'),
('high_performance', 'High Performance', 'Discussed HPC or cluster topics', '', 'silver', 'code'),
('helpful', 'Helpful', 'Reply marked as helpful', '', 'silver', 'discussions'),
('hc', 'Hors Categorie', 'Top 5 percent reputation', '', 'gold', 'reputation'),
('polka_dot', 'Polka Dot', 'Most liked author of the year', '', 'gold', 'reputation'),
('pi', 'Principal Investigator', 'Certified research scholar', '', 'gold', 'special'),
('founder', 'Founder', 'GalibierHub founding member', '', 'platinum', 'special')
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;

CREATE OR REPLACE FUNCTION public.award_basecamp_badge()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (NEW.user_id, 'basecamp') ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_first_discussion ON public.site_feedback;
CREATE TRIGGER on_first_discussion AFTER INSERT ON public.site_feedback FOR EACH ROW EXECUTE FUNCTION public.award_basecamp_badge();

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read badge definitions" ON public.badge_definitions FOR SELECT USING (true);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Service can insert badges" ON public.user_badges FOR INSERT WITH CHECK (true);
