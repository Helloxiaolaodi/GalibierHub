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
  const r2Base = SiteConfig.jbrowse.storageBaseUrl;
  const isConfigured = r2Base && r2Base !== 'https://your-r2-bucket.r2.dev';
  const [probe, setProbe] = useState<Probe>('idle');

  // Preflight: confirm the reference sequence index exists in the R2 bucket
  // before mounting JBrowse, otherwise the browser throws "Failed to fetch".
  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    setProbe('checking');
    fetch(`${r2Base}/test-data/volvox.fa.fai`, { method: 'HEAD' })
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
  }, [isConfigured, r2Base]);

  if (!isConfigured) {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser — Setup Required
        </div>
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            Connect your Cloudflare R2 bucket to enable the interactive genome browser.
          </p>
          <ol className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-2">
            <li>1. Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_R2_PUBLIC_URL</code> as a Secret in your hosting provider (e.g. Cloudflare Pages → Settings → Environment variables) or in your local <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
            <li>2. Upload genome files (FASTA + <code className="bg-gray-100 px-1 rounded">.fai</code>, BAM/CRAM + index, BigBed/BigWig, bgzipped VCF/BED + <code className="bg-gray-100 px-1 rounded">.tbi</code>) to your R2 bucket, keeping the paths referenced in <code className="bg-gray-100 px-1 rounded">jbrowse-viewer.tsx</code></li>
            <li>3. Restart the dev server, or trigger a new Cloudflare Pages deployment so the build injects the updated <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_*</code> values</li>
          </ol>
        </div>
      </div>
    );
  }

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
          Genome Browser — Reference data not uploaded yet
        </div>
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            R2 is configured, but the reference files under <code className="bg-gray-100 px-1 rounded">test-data/</code> were not found.
          </p>
          <p className="text-sm text-gray-500">
            Upload a compact demo track set (bgzipped FASTA + <code className="bg-gray-100 px-1 rounded">.fai</code>/<code className="bg-gray-100 px-1 rounded">.gzi</code>, CRAM + index, BigBed, tabixed VCF) to your R2 bucket, then reload this page.
          </p>
          <p className="text-xs text-gray-400">
            See <code className="bg-gray-100 px-1 rounded">docs/data-compression-guide.md</code> for the recommended formats.
          </p>
        </div>
      </div>
    );
  }

  return <JBrowseViewer locus={locus} onLocusChange={onLocusChange} />;
}