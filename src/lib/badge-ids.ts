const BADGE_ID_ALIASES: Record<string, string[]> = {
  ice_breaker: ["ice-breaker", "ice breaker", "icebreaker"],
};

export function normalizeBadgeId(value: string | null | undefined): string {
  const id = (value || "").trim();
  if (!id) return id;
  const lower = id.toLowerCase();
  for (const [canonical, aliases] of Object.entries(BADGE_ID_ALIASES)) {
    if (canonical === lower || aliases.includes(lower)) return canonical;
  }
  return id;
}

export function getBadgeIdVariants(value: string | null | undefined): string[] {
  const canonical = normalizeBadgeId(value);
  return [...new Set([canonical, ...(BADGE_ID_ALIASES[canonical] || [])])].filter(Boolean);
}
