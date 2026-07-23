// ============================================================
// Site Configuration - Edit this file to customize your database
// ============================================================
// This is the SINGLE source of truth for all site-wide settings.
// Other users who fork this template only need to edit this file
// (plus .env.local and schema.sql) to create their own database site.

export const SiteConfig = {
  title: 'SeqEdge',
  subtitle: 'A Modern Edge-Native Portal for Genomic Databases',
  creatorCreditPrefix: 'A GitHub open-source project deployed by',
  creatorCreditLabel: '@Helloxiaolaodi',
  creatorCreditUrl: 'https://github.com/Helloxiaolaodi',
  description:
    'Interactive database for browsing predicted promoters, whole genome annotations, and genomic data - powered by serverless edge infrastructure.',
  keywords: ['promoter', 'genome', 'bioinformatics', 'transcription factor', 'TFBS', 'gene regulation', 'seqedge'],
  contactEmail: 'lab@university.edu',

  colors: {
    primary: '#1E3A8A',
    secondary: '#10B981',
    accent: '#6366F1',
    headerBg: '#ffffff',
    headerBorder: '#e5e7eb',
  },

  jbrowse: {
    defaultAssembly: 'NC_045512.2',
    defaultLocus: 'NC_045512.2:1-5000',
    storageBaseUrl:
      process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      '',
    demoBaseUrl: '/demo-data',
    assemblies: {
      volvox: {
        defaultLocus: 'ctgA:1-5000',
        fasta: 'volvox.fa',
        fastaIndex: 'volvox.fa.fai',
        tracks: [
          {
            trackId: 'demo-genes',
            name: 'Gene Annotations (GFF3)',
            type: 'FeatureTrack',
            adapter: {
              type: 'Gff3TabixAdapter',
              gffGzLocation: 'volvox.sort.gff3.gz',
              index: { location: 'volvox.sort.gff3.gz.tbi', indexType: 'TBI' },
            },
            displays: [{ displayId: 'demo-genes-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
          {
            trackId: 'demo-alignments',
            name: 'Read Alignments (BAM)',
            type: 'AlignmentsTrack',
            adapter: {
              type: 'BamAdapter',
              bamLocation: 'volvox-sorted.bam',
              index: { location: 'volvox-sorted.bam.bai', indexType: 'BAI' },
            },
          },
          {
            trackId: 'demo-bigbed',
            name: 'BigBed Annotations',
            type: 'FeatureTrack',
            adapter: {
              type: 'BigBedAdapter',
              bigBedLocation: 'volvox.bb',
            },
            displays: [{ displayId: 'demo-bigbed-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
        ],
      },
      'NC_045512.2': {
        defaultLocus: 'NC_045512.2:1-5000',
        fasta: 'scov2.fa',
        fastaIndex: 'scov2.fa.fai',
        tracks: [
          {
            trackId: 'scov2-genes-bed',
            name: 'SARS-CoV-2 Genes (BED)',
            type: 'FeatureTrack',
            adapter: {
              type: 'BedAdapter',
              bedLocation: 'scov2.genes.bed',
            },
            displays: [{ displayId: 'scov2-genes-bed-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
          {
            trackId: 'scov2-genes-gff3',
            name: 'SARS-CoV-2 Genes (GFF3)',
            type: 'FeatureTrack',
            adapter: {
              type: 'Gff3Adapter',
              gffLocation: 'scov2.genes.gff3',
            },
            displays: [{ displayId: 'scov2-genes-gff3-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
        ],
      },
    },
  },

  chromosomes: ['NC_045512.2', 'ctgA'],

  pageSize: 20,

  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;
