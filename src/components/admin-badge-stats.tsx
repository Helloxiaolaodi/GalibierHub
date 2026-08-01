"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBadgeIcon } from "@/lib/badge-ids";

type BadgeRow = {
  id?: string;
  badge_id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  category: string;
  criteria: string;
  manual_only: boolean;
  total_holders: number;
  last_awarded_at: string | null;
};

type ProfileMatch = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

type Holder = {
  user_id: string;
  awarded_at: string;
  profiles?: ProfileMatch | null;
};

type BadgeStatsData = {
  total_awarded: number;
  awarded_this_week: number;
  total_users: number;
  active_collectors: number;
  active_collector_rate: number;
  most_unlocked: BadgeRow | null;
  rarest_artifact: BadgeRow | null;
  rarity_distribution: Array<{ tier: string; holders: number }>;
  definitions: BadgeRow[];
};

const TIER_STYLES: Record<string, string> = {
  bronze: "border-amber-200 bg-amber-50 text-amber-700",
  silver: "border-slate-300 bg-slate-100 text-slate-600",
  gold: "border-yellow-300 bg-yellow-50 text-yellow-700",
  platinum: "border-indigo-300 bg-indigo-50 text-indigo-700",
};

const TIER_BAR_STYLES: Record<string, string> = {
  bronze: "bg-amber-500",
  silver: "bg-slate-400",
  gold: "bg-yellow-400",
  platinum: "bg-indigo-400",
};

