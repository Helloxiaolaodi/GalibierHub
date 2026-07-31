"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WorldClock from "@/components/world-clock";
import Logo from "@/components/logo";
import type { SiteFeedbackEntry } from "@/types/genome";
import { getBrowserSupabase } from "@/utils/supabase-browser";

const TAG_COLORS = [
  "bg-blue-50 text-blue-700",
  "bg-teal-50 text-teal-700",
  "bg-amber-50 text-amber-700",
  "bg-emerald-50 text-emerald-700",
  "bg-purple-50 text-purple-700",
  "bg-rose-50 text-rose-700",
  "bg-indigo-50 text-indigo-700",
  "bg-cyan-50 text-cyan-700",
];

function getTagColor(index: number): string {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export default function TagsCloudPage() {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const sb = getBrowserSupabase();
        if (!sb) { setLoading(false); return; }
        const { data, error } = await sb
          .from("site_feedback")
          .select("*")
          .eq("visibility", "public")
          .order("created_at", { ascending: false });
        if (!error && data) setEntries(data as SiteFeedbackEntry[]);
      } catch {
        // ignore errors
      }
      setLoading(false);
    };
    fetchTags();
  }, []);

  const tags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    entries.forEach((entry) => {
      if (entry.category) {
        const cats = entry.category.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
        cats.forEach((cat) => {
          tagCounts[cat] = (tagCounts[cat] || 0) + 1;
        });
      }
      // Extract tags from message via hashtags
      const message = entry.message || "";
      const hashtags = message.match(/#([a-zA-Z0-9_-]+)/g);
      if (hashtags) {
        hashtags.forEach((tag) => {
          const cleanTag = tag.slice(1).toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      }
    });
    const tagList = Object.entries(tagCounts).map(([name, count]) => ({ name, count }));
    tagList.sort((a, b) => b.count - a.count);
    return tagList;
  }, [entries]);

  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return tags;
    const q = searchTerm.toLowerCase();
    return tags.filter((t) => t.name.includes(q));
  }, [tags, searchTerm]);

  const maxCount = tags.length > 0 ? tags[0].count : 1;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/70 backdrop-blur-xl saturate-150 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Logo compact />
            <span className="text-gray-500">/</span>
            <h1 className="text-base font-semibold text-gray-900">Tags Cloud</h1>
          </div>
          <div className="flex items-center gap-3">
            <WorldClock />
            <Link href="/discussions" className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">Discussions</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Community Tags</h2>
          <p className="mt-2 text-sm text-gray-600">Browse discussions by topic. Larger tags indicate more frequent use.</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter tags..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10 transition-all shadow-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="skeleton h-8 rounded-full" style={{ width: `${60 + Math.random() * 80}px` }} />
            ))}
          </div>
        )}

        {!loading && filteredTags.length === 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-sm">
            <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            <h3 className="text-base font-medium text-gray-900">No tags found</h3>
            <p className="mt-2 text-sm text-gray-500">Start a discussion to create the first tag.</p>
          </div>
        )}

        {!loading && filteredTags.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 mb-8">
              {filteredTags.map((tag, i) => {
                const sizePct = Math.max(0.7, tag.count / maxCount);
                const fontSize = 0.75 + sizePct * 0.5;
                return (
                  <Link
                    key={tag.name}
                    href={`/discussions?search=${encodeURIComponent(tag.name)}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-all hover:scale-105 hover:shadow-sm ${getTagColor(i)}`}
                    style={{ fontSize: `${fontSize}rem` }}
                  >
                    <span>{tag.name}</span>
                    <span className="text-[10px] opacity-60 tabular-nums">{tag.count}</span>
                  </Link>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Tag Statistics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-bold text-slate-800">{tags.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Total Tags</div>
                </div>
                <div className="rounded-lg bg-teal-50 p-3 text-center">
                  <div className="text-2xl font-bold text-teal-700">{entries.length}</div>
                  <div className="text-xs text-gray-500 mt-1">Discussions</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{tags.length > 0 ? tags[0].count : 0}</div>
                  <div className="text-xs text-gray-500 mt-1">Most Popular</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{tags.filter((t) => t.count >= 3).length}</div>
                  <div className="text-xs text-gray-500 mt-1">Active Tags (3+)</div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
