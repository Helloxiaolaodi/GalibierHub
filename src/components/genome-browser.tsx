'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';
import { getStorageUrl } from '@/lib/storage';

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

function buildStorageUrl(baseUrl: string, path: string): string {
  return getStorageUrl(path, baseUrl);
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
        requiredUrls.map((path) => isReachable(buildStorageUrl(baseUrl, path))),
      );
      return results.every(Boolean) ? track : null;
    }),
  );

  return checks.filter((track): track is DemoTrack => track !== null);
}

export default function GenomeBrowser({ locus }: GenomeBrowserProps) {
  const configuredBase = SiteConfig.jbrowse.storageBaseUrl;
  const assemblies = SiteConfig.jbrowse.assemblies;
  const defaultAssembly = SiteConfig.jbrowse.defaultAssembly;

  const assemblyNames = useMemo<AssemblyName[]>(() => {
    const keys = Object.keys(assemblies) as AssemblyName[];
    const rest = keys.filter((key) => key !== defaultAssembly);
    return [defaultAssembly, ...rest];
  }, [assemblies, defaultAssembly]);

  const [probe, setProbe] = useState<Probe>('idle');
  const [dataBase, setDataBase] = useState(configuredBase);
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
      const candidateBases = configuredBase ? [configuredBase] : [];

      for (const name of assemblyNames) {
        const assembly = assemblies[name];

        for (const base of candidateBases) {
          const fastaIndexUrl = buildStorageUrl(base, assembly.fastaIndex);
          if (!(await isReachable(fastaIndexUrl))) {
            continue;
          }

          const tracks = await getReachableTracks(base, assembly.tracks);
          if (cancelled) {
            return;
          }

          setDataBase(base);
          setResolvedAssembly(name);
          setAvailableTracks(tracks);
          setProbe('ready');
          return;
        }
      }

      if (!cancelled) {
        setDataBase(configuredBase);
        setResolvedAssembly(defaultAssembly);
        setAvailableTracks([]);
        setProbe('missing-data');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assemblies, assemblyNames, configuredBase, defaultAssembly]);

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
            <code className="bg-gray-100 px-1 rounded break-all">{configuredBase || '[unset storage base]'}/{firstFai}</code>.
          </p>
          <p className="text-sm text-gray-500">
            SeqEdge is configured to use only your real genome storage.
            Set NEXT_PUBLIC_STORAGE_BASE_URL to a CORS-enabled object store and make sure the SARS-CoV-2 reference files are reachable.
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
