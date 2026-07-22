'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';

interface GenomeBrowserProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

// Lazy-load the JBrowse viewer — it requires browser APIs and must not SSR
const JBrowseViewer = dynamic(() => import('./jbrowse-viewer'), {
  ssr: false,
  loading: () => (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
        Genome Browser — Loading...
      </div>
      <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
        Initializing JBrowse 2 genome browser...
      </div>
    </div>
  ),
});

type Probe = 'idle' | 'checking' | 'ready' | 'missing-data';

export default function GenomeBrowser({ locus, onLocusChange }: GenomeBrowserProps) {
  // Prefer the user's own object storage; fall back to the public JBrowse demo
  // data so the browser renders working tracks out-of-the-box on a fresh fork.
  const r2Base = SiteConfig.jbrowse.storageBaseUrl;
  const usingDemo = !r2Base;
  const dataBase = r2Base || SiteConfig.jbrowse.demoBaseUrl;
  const [probe, setProbe] = useState<Probe>('idle');

  // Preflight: confirm the reference sequence index is reachable before mounting
  // JBrowse, otherwise the browser throws an opaque "Failed to fetch".
  useEffect(() => {
    let cancelled = false;
    setProbe('checking');
    fetch(`${dataBase}/volvox.fa.fai`, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        setProbe(res.ok ? 'ready' : 'missing-data');
      })
      .catch(() => {
        if (!cancelled) setProbe('missing-data');
      });
    return () => {
      cancelled = true;
    };
  }, [dataBase]);

  if (probe === 'checking' || probe === 'idle') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser — Checking data availability...
        </div>
        <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
          Verifying reference files in R2...
        </div>
      </div>
    );
  }

  if (probe === 'missing-data') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser — Reference data unreachable
        </div>
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            The reference sequence index could not be reached at{' '}
            <code className="bg-gray-100 px-1 rounded break-all">{dataBase}/volvox.fa.fai</code>.
          </p>
          {usingDemo ? (
            <p className="text-sm text-gray-500">
              The public JBrowse demo dataset may be temporarily offline, or your
              network is blocking the request. Try reloading, or set{' '}
              <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_R2_PUBLIC_URL</code>{' '}
              to your own object storage.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_R2_PUBLIC_URL</code>{' '}
                is set, but the reference files were not found under that bucket.
                Upload a compact track set (bgzipped FASTA +{' '}
                <code className="bg-gray-100 px-1 rounded">.fai</code>/<code className="bg-gray-100 px-1 rounded">.gzi</code>,
                CRAM + index, BigBed, tabixed VCF), then reload this page.
              </p>
              <p className="text-xs text-gray-400">
                See <code className="bg-gray-100 px-1 rounded">docs/data-compression-guide.md</code> for the recommended formats.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {usingDemo && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          Showing the public JBrowse <span className="font-semibold">volvox</span> demo dataset.
          Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_R2_PUBLIC_URL</code> to your own
          object storage to load your genome tracks.
        </div>
      )}
      <JBrowseViewer locus={locus} onLocusChange={onLocusChange} dataBase={dataBase} />
    </div>
  );
}