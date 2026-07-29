"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import BadgeDisplay from "@/components/badge-display";
import UserMenuPanel from "@/components/user-menu-panel";
import { SiteConfig } from "@/site-config";
import type { FeedbackCommentEntry, SiteFeedbackEntry } from "@/types/genome";
import type { Session } from "@supabase/supabase-js";

// ---- helpers ----
function getCategoryColor(c: string): string {
  const m: Record<string,string>={general:"bg-blue-100 text-blue-800",issue:"bg-red-100 text-red-800",idea:"bg-amber-100 text-amber-800",data:"bg-emerald-100 text-emerald-800",collaboration:"bg-purple-100 text-purple-800"};
  return m[c]||"bg-gray-100 text-gray-800";
}
function getCategoryLabel(c: string): string {
  const m: Record<string,string>={general:"General",issue:"Issue",idea:"Idea",data:"Data",collaboration:"Collaboration"};
  return m[c]||c;
}
function getInitials(n: string): string {
  if(!n) return "?";
  const p=n.trim().split(/\s+/);
  return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.substring(0,2).toUpperCase();
}
function formatTimeAgo(d: string): string {
  const diff=Math.floor((Date.now()-new Date(d).getTime())/1000);
  if(diff<60)return"just now";if(diff<3600)return Math.floor(diff/60)+"m ago";
  if(diff<86400)return Math.floor(diff/3600)+"h ago";if(diff<2592000)return Math.floor(diff/86400)+"d ago";
  if(diff<31536000)return Math.floor(diff/2592000)+"mo ago";return Math.floor(diff/31536000)+"y ago";
}
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function timeGapLabel(prev: string|null, curr: string): string|null {
  if(!prev)return null;const p=new Date(prev).getTime(),c=new Date(curr).getTime(),ms=c-p;
  if(ms<120000)return null;const h=Math.floor(ms/3600000);
  if(h<24)return h+" hour"+(h>1?"s":"")+" later";const d=Math.floor(ms/86400000);
  if(d<30)return d+" day"+(d>1?"s":"")+" later";const mo=Math.floor(d/30);
  if(mo<12)return mo+" month"+(mo>1?"s":"")+" later";return Math.floor(mo/12)+" year"+(Math.floor(mo/12)>1?"s":"")+" later";
}

