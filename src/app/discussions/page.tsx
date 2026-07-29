"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteConfig } from "@/site-config";
import BadgeDisplay from "@/components/badge-display";
import UserMenuPanel from "@/components/user-menu-panel";
import type { FeedbackCommentEntry, SiteFeedbackEntry } from "@/types/genome";
import type { Session } from "@supabase/supabase-js";

function getCategoryColor(c: string): string {
  const m: Record<string,string>={general:"bg-blue-100 text-blue-800",issue:"bg-red-100 text-red-800",idea:"bg-amber-100 text-amber-800",data:"bg-emerald-100 text-emerald-800",collaboration:"bg-purple-100 text-purple-800"};
  return m[c]||"bg-gray-100 text-gray-800";
}
function getCategoryLabel(c: string): string {
  const m: Record<string,string>={general:"General",issue:"Issue",idea:"Idea",data:"Data",collaboration:"Collaboration"};
  return m[c]||c;
}
function getInitials(n: string): string {
  if(!n)return"?";
  const p=n.trim().split(/\s+/);
  return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.substring(0,2).toUpperCase();
}
function formatTimeAgo(d: string): string {
  const diff=Math.floor((Date.now()-new Date(d).getTime())/1000);
  if(diff<60)return"just now";if(diff<3600)return Math.floor(diff/60)+"m ago";
  if(diff<86400)return Math.floor(diff/3600)+"h ago";if(diff<2592000)return Math.floor(diff/86400)+"d ago";
  if(diff<31536000)return Math.floor(diff/2592000)+"mo ago";return Math.floor(diff/31536000)+"y ago";
}
function truncateText(t: string, max: number): string {
  if(!t)return"";
  const c=t.replace(/!\[.*?\]\(.*?\)/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/[*_`#]/g,"").trim();
  return c.length>max?c.slice(0,max)+"...":c;
}
function hasCreatorReply(entry: SiteFeedbackEntry): boolean {
  return Boolean(entry.creator_reply);
}

type SortMode = "newest"|"oldest"|"most_liked";
type StatusFilter = "all"|"in_progress"|"resolved";

export default function DiscussionsPage() {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string,number>>({});
  const [lastActivity, setLastActivity] = useState<Record<string,string>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string,number>>({});
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [githubUser, setGithubUser] = useState<string|null>(null);
  const [session, setSession] = useState<Session|null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerForm, setComposerForm] = useState({title:"",displayName:"",visitorEmail:"",category:"general",message:"",visibility:"public"});
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string|null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string|null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [composerUploadMsg, setComposerUploadMsg] = useState<{type:"success"|"error";text:string}|null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Detect GitHub login from session/localStorage  
  useEffect(() => {
    const stored = localStorage.getItem("galibierhub-github-user");
    if (stored) setGithubUser(stored);
    // Also try to read from Supabase session
    import("@/utils/supabase-browser").then(async ({getBrowserSupabase}) => {
      const sb = getBrowserSupabase();
      if (sb) {
        const {data} = await sb.auth.getSession();
        if (data.session) { setSession(data.session); }
        const user = data.session?.user;
        if (user) {
          const login = user.user_metadata?.user_name || user.user_metadata?.preferred_username || user.user_metadata?.login;
          if (login) {
            setGithubUser(String(login));
            localStorage.setItem("galibierhub-github-user", String(login));
            if (login === "Helloxiaolaodi" || login === "xulab-admin") { setIsAdmin(true); }
          }
        }
      }
    }).catch(()=>{});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load discussions");
      const data = await res.json() as {entries?:SiteFeedbackEntry[]};
      const publicEntries = (data.entries||[]).filter(e=>e.visibility==="public");
      setEntries(publicEntries);
      // Fetch comment counts and like counts in parallel
      const counts: Record<string,number>={};
      const activities: Record<string,string>={};
      const likes: Record<string,number>={};
      await Promise.all(publicEntries.map(async entry=>{
        try {
          const cr = await fetch("/api/feedback?feedback_id="+encodeURIComponent(entry.id));
          if (cr.ok) {
            const cd = await cr.json() as {comments?:FeedbackCommentEntry[]};
            const cmts = cd.comments||[];
            counts[entry.id]=cmts.length;
            if (cmts.length>0) {
              const latest = cmts.reduce((a,b)=>new Date(a.created_at)>new Date(b.created_at)?a:b);
              activities[entry.id]=latest.created_at;
            }
          }
        } catch{}
      }));
      // Fetch like counts
      try {
        const rr = await fetch("/api/reactions");
        if (rr.ok) {
          const rd = await rr.json() as {entries?:Record<string,{like:number}>};
          if (rd.entries) {
            Object.keys(rd.entries).forEach(k=>{likes[k]=rd.entries![k].like;});
          }
        }
      } catch{}
      setCommentCounts(counts);
      setLastActivity(activities);
      setLikeCounts(likes);
    } catch (err) { setError(err instanceof Error?err.message:"Unknown error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(()=>{fetchData();},[fetchData]);

  const handleImageUpload = useCallback(async (file: File): Promise<string|null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || data.error) return null;
      return data.url || null;
    } catch { return null; }
  }, []);

  const handleComposerSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerForm.title.trim() || composerForm.title.trim().length < 3) { setComposerError("Title must be at least 3 characters."); return; }
    if (!composerForm.message.trim() || composerForm.message.trim().length < 3) { setComposerError("Message must be at least 3 characters."); return; }
    const displayName = composerForm.displayName.trim() || (githubUser || "Visitor");
    setComposerSubmitting(true); setComposerError(null);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({title:composerForm.title.trim(),displayName,message:composerForm.message.trim(),visitorEmail:composerForm.visitorEmail,category:composerForm.category,visibility:composerForm.visibility,rating:5}) });
      if (!res.ok) { const d = await res.json() as {error?:string}; throw new Error(d.error||"Failed to submit"); }
      setComposerSuccess("Discussion created!");
      setComposerForm({title:"",displayName:"",visitorEmail:"",category:"general",message:"",visibility:"public"});
      await fetchData();
      setTimeout(()=>{ setShowComposer(false); setComposerSuccess(null); }, 1500);
    } catch (err) { setComposerError(err instanceof Error?err.message:"Failed to submit"); }
    finally { setComposerSubmitting(false); }
  }, [composerForm, githubUser, fetchData]);


  // Filter and sort entries
  const filteredEntries = entries.filter(e=>{
    if (statusFilter==="in_progress") return !hasCreatorReply(e);
    if (statusFilter==="resolved") return hasCreatorReply(e);
    return true;
  });

  const sortedEntries = [...filteredEntries].sort((a,b)=>{
    switch(sortMode){
      case "oldest": return new Date(a.created_at).getTime()-new Date(b.created_at).getTime();
      case "most_liked": return (likeCounts[b.id]||0)-(likeCounts[a.id]||0);
      case "newest":
      default: return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="sticky top-0 z-40 border-b border-white/20 bg-white/70 backdrop-blur-xl saturate-150 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800">{SiteConfig.title}</Link>
            <span className="text-gray-500">/</span>
            <h1 className="text-base font-semibold text-gray-900">Discussions</h1>
          </div>
          <div className="flex items-center gap-3">
 {githubUser&&<span className="text-sm font-semibold text-blue-700 bg-blue-50 rounded-full px-4 py-1.5">Welcome, {isAdmin ? "GalibierHub Team" : githubUser}!</span>}
            <button onClick={()=>{setShowComposer(true);setComposerError(null);setComposerSuccess(null);}} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] transition-all">New Discussion</button>
            <Link href="/" className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">Back to Home</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Community Discussions</h2>
          <p className="mt-2 text-sm text-gray-600">Browse public discussions, share ideas, and collaborate with the community.</p>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Status filter */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {(["all","in_progress","resolved"] as StatusFilter[]).map(f=>(
              <button key={f} onClick={()=>setStatusFilter(f)}
                className={"rounded-md px-3 py-1.5 text-xs font-medium transition-colors "+(statusFilter===f?"bg-blue-600 text-white shadow-sm":"text-gray-600 hover:text-gray-900")}>
                {f==="all"?"All":f==="in_progress"?"In Progress":"Resolved"}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Sort:</span>
            <select value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="most_liked">Most Liked</option>
            </select>
          </div>
        </div>

        {loading&&<div className="space-y-4">{Array.from({length:5}).map((_,i)=>(<div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"><div className="flex items-start gap-4"><div className="skeleton h-10 w-10 rounded-full"/><div className="flex-1 space-y-3"><div className="skeleton h-5 w-3/4 rounded"/><div className="skeleton h-4 w-1/2 rounded"/><div className="skeleton h-4 w-full rounded"/></div><div className="text-right space-y-2"><div className="skeleton h-4 w-12 rounded ml-auto"/><div className="skeleton h-3 w-16 rounded ml-auto"/></div></div></div>))}</div>}
        {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error} <button onClick={fetchData} className="ml-3 underline hover:no-underline">Retry</button></div>}
        {!loading&&!error&&sortedEntries.length===0&&(
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <svg className="mx-auto mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <h3 className="text-base font-medium text-gray-900">No discussions yet</h3>
            <p className="mt-2 text-sm text-gray-500">Be the first to start a discussion.</p>
            <button onClick={()=>{setShowComposer(true);setComposerError(null);setComposerSuccess(null);}} className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-all hover:-translate-y-0.5 hover:shadow-md">Start a Discussion</button>
          </div>
        )}
        {!loading&&!error&&sortedEntries.length>0&&(
          <div className="space-y-3">
            {sortedEntries.map(entry=>{
              const replyCount = commentCounts[entry.id]||0;
              const activityTime = lastActivity[entry.id]||entry.created_at;
              const preview = truncateText(entry.message, 120);
              const isResolved = hasCreatorReply(entry);
              return (
                <Link key={entry.id} href={"/discussions/"+entry.id}
                  className="block rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-gray-200 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">{getInitials(entry.display_name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <h3 className="text-base font-semibold text-gray-900 hover:text-blue-700 truncate">{entry.title||"Untitled Discussion"}</h3>
                        {entry.category !== "general" && <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium "+getCategoryColor(entry.category)}>{getCategoryLabel(entry.category)}</span>}
                        {isResolved&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Resolved</span>}
                        {!isResolved&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">In Progress</span>}
                        {entry.rating>0&&<span className="inline-flex items-center gap-0.5 text-xs text-amber-600">{Array.from({length:entry.rating}).map((_,i)=><svg key={i} className="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}</span>}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{preview}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <span>{entry.display_name}</span>
                              {entry.user_id && <BadgeDisplay userId={entry.user_id} />}
                            </div>
                            <span>·</span>
                        <span>{formatTimeAgo(entry.created_at)}</span>
                        {likeCounts[entry.id]>0&&<><span>·</span><span className="text-red-500">♥ {(likeCounts[entry.id])}</span></>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right">
                      <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
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
