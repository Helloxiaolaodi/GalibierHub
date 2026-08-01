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

const BADGE_ICON_MAP: Record<string, string> = {
  basecamp: "⛺",
  hello_world: "👋",
  profile_setup: "⛰️",
  sherpa: "🧗",
  data_miner: "⛏️",
  high_performance: "🚀",
  helpful: "🤝",
  hc: "🏔️",
  polka_dot: "🔴",
  pi: "🎓",
  founder: "👑",
  ice_breaker: "❄️",
  first_like: "❤️",
  welcome: "👏",
  nice_reply: "👍",
  nice_topic: "💬",
  appreciated: "🌟",
  thank_you: "🙏",
  markdown_master: "📝",
  data_visualizer: "📊",
  open_science: "🔗",
  cli_maestro: "⌨️",
  great_topic: "🏆",
  top_contributor: "🥇",
  community_curator: "✅",
  bug_hunter: "🐛",
  enthusiast: "🔥",
};

export function getBadgeIcon(
  badgeId: string | null | undefined,
  fallbackIcon?: string | null,
): string {
  return BADGE_ICON_MAP[normalizeBadgeId(badgeId)] || fallbackIcon || "🏅";
}
