// ============================================================
// Storage URL resolver — storage-agnostic (R2 / Hugging Face / S3 / …)
// ============================================================
// SeqEdge never hard-codes a storage provider. Every genome file is addressed
// by a URL that this helper resolves, following one simple rule:
//
//   "relative paths go through the base URL, absolute URLs are passed through."
//
// This gives template users two deployment modes with zero code changes:
//
//   1. Single-source hosting (recommended). Store relative paths in Supabase
//      (e.g. "tracks/sample1.bb") and set ONE env var to your bucket root:
//        NEXT_PUBLIC_STORAGE_BASE_URL = "https://pub-xxxx.r2.dev"
//        NEXT_PUBLIC_STORAGE_BASE_URL = "https://huggingface.co/datasets/<user>/<repo>/resolve/main"
//
//   2. Mixed-source hosting (advanced). Keep small files on R2 but park a
//      50 GB+ CRAM on Hugging Face by storing its FULL https:// URL in Supabase.
//      getStorageUrl() detects the leading scheme and returns it untouched, so
//      the file loads cross-origin with no extra config.

// Resolution order: the storage-agnostic name wins; the legacy R2 name is a
// backward-compatible fallback so existing deployments keep working after they
// upgrade. Kept in sync with SiteConfig.jbrowse.storageBaseUrl.
export const STORAGE_BASE_URL =
  process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  '';

/**
 * Resolve a stored file path to a fully-qualified, fetchable URL.
 *
 * @param path    Path stored in the database / config. May be a relative path
 *                ("tracks/chr1.bb") or an absolute URL ("https://…/chr1.cram").
 * @param baseUrl Optional base override. Defaults to STORAGE_BASE_URL. The
 *                genome browser passes the base it actually resolved (which may
 *                be the public demo dataset after a fallback), so callers stay
 *                consistent with what the reachability probe verified.
 * @returns The absolute URL, or '' when there is nothing to resolve.
 */
export function getStorageUrl(
  path: string | null | undefined,
  baseUrl: string = STORAGE_BASE_URL,
): string {
  if (!path) return '';

  // Absolute URL — mixed-source hosting. Pass through untouched.
  if (/^https?:\/\//i.test(path)) return path;

  // Relative path — join with the base, normalising the slash at the seam so we
  // never emit "…//…" (which some object stores treat as a distinct, missing key).
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
}
