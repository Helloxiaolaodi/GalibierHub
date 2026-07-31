'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { SiteConfig } from '@/site-config';
import { useDiscussionThreads } from './discussion-comments';
import { getBrowserSupabase } from '@/utils/supabase-browser';
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

type MarkdownEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  uploadControls?: ReactNode;
  className?: string;
};

type MarkdownBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; language: string; lines: string[] };

function renderInlineMarkdown(
  text: string,
  onImageClick?: (src: string, alt: string) => void,
  keyPrefix = 'md-inline',
) {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
          {text.slice(lastIndex, match.index)}
        </span>,
      );
    }

    if (match[1] !== undefined) {
      const alt = match[1];
      const src = match[2];
      nodes.push(
        <Image
          key={`${keyPrefix}-img-${match.index}`}
          src={src}
          alt={alt}
          width={400}
          height={300}
          unoptimized
          className={`my-2 max-w-[320px] rounded h-auto ${onImageClick ? 'cursor-zoom-in' : ''}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onClick={onImageClick ? () => onImageClick(src, alt) : undefined}
        />,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={match[4]}
          target="_blank"
          rel="noreferrer"
          className="text-slate-700 underline underline-offset-2 hover:text-slate-800"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <code key={`${keyPrefix}-code-${match.index}`} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.92em] text-gray-900">
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined || match[7] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`} className="font-semibold text-gray-900">
          {match[6] ?? match[7]}
        </strong>,
      );
    } else if (match[8] !== undefined || match[9] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-em-${match.index}`} className="italic">
          {match[8] ?? match[9]}
        </em>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <span key={`${keyPrefix}-tail-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
        {text.slice(lastIndex)}
      </span>,
    );
  }

  if (nodes.length === 0) {
    return [
      <span key={`${keyPrefix}-plain`} style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </span>,
    ];
  }

  return nodes;
}

function parseMarkdownBlocks(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', language, lines: codeLines });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const currentTrimmed = current.trim();
      if (!currentTrimmed) break;
      if (
        currentTrimmed.startsWith('```') ||
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        /^>\s?/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines });
  }

  return blocks;
}

