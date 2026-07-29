"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteConfig } from "@/site-config";
import BadgeDisplay from "@/components/badge-display";
import UserMenuPanel from "@/components/user-menu-panel";
import type { FeedbackCommentEntry, SiteFeedbackEntry } from "@/types/genome";
import type { Session } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/utils/supabase-browser";
import { renderInlineText, renderMarkdown } from "@/lib/markdown";

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
  const [mounted, setMounted] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerForm, setComposerForm] = useState({title:"",displayName:"",visitorEmail:"",affiliation:"",message:"",visibility:"public"});
  type MarkdownAction = "bold"|"italic"|"code"|"quote"|"link"|"image"|"list";
  const [composerPreview, setComposerPreview] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string|null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string|null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [composerUploadMsg, setComposerUploadMsg] = useState<{type:"success"|"error";text:string}|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const insertComposerMarkdown = (action: MarkdownAction) => {
    const ta = composerRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const before = composerForm.message.substring(0, start), selected = composerForm.message.substring(start, end), after = composerForm.message.substring(end);
    let result = "";
    switch (action) {
      case "bold": result = before + "**" + (selected || "bold text") + "**" + after; break;
      case "italic": result = before + "*" + (selected || "italic text") + "*" + after; break;
      case "code": result = before + "`" + (selected || "code") + "`" + after; break;
      case "quote": result = before + "> " + (selected || "quote") + after; break;
      case "link": result = before + "[" + (selected || "link text") + "](url)" + after; break;
      case "image": { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; setComposerError(null); setUploadingImage(true); setComposerUploadMsg(null); const formData = new FormData(); formData.append("file", file); try { const resp = await fetch("/api/upload-image", { method: "POST", body: formData }); const data = await resp.json() as { url?: string; error?: string }; if (!resp.ok || data.error) throw new Error(data.error || "Upload failed"); if (data.url) { setComposerForm(p => ({...p, message: p.message + "\n![" + file.name + "](" + data.url + ")"})); setComposerUploadMsg({type:"success", text:"Image uploaded!"}); } } catch (err) { setComposerUploadMsg({type:"error", text: err instanceof Error ? err.message : "Upload failed"}); } finally { setUploadingImage(false); } }; input.click(); return; }
      case "list": result = before + "\n- " + (selected || "list item") + after; break;
    }
    setComposerForm(p => ({...p, message: result}));
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + result.length - after.length; ta.focus(); }, 0);
  };

  // Detect GitHub login from session/localStorage  
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("galibierhub-github-user");
    if (stored) setGithubUser(stored);
    const sb = getBrowserSupabase();
    if (sb) {
      sb.auth.getSession().then(({data}) => {
        if (data.session) { setSession(data.session); }
        const user = data.session?.user;
        if (user) {
          const login = user.user_metadata?.user_name || user.user_metadata?.preferred_username || user.user_metadata?.login;
          if (login) {
            setGithubUser(String(login));
            localStorage.setItem("galibierhub-github-user", String(login));
            const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            if (avatar) setAvatarUrl(String(avatar));
            if (login === "Helloxiaolaodi" || login === "xulab-admin") { setIsAdmin(true); }
          }
        }
      }).catch(()=>{});
    }
  }, []);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, sortMode, searchQuery]);

  const handleSignIn = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.origin + "/discussions" } });
  }, []);

  const handleSignOut = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem("galibierhub-github-user");
    setGithubUser(null);
    setSession(null);
    setIsAdmin(false);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    const authHeaders: Record<string,string> = {};
    if (session?.access_token) { authHeaders["Authorization"] = "Bearer " + session.access_token; }
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
          const cr = await fetch("/api/feedback?feedback_id="+encodeURIComponent(entry.id), { headers: authHeaders });
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
      const res = await fetch("/api/feedback", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({title:composerForm.title.trim(),displayName,message:composerForm.message.trim(),visitorEmail:composerForm.visitorEmail,affiliation:composerForm.affiliation,visibility:composerForm.visibility}) });
      if (!res.ok) { const d = await res.json() as {error?:string}; throw new Error(d.error||"Failed to submit"); }
      setComposerSuccess("Discussion created!");
      setComposerForm({title:"",displayName:"",visitorEmail:"",affiliation:"",message:"",visibility:"public"});
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
  }).filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (e.title||'').toLowerCase().includes(q) || (e.message||'').toLowerCase().includes(q) || (e.display_name||'').toLowerCase().includes(q);
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
            {!mounted ? (
              <div className="w-[120px] h-8" />
            ) : session ? (
              <UserMenuPanel session={session} githubUser={githubUser} isAdmin={isAdmin} onSignOut={handleSignOut} avatarUrl={avatarUrl} />
            ) : (
              <button onClick={handleSignIn} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100">
                Log in with GitHub
              </button>
            )}
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

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search discussions by title, content, or author..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
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
        <>
          <div className="space-y-3">
            {sortedEntries.slice((currentPage-1)*ITEMS_PER_PAGE, currentPage*ITEMS_PER_PAGE).map(entry=>{
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
                        <h3 className="text-base font-semibold text-gray-900 hover:text-blue-700 truncate">{entry.title?renderInlineText(entry.title, "t-"+entry.id):"Untitled Discussion"}</h3>
                        {entry.affiliation && <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">{entry.affiliation}</span>}
                        {isResolved&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Resolved</span>}
                        {!isResolved&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">In Progress</span>}
                        
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{preview}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <span>{entry.display_name}</span>
                              {entry.user_id && <BadgeDisplay userId={entry.user_id} />}
                            </div>
                            <span>·</span>
                        <span>{formatTimeAgo(entry.created_at)}</span>
                        {likeCounts[entry.id]>0&&<><span className="text-red-500">♥</span><span className="text-red-500"> {likeCounts[entry.id]}</span></>}
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
          {/* Pagination footer */}
          {sortedEntries.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-gray-100 bg-white rounded-b-2xl px-4 py-3 mt-3">
              <div className="text-xs text-gray-500">
                Showing {((currentPage-1)*ITEMS_PER_PAGE)+1}–{Math.min(currentPage*ITEMS_PER_PAGE, sortedEntries.length)} of {sortedEntries.length} discussions
              </div>
              <div className="flex items-center gap-1">
                <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>Prev
                </button>
                {Array.from({length:Math.ceil(sortedEntries.length/ITEMS_PER_PAGE)},(_,i)=>i+1).map(p=>(
                  <button key={p} onClick={()=>setCurrentPage(p)} className={"inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors "+(p===currentPage?"bg-blue-600 text-white":"border border-gray-200 bg-white text-gray-700 hover:bg-gray-50")}>{p}</button>
                ))}
                <button onClick={()=>setCurrentPage(p=>Math.min(Math.ceil(sortedEntries.length/ITEMS_PER_PAGE),p+1))} disabled={currentPage>=Math.ceil(sortedEntries.length/ITEMS_PER_PAGE)} className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next<svg className="h-3.5 w-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </main>
      {/* New Discussion Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowComposer(false); setComposerError(null); setComposerSuccess(null); }}>
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">New Discussion</h2>
              <button onClick={() => { setShowComposer(false); setComposerError(null); setComposerSuccess(null); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleComposerSubmit} className="p-5 space-y-4">
              {composerError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{composerError}</div>}
              {composerSuccess && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{composerSuccess}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input type="text" value={composerForm.title} onChange={e => setComposerForm(p => ({...p, title: e.target.value}))} required minLength={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="What would you like to discuss?" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input type="text" value={composerForm.displayName} onChange={e => setComposerForm(p => ({...p, displayName: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder={githubUser || "Your name"} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation</label>
                  <input type="text" value={composerForm.affiliation||""} onChange={e => setComposerForm(p => ({...p, affiliation: e.target.value}))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="e.g. Peking University" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                {/* Toolbar + Edit/Preview toggle */}
                <div className="flex items-center justify-between border border-gray-200 rounded-t-lg bg-gray-50/80 px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    {(["bold","italic","code","quote","link","image","list"] as MarkdownAction[]).map(a => (
                      <button key={a} type="button" onClick={() => insertComposerMarkdown(a)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors" title={a}>
                        {a==="bold"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>}
                        {a==="italic"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4" strokeWidth={2}/><line x1="14" y1="20" x2="5" y2="20" strokeWidth={2}/><line x1="15" y1="4" x2="9" y2="20" strokeWidth={2}/></svg>}
                        {a==="code"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" strokeWidth={2}/><polyline points="8 6 2 12 8 18" strokeWidth={2}/></svg>}
                        {a==="quote"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" strokeWidth={2}/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" strokeWidth={2}/></svg>}
                        {a==="link"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>}
                        {a==="image"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2}/><circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2}/><polyline points="21 15 16 10 5 21" strokeWidth={2}/></svg>}
                        {a==="list"&&<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" strokeWidth={2}/><line x1="8" y1="12" x2="21" y2="12" strokeWidth={2}/><line x1="8" y1="18" x2="21" y2="18" strokeWidth={2}/><line x1="3" y1="6" x2="3.01" y2="6" strokeWidth={2}/><line x1="3" y1="12" x2="3.01" y2="12" strokeWidth={2}/><line x1="3" y1="18" x2="3.01" y2="18" strokeWidth={2}/></svg>}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setComposerPreview(false)} className={"rounded px-2 py-1 text-xs font-medium transition-colors "+(composerPreview?"text-gray-500 hover:bg-gray-200":"bg-blue-600 text-white")}>Edit</button>
                    <button type="button" onClick={() => setComposerPreview(true)} className={"rounded px-2 py-1 text-xs font-medium transition-colors "+(composerPreview?"bg-blue-600 text-white":"text-gray-500 hover:bg-gray-200")}>Preview</button>
                  </div>
                </div>
                {composerPreview ? (
                  <div className="min-h-[200px] rounded-b-lg border border-t-0 border-gray-200 px-4 py-3 text-sm text-gray-700 prose prose-sm max-w-none overflow-y-auto">{composerForm.message.trim() ? renderMarkdown(composerForm.message) : <span className="text-gray-400 italic">Nothing to preview</span>}</div>
                ) : (
                  <textarea ref={composerRef} value={composerForm.message} onChange={e => setComposerForm(p => ({...p, message: e.target.value}))} required minLength={3} rows={8}
                    className="w-full rounded-b-lg border border-t-0 border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-y"
                    placeholder="Write your message... (Markdown supported)" />
                )}
              </div>
              <div className="flex items-center justify-between">
                  {composerUploadMsg && <div className="text-xs"><span className={composerUploadMsg.type==="success"?"text-emerald-600":"text-red-600"}>{composerUploadMsg.text}</span></div>}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setShowComposer(false); setComposerError(null); setComposerSuccess(null); }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={composerSubmitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50">
                    {composerSubmitting ? "Posting..." : "Post Discussion"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
