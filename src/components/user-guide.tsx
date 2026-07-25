'use client';

import { useEffect } from 'react';

interface UserGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function UserGuide({ open, onClose }: UserGuideProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={onClose} role="presentation">
      <aside
        id="seqedge-user-guide"
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seqedge-user-guide-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3">
          <h2 id="seqedge-user-guide-title" className="text-base font-bold text-gray-900">
            SeqEdge - User Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user guide"
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 p-5 text-sm leading-relaxed text-gray-700">
          <section>
            <h3 className="mb-2 font-semibold text-gray-900">1. Overview</h3>
            <ul className="space-y-2">
              <li>Use this tab to view summary metrics, charts, and featured download entries.</li>
              <li>Start here if you want a quick overview before opening records or downloads.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">2. Records</h3>
            <ul className="space-y-2">
              <li>Filter records by fields such as coordinate, label, score, sample, species, tissue, cohort, or class.</li>
              <li>Click a row to open the detail panel and jump the embedded browser to the matching region.</li>
              <li>Use the detail panel to inspect metadata and open file downloads for that record.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">3. Discussion</h3>
            <ul className="space-y-2">
              <li>Click <span className="font-medium text-gray-900">Leave Feedback</span> to post a message. GitHub sign-in is supported for posting.</li>
              <li>Threads appear in <span className="font-medium text-gray-900">In progress</span> and <span className="font-medium text-gray-900">Completed</span>.</li>
              <li>You can view likes, bookmarks, replies, and uploaded images. Click an image to enlarge it.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">4. Downloads</h3>
            <ul className="space-y-2">
              <li>Open this tab to browse downloadable files grouped by path.</li>
              <li>For a single file, open its download window from <span className="font-medium text-gray-900">Overview</span>, a record detail panel in <span className="font-medium text-gray-900">Records</span>, or the file list in <span className="font-medium text-gray-900">Downloads</span>.</li>
              <li>For batch scripts, select items in <span className="font-medium text-gray-900">Records</span> and click <span className="font-medium text-gray-900">Batch download</span>.</li>
              <li>The download window shows file info, browser download, and command-line commands.</li>
              <li>For large public files, prefer <code>wget -c</code>, <code>curl -L -C -</code>, or <code>hf download</code> because they support resume.</li>
              <li>Protected files may require site access or a short-lived link and may not appear in batch scripts.</li>
            </ul>
          </section>

         <section>
            <h3 className="mb-2 font-semibold text-gray-900">Quick Tips</h3>
            <p className="text-xs text-gray-500">
              Use <span className="font-medium text-gray-700">Overview</span> to orient yourself, <span className="font-medium text-gray-700">Records</span> to inspect entries, <span className="font-medium text-gray-700">Discussion</span> to post feedback, and <span className="font-medium text-gray-700">Downloads</span> to get files.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
