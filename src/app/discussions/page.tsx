'use client';

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteConfig } from "@/site-config";
import type { FeedbackCommentEntry, FeedbackSummary, ReactionCounts, SiteFeedbackEntry } from "@/types/genome";

const _PAGE_SIZE = 20;

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    general: "bg-blue-100 text-blue-800",
    issue: "bg-red-100 text-red-800",
    idea: "bg-amber-100 text-amber-800",
    data: "bg-emerald-100 text-emerald-800",
    collaboration: "bg-purple-100 text-purple-800",
  };
  return map[category] || "bg-gray-100 text-gray-800";
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    general: "General",
    issue: "Issue",
    idea: "Idea",
    data: "Data",
    collaboration: "Collaboration",
  };
  return map[category] || category;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon}mo ago`;
  return `${Math.floor(diffMon / 12)}y ago`;
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return "";
  const cleaned = text.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#]/g, "").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
}

export default function DiscussionsPage() {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [lastActivity, setLastActivity] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load discussions");
      const data = await res.json() as { entries?: SiteFeedbackEntry[]; error?: string };
      if (data.error) throw new Error(data.error);
      const publicEntries = (data.entries || []).filter(
        (e) => e.visibility === "public"
      );
      setEntries(publicEntries);

      // Fetch comment counts for each entry
      const counts: Record<string, number> = {};
      const activities: Record<string, string> = {};
      await Promise.all(
        publicEntries.map(async (entry) => {
          try {
            const commentRes = await fetch(`/api/feedback?feedback_id=${encodeURIComponent(entry.id)}`);
            if (commentRes.ok) {
              const commentData = await commentRes.json() as { comments?: FeedbackCommentEntry[] };
              const comments = commentData.comments || [];
              counts[entry.id] = comments.length;
              if (comments.length > 0) {
                const latest = comments.reduce((a, b) =>
                  new Date(a.created_at) > new Date(b.created_at) ? a : b
                );
                activities[entry.id] = latest.created_at;
              }
            }
          } catch { /* ignore */ }
        })
      );
      setCommentCounts(counts);
      setLastActivity(activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header nav bar matching existing style */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800">
              {SiteConfig.title}
            </Link>
            <span className="text-sm text-gray-500">/</span>
            <h1 className="text-base font-semibold text-gray-900">Discussions</h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Community Discussions</h2>
          <p className="mt-2 text-sm text-gray-600">
            Browse public discussions, share ideas, and collaborate with the community.
          </p>
        </div>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-3/4 rounded" />
                    <div className="skeleton h-4 w-1/2 rounded" />
                    <div className="skeleton h-4 w-full rounded" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="skeleton h-4 w-12 rounded ml-auto" />
                    <div className="skeleton h-3 w-16 rounded ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={fetchData}
              className="ml-3 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
            <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-base font-medium text-gray-900">No discussions yet</h3>
            <p className="mt-2 text-sm text-gray-500">Be the first to start a discussion from the home page.</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Start a Discussion
            </Link>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => {
              const replyCount = commentCounts[entry.id] || 0;
              const activityTime = lastActivity[entry.id] || entry.created_at;
              const preview = truncateText(entry.message, 120);

              return (
                <Link
                  key={entry.id}
                  href={`/discussions/${entry.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md hover:border-gray-300"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                      {getInitials(entry.display_name)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <h3 className="text-base font-semibold text-gray-900 hover:text-blue-700 truncate">
                          {entry.title || "Untitled Discussion"}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(entry.category)}`}>
                          {getCategoryLabel(entry.category)}
                        </span>
                        {entry.rating > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                            {Array.from({ length: entry.rating }).map((_, i) => (
                              <svg key={i} className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {preview}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{entry.display_name}</span>
                        <span>·</span>
                        <span>{formatTimeAgo(entry.created_at)}</span>
                      </div>
                    </div>

                    {/* Stats column */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{replyCount}</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatTimeAgo(activityTime)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
