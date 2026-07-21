'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function GenomeBrowser({ locus, onLocusChange }: GenomeBrowserProps) {
  const r2Base = SiteConfig.jbrowse.storageBaseUrl;
  const isConfigured = r2Base && r2Base !== 'https://your-r2-bucket.r2.dev';

  // Not configured — show setup instructions
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
            <li>1. Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_R2_PUBLIC_URL</code> in your <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
            <li>2. Upload genome files (FASTA + index, tracks) to your R2 bucket</li>
            <li>3. Restart the dev server or redeploy on Vercel</li>
          </ol>
        </div>
      </div>
    );
  }

  return <JBrowseViewer locus={locus} onLocusChange={onLocusChange} />;
}