'use client';
import TurnstileWidget from '@/components/turnstile-widget';
import { renderMarkdown } from '@/lib/markdown';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type VisibilityMode = 'public' | 'private';
type FeedbackCategory = 'general' | 'issue' | 'idea' | 'data' | 'collaboration';

interface FeedbackComposerProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
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
const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadImageMessage, setUploadImageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const handleImageUpload = async (file: File): Promise<string | null> => {
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
  };

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
    setUploadImageMessage(null);
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
      errors.title = 'Required.';
    } else if (form.title.trim().length < 3) {
      errors.title = 'Use at least 3 characters.';
    } else if (form.title.trim().length > 120) {
      errors.title = 'Use 120 characters or fewer.';
    }

    if (!form.displayName.trim()) {
      errors.displayName = 'Required.';
    } else if (form.displayName.trim().length > 80) {
      errors.displayName = 'Use 80 characters or fewer.';
    }

    if (form.visitorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.visitorEmail.trim())) {
      errors.visitorEmail = 'Enter a valid email address.';
    } else if (form.visitorEmail.trim().length > 160) {
      errors.visitorEmail = 'Use 160 characters or fewer.';
    }

    if (form.affiliation.trim().length > 160) {
      errors.affiliation = 'Use 160 characters or fewer.';
    }

    if (!form.message.trim()) {
      errors.message = 'Required.';
    } else if (form.message.trim().length < 3) {
      errors.message = 'Use at least 3 characters.';
    } else if (form.message.trim().length > 2000) {
      errors.message = 'Use 2,000 characters or fewer.';
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
        headers: {
              'Content-Type': 'application/json',
              ...(turnstileToken ? { 'x-turnstile-token': turnstileToken } : {}),
            },
        body: JSON.stringify({
              ...form,
              _rendered_at: Date.now() - (typeof performance !== 'undefined' ? performance.now() : 0),
            }),
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
      setSubmitSuccess('Feedback submitted.');
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
            <p className="mt-1 text-xs text-gray-500">Post a public message or a private note to Administrator.</p>
          </div>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
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
                          {/* Honeypot: hidden from humans, bots fill this */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
              <label>
                Leave this empty:
                <input
                  type="text"
                  name="company"
                  autoComplete="off"
                  tabIndex={-1}
                  onChange={(event) => {
                    // silently capture, sent in body for middleware detection
                  }}
                />
              </label>
            </div>
            <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
               <span>Title (required)</span>
               <input
                 value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
               {validationErrors.title && <span className="text-xs text-red-600">{validationErrors.title}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
               <span>Name or nickname (required)</span>
               <input
                 value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
               {validationErrors.displayName && <span className="text-xs text-red-600">{validationErrors.displayName}</span>}
              </label>
              <label className="space-y-1 text-sm text-gray-700">
              <span>Email (optional)</span>
              <input
                value={form.visitorEmail}
                onChange={(event) => setForm((current) => ({ ...current, visitorEmail: event.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Affiliation</span>
                <input
                  value={form.affiliation}
               onChange={(event) => setForm((current) => ({ ...current, affiliation: event.target.value }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
             </label>
            </div>

            <label className="space-y-1 text-sm text-gray-700">
              <span>Visibility</span>
              <select
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as VisibilityMode }))}
                className="w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              >
                <option value="public">Public</option>
                <option value="private">Administrator only</option>
              </select>
            </label>

            <label className="block space-y-1 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Message (required)</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setPreviewMode(false)} className={!previewMode ? "rounded px-2 py-1 text-xs font-medium text-white bg-blue-600 shadow-sm" : "rounded px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"}>Edit</button>
                  <button type="button" onClick={() => setPreviewMode(true)} className={previewMode ? "rounded px-2 py-1 text-xs font-medium text-white bg-blue-600 shadow-sm" : "rounded px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"}>Preview</button>
                </div>
              </div>
              {previewMode ? (
                <div className="min-h-[200px] px-4 py-3 text-sm text-gray-700 prose prose-sm max-w-none rounded-lg border border-gray-200 bg-[#F5F5F7]">{form.message.trim() ? renderMarkdown(form.message) : (<span className="text-gray-400 italic">Nothing to preview</span>)}</div>
              ) : (
                <textarea
                  value={form.message}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                  rows={6}
                  className="w-full rounded-lg border border-transparent bg-[#F5F5F7] px-3 py-2 text-sm text-gray-900 outline-none transition-colors hover:bg-slate-200/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                />
              )}
            {!previewMode && (<div className="mt-2 flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               Attach image
               <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setUploadingImage(true); setUploadImageMessage(null); const url = await handleImageUpload(file); setUploadingImage(false); if (url) { setForm((c) => ({ ...c, message: c.message + (c.message ? '\n' : '') + '![image](' + url + ')' })); setUploadImageMessage({ type: 'success', text: 'Image uploaded.' }); } else { setUploadImageMessage({ type: 'error', text: 'Image upload failed.' }); } e.target.value = ''; } }} />
             </label>
              {uploadingImage && <span className="text-xs text-gray-500">Uploading...</span>}
              {uploadImageMessage && (
                <span className={`text-xs ${uploadImageMessage.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {uploadImageMessage.text}
                </span>
              )}
            </div>)}
            {validationErrors.message && <span className="text-xs text-red-600">{validationErrors.message}</span>}
            </label>

            {submitError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>}
            {submitSuccess && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{submitSuccess}</div>}

                        {/* Turnstile anti-bot widget */}
            <div className="border-t border-gray-200 pt-4">
              <TurnstileWidget
                onToken={(token) => setTurnstileToken(token)}
                action="feedback-submission"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-gray-500" />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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
