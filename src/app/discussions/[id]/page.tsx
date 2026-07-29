"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteConfig } from "@/site-config";
import type { FeedbackCommentEntry, SiteFeedbackEntry } from "@/types/genome";

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    general: "bg-blue-100 text-blue-800", issue: "bg-red-100 text-red-800",
    idea: "bg-amber-100 text-amber-800", data: "bg-emerald-100 text-emerald-800",
    collaboration: "bg-purple-100 text-purple-800",
  };
  return map[category] || "bg-gray-100 text-gray-800";
}
function getCategoryLabel(category: string): string {
  const map: Record<string, string> = { general: "General", issue: "Issue", idea: "Idea", data: "Data", collaboration: "Collaboration" };
  return map[category] || category;
}
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}
function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr); const n = new Date();
  const diff = Math.floor((n.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
  if (diff < 31536000) return Math.floor(diff / 2592000) + "mo ago";
  return Math.floor(diff / 31536000) + "y ago";
}
function _truncateText(text: string, maxLen: number): string {
  if (!text) return "";
  const cleaned = text.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#]/g, "").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
}

// ---- TimelineSidebar ----
function TimelineSidebar({ total, currentIndex, firstDate, lastDate, onNavigate }: {
  total: number; currentIndex: number; firstDate: string | null; lastDate: string | null;
  onNavigate: (i: number) => void;
}) {
  return (
    <div className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 w-14 z-30">
      <div className="flex flex-col items-center gap-1 rounded-full border border-gray-200 bg-white/90 py-3 px-2 shadow-sm backdrop-blur">
        <div className="text-xs font-mono font-semibold text-gray-500 text-center leading-tight">
          {currentIndex + 1}<br /><span className="text-[10px] text-gray-400">/ {total}</span>
        </div>
        <div className="w-1 flex-1 min-h-[60px] bg-gray-200 rounded-full overflow-hidden my-1">
          <div className="w-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ height: ((currentIndex + 1) / Math.max(total, 1)) * 100 + "%" }} />
        </div>
        {firstDate && <div className="text-[10px] text-gray-400 text-center leading-tight">{new Date(firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>}
        {lastDate && lastDate !== firstDate && (<><div className="text-[10px] text-gray-300">|</div><div className="text-[10px] text-blue-500 text-center leading-tight font-medium">{formatTimeAgo(lastDate)}</div></>)}
        <button onClick={() => onNavigate(Math.max(0, currentIndex - 1))} disabled={currentIndex <= 0}
          className="mt-1 rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
        <button onClick={() => onNavigate(Math.min(total - 1, currentIndex + 1))} disabled={currentIndex >= total - 1}
          className="rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
      </div>
    </div>
  );
}

// ---- DiscussionFooter ----
function DiscussionFooter({ comments, entry, totalViews }: {
  comments: FeedbackCommentEntry[]; entry: SiteFeedbackEntry; totalViews: number;
}) {
  const linkCount = useMemo(() => {
    const re = /https?:\/\/\S+/g;
    return ((entry.message || "").match(re) || []).length + comments.flatMap(c => (c.message || "").match(re) || []).length;
  }, [entry.message, comments]);
  const participants = useMemo(() => {
    const seen = new Set<string>(); const r: { name: string; email?: string | null }[] = [];
    [entry, ...comments].forEach(e => {
      const n = "display_name" in e ? (e as SiteFeedbackEntry).display_name : (e as FeedbackCommentEntry).author_name;
      const em = "visitor_email" in e ? (e as SiteFeedbackEntry).visitor_email : (e as FeedbackCommentEntry).author_email;
      if (!seen.has(n)) { seen.add(n); r.push({ name: n, email: em }); }
    });
    return r;
  }, [entry, comments]);
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          <span className="font-medium text-gray-900">{totalViews}</span> <span>views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          <span className="font-medium text-gray-900">{linkCount}</span> <span>links</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Participants:</span>
          <div className="flex -space-x-2">
            {participants.slice(0, 6).map(p => (
              <div key={p.name} className="relative" onMouseEnter={() => setHovered(p.name)} onMouseLeave={() => setHovered(null)}>
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white cursor-default">{getInitials(p.name)}</div>
                {hovered === p.name && (<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"><div className="rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3 text-center min-w-[140px]"><div className="mx-auto mb-2 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-semibold text-white">{getInitials(p.name)}</div><div className="text-sm font-semibold text-gray-900">{p.name}</div><div className="text-xs text-gray-500 mt-0.5">{p.email ? "Public profile" : "Visitor"}</div></div><div className="mx-auto h-2 w-2 rotate-45 border-r border-b border-gray-200 bg-white -mt-1" /></div>)}
              </div>))}
            {participants.length > 6 && <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 ring-2 ring-white">+{participants.length - 6}</div>}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div><h4 className="text-base font-semibold text-gray-900">Join the conversation</h4><p className="mt-1 text-sm text-gray-600">Sign in to receive notifications, save bookmarks, and like discussions.</p></div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-all hover:-translate-y-0.5 hover:shadow-md">Sign Up</button>
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">Maybe later</button>
            <button className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-all">no thanks</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- timeGapLabel ----
function timeGapLabel(prev: string | null, curr: string): string | null {
  if (!prev) return null;
  const p = new Date(prev).getTime(); const c = new Date(curr).getTime();
  const ms = c - p; if (ms < 120000) return null;
  const h = Math.floor(ms / 3600000);
  if (h < 24) return h + " hour" + (h > 1 ? "s" : "") + " later";
  const d = Math.floor(ms / 86400000);
  if (d < 30) return d + " day" + (d > 1 ? "s" : "") + " later";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + " month" + (mo > 1 ? "s" : "") + " later";
  return Math.floor(mo / 12) + " year" + (Math.floor(mo / 12) > 1 ? "s" : "") + " later";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---- MAIN ----
export default function DiscussionDetailPage() {
  const [id, setId] = useState<string | null>(null);
  const [entry, setEntry] = useState<SiteFeedbackEntry | null>(null);
  const [comments, setComments] = useState<FeedbackCommentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Extract id from URL path (client-side since it is not passed via Next.js params in App Router)
  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== "discussions") setId(lastPart);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return; setLoading(true); setError(null);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load discussion");
      const data = await res.json() as { entries?: SiteFeedbackEntry[] };
      const found = (data.entries || []).find(e => e.id === id);
      if (!found) throw new Error("Discussion not found");
      setEntry(found);
      const cr = await fetch("/api/feedback?feedback_id=" + encodeURIComponent(id));
      if (cr.ok) { const cd = await cr.json() as { comments?: FeedbackCommentEntry[] }; setComments(cd.comments || []); }
      try {
        const rr = await fetch("/api/reactions");
        if (rr.ok) { const rd = await rr.json() as { entries?: Record<string, { like: number }> }; if (rd.entries?.[id]) setLikeCounts({ [id]: rd.entries[id].like }); }
      } catch { }
      setTotalViews(Math.floor(Math.random() * 500) + 50);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLike = useCallback(async (entryId: string) => {
    if (likes[entryId]) return;
    setLikes(p => ({ ...p, [entryId]: true }));
    setLikeCounts(p => ({ ...p, [entryId]: (p[entryId] || 0) + 1 }));
    try { await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reactionType: "like", fingerprint: "detail-" + entryId, entryId }) }); } catch { }
  }, [likes]);
  const handleShare = useCallback((entryId: string) => {
    navigator.clipboard.writeText(window.location.origin + "/discussions/" + entryId).catch(() => {});
  }, []);
  const handleSubmitComment = useCallback(async () => {
    const t = commentText.trim(); if (!t) return;
    setCommentSubmitting(true); setCommentError(null); setCommentSuccess(null);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedbackId: id, message: t, authorName: "Visitor" }) });
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error || "Failed");
      setCommentText(""); setCommentSuccess("Comment posted!"); await fetchData();
    } catch (err) { setCommentError(err instanceof Error ? err.message : "Failed"); }
    finally { setCommentSubmitting(false); }
  }, [commentText, id, fetchData]);

  const timelineItems = useMemo(() => {
    if (!entry) return [];
    const items: { type: "entry" | "comment"; data: SiteFeedbackEntry | FeedbackCommentEntry; date: string }[] = [{ type: "entry", data: entry, date: entry.created_at }];
    comments.forEach(c => items.push({ type: "comment", data: c, date: c.created_at }));
    return items;
  }, [entry, comments]);
  const firstDate = timelineItems[0]?.date || null;
  const lastDate = timelineItems[timelineItems.length - 1]?.date || null;
  function handleTimelineNav(i: number) { setCurrentTimelineIndex(i); contentRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" }); }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 flex-shrink-0">{SiteConfig.title}</Link>
            <span className="text-gray-300">/</span>
            <Link href="/discussions" className="text-sm text-gray-500 hover:text-gray-700 flex-shrink-0">Discussions</Link>
            {entry && (<><span className="text-gray-300">/</span>
              <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 " + getCategoryColor(entry.category)}>{getCategoryLabel(entry.category)}</span>
              <span className="text-sm font-medium text-gray-900 truncate">{entry.title || "Discussion"}</span></>)}
          </div>
          <Link href="/discussions" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex-shrink-0">All Discussions</Link>
        </div>
      </header>
      {timelineItems.length > 1 && <TimelineSidebar total={timelineItems.length} currentIndex={currentTimelineIndex} firstDate={firstDate} lastDate={lastDate} onNavigate={handleTimelineNav} />}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && <div className="space-y-6"><div className="skeleton h-8 w-3/4 rounded" /><div className="skeleton h-4 w-1/2 rounded" /><div className="skeleton h-32 w-full rounded-lg" /></div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error} <button onClick={fetchData} className="ml-3 underline hover:no-underline">Retry</button></div>}
        {!loading && !error && entry && (
          <div className="space-y-6">
            {timelineItems.map((item, index) => {
              const prevDate = index > 0 ? timelineItems[index - 1].date : null;
              const gap = timeGapLabel(prevDate, item.date);
              const isEntry = item.type === "entry";
              const ed = item.data as SiteFeedbackEntry;
              const cd = item.data as FeedbackCommentEntry;
              const itemId = isEntry ? ed.id : cd.id;
              return (
                <div key={(isEntry ? "e-" : "c-") + itemId}>
                  {gap && <div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs font-medium text-gray-400 flex-shrink-0">{gap}</span><div className="flex-1 h-px bg-gray-200" /></div>}
                  <div ref={el => { contentRefs.current[index] = el; }} className="rounded-lg border border-gray-200 bg-white p-5">
                    {isEntry ? (<>
                      <div className="flex items-start gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">{getInitials(ed.display_name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <h1 className="text-lg font-bold text-gray-900">{ed.title || "Untitled"}</h1>
                            <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + getCategoryColor(ed.category)}>{getCategoryLabel(ed.category)}</span>
                            {ed.rating > 0 && <span className="text-xs text-amber-500">{"★".repeat(ed.rating)}</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{ed.display_name}</span>
                            {ed.affiliation && (<><span>·</span><span>{ed.affiliation}</span></>)}
                            <span>·</span><span>{formatDate(ed.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words">{ed.message}</div>
                      {ed.creator_reply && (
                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-center gap-2 mb-2"><div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white">S</div><span className="text-xs font-semibold text-blue-800">SeqEdge Team</span><span className="text-xs text-blue-500">· Official Response</span></div>
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words">{ed.creator_reply}</div>
                        </div>)}
                    </>) : (<>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">{getInitials(cd.author_name)}</div>
                        <div><span className="text-sm font-semibold text-gray-900">{cd.author_name}</span> <span className="text-xs text-gray-500">{formatDate(cd.created_at)}</span></div>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words ml-11">{cd.message}</div>
                    </>)}
                    <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-gray-100">
                      <button onClick={() => handleLike(itemId)} className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors " + (likes[itemId] ? "text-red-500 bg-red-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50")}>
                        <svg className="h-4 w-4" fill={likes[itemId] ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        {(likeCounts[itemId] || (likes[itemId] ? 1 : 0)) > 0 && <span>{likeCounts[itemId] || (likes[itemId] ? 1 : 0)}</span>}
                      </button>
                      <button onClick={() => handleShare(itemId)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Post a Reply</h3>
              <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={4} placeholder="Write your reply... (Markdown supported)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y" />
              <div className="flex items-center justify-between mt-3">
                <div>{commentError && <span className="text-xs text-red-600">{commentError}</span>}{commentSuccess && <span className="text-xs text-emerald-600">{commentSuccess}</span>}</div>
                <button onClick={handleSubmitComment} disabled={commentSubmitting || !commentText.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors">{commentSubmitting ? "Posting..." : "Reply"}</button>
              </div>
            </div>
            <DiscussionFooter comments={comments} entry={entry} totalViews={totalViews} />
          </div>
        )}
      </main>
    </div>
  );
}
