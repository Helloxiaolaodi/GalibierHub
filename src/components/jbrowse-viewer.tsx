'use client';

import { useEffect, useRef } from 'react';
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view';
import PluginLinearGenomeView from '@jbrowse/plugin-linear-genome-view';
import { SiteConfig } from '@/site-config';
import { getStorageUrl } from '@/lib/storage';

interface DemoTrackAdapter {
  type: string;
  gffGzLocation?: string;
  bamLocation?: string;
  bigBedLocation?: string;
  index?: {
    location: string;
    indexType: string;
  };
}

interface DemoTrack {
  trackId: string;
  name: string;
  type: string;
  adapter: DemoTrackAdapter;
  displays?: ReadonlyArray<{ displayId: string; type: string }>;
}

interface JBrowseViewerProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
  dataBase: string;
  tracks: DemoTrack[];
}

export default function JBrowseViewer({ locus, dataBase, tracks }: JBrowseViewerProps) {
  const assemblyName = SiteConfig.jbrowse.defaultAssembly;
  const demoData = SiteConfig.jbrowse.demoData;
  const url = (path: string) => getStorageUrl(path, dataBase);
  const lastNavLocus = useRef<string | null>(null);

  const viewState = createViewState({
    assembly: {
      name: assemblyName,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${assemblyName}-sequence`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: url(demoData.fasta) },
          faiLocation: { uri: url(demoData.fastaIndex) },
        },
      },
    },
    tracks: tracks.map((track) => {
      const adapter: Record<string, unknown> = { type: track.adapter.type };

      if (track.adapter.gffGzLocation) {
        adapter.gffGzLocation = { uri: url(track.adapter.gffGzLocation) };
      }
      if (track.adapter.bamLocation) {
        adapter.bamLocation = { uri: url(track.adapter.bamLocation) };
      }
      if (track.adapter.bigBedLocation) {
        adapter.bigBedLocation = { uri: url(track.adapter.bigBedLocation) };
      }
      if (track.adapter.index) {
        adapter.index = {
          location: { uri: url(track.adapter.index.location) },
          indexType: track.adapter.index.indexType,
        };
      }

      return {
        trackId: track.trackId,
        name: track.name,
        assemblyNames: [assemblyName],
        type: track.type,
        adapter,
        ...(track.displays ? { displays: [...track.displays] } : {}),
      };
    }),
    location: locus || SiteConfig.jbrowse.defaultLocus,
    plugins: [PluginLinearGenomeView],
  });

  useEffect(() => {
    if (locus && locus !== lastNavLocus.current) {
      try {
        viewState.session.view.navToLocString(locus);
        lastNavLocus.current = locus;
      } catch {
      }
    }
  }, [viewState, locus]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <JBrowseLinearGenomeView viewState={viewState} />
    </div>
  );
}
