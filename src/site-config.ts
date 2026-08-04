// ============================================================
// Site Configuration - Edit this file to customize your database
// ============================================================
// This is the single source of truth for all site-wide settings.
// Other users who fork this template only need to edit this file
// (plus .env.local and schema.sql) to create their own database site.

type FeaturedDownloadItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  sizeLabel: string;
  mode: 'direct' | 'cli';
};

function hasStorageBaseUrl(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  );
}

function buildFeaturedDownloads(): FeaturedDownloadItem[] {
  const storageBaseUrl =
    process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    '';
  const defaultReleaseArchiveUrl = storageBaseUrl.includes('huggingface.co/datasets/Helloxiaolaodi/seqedge-data/resolve/main')
    ? 'scov2.fa'
    : '';
  const items: FeaturedDownloadItem[] = [
    {
      id: 'release-archive',
      label: process.env.NEXT_PUBLIC_RELEASE_ARCHIVE_LABEL || 'Download Release Archive',
      description:
        process.env.NEXT_PUBLIC_RELEASE_ARCHIVE_DESCRIPTION ||
        'Versioned bundle for offline analysis, mirroring, or reproducible local setup.',
      href: process.env.NEXT_PUBLIC_RELEASE_ARCHIVE_URL || defaultReleaseArchiveUrl,
      sizeLabel: process.env.NEXT_PUBLIC_RELEASE_ARCHIVE_SIZE || '',
      mode: (process.env.NEXT_PUBLIC_RELEASE_ARCHIVE_MODE || 'cli') as 'direct' | 'cli',
    },
    {
      id: 'reference-bundle',
      label: process.env.NEXT_PUBLIC_REFERENCE_BUNDLE_LABEL || 'Download Reference Bundle',
      description:
        process.env.NEXT_PUBLIC_REFERENCE_BUNDLE_DESCRIPTION ||
        'Reference FASTA and annotation files used by the Genome Browser.',
      href: process.env.NEXT_PUBLIC_REFERENCE_BUNDLE_URL || '',
      sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_BUNDLE_SIZE || '',
      mode: (process.env.NEXT_PUBLIC_REFERENCE_BUNDLE_MODE || 'cli') as 'direct' | 'cli',
    },
  ];

  if (hasStorageBaseUrl()) {
    items.push(
      {
        id: 'reference-fasta',
        label: process.env.NEXT_PUBLIC_REFERENCE_FASTA_LABEL || 'Download Reference FASTA',
        description:
          process.env.NEXT_PUBLIC_REFERENCE_FASTA_DESCRIPTION ||
          'Primary FASTA file used by the Genome Browser and local analysis workflows.',
        href: process.env.NEXT_PUBLIC_REFERENCE_FASTA || 'scov2.fa',
        sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_FASTA_SIZE || '',
        mode: (process.env.NEXT_PUBLIC_REFERENCE_FASTA_MODE || 'cli') as 'direct' | 'cli',
      },
      {
        id: 'reference-fasta-index',
        label: process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX_LABEL || 'Download FASTA Index',
        description:
          process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX_DESCRIPTION ||
          'Index file paired with the reference FASTA for Genome Browser navigation and CLI access.',
        href: process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX || 'scov2.fa.fai',
        sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX_SIZE || '',
        mode: (process.env.NEXT_PUBLIC_REFERENCE_FASTA_INDEX_MODE || 'cli') as 'direct' | 'cli',
      },
      {
        id: 'reference-bed',
        label: process.env.NEXT_PUBLIC_REFERENCE_BED_LABEL || 'Download Annotation BED',
        description:
          process.env.NEXT_PUBLIC_REFERENCE_BED_DESCRIPTION ||
          'BED annotation file used by the Genome Browser and downstream processing.',
        href: process.env.NEXT_PUBLIC_REFERENCE_BED || 'scov2.genes.bed',
        sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_BED_SIZE || '',
        mode: (process.env.NEXT_PUBLIC_REFERENCE_BED_MODE || 'cli') as 'direct' | 'cli',
      },
      {
        id: 'reference-gff3',
        label: process.env.NEXT_PUBLIC_REFERENCE_GFF3_LABEL || 'Download Annotation GFF3',
        description:
          process.env.NEXT_PUBLIC_REFERENCE_GFF3_DESCRIPTION ||
          'GFF3 annotation file for Genome Browser rendering, parsing, and local reuse.',
        href: process.env.NEXT_PUBLIC_REFERENCE_GFF3 || 'scov2.genes.gff3',
        sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_GFF3_SIZE || '',
        mode: (process.env.NEXT_PUBLIC_REFERENCE_GFF3_MODE || 'cli') as 'direct' | 'cli',
      },
      {
        id: 'reference-genbank',
        label: process.env.NEXT_PUBLIC_REFERENCE_GENBANK_LABEL || 'Download GenBank File',
        description:
          process.env.NEXT_PUBLIC_REFERENCE_GENBANK_DESCRIPTION ||
          'GenBank reference file for archiving, inspection, and local parsing.',
        href: process.env.NEXT_PUBLIC_REFERENCE_GENBANK || 'scov2.gb',
        sizeLabel: process.env.NEXT_PUBLIC_REFERENCE_GENBANK_SIZE || '',
        mode: (process.env.NEXT_PUBLIC_REFERENCE_GENBANK_MODE || 'cli') as 'direct' | 'cli',
      },
    );
  }

  return items.filter((item) => Boolean(item.href));
}

export const SiteConfig = {
  title: 'GalibierHub',
  version: 'v1.0.0',
  releaseDate: '2026-07-22',
  dataUpdateDate: '2026-07-28',
  subtitle: '',
  creatorCreditPrefix: 'An open-source project maintained by',
  creatorCreditLabel: '@Helloxiaolaodi',
  creatorCreditUrl: 'https://github.com/Helloxiaolaodi/GalibierHub',
  adminGithubLoginFallback: 'helloxiaolaodi,yangsanduo,xulab-admin',
  description:
    'Interactive database for predicted promoters, genome annotations, and genomic data, powered by serverless edge infrastructure.',
  keywords: ['promoter', 'genome', 'bioinformatics', 'transcription factor', 'TFBS', 'gene regulation', 'galibierhub'],
  contactEmail: 'lab@university.edu',
  feedback: {
    sectionTitle: 'Discussions',
    sectionDescription:
      'A centralized space for research communication, public discussions, and feedback.',
  },
  uptime: {
    startAt: '2026-08-01T00:00:00+08:00',
  },

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

  downloads: {
    featured: buildFeaturedDownloads(),
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

  checksums: {
    enabled: true,
    algorithms: ['sha256', 'md5'] as const,
  },

  features: {
    enableGenomeBrowser: true,
    enableStatsCharts: true,
    enableVariantSearch: false,
    enableExport: true,
  },
} as const;

export type SiteConfigType = typeof SiteConfig;
