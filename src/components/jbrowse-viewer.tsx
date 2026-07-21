'use client';

import { useEffect, useRef } from 'react';
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view';
import PluginLinearGenomeView from '@jbrowse/plugin-linear-genome-view';
import { SiteConfig } from '@/site-config';

interface JBrowseViewerProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

export default function JBrowseViewer({ locus }: JBrowseViewerProps) {
  const r2Base = SiteConfig.jbrowse.storageBaseUrl;
  const assemblyName = SiteConfig.jbrowse.defaultAssembly;
  const baseUrl = r2Base.endsWith('/') ? r2Base : r2Base;
  const lastNavLocus = useRef<string | null>(null);

  const viewState = createViewState({
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
    plugins: [PluginLinearGenomeView],
  });

  // Navigate when locus prop changes
  useEffect(() => {
    if (locus && locus !== lastNavLocus.current) {
      try {
        viewState.session.view.navToLocString(locus);
        lastNavLocus.current = locus;
      } catch {
        // Invalid locus for this assembly — ignore
      }
    }
  }, [viewState, locus]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <JBrowseLinearGenomeView viewState={viewState} />
    </div>
  );
}