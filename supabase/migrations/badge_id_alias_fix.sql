-- Normalize legacy Ice Breaker badge ids so holder counts and user badge
-- panels read from the same canonical badge definition id.

UPDATE public.user_badges
SET badge_id = 'ice_breaker'
WHERE lower(badge_id) IN ('ice-breaker', 'ice breaker', 'icebreaker');
