'use client';

import { useEffect, useRef } from 'react';
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view';
import PluginLinearGenomeView from '@jbrowse/plugin-linear-genome-view';
import { SiteConfig } from '@/site-config';

interface JBrowseViewerProps {
  locus?: string;
  onLocusChange?: (locus: string) => void;
  // Base URL for the track files (user R2 or the public JBrowse demo bucket).
  dataBase: string;
}

export default function JBrowseViewer({ locus, dataBase }: JBrowseViewerProps) {
  const assemblyName = SiteConfig.jbrowse.defaultAssembly;
  const baseUrl = dataBase.replace(/\/$/, '');
  const lastNavLocus = useRef<string | null>(null);

  const viewState = createViewState({
    assembly: {
      name: assemblyName,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${assemblyName}-sequence`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: `${baseUrl}/volvox.fa` },
          faiLocation: { uri: `${baseUrl}/volvox.fa.fai` },
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
          type: 'Gff3TabixAdapter',
          gffGzLocation: { uri: `${baseUrl}/volvox.sort.gff3.gz` },
          index: { location: { uri: `${baseUrl}/volvox.sort.gff3.gz.tbi` }, indexType: 'TBI' },
        },
        displays: [
          { displayId: 'volvox-genes-LinearBasicDisplay', type: 'LinearBasicDisplay' },
        ],
      },
      {
        trackId: 'volvox-variants',
        name: 'Variants (VCF)',
        assemblyNames: [assemblyName],
        type: 'VariantTrack',
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: { uri: `${baseUrl}/volvox.filtered.vcf.gz` },
          index: { location: { uri: `${baseUrl}/volvox.filtered.vcf.gz.tbi` }, indexType: 'TBI' },
        },
      },
      {
        trackId: 'volvox-alignments',
        name: 'Read Alignments',
        assemblyNames: [assemblyName],
        type: 'AlignmentsTrack',
        adapter: {
          type: 'BamAdapter',
          bamLocation: { uri: `${baseUrl}/volvox-sorted.bam` },
          index: { location: { uri: `${baseUrl}/volvox-sorted.bam.bai` }, indexType: 'BAI' },
        },
      },
      {
        trackId: 'volvox-bigbed',
        name: 'BigBed Annotations',
        assemblyNames: [assemblyName],
        type: 'FeatureTrack',
        adapter: {
          type: 'BigBedAdapter',
          bigBedLocation: { uri: `${baseUrl}/volvox.bb` },
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