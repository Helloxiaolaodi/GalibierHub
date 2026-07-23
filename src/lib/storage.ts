// ============================================================
// Storage URL resolver - storage-agnostic (R2 / Hugging Face / S3)
// ============================================================
// SeqEdge never hard-codes a storage provider. Every genome file is addressed
// by a URL that this helper resolves, following one simple rule:
//
//   "relative paths go through the base URL, absolute URLs are passed through."
//
// This gives template users four deployment modes with zero code changes:
//
//   1. Single-source hosting (recommended). Store relative paths in Supabase
//      (e.g. "tracks/sample1.bb") and set ONE env var to your bucket root:
//        NEXT_PUBLIC_STORAGE_BASE_URL = "https://pub-xxxx.r2.dev"
//        NEXT_PUBLIC_STORAGE_BASE_URL = "https://huggingface.co/datasets/<user>/<repo>/resolve/main"
//
//   2. Mixed-source hosting (advanced). Keep small files on R2 but park a
//      50 GB+ CRAM on Hugging Face by storing its full HTTPS URL in Supabase.
//      getStorageUrl() detects the leading scheme and returns it untouched, so
//      the file loads cross-origin with no extra config.
//
//   3. HF proxy mode (fixes slow remote loading). Deploy the proxy Worker from
//      cloudflare-templates/hf-proxy/, set NEXT_PUBLIC_HF_PROXY_URL to its
//      workers.dev address, and keep storing HF absolute URLs in Supabase.
//      getStorageUrl() auto-rewrites huggingface.co URLs to go through the
//      proxy, giving you the cost efficiency of HF storage with much faster access.

// Resolution order: the storage-agnostic name wins; the legacy R2 name is a
// backward-compatible fallback so existing deployments keep working after they
// upgrade. Kept in sync with SiteConfig.jbrowse.storageBaseUrl.
export const STORAGE_BASE_URL =
  process.env.NEXT_PUBLIC_STORAGE_BASE_URL ||
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  '';

/** HF proxy Worker URL (optional). When set, any absolute huggingface.co
 *  Dataset URLs stored in Supabase are automatically rewritten to pass through
 *  this proxy Worker. The proxy handles redirects and CORS on the backend,
 *  presenting a clean S3-compatible endpoint to JBrowse. See the deployment
 *  guide in cloudflare-templates/hf-proxy/README.md. */
export const HF_PROXY_BASE_URL = process.env.NEXT_PUBLIC_HF_PROXY_URL || '';

/**
 * Resolve a stored file path to a fully qualified, fetchable URL.
 *
 * @param path    Path stored in the database or config. May be a relative path
 *                ("tracks/chr1.bb") or an absolute URL ("https://host/chr1.cram").
 *
 *                When NEXT_PUBLIC_HF_PROXY_URL is configured, any absolute URL
 *                pointing to huggingface.co/datasets/.../resolve/main is
 *                automatically rewritten to pass through the proxy Worker.
 *
 * @param baseUrl Optional base override. Defaults to STORAGE_BASE_URL. The
 *                genome browser passes the base it actually resolved, so callers
 *                stay consistent with what the reachability probe verified.
 * @returns The absolute URL, or '' when there is nothing to resolve.
 */
export function getStorageUrl(
  path: string | null | undefined,
  baseUrl: string = STORAGE_BASE_URL,
): string {
  if (!path) return '';

  const resolvedBase =
    HF_PROXY_BASE_URL && isHuggingFaceUrl(baseUrl)
      ? rewriteHfBaseUrl(baseUrl, HF_PROXY_BASE_URL)
      : baseUrl;

  // Absolute URL - check for HF proxy rewriting.
  if (/^https?:\/\//i.test(path)) {
    if (HF_PROXY_BASE_URL && isHuggingFaceUrl(path)) {
      return rewriteHfUrl(path, HF_PROXY_BASE_URL);
    }
    return path;
  }

  // Relative path - join with the base and normalize slashes so object storage
  // keys remain stable.
  const cleanBase = resolvedBase.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
}

// ---- HF proxy helpers -----------------------------------------------

/**
 * Detect Hugging Face Dataset resolve URLs.
 * Matches: https://huggingface.co/datasets/<user>/<repo>/resolve/main/...
 */
function isHuggingFaceUrl(url: string): boolean {
  return /huggingface\.co\/datasets\/[^/]+\/[^/]+\/resolve\/main/i.test(url);
}

/**
 * Rewrite a Hugging Face resolve URL to go through the proxy Worker.
 * Extracts the path after "resolve/main/" and appends it to the proxy base.
 *
 * Example:
 *   in:  https://huggingface.co/datasets/u/r/resolve/main/tracks/sample.bam
 *   out: https://proxy.workers.dev/tracks/sample.bam
 */
function rewriteHfUrl(hfUrl: string, proxyBase: string): string {
  const match = hfUrl.match(/\/resolve\/main\/([^?#]+)$/i);
  if (!match) return hfUrl;
  const cleanBase = proxyBase.replace(/\/+$/, '');
  return `${cleanBase}/${match[1]}`;
}

function rewriteHfBaseUrl(hfBaseUrl: string, proxyBase: string): string {
  const match = hfBaseUrl.match(/\/resolve\/main(?:\/(.+))?$/i);
  if (!match) return hfBaseUrl;
  const cleanBase = proxyBase.replace(/\/+$/, '');
  const suffix = match[1]?.replace(/^\/+/, '') || '';
  return suffix ? `${cleanBase}/${suffix}` : cleanBase;
}