function renderMarkdownMessage(
  text: string | null | undefined,
  onImageClick?: (src: string, alt: string) => void,
) {
  if (!text) return null;

  const blocks = parseMarkdownBlocks(text);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const keyPrefix = `md-${block.type}-${blockIndex}`;

        if (block.type === 'heading') {
          const level = Math.min(block.level, 6);
          const classes = [
            'text-xl font-semibold text-gray-900',
            'text-lg font-semibold text-gray-900',
            'text-base font-semibold text-gray-900',
            'text-sm font-semibold text-gray-900',
            'text-sm font-medium text-gray-900',
            'text-sm font-medium text-gray-800',
          ][level - 1];
          const content = renderInlineMarkdown(block.text, onImageClick, keyPrefix);

          switch (level) {
            case 1:
              return <h1 key={keyPrefix} className={classes}>{content}</h1>;
            case 2:
              return <h2 key={keyPrefix} className={classes}>{content}</h2>;
            case 3:
              return <h3 key={keyPrefix} className={classes}>{content}</h3>;
            case 4:
              return <h4 key={keyPrefix} className={classes}>{content}</h4>;
            case 5:
              return <h5 key={keyPrefix} className={classes}>{content}</h5>;
            default:
              return <h6 key={keyPrefix} className={classes}>{content}</h6>;
          }
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={keyPrefix} className="border-l-2 border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-700">
              {block.lines.map((line, lineIndex) => (
                <p key={`${keyPrefix}-${lineIndex}`} className={lineIndex > 0 ? 'mt-2' : undefined}>
                  {renderInlineMarkdown(line, onImageClick, `${keyPrefix}-${lineIndex}`)}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={keyPrefix} className="list-disc space-y-1 pl-5 text-sm leading-6 text-gray-700">
              {block.items.map((item, itemIndex) => (
                <li key={`${keyPrefix}-${itemIndex}`}>{renderInlineMarkdown(item, onImageClick, `${keyPrefix}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={keyPrefix} className="list-decimal space-y-1 pl-5 text-sm leading-6 text-gray-700">
              {block.items.map((item, itemIndex) => (
                <li key={`${keyPrefix}-${itemIndex}`}>{renderInlineMarkdown(item, onImageClick, `${keyPrefix}-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'code') {
          return (
            <div key={keyPrefix} className="overflow-hidden rounded border border-gray-200 bg-gray-950">
              {block.language && <div className="border-b border-gray-800 bg-gray-900 px-3 py-1 text-[11px] uppercase tracking-wide text-gray-400">{block.language}</div>}
              <pre className="overflow-x-auto px-3 py-3 text-xs leading-6 text-gray-100">
                <code>{block.lines.join('\n')}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={keyPrefix} className="text-sm leading-6 text-gray-700">
            {renderInlineMarkdown(block.lines.join('\n'), onImageClick, keyPrefix)}
          </p>
        );
      })}
    </div>
  );
}

function MarkdownEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled = false,
  uploadControls,
  className,
}: MarkdownEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const updateSelection = useCallback((start: number, end: number) => {
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }, []);

  const insertWrappedText = useCallback((prefix: string, suffix: string, fallbackText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || fallbackText;
    const nextValue = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
    onChange(nextValue);
    updateSelection(start + prefix.length, start + prefix.length + selected.length);
  }, [onChange, updateSelection, value]);

  const insertLinePrefix = useCallback((prefix: string, fallbackText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIndex = value.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const base = selected || value.slice(lineStart, lineEnd) || fallbackText;
    const nextBlock = base
      .split('\n')
      .map((line) => `${prefix}${line || fallbackText}`)
      .join('\n');

    const replaceStart = selected ? start : lineStart;
    const replaceEnd = selected ? end : lineEnd;
    const nextValue = `${value.slice(0, replaceStart)}${nextBlock}${value.slice(replaceEnd)}`;
    onChange(nextValue);
    updateSelection(replaceStart, replaceStart + nextBlock.length);
  }, [onChange, updateSelection, value]);

  return (
    <div className={className || 'space-y-2'}>
      <div className="overflow-hidden border border-gray-300 bg-white">
       <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-2 py-2">
         <div className="flex flex-wrap items-center gap-1">
           {[
             { label: 'B', title: 'Bold', action: () => insertWrappedText('**', '**', 'bold text') },
             { label: 'I', title: 'Italic', action: () => insertWrappedText('*', '*', 'italic text') },
             { label: '</>', title: 'Inline code', action: () => insertWrappedText('`', '`', 'code') },
             { label: 'H', title: 'Heading', action: () => insertLinePrefix('## ', 'Heading') },
             { label: '>', title: 'Quote', action: () => insertLinePrefix('> ', 'Quoted text') },
             { label: 'UL', title: 'Bullet list', action: () => insertLinePrefix('- ', 'List item') },
             { label: '1.', title: 'Numbered list', action: () => insertLinePrefix('1. ', 'List item') },
             { label: '[]', title: 'Link', action: () => insertWrappedText('[', '](https://example.com)', 'link text') },
           ].map((tool) => (
             <button
               key={tool.title}
               type="button"
               onClick={tool.action}
               disabled={disabled}
               title={tool.title}
               className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
             >
               {tool.label}
             </button>
           ))}
         </div>
         <div className="inline-flex items-center rounded border border-gray-300 bg-white p-0.5 text-xs font-medium text-gray-700">
           {uploadControls}
           <button
             type="button"
             onClick={() => setTab('write')}
              className={`rounded px-2 py-1 ${tab === 'write' ? 'bg-slate-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
           >
             Write
           </button>
           <button
             type="button"
             onClick={() => setTab('preview')}
              className={`rounded px-2 py-1 ${tab === 'preview' ? 'bg-slate-800 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
           >
             Preview
           </button>
         </div>
       </div>

        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full resize-y border-0 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-0"
          />
        ) : (
          <div className="min-h-[8rem] px-3 py-3">
            {value.trim() ? renderMarkdownMessage(value) : <div className="text-sm text-gray-500">Nothing to preview yet.</div>}
          </div>
        )}
      </div>
    </div>
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
    company: '',
    _rendered_at: 0,
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
  } = useDiscussionThreads(accessToken, isAdmin);

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
    const sb = getBrowserSupabase();
    if (!sb) return;
    const updateCount = (reactionType: 'like' | 'bookmark', entryId: string, delta: number) => {
      setEntryReactionCounts((current) => ({
        ...current,
        [entryId]: {
          like: Math.max(0, (current[entryId]?.like || 0) + (reactionType === 'like' ? delta : 0)),
          bookmark: Math.max(0, (current[entryId]?.bookmark || 0) + (reactionType === 'bookmark' ? delta : 0)),
        },
      }));
      setReactionCounts((current) => ({
        like: Math.max(0, current.like + (reactionType === 'like' ? delta : 0)),
        bookmark: Math.max(0, current.bookmark + (reactionType === 'bookmark' ? delta : 0)),
      }));
    };
    const channel = sb.channel('site-feedback-reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_reactions' }, (payload) => {
        const row = payload.new as { entry_id?: string | null; reaction_type?: string };
        if (row.entry_id && (row.reaction_type === 'like' || row.reaction_type === 'bookmark')) {
          updateCount(row.reaction_type, row.entry_id, 1);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'site_reactions' }, (payload) => {
        const oldRow = payload.old as { entry_id?: string | null; reaction_type?: string };
        if (oldRow.entry_id && (oldRow.reaction_type === 'like' || oldRow.reaction_type === 'bookmark')) {
          updateCount(oldRow.reaction_type, oldRow.entry_id, -1);
        }
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved: Record<string, Record<string, boolean>> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('galibierhub-reaction-like-')) {
        const entryId = key.replace('galibierhub-reaction-like-', '');
        saved[entryId] = {
          like: window.localStorage.getItem(`galibierhub-reaction-like-${entryId}`) === '1',
          bookmark: window.localStorage.getItem(`galibierhub-reaction-bookmark-${entryId}`) === '1',
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
    let userId: string | null = null;
    let actorName = 'Someone';
    const sb = getBrowserSupabase();
    if (sb) {
      try {
        const { data: sessionData } = await sb.auth.getSession();
        const user = sessionData.session?.user;
        if (user) {
          userId = user.id;
          actorName = String(
            user.user_metadata?.user_name ||
            user.user_metadata?.preferred_username ||
            user.user_metadata?.login ||
            (user.email ? user.email.split('@')[0] : null) ||
            'Someone'
          );
        }
      } catch {
        // Reaction still works without session identity.
      }
    }
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, fingerprint, entryId, userId, actorName }),
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
        window.localStorage.setItem(`galibierhub-reaction-${reactionType}-${entryId}`, data.active ? '1' : '0');
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
        throw new Error('Sign in to reply.');
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
          <div className="flex flex-wrap items-center gap-2 text-sm leading-5">
            <span className="min-w-0 font-semibold text-gray-900">{entry.title || 'Untitled discussion'}</span>
            {entry.pinned && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                Pinned
              </span>
            )}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${entry.visibility === 'private' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {entry.visibility === 'private' ? 'Administrator only' : 'Public'}
            </span>
            {entry.hidden && isAdmin && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                Hidden
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>{entry.display_name}</span>
            <span className="text-gray-300">|</span>
            <span>{formatDateTime(entry.created_at)}</span>
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
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
             <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700" title={`${entryReactionCounts[entry.id]?.like || 0} likes`}>
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
          <div className="mt-3">{renderMarkdownMessage(entry.message, (src) => setLightBox({ src, alt: entry.title || 'Image' }))}</div>

          {entry.creator_reply ? (
             <div className="mt-4 border-l-2 border-slate-500 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <img src="/galibierhub-logo.svg" alt="GalibierHub Team" className="h-6 w-6 rounded-full bg-white object-cover" />
                <span className="text-sm font-semibold text-slate-900">GalibierHub Team</span>
                <span className="text-xs text-slate-500">&middot; Official Response</span>
              </div>
              <div className="text-sm text-slate-800">{renderMarkdownMessage(entry.creator_reply, (src) => setLightBox({ src, alt: 'Reply image' }))}</div>
              <div className="mt-2 text-xs text-slate-600">{formatDateTime(entry.replied_at)}</div>
           </div>
         ) : isAdmin ? (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <MarkdownEditor
                value={replyDrafts[entry.id] || ''}
                onChange={(nextValue) => setReplyDrafts((current) => ({ ...current, [entry.id]: nextValue }))}
                rows={4}
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
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${entryActiveReactions[entry.id]?.like ? 'border-slate-800 bg-slate-50 text-slate-700' : 'border-gray-300 bg-white text-gray-600'}`}
            >
              <svg className="h-3.5 w-3.5" fill={entryActiveReactions[entry.id]?.like ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
             Like {entryReactionCounts[entry.id]?.like || 0}
           </button>
         </div>

         {/* Discussion replies */}
         <div className="mt-4 border-t border-gray-100 pt-4">
           {!entry.creator_reply && (
           <>
            <MarkdownEditor
              value={commentDrafts[entry.id] || ''}
              onChange={(nextValue) => setCommentDrafts((c) => ({ ...c, [entry.id]: nextValue }))}
              rows={4}
              placeholder="Add reply"
              uploadControls={(
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
              )}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void handleSubmitComment(entry.id); }}
               disabled={commentSubmitting[entry.id]}
                className="ml-auto rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:bg-slate-400"
             >
               {commentSubmitting[entry.id] ? 'Sending...' : 'Send'}
             </button>
           </div>
           {commentError[entry.id] && <div className="mt-1 text-xs text-red-600">{commentError[entry.id]}</div>}
          {commentSuccess[entry.id] && <div className="mt-1 text-xs text-emerald-700">{commentSuccess[entry.id]}</div>}
           </>
           )}

          {/* Discussion replies */}
            {comments.length > 0 && (
              <div className="mt-3 space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className={`pl-3 border-l-2 ${c.hidden ? 'border-red-200 bg-red-50/50' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-1.5">
                      {c.author_name === 'GalibierHub Team' ? (
                        <img src="/galibierhub-logo.svg" alt="GalibierHub Team" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600">{c.author_name.charAt(0).toUpperCase() || 'U'}</span>
                      )}
                      <div className="text-xs font-medium text-gray-700">{c.author_name}</div>
                    </div>
                    {isAdmin && c.hidden && <div className="mt-0.5 text-[11px] font-medium text-red-600">Hidden reply</div>}
                    <div className="mt-1 text-xs text-gray-600">{renderMarkdownMessage(c.message, (src) => setLightBox({ src, alt: 'Comment image' }))}</div>
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

  const handleComposerSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        company: '',
        _rendered_at: 0,
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
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
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
                  'New Discussion'
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
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-500"
                />
                {composerErrors.title && <span className="text-xs text-red-600">{composerErrors.title}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Name (required)</span>
                <input
                  value={composerForm.displayName}
                  onChange={(e) => setComposerForm((c) => ({ ...c, displayName: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-500"
                />
                {composerErrors.displayName && <span className="text-xs text-red-600">{composerErrors.displayName}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Email (optional)</span>
                <input
                  value={composerForm.visitorEmail}
                  onChange={(e) => setComposerForm((c) => ({ ...c, visitorEmail: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-500"
                />
                {composerErrors.visitorEmail && <span className="text-xs text-red-600">{composerErrors.visitorEmail}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation (optional)</span>
                <input
                  value={composerForm.affiliation}
                  onChange={(e) => setComposerForm((c) => ({ ...c, affiliation: e.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-500"
                />
              </label>
            </div>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Visibility</span>
              <select
                value={composerForm.visibility}
                onChange={(e) => setComposerForm((c) => ({ ...c, visibility: e.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-slate-500"
              >
                <option value="public">Public</option>
                <option value="private">Administrator only</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm text-gray-700">
              <span>Message (required)</span>
              <MarkdownEditor
                value={composerForm.message}
                onChange={(nextValue) => setComposerForm((c) => ({ ...c, message: nextValue }))}
                rows={6}
                placeholder="Share context, expected behavior, links, screenshots, or code snippets."
                uploadControls={(
                  <div className="flex flex-wrap items-center gap-2">
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
                )}
              />
             {composerErrors.message && <span className="text-xs text-red-600">{composerErrors.message}</span>}
            </label>
            {composerError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{composerError}</div>}
            {composerSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{composerSuccess}</div>}
            {/* Honeypot field: hidden from real users, bots auto-fill it */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
              <label htmlFor="honeypot-company">Company</label>
              <input
                id="honeypot-company"
                type="text"
                name="company"
                autoComplete="off"
                tabIndex={-1}
                value={composerForm.company}
                onChange={(e) => setComposerForm((c) => ({ ...c, company: e.target.value }))}
              />
            </div>
            <button
                type="submit"
                disabled={composerSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {composerSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-6 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
          <span className="inline-flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
            <span className="uppercase tracking-wide text-gray-500">Discussions</span>
            <span className="font-semibold text-gray-900">{summary.totalThreads}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="uppercase tracking-wide text-amber-600">In Progress</span>
            <span className="font-semibold text-amber-900">{inProgressTotal}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="uppercase tracking-wide text-emerald-600">Completed</span>
            <span className="font-semibold text-emerald-900">{completedTotal}</span>
          </span>
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
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">{inProgressPage + 1} / {Math.max(1, inProgressMaxPage + 1)}</span>
                <button
                  type="button"
                  onClick={() => setInProgressPage((p) => Math.min(inProgressMaxPage, p + 1))}
                  disabled={inProgressPage >= inProgressMaxPage}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
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
