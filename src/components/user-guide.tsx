'use client';

import { useEffect } from 'react';

interface UserGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function UserGuide({ open, onClose }: UserGuideProps) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm" onClick={onClose} role="presentation">
      <aside
        id="galibierhub-user-guide"
        className="h-full w-full max-w-md overflow-y-auto bg-white/85 backdrop-blur-xl shadow-2xl border-l border-white/30"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="galibierhub-user-guide-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100/60 bg-white/90 backdrop-blur-xl px-8 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <h2 id="galibierhub-user-guide-title" className="text-lg font-semibold text-slate-900">
              GalibierHub User Guide
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close user guide"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-8 py-8 text-sm leading-relaxed text-slate-600">
          <section className="rounded-xl bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Overview</h3>
            <p>View summary metrics, charts, and featured downloads on the home tab.</p>
          </section>

          <section className="rounded-xl bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Records</h3>
            <ul className="space-y-2">
              <li>Filter records by coordinate, feature, score, sample, and sample metadata.</li>
              <li>Click a row to inspect its detail panel or open it in the Genome Browser.</li>
              <li>Use the Download column to jump to the matching file in Downloads &gt; Records.</li>
            </ul>
          </section>

          <section className="rounded-xl bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Downloads</h3>
            <ul className="space-y-2">
              <li>Browse folders, select files, and use Download to Browser, CLI, or Cluster Batch Download.</li>
              <li>The Records folder contains every file from the Records interface and supports the same workflows as other Downloads folders.</li>
            </ul>
          </section>

          <section className="rounded-xl bg-slate-50/70 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Discussions</h3>
            <ul className="space-y-2">
              <li>Create discussions, reply, react, and manage notifications from the user menu.</li>
              <li>Notifications, Replies, Likes, and Following each provide Mark all read.</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
