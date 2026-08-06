"use client";

import { useEffect, useState } from "react";

type RecentSignup = {
  id: string;
  display_name?: string | null;
  email?: string | null;
  provider?: string | null;
  created_at?: string | null;
};

type RecentVisitor = {
  id: string;
  ip: string;
  path: string;
  timestamp: string;
};

type AdminUserStatsData = {
  total_users: number;
  github_users: number;
  email_users: number;
  users_this_week: number;
  total_discussions: number;
  total_comments: number;
  total_downloads: number;
  total_visitors: number;
  recent_signups: RecentSignup[];
  recent_visitors: RecentVisitor[];
  note?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayName(user: RecentSignup) {
  if (user.display_name) return user.display_name;
  if (user.email) return user.email.split("@")[0] || user.email;
  return user.id.slice(0, 8);
}

function initials(name: string) {
  const clean = name.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : clean.slice(0, 2).toUpperCase();
}

export default function AdminUserStats({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<AdminUserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((payload) => {
        if (!active) return;
        if (payload?.error) {
          setError(payload.error);
          setData(null);
        } else {
          setData(payload as AdminUserStatsData);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load user statistics.");
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
        {error || "No user statistics available."}
      </section>
    );
  }

  const totalProviders = Math.max(0, (data.github_users || 0) + (data.email_users || 0));
  const githubPct = totalProviders ? Math.round(((data.github_users || 0) / totalProviders) * 100) : 0;
  const emailPct = totalProviders ? 100 - githubPct : 0;
  const recentSignups = (data.recent_signups || []).slice(0, 5);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Registered User Statistics</h2>
          <p className="text-xs text-gray-500">{data.total_discussions} discussions, {data.total_comments} comments</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Admin</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Registered Users</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">{data.total_users.toLocaleString()}</p>
              {data.users_this_week > 0 && (
                <p className="mt-2 text-xs font-semibold text-emerald-600">+{data.users_this_week} this week</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-100 p-3 text-slate-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Signup Source</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-24 w-24 flex-shrink-0 rounded-full"
              style={{ background: `conic-gradient(#059669 0% ${githubPct}%, #2563eb ${githubPct}% 100%)` }}>
              <div className="absolute inset-2 rounded-full bg-white" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-700">{totalProviders}</span>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                <span>GitHub {githubPct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                <span>Email {emailPct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Downloads</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{data.total_downloads.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Visitors</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{data.total_visitors.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recently Joined</h3>
            <span className="text-xs text-gray-400">Latest {recentSignups.length} users</span>
          </div>
          <div className="divide-y divide-gray-100">
            {recentSignups.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No recent signups found.</p>
            )}
            {recentSignups.map((user) => (
              <div key={user.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
                  {initials(displayName(user))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{displayName(user)}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                      {user.provider || "email"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(user.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Visitors</h3>
            <span className="text-xs text-gray-400">{data.total_visitors.toLocaleString()} total</span>
          </div>
          <div className="divide-y divide-gray-100">
            {(data.recent_visitors || []).slice(0, 5).map((visitor) => (
              <div key={visitor.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {visitor.ip.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{visitor.path || "/"}</p>
                  <p className="text-xs text-gray-400">{visitor.ip} · {formatDate(visitor.timestamp)}</p>
                </div>
              </div>
            ))}
            {(data.recent_visitors || []).length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">No visitor records found.</p>
            )}
          </div>
        </div>
      </div>

      {data.note && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">{data.note}</p>
      )}
    </section>
  );
}
