'use client';

interface UserGuideProps {
  open: boolean;
  onClose: () => void;
}

export default function UserGuide({ open, onClose }: UserGuideProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/30"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">SeqEdge — User Guide</h2>
          <button
            onClick={onClose}
            aria-label="Close user guide"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 text-sm text-gray-700 leading-relaxed">
          <section>
            <h3 className="font-semibold text-gray-900 mb-1">1. Overview tab</h3>
            <p>
              Summary cards report the live counts of samples, predicted promoters and
              variants fetched from Supabase. The two ECharts panels below plot the
              species distribution and the promoter prediction-score histogram; each panel
              has a <code className="px-1 rounded bg-gray-100">PNG</code> and{' '}
              <code className="px-1 rounded bg-gray-100">SVG</code> button in its top-right
              corner for one-click publication-ready export.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1">2. Promoters tab</h3>
            <p>
              Combine the top filter bar (chromosome, position range, gene symbol,
              minimum score, species, sample ID) with the paginated, sortable table to
              slice the promoter catalogue. Click any row to open the detail card with the
              colour-coded sequence, copy-as-BED and copy-as-FASTA helpers.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1">3. Genome Browser tab</h3>
            <p>
              JBrowse 2 renders the reference sequence and annotation tracks served from
              your Cloudflare R2 bucket. Selecting a promoter row navigates the browser to
              a ±2 kb window around that locus. If the reference files are missing, the
              panel switches to a setup hint and points to the compression guide.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1">4. Data & storage</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Tabular data (samples, promoters, variants) lives in Supabase — the
                anonymous key is public and scoped by Row-Level Security.
              </li>
              <li>
                Genome-scale artefacts (FASTA, CRAM, BigBed, tabixed VCF/BED, BigWig)
                live in Cloudflare R2 under <code className="px-1 rounded bg-gray-100">test-data/</code>.
              </li>
              <li>
                See <code className="px-1 rounded bg-gray-100">docs/data-compression-guide.md</code>{' '}
                for the recommended format upgrades before you upload.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1">5. Exporting figures</h3>
            <p>
              PNG exports are rendered at 2× device-pixel ratio with an opaque white
              background. SVG exports spin up a hidden SVG-renderer instance so the
              vector output is print-ready without disturbing the on-screen canvas.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-900 mb-1">6. Deployment</h3>
            <p>
              SeqEdge ships as an open-source template. Configure{' '}
              <code className="px-1 rounded bg-gray-100">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
              <code className="px-1 rounded bg-gray-100">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{' '}
              <code className="px-1 rounded bg-gray-100">NEXT_PUBLIC_R2_PUBLIC_URL</code> as
              Cloudflare Pages environment variables (never commit them to the repo), then
              trigger a new build.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
