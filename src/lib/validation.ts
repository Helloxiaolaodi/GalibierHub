// ============================================================
// GalibierHub API Input Validation Schemas (Zod)
// ============================================================
// Every /api/* Route Handler validates input through these
// schemas BEFORE touching the database. Malformed requests
// receive 400 Bad Request, never reach Supabase.

import { z } from "zod";

// ---- Shared ----

export const noSqlPattern = /^[a-zA-Z0-9_\-.:@, \t\r\n]*$/;

export const safeString = z.string().max(500).regex(noSqlPattern, "Contains disallowed characters");

// ---- Feedback ----

export const feedbackPostSchema = z.object({
  title: z.string().min(3).max(120),
  displayName: z.string().min(1).max(80),
  visitorEmail: z.string().email().max(160).optional().or(z.literal("")),
  affiliation: z.string().max(160).optional().or(z.literal("")),
  category: z.enum(["general", "issue", "idea", "data", "collaboration"]),
  rating: z.number().int().min(1).max(5),
  visibility: z.enum(["public", "private"]),
  message: z.string().min(3).max(2000),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  _rendered_at: z.number().optional(),
  company: z.string().optional(),
});

export const feedbackPatchSchema = z.object({
  id: z.string().uuid(),
  creatorReply: z.string().min(3).max(2000).optional(),
  pinned: z.boolean().optional(),
  hidden: z.boolean().optional(),
  commentId: z.string().uuid().optional(),
  commentHidden: z.boolean().optional(),
});

export const feedbackDeleteSchema = z.object({
  id: z.string().uuid().optional(),
  comment_id: z.string().uuid().optional(),
});

// ---- Comments ----

export const commentPostSchema = z.object({
  feedbackId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  authorName: z.string().min(1).max(80),
});

// ---- Reactions ----

export const reactionPostSchema = z.object({
  reactionType: z.enum(["like", "bookmark"]),
  fingerprint: z.string().min(8).max(256),
  entryId: z.string().uuid().nullable().optional(),
});

// ---- Visitors ----

export const visitorPostSchema = z.object({
  fingerprint: z.string().min(8).max(256),
});

// ---- Promoters (GET query) ----

export const promotersQuerySchema = z.object({
  id: z.string().uuid().optional(),
  chrom: z.string().max(50).optional(),
  gene_symbol: z.string().max(200).optional(),
  min_score: z.coerce.number().min(0).max(1).optional(),
  start: z.coerce.number().int().min(0).optional(),
  end_pos: z.coerce.number().int().min(0).optional(),
  sample_id: z.string().max(50).optional(),
  species: z.string().max(100).optional(),
  tissue: z.string().max(100).optional(),
  cohort: z.string().max(100).optional(),
  bmi_class: z.enum(["underweight", "normal", "overweight", "obese"]).optional(),
  sort_by: z.enum(["score_desc", "score_asc", "chrom_start", "sample_id"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
  cursor: z.string().max(64).optional(),
});

// ---- Variants (GET query) ----

export const variantsQuerySchema = z.object({
  chrom: z.string().max(50).optional(),
  start: z.coerce.number().int().min(0).optional(),
  end: z.coerce.number().int().min(0).optional(),
  gene_symbol: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
});

// ---- Samples Batch ----

export const samplesBatchSchema = z.object({
  sample_ids: z.array(z.string().max(50)).max(200),
});

// ---- Download Metadata ----

export const downloadMetadataPutSchema = z.object({
  download_key: z.string().min(1).max(500),
  custom_label: z.string().max(200).optional(),
  custom_size_bytes: z.number().int().min(0).nullable().optional(),
  custom_file_type: z.string().max(50).optional(),
  custom_description: z.string().max(500).optional(),
  hidden: z.boolean().optional(),
  password: z.string().min(4).max(100).optional(),
  clear_password: z.boolean().optional(),
  storage_provider: z.enum(["public_url", "supabase_private"]).optional(),
  storage_bucket: z.string().max(100).optional(),
  storage_path: z.string().max(500).optional(),
  signed_url_ttl_seconds: z.number().int().min(60).max(86400).optional(),
  md5_checksum: z.string().max(64).optional(),
  sha256_checksum: z.string().max(128).optional(),
});

// ---- Download Increment ----

export const downloadIncSchema = z.object({
  download_key: z.string().min(1).max(500),
  password: z.string().max(100).optional(),
});

// ---- Download Verify ----

export const downloadVerifySchema = z.object({
  download_key: z.string().min(1).max(500),
  password: z.string().max(100),
});

// ---- Download Resolve ----

export const downloadResolveSchema = z.object({
  download_key: z.string().min(1).max(500),
  password: z.string().max(100).optional(),
  label: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

// ---- Image Upload (file validation done in route, schema covers metadata) ----

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  "image/avif",
] as const;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// ---- Helper ----

export function parseAndValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorPrefix: string = "Invalid request",
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: `${errorPrefix}: ${messages}` };
  }
  return { success: true, data: result.data };
}
