'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SiteConfig } from '@/site-config';
import type { FeedbackSummary, ReactionCounts, SiteFeedbackEntry } from '@/types/genome';

type FeedbackCategory = 'general' | 'issue' | 'idea' | 'data' | 'collaboration';
type ReactionType = 'like' | 'bookmark';

interface FeedbackResponse {
  entries: SiteFeedbackEntry[];
  summary: FeedbackSummary;
  isAdmin?: boolean;
}

interface SiteFeedbackProps {
  accessToken?: string | null;
  creatorLogin?: string | null;
  refreshSignal?: number;
  onFeedbackSubmitted?: () => void;
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: 'General',
  issue: 'Issue',
  idea: 'Idea',
  data: 'Data',
  collaboration: 'Collaboration',
};

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

export default function SiteFeedback({ accessToken = null, creatorLogin = null, refreshSignal = 0, onFeedbackSubmitted }: SiteFeedbackProps) {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({ totalComments: 0, averageRating: 0 });
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({ like: 0, bookmark: 0 });
  const [activeReactions, setActiveReactions] = useState<Record<ReactionType, boolean>>({ like: false, bookmark: false });
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
      setSummary(data.summary || { totalComments: 0, averageRating: 0 });
      setIsAdmin(Boolean(data.isAdmin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community feedback.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchReactions = useCallback(async () => {
    try {
      const response = await fetch('/api/reactions');
      const data = (await response.json()) as { counts?: ReactionCounts; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load reactions.');
      }
      setReactionCounts(data.counts || { like: 0, bookmark: 0 });
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
    const like = window.localStorage.getItem('seqedge-reaction-like') === '1';
    const bookmark = window.localStorage.getItem('seqedge-reaction-bookmark') === '1';
    setActiveReactions({ like, bookmark });
  }, []);

  const inProgressEntries = useMemo(
    () => entries.filter((entry) => !entry.creator_reply),
    [entries],
  );

  const completedEntries = useMemo(
    () => {
      const all = entries.filter((entry) => Boolean(entry.creator_reply) && !entry.hidden);
      const pinned = all.filter((entry) => entry.pinned);
      const unpinned = all.filter((entry) => !entry.pinned);
      return [...pinned, ...unpinned];
    },
    [entries],
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

  const handleReaction = useCallback(async (reactionType: ReactionType) => {
    const fingerprint = buildVisitorFingerprint();
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, fingerprint }),
      });
      const data = (await response.json()) as { active?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update reaction.');
      }
      setActiveReactions((current) => {
        const next = { ...current, [reactionType]: Boolean(data.active) };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`seqedge-reaction-${reactionType}`, data.active ? '1' : '0');
        }
        return next;
      });
      setReactionCounts((current) => ({
        ...current,
        [reactionType]: Math.max(0, current[reactionType] + (data.active ? 1 : -1)),
      }));
    } catch {
    }
  }, []);

  const handleReply = useCallback(async (entryId: string) => {
    const draft = replyDrafts[entryId]?.trim() || '';
    if (!draft) {
      setReplyError('Reply content cannot be empty.');
      return;
    }

    setReplyingId(entryId);
    setReplyError(null);
    try {
      if (!accessToken) {
        throw new Error('Sign in with the creator GitHub account to reply.');
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
        throw new Error(data.error || 'Failed to send reply.');
      }
      setReplyDrafts((current) => ({ ...current, [entryId]: '' }));
      await fetchFeedback();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send reply.');
    } finally {
      setReplyingId(null);
    }
  }, [accessToken, fetchFeedback, replyDrafts]);

  const renderEntry = (entry: SiteFeedbackEntry) => (
    <article key={entry.id} className="border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{entry.title || 'Untitled message'}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${entry.visibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {entry.visibility === 'private' ? 'Creator only' : 'Public'}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {CATEGORY_LABELS[entry.category]}
            </span>
          </div>
          <div className="text-xs text-gray-600">By {entry.display_name}</div>
          <div className="text-xs text-gray-500">
            Posted: {formatDateTime(entry.created_at)}
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
                onClick={() => handleTogglePin(entry.id, Boolean(entry.pinned))}
                disabled={pinToggling === entry.id}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  entry.pinned
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                }`}
                title={entry.pinned ? 'Unpin from top' : 'Pin to top (max 3)'}
              >
                <svg className="h-3 w-3" fill={entry.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {pinToggling === entry.id ? '...' : entry.pinned ? 'Pinned' : 'Pin'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleHidden(entry.id, Boolean(entry.hidden))}
                disabled={hideToggling === entry.id}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  entry.hidden
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                }`}
                title={entry.hidden ? 'Show entry' : 'Hide entry'}
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
            </div>
          )}
          <div className="text-sm font-medium text-gray-700">Rating {entry.rating}/5</div>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{entry.message}</p>

      {entry.creator_reply ? (
        <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-4 py-3">
          <div className="text-sm font-semibold text-blue-900">Creator reply</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-blue-900">{entry.creator_reply}</div>
          <div className="mt-2 text-xs text-blue-700">Replied: {formatDateTime(entry.replied_at)}</div>
        </div>
      ) : isAdmin ? (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          <textarea
            value={replyDrafts[entry.id] || ''}
            onChange={(event) => setReplyDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
            rows={4}
            className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            placeholder="Write a reply that will be shown here and emailed to the visitor."
          />
          <button
            type="button"
            onClick={() => void handleReply(entry.id)}
            disabled={replyingId === entry.id}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {replyingId === entry.id ? 'Sending reply...' : 'Send reply'}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); void handleReaction('like'); }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${activeReactions.like ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'}`}
        >
          <svg className="h-3.5 w-3.5" fill={activeReactions.like ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          Like {reactionCounts.like}
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); void handleReaction('bookmark'); }}
          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${activeReactions.bookmark ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-600'}`}
        >
          <svg className="h-3.5 w-3.5" fill={activeReactions.bookmark ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Bookmark {reactionCounts.bookmark}
        </button>
      </div>
    </article>
  );

  const handleComposerSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setComposerSubmitting(true);
    setComposerError(null);
    setComposerSuccess(null);

    const errors: Record<string, string> = {};
    if (!composerForm.title.trim()) {
      errors.title = 'This field is required';
    } else if (composerForm.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (composerForm.title.trim().length > 120) {
      errors.title = 'Title must be 120 characters or less';
    }
    if (!composerForm.displayName.trim()) {
      errors.displayName = 'This field is required';
    } else if (composerForm.displayName.trim().length > 80) {
      errors.displayName = 'Name must be 80 characters or less';
    }
    if (composerForm.visitorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(composerForm.visitorEmail.trim())) {
      errors.visitorEmail = 'Please enter a valid email address';
    } else if (composerForm.visitorEmail.trim().length > 160) {
      errors.visitorEmail = 'Email must be 160 characters or less';
    }
    if (!composerForm.message.trim()) {
      errors.message = 'This field is required';
    } else if (composerForm.message.trim().length < 3) {
      errors.message = 'Message must be at least 3 characters';
    } else if (composerForm.message.trim().length > 2000) {
      errors.message = 'Message must be 2000 characters or less';
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
      setComposerSuccess('Message submitted successfully.');
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
      await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: entryId, pinned: !currentPinned }),
      });
      await fetchFeedback();
    } catch { /* ignore */ }
    finally { setPinToggling(null); }
  };

  const handleToggleHidden = async (entryId: string, currentHidden: boolean) => {
    if (!accessToken) return;
    setHideToggling(entryId);
    try {
      await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: entryId, hidden: !currentHidden }),
      });
      await fetchFeedback();
    } catch { /* ignore */ }
    finally { setHideToggling(null); }
  };

  return (
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
                onClick={() => { setShowComposer((v) => !v); setComposerSuccess(null); setComposerError(null); }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  showComposer
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
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
                  minLength={3}
                  maxLength={120}
                />
                {composerErrors.title && <span className="text-xs text-red-600">{composerErrors.title}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Name or nickname (required)</span>
                <input
                  value={composerForm.displayName}
                  onChange={(e) => setComposerForm((c) => ({ ...c, displayName: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={80}
                />
                {composerErrors.displayName && <span className="text-xs text-red-600">{composerErrors.displayName}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Email (optional)</span>
                <input
                  type="email"
                  value={composerForm.visitorEmail}
                  onChange={(e) => setComposerForm((c) => ({ ...c, visitorEmail: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={160}
                />
                {composerErrors.visitorEmail && <span className="text-xs text-red-600">{composerErrors.visitorEmail}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation (optional)</span>
                <input
                  value={composerForm.affiliation}
                  onChange={(e) => setComposerForm((c) => ({ ...c, affiliation: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={160}
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Category</span>
                <select
                  value={composerForm.category}
                  onChange={(e) => setComposerForm((c) => ({ ...c, category: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span>Visibility</span>
                <select
                  value={composerForm.visibility}
                  onChange={(e) => setComposerForm((c) => ({ ...c, visibility: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Creator only</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Rating</span>
                <select
                  value={String(composerForm.rating)}
                  onChange={(e) => setComposerForm((c) => ({ ...c, rating: Number(e.target.value) }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  {[5, 4, 3, 2, 1].map((v) => (
                    <option key={v} value={v}>{v}/5</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm text-gray-700">
              <span>Message (required)</span>
              <textarea
                value={composerForm.message}
                onChange={(e) => setComposerForm((c) => ({ ...c, message: e.target.value }))}
                rows={4}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                minLength={3}
                maxLength={2000}
              />
              {composerErrors.message && <span className="text-xs text-red-600">{composerErrors.message}</span>}
            </label>
            {composerError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{composerError}</div>}
            {composerSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{composerSuccess}</div>}
            <button
              type="submit"
              disabled={composerSubmitting}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {composerSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 px-4 py-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Comments</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.totalComments}</div>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Average rating</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{summary.averageRating.toFixed(1)}</div>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">In progress</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{inProgressTotal}</div>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{completedTotal}</div>
            </div>
          </div>
          <div className="border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Review public threads, creator-only progress, timestamps, and reply status here. Use the Leave Feedback button above to submit a new message.
          </div>
        </div>

        <div className="space-y-6">
          {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {replyError && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{replyError}</div>}
          {isAdmin && (
            <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Creator reply access is active{creatorLogin ? ` for @${creatorLogin}` : ''}.
            </div>
          )}
          {accessToken && !isAdmin && !loading && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This signed-in GitHub account does not have creator reply access.
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">In progress</h3>
              <span className="text-xs text-gray-500">
                {inProgressTotal > 0
                  ? `Page ${inProgressPage + 1} of ${Math.max(1, inProgressMaxPage + 1)} (${inProgressTotal} total)`
                  : 'Waiting for creator reply'}
              </span>
            </div>
            <div className="space-y-3" style={{ maxHeight: `${FEEDBACK_LIST_MAX_HEIGHT}px`, overflowY: 'auto' }}>
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading messages...</div>
              ) : inProgressPageEntries.length > 0 ? (
                inProgressPageEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No in-progress messages.</div>
              )}
            </div>
            {inProgressTotal > FEEDBACK_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setInProgressPage((p) => Math.max(0, p - 1))}
                  disabled={inProgressPage <= 0}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">{inProgressPage + 1} / {Math.max(1, inProgressMaxPage + 1)}</span>
                <button
                  type="button"
                  onClick={() => setInProgressPage((p) => Math.min(inProgressMaxPage, p + 1))}
                  disabled={inProgressPage >= inProgressMaxPage}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Completed</h3>
              <span className="text-xs text-gray-500">
                {completedTotal > 0
                  ? `Page ${completedPage + 1} of ${Math.max(1, completedMaxPage + 1)} (${completedTotal} total)`
                  : 'Creator replied'}
              </span>
            </div>
            <div className="space-y-3" style={{ maxHeight: `${FEEDBACK_LIST_MAX_HEIGHT}px`, overflowY: 'auto' }}>
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading messages...</div>
              ) : completedPageEntries.length > 0 ? (
                completedPageEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No completed threads yet.</div>
              )}
            </div>
            {completedTotal > FEEDBACK_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCompletedPage((p) => Math.max(0, p - 1))}
                  disabled={completedPage <= 0}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">{completedPage + 1} / {Math.max(1, completedMaxPage + 1)}</span>
                <button
                  type="button"
                  onClick={() => setCompletedPage((p) => Math.min(completedMaxPage, p + 1))}
                  disabled={completedPage >= completedMaxPage}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
