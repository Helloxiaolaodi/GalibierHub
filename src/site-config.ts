// ============================================================
// Site Configuration - Edit this file to customize your database
// ============================================================
// This is the single source of truth for all site-wide settings.
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
    defaultAssembly: process.env.NEXT_PUBLIC_REFERENCE_ASSEMBLY || 'reference',
    defaultLocus: process.env.NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS || 'reference:1-1000',
    storageBaseUrl:
      process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      '',
    assemblies: {
      [process.env.NEXT_PUBLIC_REFERENCE_ASSEMBLY || 'reference']: {
        defaultLocus: process.env.NEXT_PUBLIC_REFERENCE_DEFAULT_LOCUS || 'reference:1-1000',
        fasta: process.env.NEXT_PUBLIC_REFERENCE_FASTA || 'reference.fa',
        fastaIndex: process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX || 'reference.fa.fai',
        tracks: [
          {
            trackId: 'annotations-bed',
            name: 'Reference Annotations (BED)',
            type: 'FeatureTrack',
            adapter: {
              type: 'BedAdapter',
              bedLocation: process.env.NEXT_PUBLIC_REFERENCE_BED || 'reference.annotations.bed',
            },
            displays: [{ displayId: 'annotations-bed-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
          {
            trackId: 'annotations-gff3',
            name: 'Reference Annotations (GFF3)',
            type: 'FeatureTrack',
            adapter: {
              type: 'Gff3Adapter',
              gffLocation: process.env.NEXT_PUBLIC_REFERENCE_GFF3 || 'reference.annotations.gff3',
            },
            displays: [{ displayId: 'annotations-gff3-LinearBasicDisplay', type: 'LinearBasicDisplay' }],
          },
        ],
      },
    },
  },

  // Chinese adult BMI classification (kg/m^2)
  // Underweight (<18.5) | Normal (18.5-24.0) | Overweight (24.0-28.0) | Obese (>=28.0)
  bmiBands: {
    underweight: [0, 18.5],
    normal: [18.5, 24.0],
    overweight: [24.0, 28.0],
    obese: [28.0, 100],
  },
  chromosomes: [process.env.NEXT_PUBLIC_REFERENCE_ASSEMBLY || 'reference'],

  pageSize: 20,

  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;
