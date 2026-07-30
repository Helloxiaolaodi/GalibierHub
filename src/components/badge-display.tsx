'use client';

import { useEffect, useState } from 'react';

type Badge = {
  badge_id: string;
  awarded_at: string;
  badge_definitions?: {
    name: string;
    description: string;
    icon: string;
    tier: string;
    category: string;
  };
  name?: string;
  description?: string;
  icon?: string;
  tier?: string;
};

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-50 ring-amber-200 text-amber-700',
  silver: 'bg-slate-50 ring-slate-300 text-slate-600',
  gold: 'bg-yellow-50 ring-yellow-300 text-yellow-700',
  platinum: 'bg-indigo-50 ring-indigo-300 text-indigo-700',
};

const TIER_SCORES: Record<string, number> = {
  bronze: 5,
  silver: 15,
  gold: 30,
  platinum: 50,
};

type BadgeDisplayProps = {
  userId: string;
  maxDisplay?: number;
  size?: 'sm' | 'md';
  showScore?: boolean;
};

export default function BadgeDisplay({ userId, maxDisplay = 2, size = 'sm', showScore = false }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/badges?user_id=' + encodeURIComponent(userId))
      .then(res => res.json())
      .then(data => {
        if (data.badges) {
          // Sort by tier priority
          const tierOrder = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
          const sorted = (data.badges as Badge[]).sort((a, b) => {
            const defA = a.badge_definitions || a;
            const defB = b.badge_definitions || b;
            return (tierOrder[defB.tier as keyof typeof tierOrder] || 0) - (tierOrder[defA.tier as keyof typeof tierOrder] || 0);
          });
          setBadges(sorted.slice(0, maxDisplay));
        }
      })
      .catch(() => {});
  }, [userId, maxDisplay]);

  if (badges.length === 0) return null;

  const reputationScore = showScore
    ? badges.reduce((sum, badge) => {
        const def = badge.badge_definitions || badge;
        return sum + (TIER_SCORES[(def.tier as string) || 'bronze'] || 0);
      }, 0)
    : 0;

  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[10px]'
    : 'w-5 h-5 text-xs';

  return (
    <div className="flex items-center gap-1.5">
      {showScore && reputationScore > 0 && (
        <span className="text-[11px] font-semibold text-slate-600 tabular-nums leading-none">
          {reputationScore}
        </span>
      )}
      {badges.map((badge) => {
        const def = badge.badge_definitions || badge;
        const colors = TIER_COLORS[(def.tier as string) || "bronze"];
        return (
          <span
            key={badge.badge_id}
            title={def.name + ': ' + (def.description || '')}
            className={'inline-flex items-center justify-center rounded-full ring-1 ring-inset cursor-help ' + sizeClasses + ' ' + colors}
          >
            {def.icon || '🏅'}
          </span>
        );
      })}
    </div>
  );
}
