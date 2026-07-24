'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ADMIN_TOKEN_HEADER } from '@/lib/feedback-shared';
import { SiteConfig } from '@/site-config';
import type { FeedbackSummary, ReactionCounts, SiteFeedbackEntry } from '@/types/genome';

type VisibilityMode = 'public' | 'private';
type FeedbackCategory = 'general' | 'issue' | 'idea' | 'data' | 'collaboration';
type ReactionType = 'like' | 'bookmark';

interface FeedbackResponse {
  entries: SiteFeedbackEntry[];
  summary: FeedbackSummary;
  isAdmin?: boolean;
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

export default function SiteFeedback() {
  const [entries, setEntries] = useState<SiteFeedbackEntry[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({ totalComments: 0, averageRating: 0 });
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({ like: 0, bookmark: 0 });
  const [activeReactions, setActiveReactions] = useState<Record<ReactionType, boolean>>({ like: false, bookmark: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    displayName: '',
    visitorEmail: '',
    affiliation: '',
    category: 'general' as FeedbackCategory,
    rating: 5,
    visibility: 'public' as VisibilityMode,
    message: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(SiteConfig.feedback.adminTokenStorageKey) || '';
    setAdminToken(stored);
  }, []);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/feedback', {
        headers: adminToken ? { [ADMIN_TOKEN_HEADER]: adminToken } : {},
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
  }, [adminToken]);

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
  }, [fetchFeedback]);

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
    () => entries.filter((entry) => Boolean(entry.creator_reply)),
    [entries],
  );

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

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }
      setForm({
        displayName: '',
        visitorEmail: '',
        affiliation: '',
        category: 'general',
        rating: 5,
        visibility: 'public',
        message: '',
      });
      await fetchFeedback();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }, [fetchFeedback, form]);

  const handleAdminTokenSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SiteConfig.feedback.adminTokenStorageKey, adminToken.trim());
    void fetchFeedback();
  }, [adminToken, fetchFeedback]);

  const handleReply = useCallback(async (entryId: string) => {
    const draft = replyDrafts[entryId]?.trim() || '';
    if (!draft) {
      setReplyError('Reply content cannot be empty.');
      return;
    }

    setReplyingId(entryId);
    setReplyError(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          [ADMIN_TOKEN_HEADER]: adminToken,
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
  }, [adminToken, fetchFeedback, replyDrafts]);

  const renderEntry = (entry: SiteFeedbackEntry) => (
    <article key={entry.id} className="border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{entry.display_name}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${entry.visibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {entry.visibility === 'private' ? 'Creator only' : 'Public'}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {CATEGORY_LABELS[entry.category]}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {entry.affiliation || 'No affiliation provided'}
          </div>
          <div className="text-xs text-gray-500">
            Posted: {formatDateTime(entry.created_at)}
          </div>
          {isAdmin && entry.visitor_email && (
            <div className="text-xs text-gray-500">Email: {entry.visitor_email}</div>
          )}
        </div>
        <div className="text-sm font-medium text-gray-700">Rating {entry.rating}/5</div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{entry.message}</p>

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
    </article>
  );

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{SiteConfig.feedback.sectionTitle}</h2>
            <p className="mt-1 text-sm text-gray-600">{SiteConfig.feedback.sectionDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleReaction('like')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${activeReactions.like ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'}`}
            >
              Like {reactionCounts.like}
            </button>
            <button
              type="button"
              onClick={() => void handleReaction('bookmark')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${activeReactions.bookmark ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-700'}`}
            >
              Bookmark {reactionCounts.bookmark}
            </button>
          </div>
        </div>
      </div>

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
              <div className="mt-1 text-2xl font-semibold text-gray-900">{inProgressEntries.length}</div>
            </div>
            <div className="border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{completedEntries.length}</div>
            </div>
          </div>

          <div className="space-y-3 border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Creator access</h3>
              {isAdmin && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Admin mode</span>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="Enter admin reply token"
                className="min-w-0 flex-1 border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAdminTokenSave}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Save token
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Leave a message</h3>
              <div className="text-xs text-gray-500">Public or creator-only</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span>Name or nickname</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={80}
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Email</span>
                <input
                  type="email"
                  value={form.visitorEmail}
                  onChange={(event) => setForm((current) => ({ ...current, visitorEmail: event.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={160}
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation</span>
                <input
                  value={form.affiliation}
                  onChange={(event) => setForm((current) => ({ ...current, affiliation: event.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={160}
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as FeedbackCategory }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
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
                  value={form.visibility}
                  onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as VisibilityMode }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  <option value="public">Public</option>
                  <option value="private">Creator only</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Rating</span>
                <select
                  value={String(form.rating)}
                  onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))}
                  className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value}/5</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm text-gray-700">
              <span>Message</span>
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                rows={6}
                className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                minLength={10}
                maxLength={2000}
                required
              />
            </label>

            {submitError && <div className="text-sm text-red-600">{submitError}</div>}

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Public messages are shown on the site. Creator-only messages stay hidden from other visitors.
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          {error && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {replyError && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{replyError}</div>}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">In progress</h3>
              <span className="text-xs text-gray-500">Waiting for creator reply</span>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading messages...</div>
              ) : inProgressEntries.length > 0 ? (
                inProgressEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No in-progress messages.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Completed</h3>
              <span className="text-xs text-gray-500">Creator replied</span>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">Loading messages...</div>
              ) : completedEntries.length > 0 ? (
                completedEntries.map(renderEntry)
              ) : (
                <div className="border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">No completed threads yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
