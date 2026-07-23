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
            <h3 className="mb-2 font-semibold text-gray-900">1. Overview</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Live Metrics:</span> Real-time summary counts for samples, predicted promoters, and genomic variants.</li>
              <li><span className="font-medium text-gray-900">Interactive Charts:</span> Visualizes species distribution and prediction score distributions.</li>
              <li><span className="font-medium text-gray-900">Publication Export:</span> High-resolution PNG and SVG export for figures in one click.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">2. Promoters &amp; Features</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Advanced Filtering:</span> Slice records by chromosome, coordinate range, gene symbol, minimum score, sample ID, species, tissue, cohort, or BMI class.</li>
              <li><span className="font-medium text-gray-900">Interactive Inspection:</span> Click any row to inspect sequence details, color-coded domains, and quick-copy utilities (FASTA / BED).</li>
              <li><span className="font-medium text-gray-900">Large Result Navigation:</span> Switch between 20 / 50 / 100 rows per page, jump directly to a target page, and review active filters plus page-level chromosome and sample summaries.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">3. Genome Browser</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Integrated JBrowse 2:</span> Interactive viewer for reference genomes and multi-track annotations.</li>
              <li><span className="font-medium text-gray-900">Synchronized Navigation:</span> Selecting a feature automatically jumps the browser view to a +/-2 kb window around the target locus.</li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-gray-900">4. Data &amp; Storage</h3>
            <ul className="space-y-2">
              <li><span className="font-medium text-gray-900">Metadata &amp; Tables:</span> Structured datasets are served via cloud databases with secure read access.</li>
              <li><span className="font-medium text-gray-900">Genomic Files:</span> Large tracks (FASTA, BAM, VCF, GFF3) are hosted via object storage with range-request acceleration for fast streaming.</li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              For local validation or reproducible setup, download <span className="font-medium text-gray-700">seqedge-test-data.zip</span> from the repository Releases page, upload the extracted files to your object storage, and point the deployment to those real files.
            </p>
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