// ---- TimelineSidebar: positioned relative to main content, not viewport ----
function TimelineSidebar({ total, currentIndex, firstDate, lastDate, onNavigate }: {
  total: number; currentIndex: number; firstDate: string|null; lastDate: string|null;
  onNavigate: (i: number) => void;
}) {
  return (
    <div className="absolute -right-16 top-0 bottom-0 hidden xl:flex items-center" style={{ width: 48 }}>
      <div className="sticky top-32 flex flex-col items-center gap-1 rounded-full border border-gray-200 bg-white/90 py-3 px-2 shadow-sm backdrop-blur">
        <div className="text-xs font-mono font-semibold text-gray-500 text-center leading-tight">
          {currentIndex+1}<br/><span className="text-[10px] text-gray-400">/ {total}</span>
        </div>
        <div className="w-1 flex-1 min-h-[48px] bg-gray-200 rounded-full overflow-hidden my-1">
          <div className="w-full bg-blue-500 rounded-full transition-all duration-300"
            style={{height:((currentIndex+1)/Math.max(total,1))*100+"%"}} />
        </div>
        {firstDate&&<div className="text-[10px] text-gray-400 text-center leading-tight">{new Date(firstDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
        {lastDate&&lastDate!==firstDate&&<><div className="text-[10px] text-gray-300">|</div><div className="text-[10px] text-blue-500 text-center leading-tight font-medium">{formatTimeAgo(lastDate)}</div></>}
        <button onClick={()=>onNavigate(Math.max(0,currentIndex-1))} disabled={currentIndex<=0} className="mt-1 rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg></button>
        <button onClick={()=>onNavigate(Math.min(total-1,currentIndex+1))} disabled={currentIndex>=total-1} className="rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg></button>
      </div>
    </div>
  );
}

// ---- ShareModal ----
function ShareModal({ open, onClose, entryId }: { open: boolean; onClose: () => void; entryId: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/discussions/${entryId}` : "";
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Share this discussion</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <input type="text" readOnly value={url} className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none" />
          <button onClick={handleCopy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">{copied ? "Copied!" : "Copy"}</button>
        </div>
        <div className="flex items-center gap-3 justify-center pt-2 border-t border-gray-100">
          <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
          <a href={`mailto:?subject=GalibierHub Discussion&body=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></a>
          <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
        </div>
      </div>
    </div>
  );
}

// ---- FloatingReply ----
type MarkdownAction = "bold"|"italic"|"code"|"quote"|"link"|"image"|"list";

function FloatingReply({ open, onClose, replyTarget, onSubmit }: {
  open: boolean; onClose: () => void; replyTarget: string|null; onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) { setText(replyTarget ? `@${replyTarget} ` : ""); setError(null); setSuccess(null); setTimeout(()=>textareaRef.current?.focus(), 100); } }, [open, replyTarget]);

  const insertMarkdown = (action: MarkdownAction) => {
    const ta = textareaRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const before = text.substring(0, start), selected = text.substring(start, end), after = text.substring(end);
    let result = "";
    switch (action) {
      case "bold": result = before + "**" + (selected || "bold text") + "**" + after; break;
      case "italic": result = before + "*" + (selected || "italic text") + "*" + after; break;
      case "code": result = before + "`" + (selected || "code") + "`" + after; break;
      case "quote": result = before + "> " + (selected || "quote") + after; break;
      case "link": result = before + "[" + (selected || "link text") + "](url)" + after; break;
      case "image": { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; setError(null); const formData = new FormData(); formData.append("file", file); try { const resp = await fetch("/api/upload-image", { method: "POST", body: formData }); const data = await resp.json() as { url?: string; error?: string }; if (!resp.ok) throw new Error(data.error || "Upload failed"); if (data.url) { const r = before + "![" + (selected || file.name) + "](" + data.url + ")" + after; setText(r); } } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } }; input.click(); break; }
      case "list": result = before + "\n- " + (selected || "list item") + after; break;
    }
    setText(result);
  };

  const handleSubmit = async () => {
    const t = text.trim(); if (!t) return;
    setSubmitting(true); setError(null); setSuccess(null);
    try { await onSubmit(t); setSuccess("Posted!"); setText(""); } 
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2 backdrop-blur">
          <span className="text-sm font-semibold text-gray-700">{replyTarget ? `Replying to @${replyTarget}` : "Post a Reply"}</span>
          <div className="flex items-center gap-1">
            <button onClick={()=>setPreviewMode(false)} className={"rounded px-2 py-1 text-xs font-medium transition-colors "+(previewMode?"text-gray-500 hover:bg-gray-200":"bg-blue-600 text-white")}>Edit</button>
            <button onClick={()=>setPreviewMode(true)} className={"rounded px-2 py-1 text-xs font-medium transition-colors "+(previewMode?"bg-blue-600 text-white":"text-gray-500 hover:bg-gray-200")}>Preview</button>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
        </div>
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-1.5 bg-white">
          {(["bold","italic","code","quote","link","image","list"] as MarkdownAction[]).map(a => (
            <button key={a} type="button" onClick={() => insertMarkdown(a)}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors" title={a}>
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
        {previewMode ? (
          <div className="min-h-[150px] px-4 py-3 text-sm text-gray-700 prose prose-sm max-w-none">{text.trim() ? renderMarkdown(text) : <span className="text-gray-400 italic">Nothing to preview</span>}</div>
        ) : (
          <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} rows={6}
            placeholder="Write your reply... (Markdown supported)" 
            className="w-full resize-y border-0 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400" />
        )}
        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          <div>{error&&<span className="text-xs text-red-600">{error}</span>}{success&&<span className="text-xs text-emerald-600">{success}</span>}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting||!text.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors">{submitting?"Posting...":"Reply"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Simple Markdown renderer for inline images ----
function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInlineText(text: string, key: string): React.ReactNode {
  let html = htmlEscape(text);
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-pink-600 font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 hover:underline">$1</a>');
  return <span key={key} dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap break-words" />;
}

function renderInline(text: string, onImageClick?: (src: string, alt: string) => void, prefix?: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIdx = 0, pi = 0;
  let m: RegExpExecArray | null;
  const pf = prefix || '';
  while ((m = imgRe.exec(text)) !== null) {
    const imgSrc = m[2], imgAlt = m[1] || 'image';
    if (m.index > lastIdx) parts.push(renderInlineText(text.substring(lastIdx, m.index), `${pf}-it-${pi++}`));
    parts.push(<img key={`${pf}-img-${pi++}`} src={imgSrc} alt={imgAlt} className="my-2 max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" onClick={() => onImageClick?.(imgSrc, imgAlt)} />);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(renderInlineText(text.substring(lastIdx), `${pf}-it-${pi++}`));
  return parts.length > 1 ? <>{parts}</> : parts[0] || null;
}

function renderMarkdown(text: string, onImageClick?: (src: string, alt: string) => void): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let inCodeBlock = false, codeContent = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      if (inCodeBlock) {
        result.push(<pre key={`cb-${i}`} className="my-2 rounded-lg bg-slate-900 text-green-400 p-3 text-sm overflow-x-auto whitespace-pre-wrap font-mono">{codeContent}</pre>);
        inCodeBlock = false; codeContent = '';
      } else { inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; continue; }
    if (line.startsWith('> ')) { result.push(<div key={`bq-${i}`} className="my-1 border-l-4 border-blue-300 pl-3 italic text-gray-600">{renderInline(line.substring(2), onImageClick, `bqi-${i}`)}</div>); continue; }
    if (line.trim() === '') { result.push(<div key={`br-${i}`} className="h-2" />); continue; }
    result.push(<div key={`ln-${i}`}>{renderInline(line, onImageClick, `lni-${i}`)}</div>);
  }
  return <div className="markdown-content">{result}</div>;
}

// ---- DiscussionFooter with subscription controls ----
function DiscussionFooter({ comments, entry, totalViews, onSignUp, onMaybeLater, onNoThanks, hideSignupPrompt }: {
  comments: FeedbackCommentEntry[]; entry: SiteFeedbackEntry; totalViews: number;
  onSignUp: () => void; onMaybeLater: () => void; onNoThanks: () => void;
  hideSignupPrompt: boolean;
}) {
  const linkCount = useMemo(() => {
    const re = /https?:\/\/\S+/g;
    return ((entry.message||"").match(re)||[]).length + comments.flatMap(c=>(c.message||"").match(re)||[]).length;
  }, [entry.message, comments]);
  const participants = useMemo(() => {
    const seen = new Set<string>(); const r: {name:string;email?:string|null}[] = [];
    const add = (n:string,em?:string|null) => { if(!seen.has(n)){seen.add(n);r.push({name:n,email:em});} };
    add(entry.display_name, entry.visitor_email);
    comments.forEach(c=>add(c.author_name, c.author_email));
    return r;
  }, [entry, comments]);
  const [hovered, setHovered] = useState<string|null>(null);
  const [notifyLevel, setNotifyLevel] = useState<string>("normal");

  const notifyOptions = [
    { key: "watching", label: "Watching", desc: "Every reply triggers notification" },
    { key: "tracking", label: "Tracking", desc: "Show unread count only" },
    { key: "normal", label: "Normal", desc: "Notify on @mentions and replies to you" },
    { key: "muted", label: "Muted", desc: "No notifications from this discussion" },
  ];

  return (
    <div className="mt-8 border-t border-gray-200 pt-6">
      {/* Subscription controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span className="text-sm font-medium text-gray-700">Notification:</span>
        </div>
        <select value={notifyLevel} onChange={e=>setNotifyLevel(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
          {notifyOptions.map(o=><option key={o.key} value={o.key} title={o.desc}>{o.label}</option>)}
        </select>
      </div>

      {/* Data summary */}
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <span className="font-medium text-gray-900">{totalViews}</span> <span>views</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          <span className="font-medium text-gray-900">{linkCount}</span> <span>links</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Participants:</span>
          <div className="flex -space-x-2">
            {participants.slice(0,6).map(p=>(<div key={p.name} className="relative" onMouseEnter={()=>setHovered(p.name)} onMouseLeave={()=>setHovered(null)}><div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-white cursor-default">{getInitials(p.name)}</div>{hovered===p.name&&(<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"><div className="rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3 text-center min-w-[140px]"><div className="mx-auto mb-2 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-semibold text-white">{getInitials(p.name)}</div><div className="text-sm font-semibold text-gray-900">{p.name}</div><div className="text-xs text-gray-500 mt-0.5">{p.email?"Public profile":"Visitor"}</div></div><div className="mx-auto h-2 w-2 rotate-45 border-r border-b border-gray-200 bg-white -mt-1"/></div>)}</div>))}
            {participants.length>6&&<div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 ring-2 ring-white">+{participants.length-6}</div>}
          </div>
        </div>
      </div>

      {/* Sign-up prompt */}
      {!hideSignupPrompt && (
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div><h4 className="text-base font-semibold text-gray-900">Join the conversation</h4><p className="mt-1 text-sm text-gray-600">Sign in to receive notifications, save bookmarks, and like discussions.</p></div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onSignUp} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-all hover:-translate-y-0.5 hover:shadow-md">Sign Up</button>
            <button onClick={onMaybeLater} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">Maybe later</button>
            <button onClick={onNoThanks} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-all">no thanks</button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ---- MAIN COMPONENT ----
export default function DiscussionDetailPage() {
  const [id, setId] = useState<string|null>(null);
  const [entry, setEntry] = useState<SiteFeedbackEntry|null>(null);
  const [comments, setComments] = useState<FeedbackCommentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [likes, setLikes] = useState<Record<string,boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string,number>>({});
  const [likeLoading, setLikeLoading] = useState<Record<string,boolean>>({});
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [floatingReplyOpen, setFloatingReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string|null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareId, setShareId] = useState<string>("");
  const [lightbox, setLightbox] = useState<{src:string;alt:string}|null>(null);
  const [githubUser, setGithubUser] = useState<string|null>(null);
  const [currentUserId, setCurrentUserId] = useState<string|null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<Session|null>(null);
  const [adminGithubLogin, setAdminGithubLogin] = useState<string|null>(null);
  const contentRefs = useRef<(HTMLDivElement|null)[]>([]);
  const [hideSignupPrompt, setHideSignupPrompt] = useState(false);

  // Extract id from URL
  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length-1];
    if (last && last !== "discussions") setId(last);

    // Check for hidden signup prompt
    if (localStorage.getItem("galibierhub-hide-signup") === "permanent" || localStorage.getItem("galibierhub-hide-signup") === "true") {
      setHideSignupPrompt(true);
    }

    // Detect GitHub login
    const stored = localStorage.getItem("galibierhub-github-user");
    if (stored) setGithubUser(stored);
    const storedUserId = localStorage.getItem("galibierhub-user-id");
    if (storedUserId) setCurrentUserId(storedUserId);
    import("@/utils/supabase-browser").then(async ({getBrowserSupabase}) => {
      const sb = getBrowserSupabase();
      if (sb) {
        const {data} = await sb.auth.getSession();
        const user = data.session?.user;
        if (data.session) { setSession(data.session); }
        if (user) {
          const login = user.user_metadata?.user_name || user.user_metadata?.preferred_username || user.user_metadata?.login;
          if (login) {
            setGithubUser(String(login));
            localStorage.setItem("galibierhub-github-user", String(login));
            if (user.id) { setCurrentUserId(String(user.id)); localStorage.setItem("galibierhub-user-id", String(user.id)); }
            import("@/lib/admin-login").then(async ({resolveExpectedAdminGithubLogin}) => {
              const expected = resolveExpectedAdminGithubLogin({});
              if (expected && String(login).toLowerCase() === expected.toLowerCase()) {
                setIsAdmin(true);
                setAdminGithubLogin(expected);
              }
            }).catch(()=>{});
          }
        }
      }
    }).catch(()=>{});
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return; setLoading(true); setError(null);
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error("Failed to load discussion");
      const data = await res.json() as {entries?:SiteFeedbackEntry[]};
      const found = (data.entries||[]).find(e=>e.id===id);
      if (!found) throw new Error("Discussion not found");
      setEntry(found);
      const cr = await fetch("/api/feedback?feedback_id="+encodeURIComponent(id));
      if (cr.ok) { const cd = await cr.json() as {comments?:FeedbackCommentEntry[]}; setComments(cd.comments||[]); }
      // Fetch existing likes
      try {
        const rr = await fetch("/api/reactions");
        if (rr.ok) {
          const rd = await rr.json() as {entries?:Record<string,{like:number}>};
          if (rd.entries?.[id]) setLikeCounts({[id]:rd.entries[id].like});
          // Also pre-mark liked if previously liked (via local storage fingerprint)
          const stored = localStorage.getItem("galibierhub-likes-"+id);
          if (stored) {
            try { const liked = JSON.parse(stored) as string[]; liked.forEach(lid=>setLikes(p=>({...p,[lid]:true}))); } catch {}
          }
        }
      } catch {}
      // Real view counter using localStorage
      try {
        const viewKey = "galibierhub-view-"+id;
        const stored = localStorage.getItem(viewKey);
        const count = stored ? parseInt(stored,10)+1 : 1;
        localStorage.setItem(viewKey, String(count));
        setTotalViews(count);
      } catch { setTotalViews(0); }
    } catch (err) { setError(err instanceof Error?err.message:"Unknown error"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Fixed like handler - supports toggle (like/unlike)
  const handleLike = useCallback(async (entryId: string) => {
    const currentlyLiked = likes[entryId];
    setLikeLoading(p=>({...p,[entryId]:true}));
    
    if (currentlyLiked) {
      // Unlike
      setLikes(p=>({...p,[entryId]:false}));
      setLikeCounts(p=>({...p,[entryId]:Math.max(0,(p[entryId]||1)-1)}));
    } else {
      // Like
      setLikes(p=>({...p,[entryId]:true}));
      setLikeCounts(p=>({...p,[entryId]:(p[entryId]||0)+1}));
    }

    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({reactionType:"like", fingerprint:"detail-"+entryId, entryId})
      });
      // Persist liked state locally
      const stored = localStorage.getItem("galibierhub-likes-"+id);
      let likedList: string[] = stored ? JSON.parse(stored) : [];
      if (currentlyLiked) {
        likedList = likedList.filter(l=>l!==entryId);
      } else {
        if (!likedList.includes(entryId)) likedList.push(entryId);
      }
      localStorage.setItem("galibierhub-likes-"+(id||""), JSON.stringify(likedList));
    } catch {}
    finally { setLikeLoading(p=>({...p,[entryId]:false})); }
  }, [likes, id]);

  // Open share modal
  const handleShare = useCallback((entryId: string) => {
    setShareId(entryId);
    setShareModalOpen(true);
  }, []);

  // Reply to specific post
  const handleReplyTo = useCallback((authorName: string) => {
    setReplyTarget(authorName);
    setFloatingReplyOpen(true);
  }, []);

  const handleSubmitComment = useCallback(async (text: string) => {
    const authorName = isAdmin ? "GalibierHub Team" : (githubUser || "Visitor");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({feedbackId:id, message:text, authorName, userId: currentUserId || (typeof window !== "undefined" ? localStorage.getItem("galibierhub-user-id") : null)})
    });
    const d = await res.json() as {error?:string};
    if (!res.ok) throw new Error(d.error||"Failed to post");
    setFloatingReplyOpen(false);
    await fetchData();
    // Auto-award Ice Breaker badge on first post
    if (currentUserId || (typeof window !== "undefined" && localStorage.getItem("galibierhub-user-id"))) {
      const uid = currentUserId || (typeof window !== "undefined" ? localStorage.getItem("galibierhub-user-id") : null);
      if (uid) {
        try { await fetch("/api/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: uid, badgeId: "ice_breaker" }) }); } catch {}
      }
    }
  }, [id, fetchData, githubUser]);

  const timelineItems = useMemo(() => {
    if (!entry) return [];
    const items: {type:"entry"|"comment";data:SiteFeedbackEntry|FeedbackCommentEntry;date:string}[]=[
      {type:"entry",data:entry,date:entry.created_at}
    ];
    comments.forEach(c=>items.push({type:"comment",data:c,date:c.created_at}));
    return items;
  }, [entry, comments]);

  const firstDate = timelineItems[0]?.date||null;
  const lastDate = timelineItems[timelineItems.length-1]?.date||null;

  function handleTimelineNav(i: number) {
    setCurrentTimelineIndex(i);
    contentRefs.current[i]?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  // Sign-up prompt callbacks
  const handleSignUp = useCallback(() => {
    // Redirect to GitHub OAuth login
    import("@/utils/supabase-browser").then(async ({getBrowserSupabase}) => {
      const sb = getBrowserSupabase();
      if (sb) {
        await sb.auth.signInWithOAuth({provider:"github", options:{redirectTo:window.location.href}});
      }
    }).catch(()=>{ window.location.href = "/"; });
  }, []);
  const handleMaybeLater = useCallback(() => {
    // Hide the signup prompt for this session
    localStorage.setItem("galibierhub-hide-signup", "true");
    setHideSignupPrompt(true);
  }, []);
  const handleNoThanks = useCallback(() => {
    // Hide permanently
    localStorage.setItem("galibierhub-hide-signup", "permanent");
    setHideSignupPrompt(true);
  }, []);
  const handleHidePost = useCallback(async (postId: string, isDiscussion: boolean) => {
    let token = localStorage.getItem("galibierhub-github-user") || "";
    try {
      const {getBrowserSupabase} = await import("@/utils/supabase-browser");
      const sb2 = getBrowserSupabase();
      if (sb2) {
        const {data} = await sb2.auth.getSession();
        token = data.session?.access_token || token;
      }
    } catch {}
    if (isDiscussion) {
      await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id: postId, hidden: true }) });
    } else {
      await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ commentId: postId, commentHidden: true }) });
    }
    fetchData();
  }, [fetchData]);

 const handleDeletePost = useCallback(async (postId: string, isDiscussion: boolean) => {
   if (!confirm("Permanently delete this post?")) return;
   let token = localStorage.getItem("galibierhub-github-user") || "";
   try {
     const {getBrowserSupabase} = await import("@/utils/supabase-browser");
     const sb2 = getBrowserSupabase();
     if (sb2) {
       const {data} = await sb2.auth.getSession();
       token = data.session?.access_token || token;
     }
   } catch {}
   const param = isDiscussion ? "id=" + postId : "comment_id=" + postId;
   await fetch("/api/feedback?" + param, { method: "DELETE", headers: { Authorization: "Bearer " + token } });
   fetchData();
 }, [fetchData]);

  const handlePinPost = useCallback(async (postId: string) => {
    let token = localStorage.getItem("galibierhub-github-user") || "";
    try {
      const {getBrowserSupabase} = await import("@/utils/supabase-browser");
      const sb2 = getBrowserSupabase();
      if (sb2) {
        const {data} = await sb2.auth.getSession();
        token = data.session?.access_token || token;
      }
    } catch {}
    const isPinned = entry?.pinned;
    await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id: postId, pinned: !isPinned }) });
    fetchData();
  }, [entry, fetchData]);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Sticky nav */}
      <header className="sticky top-0 z-40 border-b border-white/20 bg-white/70 backdrop-blur-xl saturate-150 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-lg font-bold text-blue-700 hover:text-blue-800 flex-shrink-0">{SiteConfig.title}</Link>
            <span className="text-gray-300">/</span>
            <Link href="/discussions" className="text-sm text-gray-500 hover:text-gray-700 flex-shrink-0">Discussions</Link>
            {entry&&<><span className="text-gray-300">/</span><span className="text-sm font-medium text-gray-900 truncate">{entry.title||"Discussion"}</span></>}
          </div>
          <Link href="/discussions" className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex-shrink-0 shadow-sm">All Discussions</Link>
        </div>
        {githubUser && (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-3 text-base font-bold text-blue-700">
            Welcome, {isAdmin ? "GalibierHub Team" : githubUser}!
          </div>
        )}
      </header>

      {/* Main content area with relative positioning for sidebar */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 relative">
        {/* Timeline sidebar - now positioned relative to content */}
        {timelineItems.length>1&&(
          <div className="absolute right-0 top-0 bottom-0 hidden xl:block" style={{transform:"translateX(100%)",paddingLeft:"12px"}}>
            <div className="sticky top-32 flex flex-col items-center gap-1 rounded-full border border-gray-200 bg-white/90 py-3 px-2 shadow-sm backdrop-blur">
              <div className="text-xs font-mono font-semibold text-gray-500 text-center leading-tight">{currentTimelineIndex+1}<br/><span className="text-[10px] text-gray-400">/ {timelineItems.length}</span></div>
              <div className="w-1 h-20 bg-gray-200 rounded-full overflow-hidden my-1"><div className="w-full bg-blue-500 rounded-full transition-all duration-300" style={{height:((currentTimelineIndex+1)/Math.max(timelineItems.length,1))*100+"%"}}/></div>
              {firstDate&&<div className="text-[10px] text-gray-400 text-center leading-tight">{new Date(firstDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
              {lastDate&&lastDate!==firstDate&&<><div className="text-[10px] text-gray-300">|</div><div className="text-[10px] text-blue-500 text-center leading-tight font-medium">{formatTimeAgo(lastDate)}</div></>}
              <button onClick={()=>handleTimelineNav(Math.max(0,currentTimelineIndex-1))} disabled={currentTimelineIndex<=0} className="mt-1 rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg></button>
              <button onClick={()=>handleTimelineNav(Math.min(timelineItems.length-1,currentTimelineIndex+1))} disabled={currentTimelineIndex>=timelineItems.length-1} className="rounded-full p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg></button>
            </div>
          </div>
        )}

        <main className="py-8">
          {loading&&<div className="space-y-6"><div className="skeleton h-8 w-3/4 rounded"/><div className="skeleton h-4 w-1/2 rounded"/><div className="skeleton h-32 w-full rounded-xl"/></div>}
          {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error} <button onClick={fetchData} className="ml-3 underline hover:no-underline">Retry</button></div>}
          {!loading&&!error&&entry&&(
            <div className="space-y-6">
              {timelineItems.map((item,index)=>{
                const prevDate = index>0?timelineItems[index-1].date:null;
                const gap = timeGapLabel(prevDate,item.date);
                const isEntry = item.type==="entry";
                const ed = item.data as SiteFeedbackEntry;
                const cd = item.data as FeedbackCommentEntry;
                const itemId = isEntry?ed.id:cd.id;
                return (
                  <div key={(isEntry?"e-":"c-")+itemId}>
                    {gap&&<div className="flex items-center gap-3 my-6"><div className="flex-1 h-px bg-gray-200"/><span className="text-xs font-medium text-gray-400 flex-shrink-0">{gap}</span><div className="flex-1 h-px bg-gray-200"/></div>}
                    <div ref={el=>{contentRefs.current[index]=el;}} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                      {isEntry?(<>
                        <div className="flex items-start gap-3 mb-4">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">{getInitials(ed.display_name)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <h1 className="text-lg font-bold text-gray-900">{ed.title||"Untitled"}</h1>
                              
                              {ed.rating>0&&<span className="text-xs text-amber-500">{"★".repeat(ed.rating)}</span>}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{ed.display_name}</span>

                              {ed.user_id && <BadgeDisplay userId={ed.user_id} />}

                              {ed.affiliation&&<><span>·</span><span>{ed.affiliation}</span></>}
                              <span>·</span><span>{formatDate(ed.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words">{renderMarkdown(ed.message, (src, alt) => setLightbox({src, alt}))}</div>
                        {ed.creator_reply&&(
                          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center gap-2 mb-2"><div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-semibold text-white">S</div><span className="text-xs font-semibold text-blue-800">GalibierHub Team</span><span className="text-xs text-blue-500">· Official Response</span></div>
                            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words">{ed.creator_reply}</div>
                          </div>)}
                      </>):(<>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">{getInitials(cd.author_name)}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900">{cd.author_name}</span>
                              {cd.user_id && <BadgeDisplay userId={cd.user_id} />}
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(cd.created_at)}</span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words ml-11">{renderMarkdown(cd.message, (src, alt) => setLightbox({src, alt}))}</div>
                      </>)}
                      {/* Post-level interaction buttons */}
                      <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
                        <button onClick={()=>handleReplyTo(isEntry?ed.display_name:cd.author_name)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg> Reply
                        </button>
                        <button onClick={()=>handleLike(itemId)} disabled={likeLoading[itemId]}
                          className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors "+(likes[itemId]?"text-red-500 bg-red-50":"text-gray-400 hover:text-red-500 hover:bg-red-50")}>
                          <svg className="h-4 w-4" fill={likes[itemId]?"currentColor":"none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                          {(likeCounts[itemId]||(likes[itemId]?1:0))>0&&<span>{likeCounts[itemId]||(likes[itemId]?1:0)}</span>}
                        </button>
                        <button onClick={()=>handleShare(itemId)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        </button>

                        {isAdmin && (
                          <button onClick={()=>handleHidePost(itemId, isEntry)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors" title="Hide post">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                          </button>
                        )}
                       {isAdmin && (
                         <button onClick={()=>handleDeletePost(itemId, isEntry)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete post">
                           <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                         </button>
                        )}
                        {isAdmin && isEntry && (
                          <button onClick={()=>handlePinPost(itemId)} className={"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors "+(entry?.pinned?"text-blue-600 bg-blue-50":"text-gray-400 hover:text-blue-500 hover:bg-blue-50")} title={entry?.pinned?"Unpin":"Pin"}>
                            <svg className="h-3.5 w-3.5" fill={entry?.pinned?"currentColor":"none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                          </button>
                        )}                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Reply button at bottom */}
              <div className="flex justify-center">
                <button onClick={()=>{setReplyTarget(null);setFloatingReplyOpen(true);}} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  Post a Reply
                </button>
              </div>

              <DiscussionFooter comments={comments} entry={entry} totalViews={totalViews} onSignUp={handleSignUp} onMaybeLater={handleMaybeLater} onNoThanks={handleNoThanks} hideSignupPrompt={hideSignupPrompt}/>
            </div>
          )}
        </main>
      </div>

      {/* Floating reply composer */}
      <FloatingReply open={floatingReplyOpen} onClose={()=>setFloatingReplyOpen(false)} replyTarget={replyTarget} onSubmit={handleSubmitComment}/>

      {/* Share modal */}
      <ShareModal open={shareModalOpen} onClose={()=>setShareModalOpen(false)} entryId={shareId}/>

      {/* Image lightbox */}
      {lightbox&&(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-8" onClick={()=>setLightbox(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e=>e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.alt} className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl" />
            <p className="mt-2 text-center text-sm text-white/80">{lightbox.alt}</p>
            <button onClick={()=>setLightbox(null)} className="absolute -top-3 -right-3 rounded-full bg-white p-1.5 text-gray-600 shadow-lg hover:bg-gray-100"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
        </div>
      )}
    </div>
  );
}