function userName(user: ProfileMatch) {
  return user.display_name || user.username || (user.email ? user.email.split("@")[0] : "Unknown user");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminBadgeStats({ accessToken }: { accessToken?: string | null }) {
  const [data, setData] = useState<BadgeStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualBadge, setManualBadge] = useState<BadgeRow | null>(null);
  const [holdersBadge, setHoldersBadge] = useState<BadgeRow | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<ProfileMatch[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileMatch | null>(null);
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardMessage, setAwardMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/badges", {
        headers: accessToken ? { Authorization: "Bearer " + accessToken } : {},
      });
      const payload = await res.json();
      if (!res.ok || payload.error) {
        throw new Error(payload.error || "Failed to load badge statistics.");
      }
      setData(payload as BadgeStatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load badge statistics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!manualBadge) {
      setSearchUsers([]);
      setSearchQuery("");
      setSelectedUser(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const query = searchQuery.trim();
      if (!query) {
        setSearchUsers([]);
        return;
      }
      setSearchingUsers(true);
      fetch("/api/admin/badges?query=" + encodeURIComponent(query), {
        headers: accessToken ? { Authorization: "Bearer " + accessToken } : {},
      })
        .then((res) => res.json())
        .then((payload) => {
          if (!payload.error) setSearchUsers(payload.users || []);
        })
        .catch(() => {})
        .finally(() => setSearchingUsers(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [manualBadge, searchQuery, accessToken]);

  useEffect(() => {
    if (!manualBadge) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [manualBadge]);

  const openHolders = useCallback(async (badge: BadgeRow) => {
    setHoldersBadge(badge);
    setHolders([]);
    setHoldersLoading(true);
    try {
      const res = await fetch("/api/admin/badges?badge_id=" + encodeURIComponent(badge.badge_id), {
        headers: accessToken ? { Authorization: "Bearer " + accessToken } : {},
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || "Failed to load holders.");
      setHolders(payload.holders || []);
    } catch (err) {
      setHolders([]);
    } finally {
      setHoldersLoading(false);
    }
  }, [accessToken]);

  const awardBadge = useCallback(async () => {
    if (!manualBadge || !selectedUser) return;
    setAwardLoading(true);
    setAwardError(null);
    setAwardMessage(null);
    try {
      const res = await fetch("/api/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
        },
        body: JSON.stringify({ userId: selectedUser.id, badgeId: manualBadge.badge_id }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || "Award failed.");
      setAwardMessage(userName(selectedUser) + " was awarded " + manualBadge.name + ".");
      window.setTimeout(() => {
        setManualBadge(null);
        setSelectedUser(null);
        setSearchQuery("");
        setAwardMessage(null);
        void fetchStats();
      }, 1200);
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : "Award failed.");
    } finally {
      setAwardLoading(false);
    }
  }, [accessToken, fetchStats, manualBadge, selectedUser]);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-800 bg-[#0F172A] p-6 shadow-lg">
        <div className="skeleton h-6 w-56 rounded" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-28 rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-100 shadow-lg">
        {error || "No badge statistics available."}
      </section>
    );
  }

  const maxRarity = Math.max(1, ...(data.rarity_distribution || []).map((item) => item.holders));
  const unlockRate = (holdersCount: number) => {
    if (!data.total_users) return "0%";
    return ((holdersCount / data.total_users) * 100).toFixed(1) + "%";
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Badge Analytics</h2>
          <p className="text-xs text-slate-400">{data.total_awarded.toLocaleString()} total awards across the community</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">Admin</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#1E293B] p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Badges Awarded</p>
          <p className="mt-2 font-mono text-3xl font-bold text-white">{data.total_awarded.toLocaleString()}</p>
          {data.awarded_this_week > 0 && (
            <p className="mt-2 text-xs font-semibold text-emerald-400">+{data.awarded_this_week} this week</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#1E293B] p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Collectors</p>
          <p className="mt-2 font-mono text-3xl font-bold text-white">{data.active_collectors.toLocaleString()}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400">{(data.active_collector_rate * 100).toFixed(1)}% of users</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#1E293B] p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Most Unlocked</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{data.most_unlocked?.name || "No awards yet"}</p>
          <p className="mt-2 font-mono text-xs font-semibold text-slate-400">{data.most_unlocked?.total_holders || 0} holders</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#1E293B] p-4 shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rarest Artifact</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">{data.rarest_artifact?.name || "No awards yet"}</p>
          <p className="mt-2 font-mono text-xs font-semibold text-slate-400">{data.rarest_artifact?.total_holders || 0} holders</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-800 bg-[#1E293B] p-4 shadow-lg lg:col-span-2">
          <h3 className="text-sm font-semibold text-white">Rarity Distribution</h3>
          <div className="mt-4 space-y-4">
            {(data.rarity_distribution || []).length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No awards yet</p>
            )}
            {(data.rarity_distribution || []).map((item) => (
              <div key={item.tier}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-slate-300">{item.tier}</span>
                  <span className="font-mono text-slate-400">{item.holders.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={"h-full rounded-full " + (TIER_BAR_STYLES[item.tier] || "bg-slate-400")}
                    style={{ width: Math.max(4, Math.round((item.holders / maxRarity) * 100)) + "%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#1E293B] shadow-lg lg:col-span-3">
          <div className="border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Badge Ledger</h3>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-[#1E293B] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Badge</th>
                  <th className="px-4 py-2.5 font-medium">Rarity</th>
                  <th className="px-4 py-2.5 text-right font-medium">Holders</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unlock Rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.definitions.map((badge) => (
                  <tr key={badge.badge_id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm">
                          {getBadgeIcon(badge.badge_id || badge.id, badge.icon)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{badge.name}</p>
                          <p className="truncate text-xs text-slate-400">{badge.criteria || badge.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize " + (TIER_STYLES[badge.tier] || TIER_STYLES.bronze)}>
                        {badge.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">{badge.total_holders.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">{unlockRate(badge.total_holders)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {badge.total_holders > 0 && (
                          <button
                            type="button"
                            onClick={() => void openHolders(badge)}
                            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                          >
                            View Users
                          </button>
                        )}
                        {badge.manual_only && (
                          <button
                            type="button"
                            onClick={() => { setManualBadge(badge); setSelectedUser(null); setSearchQuery(""); setAwardError(null); setAwardMessage(null); }}
                            className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-500"
                          >
                            Award Manually
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {manualBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Award {manualBadge.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{manualBadge.criteria || manualBadge.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setManualBadge(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-600">Search users</label>
            <div className="relative mt-1">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setSelectedUser(null); }}
                placeholder="Search username, display name, or email"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-14 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-200"
              />
              <span className="absolute right-3 top-2.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Ctrl K</span>
            </div>

            <div className="mt-2 min-h-[150px] overflow-hidden rounded-lg border border-slate-200">
              {searchingUsers ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-400">Searching...</div>
              ) : selectedUser ? (
                <div className="flex items-center gap-3 p-3">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                      {(userName(selectedUser) || "?").substring(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{userName(selectedUser)}</p>
                    <p className="truncate text-xs text-slate-500">{selectedUser.email || "@" + (selectedUser.username || "unknown")}</p>
                  </div>
                </div>
              ) : searchUsers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{searchQuery.trim() ? "No matching users." : "Type to search users."}</p>
              ) : (
                <div className="max-h-56 divide-y divide-slate-100 overflow-auto">
                  {searchUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                          {(userName(user) || "?").substring(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{userName(user)}</p>
                        <p className="truncate text-xs text-slate-500">{user.email || "@" + (user.username || "unknown")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {awardError && <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{awardError}</p>}
            {awardMessage && <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{awardMessage}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualBadge(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedUser || awardLoading}
                onClick={() => void awardBadge()}
                className="rounded-lg bg-[#1E293B] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {awardLoading ? "Awarding..." : "Grant " + manualBadge.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {holdersBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{holdersBadge.name} Holders</h3>
                <p className="mt-1 text-xs text-slate-500">{holders.length} users</p>
              </div>
              <button
                type="button"
                onClick={() => setHoldersBadge(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-3 max-h-72 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
              {holdersLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
              ) : holders.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No holders yet.</p>
              ) : (
                holders.map((holder) => {
                  const user = holder.profiles as ProfileMatch | null | undefined;
                  const name = user ? userName(user) : holder.user_id.slice(0, 8);
                  return (
                    <div key={holder.user_id} className="flex items-center gap-3 p-3">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">{name.substring(0, 1).toUpperCase()}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        {user?.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(holder.awarded_at)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
