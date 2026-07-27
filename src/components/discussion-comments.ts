'use client';

import { useCallback, useState } from 'react';
import type { FeedbackCommentEntry } from '@/types/genome';

type CommentEntry = FeedbackCommentEntry;

export function useDiscussionComments(accessToken?: string | null) {
  const [entryComments, setEntryComments] = useState<Record<string, CommentEntry[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});
  const [commentError, setCommentError] = useState<Record<string, string | null>>({});
  const [commentSuccess, setCommentSuccess] = useState<Record<string, string | null>>({});

  const fetchEntryComments = useCallback(async (entryId: string) => {
    try {
      const response = await fetch(`/api/feedback?feedback_id=${encodeURIComponent(entryId)}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = await response.json() as { comments?: CommentEntry[]; error?: string };
      if (!response.ok) return;
      setEntryComments((c) => ({ ...c, [entryId]: data.comments || [] }));
    } catch { /* ignore */ }
  }, [accessToken]);

  const handleSubmitComment = useCallback(async (entryId: string) => {
    const draft = (commentDrafts[entryId] || '').trim();
    if (!draft || draft.length < 1) return;
    setCommentSubmitting((s) => ({ ...s, [entryId]: true }));
    setCommentError((e) => ({ ...e, [entryId]: null }));
    setCommentSuccess((e) => ({ ...e, [entryId]: null }));
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: entryId,
          message: draft,
          authorName: 'Visitor',
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Failed to post comment.');
      setCommentDrafts((c) => ({ ...c, [entryId]: '' }));
      setCommentSuccess((e) => ({ ...e, [entryId]: 'Comment posted.' }));
      await fetchEntryComments(entryId);
    } catch (err) {
      setCommentError((e) => ({ ...e, [entryId]: err instanceof Error ? err.message : 'Failed to post comment.' }));
    } finally {
      setCommentSubmitting((s) => ({ ...s, [entryId]: false }));
    }
  }, [commentDrafts, fetchEntryComments]);

  return {
    entryComments,
    setEntryComments,
    commentDrafts,
    setCommentDrafts,
    commentSubmitting,
    commentError,
    setCommentError,
    commentSuccess,
    setCommentSuccess,
    fetchEntryComments,
    handleSubmitComment,
  };
}

export function useDiscussionThreads(accessToken?: string | null) {
  const comments = useDiscussionComments(accessToken);
  return {
    ...comments,
    entryThreads: comments.entryComments,
    fetchEntryThreads: comments.fetchEntryComments,
  };
}
