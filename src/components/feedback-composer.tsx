'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type VisibilityMode = 'public' | 'private';
type FeedbackCategory = 'general' | 'issue' | 'idea' | 'data' | 'collaboration';

interface FeedbackComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: 'General',
  issue: 'Issue',
  idea: 'Idea',
  data: 'Data',
  collaboration: 'Collaboration',
};

const MIN_PANEL_WIDTH = 380;
const MAX_PANEL_WIDTH = 760;
const MIN_PANEL_HEIGHT = 520;
const MAX_PANEL_HEIGHT = 920;
const PANEL_MARGIN = 16;
const DESKTOP_HEADER_OFFSET = 88;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, [role="button"]'));
}

export default function FeedbackComposer({ open, onClose, onSubmitted }: FeedbackComposerProps) {
  const initializedRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: DESKTOP_HEADER_OFFSET });
  const [size, setSize] = useState({ width: 520, height: 720 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeOrigin, setResizeOrigin] = useState({
    pointerX: 0,
    pointerY: 0,
    width: 520,
    height: 720,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    displayName: '',
    visitorEmail: '',
    affiliation: '',
    category: 'general' as FeedbackCategory,
    rating: 5,
    visibility: 'public' as VisibilityMode,
    message: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (!open || viewport.width === 0 || viewport.height === 0 || initializedRef.current) {
      return;
    }

    const initialWidth = clamp(Math.min(520, viewport.width - PANEL_MARGIN * 2), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
    const initialHeight = clamp(
      Math.min(720, viewport.height - PANEL_MARGIN * 2),
      MIN_PANEL_HEIGHT,
      Math.min(MAX_PANEL_HEIGHT, viewport.height - PANEL_MARGIN * 2),
    );
    setSize({ width: initialWidth, height: initialHeight });
    setPosition({
      x: Math.max(PANEL_MARGIN, viewport.width - initialWidth - PANEL_MARGIN),
      y: viewport.width >= 1024 ? DESKTOP_HEADER_OFFSET : PANEL_MARGIN,
    });
    initializedRef.current = true;
  }, [open, viewport.height, viewport.width]);

  useEffect(() => {
    if (!open) {
      setSubmitError(null);
      setSubmitSuccess(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const isDesktop = viewport.width >= 1024;
  const maxPanelHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, (viewport.height || MAX_PANEL_HEIGHT) - PANEL_MARGIN * 2));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    // Validation
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = 'This field is required';
    } else if (form.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (form.title.trim().length > 120) {
      errors.title = 'Title must be 120 characters or less';
    }

    if (!form.displayName.trim()) {
      errors.displayName = 'This field is required';
    } else if (form.displayName.trim().length > 80) {
      errors.displayName = 'Name must be 80 characters or less';
    }

    if (!form.visitorEmail.trim()) {
      errors.visitorEmail = 'This field is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.visitorEmail.trim())) {
      errors.visitorEmail = 'Please enter a valid email address';
    } else if (form.visitorEmail.trim().length > 160) {
      errors.visitorEmail = 'Email must be 160 characters or less';
    }

    if (form.affiliation.trim().length > 160) {
      errors.affiliation = 'Affiliation must be 160 characters or less';
    }

    if (!form.message.trim()) {
      errors.message = 'This field is required';
    } else if (form.message.trim().length < 3) {
      errors.message = 'Message must be at least 3 characters';
    } else if (form.message.trim().length > 2000) {
      errors.message = 'Message must be 2000 characters or less';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSubmitting(false);
      return;
    }

    setValidationErrors({});

   try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback.');
      }

      setForm({
        title: '',
        displayName: '',
        visitorEmail: '',
        affiliation: '',
        category: 'general',
        rating: 5,
        visibility: 'public',
        message: '',
      });
      setSubmitSuccess('Message submitted successfully.');
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDesktop || isInteractiveTarget(event.target)) return;
    setDragging(true);
    setDragOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !isDesktop) return;
    const nextX = clamp(event.clientX - dragOffset.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.width - size.width - PANEL_MARGIN));
    const nextY = clamp(event.clientY - dragOffset.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.height - size.height - PANEL_MARGIN));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDesktop) return;
    event.stopPropagation();
    setResizing(true);
    setResizeOrigin({
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: size.width,
      height: size.height,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizing || !isDesktop) return;
    const maxWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewport.width - position.x - PANEL_MARGIN));
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, viewport.height - position.y - PANEL_MARGIN));
    const nextWidth = clamp(resizeOrigin.width + event.clientX - resizeOrigin.pointerX, MIN_PANEL_WIDTH, maxWidth);
    const nextHeight = clamp(resizeOrigin.height + event.clientY - resizeOrigin.pointerY, MIN_PANEL_HEIGHT, maxHeight);
    setSize({ width: nextWidth, height: nextHeight });
  };

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizing) return;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} role="presentation">
      <div
        className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-2xl"
        style={{
          left: isDesktop ? `${position.x}px` : '1rem',
          top: isDesktop ? `${position.y}px` : '1rem',
          width: isDesktop ? `${size.width}px` : 'calc(100vw - 2rem)',
          maxWidth: 'calc(100vw - 2rem)',
          height: isDesktop ? `${size.height}px` : 'calc(100vh - 2rem)',
          maxHeight: `min(${maxPanelHeight}px, calc(100vh - 2rem))`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex cursor-move items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Leave Feedback</h2>
            <p className="mt-1 text-xs text-gray-500">Submit a public message or a creator-only note.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close feedback composer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-[calc(100%-57px)] overflow-y-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
               <span>Title</span>
               <input
                 value={form.title}
                 onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                 className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                 minLength={3}
                 maxLength={120}
               />
                {validationErrors.title && <span className="text-xs text-red-600">{validationErrors.title}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
               <span>Name or nickname</span>
               <input
                 value={form.displayName}
                 onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                 className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                 maxLength={80}
               />
                {validationErrors.displayName && <span className="text-xs text-red-600">{validationErrors.displayName}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
               <span>Email</span>
               <input
                 type="email"
                 value={form.visitorEmail}
                 onChange={(event) => setForm((current) => ({ ...current, visitorEmail: event.target.value }))}
                 className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                 maxLength={160}
               />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation</span>
                <input
                  value={form.affiliation}
                  onChange={(event) => setForm((current) => ({ ...current, affiliation: event.target.value }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                  maxLength={160}
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as FeedbackCategory }))}
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
                  value={form.visibility}
                  onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as VisibilityMode }))}
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
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
                  className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
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
                rows={8}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
               minLength={3}
               maxLength={2000}
             />
            </label>

            {submitError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>}
            {submitSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{submitSuccess}</div>}

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-500">
                Public messages appear on the site. Creator-only messages stay private.
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

        {isDesktop && (
          <button
            type="button"
            aria-label="Resize feedback composer"
            className="absolute bottom-2 right-2 h-5 w-5 cursor-se-resize rounded-sm text-gray-400 hover:text-gray-600"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 15l6-6M13 19l6-6M17 23l6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
