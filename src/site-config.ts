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
    defaultAssembly: 'NC_045512.2',
    defaultLocus: 'NC_045512.2:1-5000',
    storageBaseUrl:
      process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      '',
    assemblies: {
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

  // Chinese adult BMI classification (kg/m^2)
  // Underweight (<18.5) | Normal (18.5-24.0) | Overweight (24.0-28.0) | Obese (>=28.0)
  bmiBands: {
    underweight: [0, 18.5],
    normal: [18.5, 24.0],
    overweight: [24.0, 28.0],
    obese: [28.0, 100],
  },
  chromosomes: ['NC_045512.2'],

  pageSize: 20,

  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;
