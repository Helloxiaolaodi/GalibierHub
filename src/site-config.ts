// ============================================================
// Site Configuration - Edit this file to customize your database
// ============================================================
// This is the SINGLE source of truth for all site-wide settings.
// Other users who fork this template only need to edit this file
// (plus .env.local and schema.sql) to create their own database site.

export const SiteConfig = {
  // ---- Site identity ----
  title: 'SeqEdge',
  subtitle: 'A Modern Edge-Native Portal for Genomic Databases',
  description: 'Interactive database for browsing predicted promoters, whole genome annotations, and genomic data - powered by serverless edge infrastructure.',
  keywords: ['promoter', 'genome', 'bioinformatics', 'transcription factor', 'TFBS', 'gene regulation', 'seqedge'],
  contactEmail: 'lab@university.edu',

  // ---- Branding ----
  colors: {
    primary: '#1E3A8A',
    secondary: '#10B981',
    accent: '#6366F1',
    headerBg: '#ffffff',
    headerBorder: '#e5e7eb',
  },

  // ---- Genome browser defaults ----
  jbrowse: {
    defaultAssembly: 'NC_045512.2',
    defaultLocus: 'NC_045512.2:1-5000',
    // Your own object storage - Cloudflare R2, Hugging Face Datasets, AWS S3, or
    // any CORS-enabled host that supports HTTP range requests. Leave both env
    // vars unset to fall back to the public demo data below, so the browser works
    // out-of-the-box the moment someone forks this template.
    //
    // NEXT_PUBLIC_STORAGE_BASE_URL is the storage-agnostic name (preferred).
    // NEXT_PUBLIC_R2_PUBLIC_URL is kept as a fallback for older deployments that
    // already set it, so renaming the env var is not a breaking change.
    //   R2 example: https://pub-xxxxxxxx.r2.dev
    //   HF example: https://huggingface.co/datasets/<user>/<repo>/resolve/main
    storageBaseUrl:
      process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
      '',
    // Public SARS-CoV-2 genome dataset hosted on Hugging Face (NCBI NC_045512.2).
    // Used automatically whenever storageBaseUrl is empty. The dataset includes
    // reference FASTA + index and gene annotations exported from GenBank.
    demoBaseUrl: 'https://huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main',
    tracks: [
      { name: 'SARS-CoV-2 Genes (BED)', type: 'annotation', format: 'bed' },
      { name: 'SARS-CoV-2 Genes (GFF3)', type: 'annotation', format: 'gff3' },
    ],
  },

  // ---- Search filters ----
  chromosomes: [
    'NC_045512.2',
    // For multi-chromosome genomes, list all here, e.g.:
    //   'chr1', 'chr2', ..., 'chr22', 'chrX', 'chrY', 'chrMT'
  ],

  // ---- Table pagination ----
  pageSize: 20,

  // ---- Feature flags ----
  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;