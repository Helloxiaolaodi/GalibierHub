'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { SiteConfig } from '@/site-config';
import { useDiscussionThreads } from './discussion-comments';
import type { FeedbackCommentEntry, FeedbackSummary, ReactionCounts, SiteFeedbackEntry } from '@/types/genome';

type ReactionType = 'like' | 'bookmark';

interface FeedbackResponse {
  entries: SiteFeedbackEntry[];
  summary: FeedbackSummary;
  isAdmin?: boolean;
}

interface CommentsResponse {
  comments?: FeedbackCommentEntry[];
  isAdmin?: boolean;
  error?: string;
}

interface SiteFeedbackProps {
  isAdminHint?: boolean;
  accessToken?: string | null;
  creatorLogin?: string | null;
  refreshSignal?: number;
  onFeedbackSubmitted?: () => void;
}

function renderMessageWithImages(
  text: string | null | undefined,
  onImageClick?: (src: string, alt: string) => void,
) {
  if (!text) return text;
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: (string | { type: 'img'; alt: string; src: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push({ type: 'img', alt: match[1], src: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
        }
        return (
          <Image
            key={i}
            src={part.src}
            alt={part.alt}
            width={1200}
            height={900}
            unoptimized
            className={`max-w-full h-auto rounded my-2 ${onImageClick ? 'cursor-zoom-in' : ''}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onClick={onImageClick ? () => onImageClick(part.src, part.alt) : undefined}
          />
        );
      })}
    </>
  );
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function buildVisitorFingerprint() {
  if (typeof window === 'undefined') return 'server';
  const parts = [
    navigator.userAgent,
    navigator.language,
    window.screen?.width || 0,
    window.screen?.height || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  ];
  return parts.join('|');
}

const FEEDBACK_LIST_MAX_HEIGHT = 480;
const FEEDBACK_PAGE_SIZE = 5;

export default function SiteFeedback({ isAdminHint = false, accessToken = null, creatorLogin = null, refreshSignal = 0, onFeedbackSubmitted }: SiteFeedbackProps) {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({ totalThreads: 0, averageRating: 0 });
 const [, setReactionCounts] = useState<ReactionCounts>({ like: 0, bookmark: 0 });
  const [entryReactionCounts, setEntryReactionCounts] = useState<Record<string, { like: number; bookmark: number }>>({});
  const [entryActiveReactions, setEntryActiveReactions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [inProgressPage, setInProgressPage] = useState(0);
  const [completedPage, setCompletedPage] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerSuccess, setComposerSuccess] = useState<string | null>(null);
  const [composerForm, setComposerForm] = useState({
    title: '',
    displayName: '',
    visitorEmail: '',
    affiliation: '',
    category: 'general',
    rating: 5,
    visibility: 'public',
    message: '',
  });
  const [composerErrors, setComposerErrors] = useState<Record<string, string>>({});
 const [pinToggling, setPinToggling] = useState<string | null>(null);
 const [hideToggling, setHideToggling] = useState<string | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [commentHideToggling, setCommentHideToggling] = useState<string | null>(null);
 const [commentDeletingId, setCommentDeletingId] = useState<string | null>(null);
 const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});
  const [inProgressSort, setInProgressSort] = useState<'newest' | 'oldest' | 'most_liked'>('newest');
  const [completedSort, setCompletedSort] = useState<'newest' | 'oldest' | 'most_liked'>('newest');
const [uploadingImage, setUploadingImage] = useState(false);
  const [replyUploadingImage, setReplyUploadingImage] = useState<Record<string, boolean>>({});
  const [lightBox, setLightBox] = useState<{ src: string; alt: string } | null>(null);
  const [composerUploadMessage, setComposerUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [replyUploadMessage, setReplyUploadMessage] = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({});

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data.url || null;
    } catch {
      return null;
    }
  }, []);
  const {
    entryThreads,
    setEntryComments,
    commentDrafts,
    setCommentDrafts,
    commentSubmitting,
    commentError,
    commentSuccess,
    handleSubmitComment,
  } = useDiscussionThreads(accessToken);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/feedback', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = (await response.json()) as FeedbackResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load community feedback.');
      }
      setEntries(data.entries || []);
      setSummary(data.summary || { totalThreads: 0, averageRating: 0 });
      setIsAdmin(Boolean(data.isAdmin) || isAdminHint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community feedback.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAdminHint]);

  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch('/api/reactions');
      const data = (await response.json()) as { counts?: ReactionCounts; entries?: Record<string, { like: number; bookmark: number }>; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load reactions.');
      }
      setReactionCounts(data.counts || { like: 0, bookmark: 0 });
      setEntryReactionCounts(data.entries || {});
    } catch {
    }
  }, []);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback, refreshSignal]);

  useEffect(() => {
    void fetchReactions();
  }, [fetchReactions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved: Record<string, Record<string, boolean>> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('seqedge-reaction-like-')) {
        const entryId = key.replace('seqedge-reaction-like-', '');
        saved[entryId] = {
          like: window.localStorage.getItem(`seqedge-reaction-like-${entryId}`) === '1',
          bookmark: window.localStorage.getItem(`seqedge-reaction-bookmark-${entryId}`) === '1',
        };
      }
    }
    setEntryActiveReactions(saved);
  }, []);

 const inProgressEntries = useMemo(
    () => {
      const all = entries.filter((entry) => !entry.creator_reply && (isAdmin || !entry.hidden));
      const pinned = all.filter((entry) => entry.pinned);
      const unpinned = all.filter((entry) => !entry.pinned);
      if (inProgressSort === 'oldest') {
        return [...pinned, ...[...unpinned].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())];
      }
      if (inProgressSort === 'most_liked') {
        return [...pinned, ...[...unpinned].sort((a, b) => (entryReactionCounts[b.id]?.like || 0) - (entryReactionCounts[a.id]?.like || 0))];
      }
      return [...pinned, ...unpinned];
    },
    [entries, inProgressSort, entryReactionCounts, isAdmin],
  );

 const completedEntries = useMemo(
   () => {
     const all = entries.filter((entry) => Boolean(entry.creator_reply) && (isAdmin || !entry.hidden));
     const pinned = all.filter((entry) => entry.pinned);
     const unpinned = all.filter((entry) => !entry.pinned);
      const sorted = completedSort === 'oldest'
        ? [...unpinned].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        : completedSort === 'most_liked'
          ? [...unpinned].sort((a, b) => (entryReactionCounts[b.id]?.like || 0) - (entryReactionCounts[a.id]?.like || 0))
          : unpinned;
      return [...pinned, ...sorted];
   },
    [entries, completedSort, entryReactionCounts, isAdmin],
 );

  const inProgressTotal = inProgressEntries.length;
  const inProgressMaxPage = Math.max(0, Math.ceil(inProgressTotal / FEEDBACK_PAGE_SIZE) - 1);
  const inProgressPageEntries = useMemo(
    () => inProgressEntries.slice(inProgressPage * FEEDBACK_PAGE_SIZE, (inProgressPage + 1) * FEEDBACK_PAGE_SIZE),
    [inProgressEntries, inProgressPage],
  );

  const completedTotal = completedEntries.length;
  const completedMaxPage = Math.max(0, Math.ceil(completedTotal / FEEDBACK_PAGE_SIZE) - 1);
  const completedPageEntries = useMemo(
    () => completedEntries.slice(completedPage * FEEDBACK_PAGE_SIZE, (completedPage + 1) * FEEDBACK_PAGE_SIZE),
    [completedEntries, completedPage],
  );

  useEffect(() => {
    setInProgressPage(0);
    setCompletedPage(0);
  }, [refreshSignal]);

  const handleReaction = useCallback(async (reactionType: ReactionType, entryId: string) => {
    const fingerprint = buildVisitorFingerprint();
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, fingerprint, entryId }),
      });
      const data = (await response.json()) as { active?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update reaction.');
      }

      setEntryActiveReactions((current) => ({
        ...current,
        [entryId]: { ...current[entryId], [reactionType]: Boolean(data.active) },
      }));

      setEntryReactionCounts((current) => ({
        ...current,
        [entryId]: {
          ...current[entryId] || { like: 0, bookmark: 0 },
          [reactionType]: Math.max(0, (current[entryId]?.[reactionType] || 0) + (data.active ? 1 : -1)),
        },
      }));

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`seqedge-reaction-${reactionType}-${entryId}`, data.active ? '1' : '0');
      }

     setReactionCounts((current) => ({
       ...current,
       [reactionType]: Math.max(0, current[reactionType] + (data.active ? 1 : -1)),
     }));
    } catch (err) {
      console.error('Reaction failed:', err);
   }
 }, []);

  const fetchThreadComments = useCallback(async (entryId: string) => {
    try {
      const response = await fetch(`/api/feedback?feedback_id=${encodeURIComponent(entryId)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = await response.json() as CommentsResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load comments.');
      }
      setEntryComments((current) => ({ ...current, [entryId]: data.comments || [] }));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to load comments.');
    }
  }, [accessToken, setEntryComments]);

  const handleReply = useCallback(async (entryId: string) => {
    const draft = replyDrafts[entryId]?.trim() || '';
    if (!draft) {
      setReplyError('Reply cannot be empty.');
      return;
    }

    setReplyingId(entryId);
    setReplyError(null);
    try {
     if (!accessToken) {
        throw new Error('Sign in with GitHub to reply.');
     }
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: entryId, creatorReply: draft }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Reply failed.');
      }
      setReplyDrafts((current) => ({ ...current, [entryId]: '' }));
      await fetchFeedback();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Reply failed.');
    } finally {
      setReplyingId(null);
    }
  }, [accessToken, fetchFeedback, replyDrafts]);


  const handleToggleHidden = async (entryId: string, currentHidden: boolean) => {
    if (!accessToken) return;
    setHideToggling(entryId);
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: entryId, hidden: !currentHidden }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Visibility update failed.');
      }
      await fetchFeedback();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Visibility update failed.');
    }
  finally { setHideToggling(null); }
  };

  const handleDelete = async (entryId: string) => {
    if (!accessToken) return;
    if (!window.confirm('Delete this discussion permanently?')) return;
    setDeletingId(entryId);
    try {
      const response = await fetch(`/api/feedback?id=${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Delete failed.');
      await fetchFeedback();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Delete failed.');
    }
    finally { setDeletingId(null); }
  };

  const handleToggleCommentHidden = async (entryId: string, commentId: string, currentHidden: boolean) => {
    if (!accessToken) return;
    setCommentHideToggling(commentId);
    setReplyError(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ commentId, commentHidden: !currentHidden }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Comment visibility update failed.');
      }
      await fetchThreadComments(entryId);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Comment visibility update failed.');
    } finally {
      setCommentHideToggling(null);
    }
  };

  const handleDeleteComment = async (entryId: string, commentId: string) => {
    if (!accessToken) return;
    if (!window.confirm('Delete this reply permanently?')) return;
    setCommentDeletingId(commentId);
    setReplyError(null);
    try {
      const response = await fetch(`/api/feedback?comment_id=${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Comment delete failed.');
      }
      await fetchThreadComments(entryId);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Comment delete failed.');
    } finally {
      setCommentDeletingId(null);
    }
  };

  const renderEntry = (entry: SiteFeedbackEntry) => {
    const isExpanded = Boolean(expandedEntries[entry.id]);
    const comments = entryThreads[entry.id] || [];
    return (
    <article key={entry.id} className="border border-gray-200 bg-white p-4">
      {/* HEADER BUTTON - wraps only the clickable header */}
      <button type="button" onClick={() => { setExpandedEntries((c) => ({ ...c, [entry.id]: !c[entry.id] })); void fetchThreadComments(entry.id); }} className="w-full text-left focus:outline-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{entry.title || 'Untitled discussion'}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${entry.visibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {entry.visibility === 'private' ? 'Administrator only' : 'Public'}
            </span>
            {entry.hidden && isAdmin && (
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                Hidden
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600">{entry.display_name}</div>
          <div className="text-xs text-gray-500">
            {formatDateTime(entry.created_at)}
          </div>
          {isAdmin && entry.visitor_email && (
            <div className="text-xs text-gray-500">Email: {entry.visitor_email}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleTogglePin(entry.id, Boolean(entry.pinned)); }}
                disabled={pinToggling === entry.id}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  entry.pinned
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                title={entry.pinned ? 'Unpin' : 'Pin (max 3)'}
              >
                <svg className="h-3 w-3" fill={entry.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {pinToggling === entry.id ? '...' : entry.pinned ? 'Pinned' : 'Pin'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleToggleHidden(entry.id, Boolean(entry.hidden)); }}
                disabled={hideToggling === entry.id}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  entry.hidden
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
                title={entry.hidden ? 'Unhide entry' : 'Hide entry'}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {entry.hidden ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {hideToggling === entry.id ? '...' : entry.hidden ? 'Hidden' : 'Hide'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleDelete(entry.id); }}
                disabled={deletingId === entry.id}
                className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                title="Delete permanently"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deletingId === entry.id ? '...' : 'Delete'}
              </button>
            </div>
          )}
          {/* Expand/collapse chevron */}
          <div className="shrink-0">
          {!isExpanded && (entryReactionCounts[entry.id]?.like || 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700" title={`${entryReactionCounts[entry.id]?.like || 0} likes`}>
              <svg className="h-3 w-3" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              {entryReactionCounts[entry.id]?.like || 0}
            </span>
          )}
            {isExpanded ? (
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
      </button>

      {/* EXPANDED CONTENT - outside the header button */}
      {isExpanded && (
        <>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{renderMessageWithImages(entry.message, (src) => setLightBox({ src, alt: entry.title || 'Image' }))}</p>

          {entry.creator_reply ? (
            <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3">
              <div className="text-sm font-semibold text-blue-900">Administrator response</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-blue-900">{renderMessageWithImages(entry.creator_reply, (src) => setLightBox({ src, alt: 'Reply image' }))}</div>
              <div className="mt-2 text-xs text-blue-700">{formatDateTime(entry.replied_at)}</div>
           </div>
         ) : isAdmin ? (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <textarea
                value={replyDrafts[entry.id] || ''}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                rows={3}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                placeholder="Reply to close this discussion."
              />
              <button
                type="button"
                onClick={() => void handleReply(entry.id)}
                disabled={replyingId === entry.id}
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {replyingId === entry.id ? 'Saving...' : 'Reply and close'}
              </button>
            </div>
         ) : null}

          {/* Like/Bookmark buttons - visible to all */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void handleReaction('like', entry.id); }}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${entryActiveReactions[entry.id]?.like ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'}`}
            >
              <svg className="h-3.5 w-3.5" fill={entryActiveReactions[entry.id]?.like ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
             Like {entryReactionCounts[entry.id]?.like || 0}
           </button>
         </div>

         {/* Thread comments */}
         <div className="mt-4 border-t border-gray-100 pt-4">
            <textarea
              value={commentDrafts[entry.id] || ''}
              onChange={(e) => setCommentDrafts((c) => ({ ...c, [entry.id]: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              placeholder="Add comment"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Attach image
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple className="hidden" onChange={async (e) => { const files = e.target.files; if (files && files.length > 0) { setReplyUploadingImage((c) => ({ ...c, [entry.id]: true })); setReplyUploadMessage((c) => ({ ...c, [entry.id]: null })); let uploaded = 0; for (let i = 0; i < files.length; i++) { const url = await handleImageUpload(files[i]); if (url) { setCommentDrafts((c) => ({ ...c, [entry.id]: (c[entry.id] || '') + ((c[entry.id] || '') ? '\n' : '') + '![image](' + url + ')' })); uploaded++; } } setReplyUploadingImage((c) => ({ ...c, [entry.id]: false })); setReplyUploadMessage((c) => ({ ...c, [entry.id]: uploaded > 0 ? { type: 'success', text: 'Image uploaded.' } : { type: 'error', text: 'Image upload failed.' } })); e.target.value = ''; } }} />
              </label>
              {replyUploadingImage[entry.id] && <span className="text-xs text-gray-500">Uploading...</span>}
              {replyUploadMessage[entry.id] && (
                <span className={`text-xs ${replyUploadMessage[entry.id]!.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {replyUploadMessage[entry.id]!.text}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleSubmitComment(entry.id); }}
               disabled={commentSubmitting[entry.id]}
                className="ml-auto rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
             >
                {commentSubmitting[entry.id] ? 'Sending...' : 'Send'}
             </button>
           </div>
           {commentError[entry.id] && <div className="mt-1 text-xs text-red-600">{commentError[entry.id]}</div>}
          {commentSuccess[entry.id] && <div className="mt-1 text-xs text-emerald-700">{commentSuccess[entry.id]}</div>}

          {/* Thread comments */}
            {comments.length > 0 && (
              <div className="mt-3 space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className={`pl-3 border-l-2 ${c.hidden ? 'border-red-200 bg-red-50/50' : 'border-gray-200'}`}>
                    <div className="text-xs font-medium text-gray-700">{c.author_name}</div>
                    {isAdmin && c.hidden && <div className="mt-0.5 text-[11px] font-medium text-red-600">Hidden reply</div>}
                    <div className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{renderMessageWithImages(c.message, (src) => setLightBox({ src, alt: 'Comment image' }))}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(c.created_at)}</div>
                    {isAdmin && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleCommentHidden(entry.id, c.id, Boolean(c.hidden))}
                          disabled={commentHideToggling === c.id}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium ${c.hidden ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'} disabled:opacity-40`}
                        >
                          {commentHideToggling === c.id ? '...' : c.hidden ? 'Show reply' : 'Hide reply'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteComment(entry.id, c.id)}
                          disabled={commentDeletingId === c.id}
                          className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          {commentDeletingId === c.id ? '...' : 'Delete reply'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
         </div>
        </>
      )}
    </article>
  );

  };

  const handleComposerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setComposerSubmitting(true);
    setComposerError(null);
    setComposerSuccess(null);

    const errors: Record<string, string> = {};
    if (!composerForm.title.trim()) {
      errors.title = 'Required.';
    } else if (composerForm.title.trim().length < 3) {
      errors.title = 'Use at least 3 characters.';
    } else if (composerForm.title.trim().length > 120) {
      errors.title = 'Use 120 characters or fewer.';
    }
    if (!composerForm.displayName.trim()) {
      errors.displayName = 'Required.';
    } else if (composerForm.displayName.trim().length > 80) {
      errors.displayName = 'Use 80 characters or fewer.';
    }
    if (composerForm.visitorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composerForm.visitorEmail.trim())) {
      errors.visitorEmail = 'Enter a valid email address.';
    } else if (composerForm.visitorEmail.trim().length > 160) {
      errors.visitorEmail = 'Use 160 characters or fewer.';
    }
    if (!composerForm.message.trim()) {
      errors.message = 'Required.';
    } else if (composerForm.message.trim().length < 3) {
      errors.message = 'Use at least 3 characters.';
    } else if (composerForm.message.trim().length > 2000) {
      errors.message = 'Use 2,000 characters or fewer.';
    }

    if (Object.keys(errors).length > 0) {
      setComposerErrors(errors);
      setComposerSubmitting(false);
      return;
    }
    setComposerErrors({});

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composerForm),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }
      setComposerForm({
        title: '',
        displayName: '',
        visitorEmail: '',
        affiliation: '',
        category: 'general',
        rating: 5,
        visibility: 'public',
        message: '',
      });
      setComposerUploadMessage(null);
      setComposerSuccess('Feedback submitted.');
      setShowComposer(false);
      onFeedbackSubmitted?.();
      await fetchFeedback();
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setComposerSubmitting(false);
    }
  };

  const handleTogglePin = async (entryId: string, currentPinned: boolean) => {
    if (!accessToken) return;
    setPinToggling(entryId);
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: entryId, pinned: !currentPinned }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Pin update failed.');
      }
      await fetchFeedback();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Pin update failed.');
    }
    finally { setPinToggling(null); }
  };

  return (
    <>
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b bg-gray-50 px-4 py-3">
       <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{SiteConfig.feedback.sectionTitle}</h2>
              <p className="mt-1 text-sm text-gray-600">{SiteConfig.feedback.sectionDescription}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowComposer((v) => !v); setComposerSuccess(null); setComposerError(null); setComposerUploadMessage(null); }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  showComposer
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {showComposer ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </>
                ) : (
                  'Leave Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {composerSuccess && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {composerSuccess}
        </div>
      )}

      {showComposer && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4">
          <form onSubmit={handleComposerSubmit} className="max-w-2xl space-y-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span>Title (required)</span>
                <input
                  value={composerForm.title}
                  onChange={(e) => setComposerForm((c) => ({ ...c, title: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                />
                {composerErrors.title && <span className="text-xs text-red-600">{composerErrors.title}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Name or nickname (required)</span>
                <input
                  value={composerForm.displayName}
                  onChange={(e) => setComposerForm((c) => ({ ...c, displayName: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                />
                {composerErrors.displayName && <span className="text-xs text-red-600">{composerErrors.displayName}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Email (optional)</span>
                <input
                  value={composerForm.visitorEmail}
                  onChange={(e) => setComposerForm((c) => ({ ...c, visitorEmail: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                />
                {composerErrors.visitorEmail && <span className="text-xs text-red-600">{composerErrors.visitorEmail}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation (optional)</span>
                <input
                  value={composerForm.affiliation}
                  onChange={(e) => setComposerForm((c) => ({ ...c, affiliation: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Visibility</span>
              <select
                value={composerForm.visibility}
                onChange={(e) => setComposerForm((c) => ({ ...c, visibility: e.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              >
                <option value="public">Public</option>
                <option value="private">Administrator only</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm text-gray-700">
              <span>Message (required)</span>
             <textarea
               value={composerForm.message}
               onChange={(e) => setComposerForm((c) => ({ ...c, message: e.target.value }))}
               rows={4}
               className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
             />
              <div className="mt-2 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Attach image
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple className="hidden" onChange={async (e) => { const files = e.target.files; if (files && files.length > 0) { setUploadingImage(true); setComposerUploadMessage(null); let uploaded = 0; for (let i = 0; i < files.length; i++) { const url = await handleImageUpload(files[i]); if (url) { setComposerForm((c) => ({ ...c, message: c.message + (c.message ? '\n' : '') + '![image](' + url + ')' })); uploaded++; } } setUploadingImage(false); setComposerUploadMessage(uploaded > 0 ? { type: 'success', text: 'Image uploaded.' } : { type: 'error', text: 'Image upload failed.' }); e.target.value = ''; } }} />
                </label>
                {uploadingImage && <span className="text-xs text-gray-500">Uploading...</span>}
                {composerUploadMessage && (
                  <span className={`text-xs ${composerUploadMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {composerUploadMessage.text}
                  </span>
                )}
              </div>
             {composerErrors.message && <span className="text-xs text-red-600">{composerErrors.message}</span>}
            </label>
            {composerError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{composerError}</div>}
            {composerSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{composerSuccess}</div>}
            <button
              type="submit"
              disabled={composerSubmitting}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {composerSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 px-4 py-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
           <div className="border border-gray-200 bg-gray-50 p-4">
             <div className="text-xs uppercase tracking-wide text-gray-500">Discussions</div>
             <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.totalThreads}</div>
           </div>
           <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">In Progress</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{inProgressTotal}</div>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{completedTotal}</div>
            </div>
          </div>
         <div className="border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Browse discussions and add feedback.
         </div>
        </div>

        <div className="space-y-6">
          {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {replyError && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{replyError}</div>}
          {isAdmin && (
            <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Administrator access enabled{creatorLogin ? ` for @${creatorLogin}` : ''}.
            </div>
          )}
         <section className="space-y-3">
           <div className="flex items-center justify-between gap-3">
             <h3 className="text-sm font-semibold text-gray-900">In Progress</h3>
              <select
                value={inProgressSort}
                onChange={(e) => setInProgressSort(e.target.value as 'newest' | 'oldest' | 'most_liked')}
                className="border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most_liked">Most liked</option>
              </select>
             <span className="text-xs text-gray-500">
                {inProgressTotal > 0
                  ? `Page ${inProgressPage + 1} of ${Math.max(1, inProgressMaxPage + 1)} (${inProgressTotal} total)`
                  : 'Awaiting administrator reply'}
              </span>
            </div>
            <div className="space-y-3" style={{ maxHeight: `${FEEDBACK_LIST_MAX_HEIGHT}px`, overflowY: 'auto' }}>
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading discussions...</div>
              ) : inProgressPageEntries.length > 0 ? (
                inProgressPageEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No active discussions.</div>
              )}
            </div>
            {inProgressTotal > FEEDBACK_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setInProgressPage((p) => Math.max(0, p - 1))}
                  disabled={inProgressPage <= 0}
                  className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">{inProgressPage + 1} / {Math.max(1, inProgressMaxPage + 1)}</span>
                <button
                  type="button"
                  onClick={() => setInProgressPage((p) => Math.min(inProgressMaxPage, p + 1))}
                  disabled={inProgressPage >= inProgressMaxPage}
                  className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>

         <section className="space-y-3">
           <div className="flex items-center justify-between gap-3">
             <h3 className="text-sm font-semibold text-gray-900">Completed</h3>
              <select
                value={completedSort}
                onChange={(e) => setCompletedSort(e.target.value as 'newest' | 'oldest' | 'most_liked')}
                className="border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most_liked">Most liked</option>
              </select>
             <span className="text-xs text-gray-500">
                {completedTotal > 0
                  ? `Page ${completedPage + 1} of ${Math.max(1, completedMaxPage + 1)} (${completedTotal} total)`
                  : 'Completed discussions'}
              </span>
            </div>
            <div className="space-y-3" style={{ maxHeight: `${FEEDBACK_LIST_MAX_HEIGHT}px`, overflowY: 'auto' }}>
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading discussions...</div>
              ) : completedPageEntries.length > 0 ? (
                completedPageEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No completed discussions.</div>
              )}
            </div>
            {completedTotal > FEEDBACK_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCompletedPage((p) => Math.max(0, p - 1))}
                  disabled={completedPage <= 0}
                  className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">{completedPage + 1} / {Math.max(1, completedMaxPage + 1)}</span>
                <button
                  type="button"
                  onClick={() => setCompletedPage((p) => Math.min(completedMaxPage, p + 1))}
                  disabled={completedPage >= completedMaxPage}
                  className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
      {lightBox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightBox(null)}
        >
          <button
            type="button"
            aria-label="Close image"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/40"
            onClick={(e) => { e.stopPropagation(); setLightBox(null); }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <Image
            src={lightBox.src}
            alt={lightBox.alt}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            decoding="async"
            referrerPolicy="no-referrer"
            onClick={(e: ReactMouseEvent<HTMLImageElement>) => e.stopPropagation()}
          />
       </div>
     )}
    </>
  );
}
