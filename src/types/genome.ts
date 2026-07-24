// Genome sample metadata
export interface GenomeSample {
  id: string;
  sample_id: string;
  species: string;
  tissue: string;
  sequencing_platform: string;
  assembly_version: string;
  total_variants: number;
  coverage: number;
  vcf_download_url: string | null;
  fasta_download_url: string | null;
  vcf_download_mode?: 'direct' | 'cli' | null;
  fasta_download_mode?: 'direct' | 'cli' | null;
  created_at: string;
}

// Promoter prediction record
export interface Promoter {
  id: string;
  sample_id: string;
  chrom: string;
  start: number;
  end_pos: number;
  score: number;
  strand: "+" | "-";
  gene_symbol: string | null;
  sequence: string | null;
  created_at: string;
}

// Variant index record
export interface VariantIndex {
  id: number;
  chrom: string;
  pos: number;
  ref_allele: string;
  alt_allele: string;
  quality: number | null;
  gene_symbol: string | null;
  consequence: string | null;
  sample_id: string;
  created_at: string;
}

// Sample phenotype card payload returned by /api/samples/[id]
export interface SampleMetadata {
  sample_id: string;
  species: string | null;
  tissue: string | null;
  sequencing_platform: string | null;
  assembly_version: string | null;
  coverage: number | null;
  cohort: string | null;
  bmi: number | null;
  age: number | null;
  sex: string | null;
  vcf_download_url: string | null;
  fasta_download_url: string | null;
  vcf_download_mode?: 'direct' | 'cli' | null;
  fasta_download_mode?: 'direct' | 'cli' | null;
}

// Stats for dashboard overview
export interface DashboardStats {
  total_samples: number;
  total_promoters: number;
  total_variants: number;
  species_distribution: Record<string, number>;
  score_distribution: { range: string; count: number }[];
}

export type FeedbackCategory = 'general' | 'issue' | 'idea' | 'data' | 'collaboration';

export interface SiteFeedbackEntry {
  id: string;
  title: string | null;
  display_name: string;
  visitor_email?: string | null;
  affiliation: string | null;
  category: FeedbackCategory;
  rating: number;
  visibility: 'public' | 'private';
  message: string;
  creator_reply: string | null;
  replied_at: string | null;
  created_at: string;
  pinned?: boolean;
  hidden?: boolean;
}

export interface FeedbackSummary {
  totalComments: number;
  averageRating: number;
}

export interface ReactionCounts {
  like: number;
  bookmark: number;
}
