'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';

interface GenomeBrowserProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

type Probe = 'idle' | 'checking' | 'ready' | 'missing-data';
type AssemblyName = keyof typeof SiteConfig.jbrowse.assemblies;
type DemoTrack = (typeof SiteConfig.jbrowse.assemblies)[AssemblyName]['tracks'][number];

interface AdapterWithFiles {
  gffGzLocation?: string;
  bamLocation?: string;
  bigBedLocation?: string;
  bedLocation?: string;
  gffLocation?: string;
  index?: {
    location: string;
    indexType: string;
  };
}

const PUBLIC_JBROWSE_DEMO_BASE = 'https://jbrowse.org/code/jb2/main/demos/volvox';

const JBrowseViewer = dynamic(() => import('./jbrowse-viewer'), {
  ssr: false,
  loading: () => (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
        Genome Browser - Loading...
      </div>
      <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
        Initializing JBrowse 2 genome browser...
      </div>
    </div>
  ),
});

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    return response.ok;
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
    adapter.bedLocation,
    adapter.gffLocation,
    adapter.index?.location,
  ].filter((value): value is string => Boolean(value));
}

async function getReachableTracks(baseUrl: string, tracks: readonly DemoTrack[]): Promise<DemoTrack[]> {
  const checks = await Promise.all(
    tracks.map(async (track) => {
      const requiredUrls = getTrackRequiredUrls(track);
      const results = await Promise.all(
        requiredUrls.map((relativePath) => isReachable(`${baseUrl}/${relativePath}`)),
      );
      return results.every(Boolean) ? track : null;
    }),
  );

  return checks.filter((track): track is DemoTrack => track !== null);
}

export default function GenomeBrowser({ locus }: GenomeBrowserProps) {
  const configuredBase = SiteConfig.jbrowse.storageBaseUrl;
  const demoBase = SiteConfig.jbrowse.demoBaseUrl;
  const assemblies = SiteConfig.jbrowse.assemblies;
  const defaultAssembly = SiteConfig.jbrowse.defaultAssembly;

  const assemblyNames = useMemo<AssemblyName[]>(() => {
    const keys = Object.keys(assemblies) as AssemblyName[];
    const rest = keys.filter((key) => key !== defaultAssembly);
    return [defaultAssembly, ...rest];
  }, [assemblies, defaultAssembly]);

  const [probe, setProbe] = useState<Probe>('idle');
  const [dataBase, setDataBase] = useState(configuredBase || demoBase);
  const [usingDemo, setUsingDemo] = useState(!configuredBase);
  const [resolvedAssembly, setResolvedAssembly] = useState<AssemblyName>(defaultAssembly);
  const [availableTracks, setAvailableTracks] = useState<DemoTrack[]>([]);

  const assemblyData = assemblies[resolvedAssembly];
  const allConfiguredTracks = useMemo(() => assemblyData.tracks, [assemblyData]);

  const missingTrackNames = useMemo(() => {
    const available = new Set(availableTracks.map((track) => track.trackId));
    return allConfiguredTracks
      .filter((track) => !available.has(track.trackId))
      .map((track) => track.name);
  }, [allConfiguredTracks, availableTracks]);

  useEffect(() => {
    let cancelled = false;
    setProbe('checking');

    (async () => {
      const candidateBases = [configuredBase, demoBase, PUBLIC_JBROWSE_DEMO_BASE].filter(
        (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
      );

      for (const name of assemblyNames) {
        const assembly = assemblies[name];

        for (const base of candidateBases) {
          const fastaIndexUrl = `${base}/${assembly.fastaIndex}`;
          if (!(await isReachable(fastaIndexUrl))) {
            continue;
          }

          const tracks = await getReachableTracks(base, assembly.tracks);
          if (cancelled) {
            return;
          }

          setDataBase(base);
          setUsingDemo(base !== configuredBase);
          setResolvedAssembly(name);
          setAvailableTracks(tracks);
          setProbe('ready');
          return;
        }
      }

      if (!cancelled) {
        setDataBase(configuredBase || demoBase);
        setUsingDemo(!configuredBase);
        setResolvedAssembly(defaultAssembly);
        setAvailableTracks([]);
        setProbe('missing-data');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assemblies, assemblyNames, configuredBase, defaultAssembly, demoBase]);

  if (probe === 'checking' || probe === 'idle') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser - Checking data availability...
        </div>
        <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
          Probing {assemblyNames.length} assembly(s) across available storage bases...
        </div>
      </div>
    );
  }

  if (probe === 'missing-data') {
    const firstFai = assemblies[defaultAssembly].fastaIndex;
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
          Genome Browser - Reference data unreachable
        </div>
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            The reference sequence index could not be reached at{' '}
            <code className="bg-gray-100 px-1 rounded break-all">{dataBase}/{firstFai}</code>.
          </p>
          <p className="text-sm text-gray-500">
            Both your configured storage and the public JBrowse demo dataset failed to respond.
            This is usually a network block or a missing CORS header rather than a missing file.
            Try reloading, or point NEXT_PUBLIC_STORAGE_BASE_URL at a CORS-enabled object store
            (Cloudflare R2, Hugging Face Datasets, S3, ...).
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
          Showing{' '}
          {resolvedAssembly !== defaultAssembly ? (
            <span>
              assembly <span className="font-semibold">{resolvedAssembly}</span> from the fallback dataset
            </span>
          ) : (
            <span>
              the public JBrowse <span className="font-semibold">demo</span> dataset
            </span>
          )}
          .
          {configuredBase
            ? ' Your configured storage was unavailable or incomplete, so a fallback data source is shown.'
            : ' Set NEXT_PUBLIC_STORAGE_BASE_URL to your own object storage to load your genome tracks.'}
        </div>
      )}
      {missingTrackNames.length > 0 && (
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
          Optional tracks hidden because required files were not reachable: {missingTrackNames.join(', ')}.
        </div>
      )}
      <JBrowseViewer
        locus={locus}
        dataBase={dataBase}
        assemblyName={resolvedAssembly}
        assemblyData={assemblyData}
        tracks={availableTracks}
      />
    </div>
  );
}