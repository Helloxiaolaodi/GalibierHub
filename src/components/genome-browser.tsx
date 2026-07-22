'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';

interface GenomeBrowserProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

type Probe = 'idle' | 'checking' | 'ready' | 'missing-data';
type DemoTrack = (typeof SiteConfig.jbrowse.demoData.tracks)[number];
type AdapterWithFiles = {
  gffGzLocation?: string;
  bamLocation?: string;
  bigBedLocation?: string;
  index?: {
    location: string;
    indexType: string;
  };
};

const PUBLIC_JBROWSE_DEMO_BASE = 'https://jbrowse.org/code/jb2/main/demos/volvox';

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

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return res.ok;
  } catch {
    return false;
  }
}

function getTrackRequiredUrls(track: DemoTrack): string[] {
  const adapter = track.adapter as AdapterWithFiles;
  return [
    adapter.gffGzLocation,
    adapter.bamLocation,
    adapter.bigBedLocation,
    adapter.index?.location,
  ].filter((value): value is string => Boolean(value));
}

async function getReachableTracks(baseUrl: string): Promise<DemoTrack[]> {
  const checks = await Promise.all(
    SiteConfig.jbrowse.demoData.tracks.map(async (track) => {
      const requiredUrls = getTrackRequiredUrls(track);
      const results = await Promise.all(requiredUrls.map((path) => isReachable(`${baseUrl}/${path}`)));
      return results.every(Boolean) ? track : null;
    }),
  );

  return checks.filter((track): track is DemoTrack => track !== null);
}

export default function GenomeBrowser({ locus, onLocusChange }: GenomeBrowserProps) {
  const configuredBase = SiteConfig.jbrowse.storageBaseUrl;
  const demoBase = SiteConfig.jbrowse.demoBaseUrl;
  const [probe, setProbe] = useState<Probe>('idle');
  const [dataBase, setDataBase] = useState(configuredBase || demoBase);
  const [usingDemo, setUsingDemo] = useState(!configuredBase);
  const [availableTracks, setAvailableTracks] = useState<DemoTrack[]>([]);

  const missingTrackNames = useMemo(() => {
    const available = new Set(availableTracks.map((track) => track.trackId));
    return SiteConfig.jbrowse.demoData.tracks
      .filter((track) => !available.has(track.trackId))
      .map((track) => track.name);
  }, [availableTracks]);

  useEffect(() => {
    let cancelled = false;
    setProbe('checking');

    (async () => {
      const candidateBases = [configuredBase, demoBase, PUBLIC_JBROWSE_DEMO_BASE].filter(
        (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
      );

      for (const base of candidateBases) {
        if (!(await isReachable(`${base}/${SiteConfig.jbrowse.demoData.fastaIndex}`))) {
          continue;
        }

        const tracks = await getReachableTracks(base);
        if (cancelled) return;

        setDataBase(base);
        setUsingDemo(base !== configuredBase);
        setAvailableTracks(tracks);
        setProbe('ready');
        return;
      }

      if (!cancelled) {
        setDataBase(configuredBase || demoBase);
        setUsingDemo(!configuredBase);
        setAvailableTracks([]);
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
          Verifying reference files and optional tracks...
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
            <code className="bg-gray-100 px-1 rounded break-all">{dataBase}/{SiteConfig.jbrowse.demoData.fastaIndex}</code>.
          </p>
          <p className="text-sm text-gray-500">
            The configured storage base and the public demo fallbacks all failed to respond. This is usually a network block or a missing CORS header rather than a missing file.
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
          Showing the public JBrowse <span className="font-semibold">demo</span> dataset.
          {configuredBase
            ? ' Your configured storage was unavailable or incomplete, so public demo data is shown as a fallback.'
            : ' Set NEXT_PUBLIC_STORAGE_BASE_URL to your own object storage to load your genome tracks.'}
        </div>
      )}
      {missingTrackNames.length > 0 && (
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
          Optional tracks hidden because required files were not reachable: {missingTrackNames.join(', ')}.
        </div>
      )}
      <JBrowseViewer locus={locus} onLocusChange={onLocusChange} dataBase={dataBase} tracks={availableTracks} />
    </div>
  );
}
