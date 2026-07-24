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
            <h3 className="mb-2 font-semibold text-gray-900">1. Browsing Data</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Overview:</span> Dashboard with live metric counts and interactive charts for species and score distributions.</li>
              <li><span className="font-medium text-gray-900">Promoters:</span> Filter by chromosome, gene, score, sample ID, species, tissue, cohort, or BMI class. Click any row to inspect sequence details, copy as BED/FASTA, and view in the embedded genome browser.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">2. Downloading Data</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Web download:</span> Click <span className="font-medium text-gray-900">Download</span> on any file card. Links go directly to the public storage host with <code>?download=true</code> for maximum speed.</li>
              <li><span className="font-medium text-gray-900">CLI download (recommended for large files):</span> Use <span className="font-medium text-gray-900">Copy wget</span> or <span className="font-medium text-gray-900">Copy curl</span> for resumable terminal downloads.</li>
              <li><span className="font-medium text-gray-900">Overview bundles:</span> Download complete dataset archives from the Dataset Downloads section on the Overview tab.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">3. Community Feedback</h3>
            <ul className="space-y-2">
              <li>Navigate to the <span className="font-medium text-gray-900">Community Feedback</span> tab and click <span className="font-medium text-gray-900">Leave Feedback</span> to submit a message.</li>
              <li>Each message includes a title, category, rating, and public/private visibility. Email is optional.</li>
              <li>Threads are grouped into <span className="font-medium text-gray-900">In progress</span> and <span className="font-medium text-gray-900">Completed</span> sections with timestamps.</li>
              <li>Like and bookmark entries to show support and save for later.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">4. For Site Creators</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Reply:</span> Sign in with GitHub (Creator Sign In) to reply to feedback. Replies are emailed to visitors who provided an email address.</li>
              <li><span className="font-medium text-gray-900">Moderate:</span> Pin important entries to the top of Completed (max 3) or hide entries from public view.</li>
              <li><span className="font-medium text-gray-900">Customize:</span> Edit <code>src/site-config.ts</code> to set branding, tracks, and download links.</li>
              <li><span className="font-medium text-gray-900">Deploy:</span> See README for Vercel, Cloudflare Pages, and Wrangler deployment guides.</li>
            </ul>
          </section>

         <section>
            <h3 className="mb-2 font-semibold text-gray-900">Open-source Stack</h3>
            <p className="text-xs text-gray-500">
              Built with Next.js 15, React 19, Supabase, JBrowse 2, TanStack Table, ECharts, and OpenNext.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
