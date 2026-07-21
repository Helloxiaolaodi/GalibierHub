'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';

interface GenomeBrowserProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

// Dynamic import — JBrowse requires browser APIs (window, document) and must not render on the server
const JBrowseLinearGenomeView = dynamic(
  () => import('@jbrowse/react-linear-genome-view').then((mod) => mod.JBrowseLinearGenomeView),
  { ssr: false, loading: () => <JBrowseLoading /> }
);

function JBrowseLoading() {
  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
        Genome Browser — Loading...
      </div>
      <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
        Initializing JBrowse 2 genome browser...
      </div>
    </div>
  );
}

export default function GenomeBrowser({ locus, onLocusChange }: GenomeBrowserProps) {
  const [error, setError] = useState<string | null>(null);

  // Build the R2 base URL from env
  const r2Base = SiteConfig.jbrowse.storageBaseUrl;
  const isConfigured = r2Base && r2Base !== 'https://your-r2-bucket.r2.dev';

  // Track which locus we displayed last to avoid redundant navTo calls
  const lastNavLocus = useRef<string | null>(null);
  const viewStateRef = useRef<ReturnType<typeof createViewState> | null>(null);

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

  const assemblyName = SiteConfig.jbrowse.defaultAssembly;
  const baseUrl = r2Base.endsWith('/') ? r2Base : r2Base;

  // We create the view state inside the component render for dynamic import compatibility
  const createViewState = require('@jbrowse/react-linear-genome-view').createViewState;

  try {
    const viewState = viewStateRef.current ??= createViewState({
      assembly: {
        name: assemblyName,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${assemblyName}-sequence`,
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: { uri: `${baseUrl}/test-data/volvox.fa` },
            faiLocation: { uri: `${baseUrl}/test-data/volvox.fa.fai` },
          },
        },
      },
      tracks: [
        {
          trackId: 'volvox-genes',
          name: 'Gene Annotations',
          assemblyNames: [assemblyName],
          type: 'FeatureTrack',
          adapter: {
            type: 'Gff3Adapter',
            gffLocation: { uri: `${baseUrl}/test-data/volvox.gff3` },
          },
          displays: [
            { displayId: 'volvox-genes-LinearBasicDisplay', type: 'LinearBasicDisplay' },
          ],
        },
        {
          trackId: 'volvox-beds',
          name: 'BED Annotations',
          assemblyNames: [assemblyName],
          type: 'FeatureTrack',
          adapter: {
            type: 'BedTabixAdapter',
            bedGzLocation: { uri: `${baseUrl}/test-data/volvox-bed12.bed.gz` },
            index: { location: { uri: `${baseUrl}/test-data/volvox-bed12.bed.gz.tbi` }, indexType: 'TBI' },
          },
          displays: [
            { displayId: 'volvox-beds-LinearBasicDisplay', type: 'LinearBasicDisplay' },
          ],
        },
        {
          trackId: 'volvox-alignments',
          name: 'Read Alignments',
          assemblyNames: [assemblyName],
          type: 'AlignmentsTrack',
          adapter: {
            type: 'BamAdapter',
            bamLocation: { uri: `${baseUrl}/test-data/volvox-sorted.bam` },
            index: { location: { uri: `${baseUrl}/test-data/volvox-sorted.bam.bai` }, indexType: 'BAI' },
          },
        },
        {
          trackId: 'volvox-bigbed',
          name: 'BigBed Annotations',
          assemblyNames: [assemblyName],
          type: 'FeatureTrack',
          adapter: {
            type: 'BigBedAdapter',
            bigBedLocation: { uri: `${baseUrl}/test-data/volvox.bb` },
          },
          displays: [
            { displayId: 'volvox-bigbed-LinearBasicDisplay', type: 'LinearBasicDisplay' },
          ],
        },
      ],
      location: locus || SiteConfig.jbrowse.defaultLocus,
      plugins: [require('@jbrowse/plugin-linear-genome-view')],
    });

    // Navigate when locus prop changes
    if (locus && locus !== lastNavLocus.current) {
      try {
        viewState.session.view.navToLocString(locus);
        lastNavLocus.current = locus;
      } catch {
        // Invalid locus for this assembly — ignore
      }
    }

    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <JBrowseLinearGenomeView viewState={viewState} />
      </div>
    );
  } catch (err) {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-red-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser — Error
        </div>
        <div className="p-4 text-red-700 text-sm">{err instanceof Error ? err.message : 'Failed to initialize genome browser'}</div>
      </div>
    );
  }
}