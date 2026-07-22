// ============================================================
// Site Configuration â€” Edit this file to customize your database
// ============================================================
// This is the SINGLE source of truth for all site-wide settings.
// Other users who fork this template only need to edit this file
// (plus .env.local and schema.sql) to create their own database site.

export const SiteConfig = {
  // ---- Site identity ----
  title: 'SeqEdge',
  subtitle: 'A Modern Edge-Native Portal for Genomic Databases',
  description: 'Interactive database for browsing predicted promoters, whole genome annotations, and genomic data â€” powered by serverless edge infrastructure.',
  keywords: ['promoter', 'genome', 'bioinformatics', 'transcription factor', 'TFBS', 'gene regulation', 'seqedge'],
  contactEmail: 'lab@university.edu',

  // ---- Branding ----
  colors: {
    primary: '#1E3A8A',     // deep blue
    secondary: '#10B981',   // emerald
    accent: '#6366F1',      // indigo
    headerBg: '#ffffff',
    headerBorder: '#e5e7eb',
  },

  // ---- Genome browser defaults ----
  jbrowse: {
    defaultAssembly: 'volvox',
    defaultLocus: 'ctgA:1-5000',
    // Your own object storage (Cloudflare R2, S3, etc). Leave the env var unset
    // to fall back to the public JBrowse demo data below, so the browser works
    // out-of-the-box the moment someone forks this template.
    storageBaseUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '',
    // Public JBrowse 2 demo track set (volvox) — reference + alignments + BigBed.
    // Used automatically whenever storageBaseUrl is empty. Confirmed reachable
    // with permissive CORS + HTTP range requests, which JBrowse needs.
    demoBaseUrl: 'https://jbrowse.org/code/jb2/main/test_data/volvox',
    tracks: [
      { name: 'Predicted Promoters', type: 'annotation', format: 'bed' },
      { name: 'Gene Annotations', type: 'annotation', format: 'gff3' },
      { name: 'RNA-seq Coverage', type: 'quantitative', format: 'bigwig' },
      { name: 'ChIP-seq Peaks', type: 'annotation', format: 'bed' },
    ],
  },

  // ---- Search filters ----
  chromosomes: [
    'ctgA', 'ctgB',
    // For human genomes, replace with: 'chr1', 'chr2', ..., 'chr22', 'chrX', 'chrY', 'chrMT'
  ],

  // ---- Table pagination ----
  pageSize: 20,

  // ---- Feature flags ----
  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,  // set true when variant_index table is ready
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;