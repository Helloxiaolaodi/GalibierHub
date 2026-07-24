'use client';

import { useEffect } from 'react';

interface UserGuideProps {
  open: boolean;
  onClose: () => void;
}

const REFERENCES = [
  {
    name: 'Next.js 15.5.21',
    href: 'https://nextjs.org/docs',
    note: 'Official documentation',
  },
  {
    name: 'React 19.2.4',
    href: 'https://react.dev/learn',
    note: 'Official learning resources',
  },
  {
    name: '@supabase/supabase-js ^2.110.7',
    href: 'https://supabase.com/docs/reference/javascript/introduction',
    note: 'Official JavaScript client documentation',
  },
  {
    name: '@jbrowse/product-core ^4.3.0',
    href: 'https://jbrowse.org/jb2/',
    note: 'JBrowse 2 official documentation',
  },
  {
    name: '@jbrowse/react-linear-genome-view ^3.1.0',
    href: 'https://www.npmjs.com/package/@jbrowse/react-linear-genome-view',
    note: 'Package documentation',
  },
  {
    name: 'JBrowse 2',
    href: 'https://www.nature.com/articles/s41587-023-01780-9',
    note: 'Buels R, et al. JBrowse 2: a modular genome browser with views of synteny and structural variation. Nature Biotechnology. 2023.',
  },
  {
    name: '@tanstack/react-table ^8.21.3',
    href: 'https://tanstack.com/table/latest/docs/guide/introduction',
    note: 'Official documentation',
  },
  {
    name: 'echarts ^6.1.0',
    href: 'https://echarts.apache.org/handbook/en/get-started/',
    note: 'Official handbook',
  },
  {
    name: '@opennextjs/cloudflare ^1.20.2',
    href: 'https://opennext.js.org/cloudflare',
    note: 'OpenNext Cloudflare documentation',
  },
  {
    name: 'wrangler ^4.113.0',
    href: 'https://developers.cloudflare.com/workers/wrangler/',
    note: 'Cloudflare Workers CLI documentation',
  },
];

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
              <li><span className="font-medium text-gray-900">Promoters:</span> Filter by chromosome, gene, score, sample ID, species, tissue, cohort, or BMI class. Click any row to inspect sequence details and copy as BED/FASTA.</li>
              <li><span className="font-medium text-gray-900">Genome Browser:</span> Embedded JBrowse 2 viewer synced with the selected promoter. Navigating the browser updates the locus across the page.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">2. Downloading Data</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Browser download:</span> Click <span className="font-medium text-gray-900">Download</span> on any file card. Links point directly to the public storage host with <code>?download=true</code> to avoid proxy overhead.</li>
              <li><span className="font-medium text-gray-900">CLI download:</span> For large files, use <span className="font-medium text-gray-900">Copy wget</span> or <span className="font-medium text-gray-900">Copy curl</span> to paste a ready-made command into your terminal. Supports resumable transfers via <code>aria2c</code> or similar tools.</li>
              <li><span className="font-medium text-gray-900">Free-tier note:</span> JBrowse streaming uses the configured proxy; user-triggered downloads go directly to Hugging Face or R2 for better speed at zero cost.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">3. Community Feedback</h3>
            <ul className="space-y-2">
              <li>Click <span className="font-medium text-gray-900">Community Feedback</span> in the top nav to open the floating composer and browse public threads.</li>
              <li>Messages support a title, public/private visibility, rating, and optional affiliation. The creator can reply after signing in with GitHub.</li>
              <li>Threads are organized into <span className="font-medium text-gray-900">In progress</span> and <span className="font-medium text-gray-900">Completed</span> sections with posted and replied timestamps.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">4. For Site Creators</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Customization:</span> Edit <code>src/site-config.ts</code> to set your title, description, JBrowse tracks, and download links.</li>
              <li><span className="font-medium text-gray-900">Data sources:</span> Metadata lives in Supabase; genomic tracks can come from R2, Hugging Face, or any Range-request-capable object store.</li>
              <li><span className="font-medium text-gray-900">Deployment:</span> See README.md for Vercel, Cloudflare Pages, and Wrangler deployment guides.</li>
              <li><span className="font-medium text-gray-900">Proxy setup:</span> See <code>cloudflare-templates/hf-proxy/README.md</code> for the Hugging Face proxy Worker that accelerates JBrowse streaming.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">Open-source References &amp; Thanks</h3>
            <div className="space-y-3">
              {REFERENCES.map((item) => (
                <div key={item.name} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-700 underline underline-offset-2"
                  >
                    {item.name}
                  </a>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{item.note}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
