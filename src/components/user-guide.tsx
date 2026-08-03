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
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <h2 id="galibierhub-user-guide-title" className="text-lg font-semibold text-slate-900 tracking-tight">
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

        <div className="space-y-3 px-8 py-8 text-sm leading-relaxed text-slate-600">
          {/* Overview */}
          <section className="rounded-xl bg-slate-50/70 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Overview</h3>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />Open this tab for summary metrics, charts, and featured downloads.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />Use Overview for a quick orientation before browsing records or downloads.</li>
            </ul>
          </section>

          {/* Records */}
          <section className="rounded-xl bg-slate-50/70 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Records</h3>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />Filter records by fields such as coordinate, label, score, sample, species, tissue, cohort, or class.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />Click a row to open the detail panel and navigate the Genome Browser.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />Use the detail panel to inspect metadata and open file downloads.</li>
            </ul>
          </section>

          {/* Discussions */}
          <section className="rounded-xl bg-slate-50/70 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Discussions</h3>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />Click New Discussion to open the composer.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />Use the Markdown toolbar for headings, lists, quotes, code, and links, then switch to Preview before posting.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />Discussions show status badges: In Progress or Resolved.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />View likes, bookmarks, replies, and uploaded images. Click an image to enlarge it.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400" />Earn badges through community participation: Ice Breaker, Nice Topic, and more.</li>
            </ul>
          </section>

          {/* Downloads */}
          <section className="rounded-xl bg-slate-50/70 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Downloads</h3>
            </div>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />Navigate the directory tree with breadcrumbs and switch between Grid / Table views.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />Use Cluster Batch Download to generate Python and SLURM scripts for recursive folder downloads.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />Export manifests (TSV, CSV) or checksum files for bulk verification.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />For batch scripts, select samples in Records and click Batch download.</li>
              <li className="flex items-start gap-2"><span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />Large files support resumable downloads via wget -c or hf download.</li>
            </ul>
          </section>

          {/* Quick Tips */}
          <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Quick Tips</h3>
            </div>
            <p className="text-sm leading-relaxed">
              Use <span className="font-semibold text-blue-700">Overview</span> to orient yourself, <span className="font-semibold text-emerald-700">Records</span> to inspect entries, <span className="font-semibold text-purple-700">Discussions</span> to post feedback, and <span className="font-semibold text-amber-700">Downloads</span> to get files.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
