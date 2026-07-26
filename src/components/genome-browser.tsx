'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SiteConfig } from '@/site-config';
import { getCandidateStorageBaseUrls, getStorageAccessMode, getStorageUrl } from '@/lib/storage';
import type { AssemblyData, DemoTrack, DemoTrackAdapter } from './jbrowse-viewer';

interface GenomeBrowserProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
  highlightRegion?: {
    refName: string;
    start: number;
    end: number;
    name?: string;
  } | null;
}

type Probe = 'idle' | 'checking' | 'ready' | 'missing-data';
type AssemblyConfig = AssemblyData;
type AdapterWithFiles = DemoTrackAdapter;

const JBrowseViewer = dynamic(() => import('./jbrowse-viewer'), {
  ssr: false,
  loading: () => (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white">
        Genome Browser
      </div>
      <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
        Loading genome browser...
      </div>
    </div>
  ),
});

const REACHABILITY_TIMEOUT_MS = 2000;

async function isReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildStorageUrl(baseUrl: string, path: string): string {
  return getStorageUrl(path, baseUrl, { preferProxy: false });
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

async function checkTrackReachable(baseUrl: string, track: DemoTrack): Promise<boolean> {
  const requiredUrls = getTrackRequiredUrls(track);
  if (requiredUrls.length === 0) return true;
  const results = await Promise.all(
    requiredUrls.map((path) => isReachable(buildStorageUrl(baseUrl, path))),
  );
  return results.every(Boolean);
}

export default function GenomeBrowser({ locus, onLocusChange, highlightRegion }: GenomeBrowserProps) {
  const configuredBase = SiteConfig.jbrowse.storageBaseUrl;
  const candidateBases = useMemo(() => getCandidateStorageBaseUrls(configuredBase), [configuredBase]);
  const storageMode = useMemo(() => getStorageAccessMode(configuredBase), [configuredBase]);
  const assemblies = SiteConfig.jbrowse.assemblies as Record<string, AssemblyConfig>;
  const defaultAssembly = SiteConfig.jbrowse.defaultAssembly;

  const assemblyNames = useMemo<string[]>(() => {
    const keys = Object.keys(assemblies);
    const rest = keys.filter((key) => key !== defaultAssembly);
    return [defaultAssembly, ...rest];
  }, [assemblies, defaultAssembly]);

  const [probe, setProbe] = useState<Probe>('idle');
  const [dataBase, setDataBase] = useState(configuredBase);
  const [resolvedAssembly, setResolvedAssembly] = useState<string>(defaultAssembly);
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
    if (!candidateBases || candidateBases.length === 0) {
      setDataBase('');
      setResolvedAssembly(defaultAssembly);
      setAvailableTracks([]);
      setProbe('missing-data');
    }
  }, [defaultAssembly, candidateBases]);

  useEffect(() => {
    let cancelled = false;

    if (!candidateBases || candidateBases.length === 0) {
      setProbe('missing-data');
      return () => {
        cancelled = true;
      };
    }

    setProbe('checking');

    (async () => {
      const probeTasks = assemblyNames.flatMap((name) =>
        candidateBases.map(async (base) => {
          const assembly = assemblies[name];
          const fastaIndexUrl = buildStorageUrl(base, assembly.fastaIndex);
          if (!(await isReachable(fastaIndexUrl))) {
            return null;
          }

          const trackResults = await Promise.all(
            assembly.tracks.map((track) => checkTrackReachable(base, track)),
          );
          const reachableTracks = assembly.tracks.filter((_, idx) => trackResults[idx]);

          if (cancelled) return null;
          return { base, name, tracks: reachableTracks };
        }),
      );

      for (const task of probeTasks) {
        if (cancelled) return;
        const result = await task;
        if (result) {
          setDataBase(result.base);
          setResolvedAssembly(result.name);
          setAvailableTracks(result.tracks);
          setProbe('ready');
          return;
        }
      }

      if (!cancelled) {
        setDataBase(candidateBases[0] || '');
        setResolvedAssembly(defaultAssembly);
        setAvailableTracks([]);
        setProbe('missing-data');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assemblies, assemblyNames, candidateBases, defaultAssembly]);

  if (probe === 'checking' || probe === 'idle') {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white">
          Genome Browser
        </div>
        <div className="p-6 text-center text-gray-400 text-sm animate-pulse">
          Checking reference data across {assemblyNames.length} assemblies and {candidateBases.length} storage locations...
        </div>
      </div>
    );
  }

  if (probe === 'missing-data') {
    const firstFai = assemblies[defaultAssembly].fastaIndex;
    const probeUrl = getStorageUrl(firstFai, candidateBases[0] || configuredBase, { preferProxy: false });
    const accessHint =
      storageMode === 'unset'
        ? 'No genome storage base is configured. Set NEXT_PUBLIC_STORAGE_BASE_URL or NEXT_PUBLIC_R2_PUBLIC_URL to a reachable public storage URL or Hugging Face proxy endpoint.'
        : storageMode === 'hf-proxy'
        ? 'SeqEdge is configured to use a Cloudflare Worker proxy for Hugging Face assets. Confirm NEXT_PUBLIC_HF_PROXY_URL is deployed and that the reference files are reachable.'
        : storageMode === 'hf-direct'
          ? 'SeqEdge is reading reference files from Hugging Face. A deployed NEXT_PUBLIC_HF_PROXY_URL is still recommended for production reliability.'
          : 'SeqEdge is configured to use your storage endpoint directly. Confirm NEXT_PUBLIC_STORAGE_BASE_URL points to a public CORS-enabled object store and that the reference files are reachable.';
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white">
          Genome browser unavailable
        </div>
        <div className="p-6 text-center space-y-3">
          <p className="text-gray-600">
            The reference index could not be reached at{' '}
            <code className="bg-gray-100 px-1 rounded break-all">{probeUrl || '[unset storage base]'}</code>.
          </p>
          <p className="text-sm text-gray-500">
            {accessHint}
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
          Some optional tracks are hidden because required files were unavailable: {missingTrackNames.join(', ')}.
        </div>
      )}
      <JBrowseViewer
        locus={locus}
        onLocusChange={onLocusChange}
        highlightRegion={highlightRegion}
        dataBase={dataBase}
        assemblyName={resolvedAssembly}
        assemblyData={assemblyData}
        tracks={availableTracks}
      />
    </div>
  );
}
