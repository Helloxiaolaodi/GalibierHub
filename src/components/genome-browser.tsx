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

// Range GET is more reliable than HEAD for a reachability probe: it exercises
// the exact code path JBrowse uses (byte-range reads) and correctly follows the
// 302 redirect that Hugging Face / CDN-backed hosts issue for large files, where
// a bare HEAD may be rejected or answered without the redirect.
async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return res.ok; // 200 or 206 both count as reachable
  } catch {
    return false;
  }
}

export default function GenomeBrowser({ locus, onLocusChange }: GenomeBrowserProps) {
  // Prefer the user's own object storage; fall back to the public JBrowse demo
  // data so the browser renders working tracks out-of-the-box on a fresh fork.
  const configuredBase = SiteConfig.jbrowse.storageBaseUrl;
  const demoBase = SiteConfig.jbrowse.demoBaseUrl;
  const [probe, setProbe] = useState<Probe>('idle');
  // The base URL that actually resolved — may differ from configuredBase when we
  // silently fall back to the demo dataset because the configured bucket is empty.
  const [dataBase, setDataBase] = useState(configuredBase || demoBase);
  // True whenever the browser ends up serving the public demo dataset, either
  // because no storage was configured, or the configured bucket had no files.
  const [usingDemo, setUsingDemo] = useState(!configuredBase);

  // Preflight: confirm the reference sequence index is reachable before mounting
  // JBrowse, otherwise the browser throws an opaque "Failed to fetch". If a
  // configured bucket has no reference files, transparently retry the public
  // demo dataset so the template is always usable out-of-the-box.
  useEffect(() => {
    let cancelled = false;
    setProbe('checking');

    (async () => {
      // 1. Try the configured bucket first (if any).
      if (configuredBase && (await isReachable(`${configuredBase}/volvox.fa.fai`))) {
        if (cancelled) return;
        setDataBase(configuredBase);
        setUsingDemo(false);
        setProbe('ready');
        return;
      }
      // 2. Fall back to the public demo dataset.
      if (await isReachable(`${demoBase}/volvox.fa.fai`)) {
        if (cancelled) return;
        setDataBase(demoBase);
        setUsingDemo(true);
        setProbe('ready');
        return;
      }
      // 3. Neither reachable — show the error page.
      if (!cancelled) {
        setDataBase(configuredBase || demoBase);
        setUsingDemo(!configuredBase);
        setProbe('missing-data');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configuredBase, demoBase]);

  if (probe === 'checking' || probe === 'idle') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser — Checking data availability...
        </div>
        <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
          Verifying reference files in object storage...
        </div>
      </div>
    );
  }

  if (probe === 'missing-data') {
    // Reached only when even the public demo dataset is unreachable — almost
    // always a network / CORS block rather than a missing-file problem.
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
          <p className="text-sm text-gray-500">
            Both your configured storage and the public JBrowse demo dataset
            failed to respond. This is usually a network block or a missing CORS
            header rather than a missing file. Try reloading, or point{' '}
            <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_STORAGE_BASE_URL</code>{' '}
            at a CORS-enabled object store (Cloudflare R2, Hugging Face Datasets, S3, …).
          </p>
          <p className="text-xs text-gray-400">
            See <code className="bg-gray-100 px-1 rounded">docs/data-compression-guide.md</code> for the recommended formats.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {usingDemo && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
          Showing the public JBrowse <span className="font-semibold">volvox</span> demo dataset.
          {configuredBase
            ? ' Your configured storage had no reference files yet, so the demo data is shown as a fallback.'
            : ' Set NEXT_PUBLIC_STORAGE_BASE_URL to your own object storage (Cloudflare R2, Hugging Face, S3, …) to load your genome tracks.'}
        </div>
      )}
      <JBrowseViewer locus={locus} onLocusChange={onLocusChange} dataBase={dataBase} />
    </div>
  );
}