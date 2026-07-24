'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view';
import PluginLinearGenomeView from '@jbrowse/plugin-linear-genome-view';
import { onSnapshot } from 'mobx-state-tree';
import { SiteConfig } from '@/site-config';
import { getStorageUrl } from '@/lib/storage';

export interface DemoTrackAdapter {
  type: string;
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

export interface DemoTrack {
  trackId: string;
  name: string;
  type: string;
  adapter: DemoTrackAdapter;
  displays?: ReadonlyArray<{ displayId: string; type: string }>;
}

export interface AssemblyData {
  defaultLocus: string;
  fasta: string;
  fastaIndex: string;
  tracks: ReadonlyArray<DemoTrack>;
}

interface JBrowseViewerProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
  highlightRegion?: {
    refName: string;
    start: number;
    end: number;
    name?: string;
  } | null;
  dataBase: string;
  assemblyName: string;
  assemblyData: AssemblyData;
  tracks: DemoTrack[];
}

function formatDisplayedRegionLocus(view: {
  displayedRegions?: Array<{
    refName: string;
    start: number;
    end: number;
  }>;
}) {
  const region = view.displayedRegions?.[0];
  if (!region) {
    return null;
  }

  return `${region.refName}:${Math.max(1, Math.floor(region.start) + 1)}-${Math.max(Math.floor(region.end), Math.floor(region.start) + 1)}`;
}

export default function JBrowseViewer({ locus, onLocusChange, highlightRegion, dataBase, assemblyName, assemblyData, tracks }: JBrowseViewerProps) {
  const buildUrl = useMemo(
    () => (path: string) => getStorageUrl(path, dataBase, { preferProxy: false }),
    [dataBase],
  );
  const lastNavLocus = useRef<string | null>(null);
  const lastReportedLocus = useRef<string | null>(null);
  const initialLocusRef = useRef(locus || assemblyData.defaultLocus || SiteConfig.jbrowse.defaultLocus);
  const defaultSession = useMemo(() => {
    const defaultTracks = tracks.slice(0, 1).map((track) => ({
      type: track.type,
      configuration: track.trackId,
      displays: (track.displays || []).map((display) => ({
        type: display.type,
        configuration: display.displayId,
      })),
    }));

    return {
      name: `${assemblyName} session`,
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'ReferenceSequenceTrack',
            configuration: `${assemblyName}-sequence`,
            displays: [
              {
                type: 'LinearReferenceSequenceDisplay',
                configuration: `${assemblyName}-sequence-LinearReferenceSequenceDisplay`,
              },
            ],
          },
          ...defaultTracks,
        ],
      },
    };
  }, [assemblyName, tracks]);

  const viewState = useMemo(
    () =>
      createViewState({
        assembly: {
          name: assemblyName,
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: `${assemblyName}-sequence`,
            adapter: {
              type: 'IndexedFastaAdapter',
              fastaLocation: { uri: buildUrl(assemblyData.fasta) },
              faiLocation: { uri: buildUrl(assemblyData.fastaIndex) },
            },
          },
        },
        tracks: tracks.map((track) => {
          const adapterConfig = track.adapter as DemoTrackAdapter;
          const adapter: Record<string, unknown> = { type: adapterConfig.type };

          if (adapterConfig.gffGzLocation) {
            adapter.gffGzLocation = { uri: buildUrl(adapterConfig.gffGzLocation) };
          }
          if (adapterConfig.bamLocation) {
            adapter.bamLocation = { uri: buildUrl(adapterConfig.bamLocation) };
          }
          if (adapterConfig.bigBedLocation) {
            adapter.bigBedLocation = { uri: buildUrl(adapterConfig.bigBedLocation) };
          }
          if (adapterConfig.bedLocation) {
            adapter.bedLocation = { uri: buildUrl(adapterConfig.bedLocation) };
          }
          if (adapterConfig.gffLocation) {
            adapter.gffLocation = { uri: buildUrl(adapterConfig.gffLocation) };
          }
          if (adapterConfig.index) {
            adapter.index = {
              location: { uri: buildUrl(adapterConfig.index.location) },
              indexType: adapterConfig.index.indexType,
            };
          }

          return {
            trackId: track.trackId,
            name: track.name,
            assemblyNames: [assemblyName],
            type: track.type,
            adapter,
            ...('displays' in track && track.displays ? { displays: [...track.displays] } : {}),
          };
        }),
        location: initialLocusRef.current,
        defaultSession,
        plugins: [PluginLinearGenomeView],
      }),
    [assemblyData, assemblyName, buildUrl, defaultSession, tracks],
  );

  useEffect(() => {
    if (locus && locus !== lastNavLocus.current) {
      try {
        viewState.session.view.navToLocString(locus);
        lastNavLocus.current = locus;
      } catch {
      }
    }
  }, [locus, viewState]);

  useEffect(() => {
    const view = viewState.session.view;
    const locusFromView = formatDisplayedRegionLocus(view);
    if (locusFromView) {
      lastReportedLocus.current = locusFromView;
    }

    const disposer = onSnapshot(view, () => {
      if (!onLocusChange) {
        return;
      }

      const nextLocus = formatDisplayedRegionLocus(view);
      if (!nextLocus || nextLocus === lastReportedLocus.current || nextLocus === lastNavLocus.current) {
        return;
      }

      lastReportedLocus.current = nextLocus;
      lastNavLocus.current = nextLocus;
      onLocusChange(nextLocus);
    });

    return () => {
      disposer();
    };
  }, [onLocusChange, viewState]);

  useEffect(() => {
    const view = viewState.session.view;
    if (!highlightRegion) {
      view.setHighlight([]);
      return;
    }

    view.setHighlight([
      {
        refName: highlightRegion.refName,
        start: Math.max(0, highlightRegion.start),
        end: Math.max(highlightRegion.end, highlightRegion.start + 1),
        assemblyName,
        name: highlightRegion.name,
      },
    ]);
  }, [assemblyName, highlightRegion, viewState]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <JBrowseLinearGenomeView viewState={viewState} />
    </div>
  );
}
