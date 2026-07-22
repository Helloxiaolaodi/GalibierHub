'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view';
import PluginLinearGenomeView from '@jbrowse/plugin-linear-genome-view';
import { SiteConfig } from '@/site-config';
import { getStorageUrl } from '@/lib/storage';

type AssemblyData = (typeof SiteConfig.jbrowse.assemblies)[keyof typeof SiteConfig.jbrowse.assemblies];
type DemoTrack = AssemblyData['tracks'][number];

interface DemoTrackAdapter {
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

interface JBrowseViewerProps {
  locus?: string;
  dataBase: string;
  assemblyName: string;
  assemblyData: AssemblyData;
  tracks: DemoTrack[];
}

export default function JBrowseViewer({ locus, dataBase, assemblyName, assemblyData, tracks }: JBrowseViewerProps) {
  const buildUrl = useMemo(() => (path: string) => getStorageUrl(path, dataBase), [dataBase]);
  const lastNavLocus = useRef<string | null>(null);

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
        location: locus || assemblyData.defaultLocus || SiteConfig.jbrowse.defaultLocus,
        plugins: [PluginLinearGenomeView],
      }),
    [assemblyData, assemblyName, buildUrl, locus, tracks],
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

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <JBrowseLinearGenomeView viewState={viewState} />
    </div>
  );
}