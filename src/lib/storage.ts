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

export const LOCAL_HF_PROXY_PATH = '/api/hf-proxy';
export const NOT_DIRECT_FILE_URL_MESSAGE = 'Not a direct file URL';

const DIRECT_FILE_QUERY_HINTS = [
  'download',
  'dl',
  'raw',
  'filename',
  'response-content-disposition',
  'x-amz-signature',
  'signature',
  'token',
  'se',
  'sp',
  'sv',
];

const STORAGE_HOST_PATTERNS = [
  /\.r2\.dev$/i,
  /\.amazonaws\.com$/i,
  /storage\.googleapis\.com$/i,
  /blob\.core\.windows\.net$/i,
  /\.supabase\.co$/i,
];

export interface DirectFileUrlValidationResult {
  normalizedUrl: string;
  valid: boolean;
  reason: string | null;
}

function isPlaceholderStorageValue(value: string): boolean {
  return !value || /your-(bucket|r2-bucket)|example\.com|<user>|<repo>/i.test(value);
}

function getResolvedStorageBaseUrl(baseUrl: string, preferProxy: boolean): string {
  if (isPlaceholderStorageValue(baseUrl)) return '';
  if (preferProxy && HF_PROXY_BASE_URL && isHuggingFaceUrl(baseUrl)) {
    return rewriteHfBaseUrl(baseUrl, HF_PROXY_BASE_URL);
  }
  return baseUrl;
}

function getLocalProxyBaseUrl(baseUrl: string): string {
  if (typeof window === 'undefined') return '';
  if (isPlaceholderStorageValue(baseUrl) || !isHuggingFaceUrl(baseUrl)) return '';
  return LOCAL_HF_PROXY_PATH;
}

export function getCandidateStorageBaseUrls(baseUrl: string = STORAGE_BASE_URL): string[] {
  const workerPreferred = getResolvedStorageBaseUrl(baseUrl, true);
  const localProxy = getLocalProxyBaseUrl(baseUrl);
  const direct = getResolvedStorageBaseUrl(baseUrl, false);
  return [workerPreferred, localProxy, direct].filter(
    (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
  );
}

export function getEffectiveStorageBaseUrl(baseUrl: string = STORAGE_BASE_URL): string {
  return getCandidateStorageBaseUrls(baseUrl)[0] || '';
}

export function getStorageAccessMode(baseUrl: string = STORAGE_BASE_URL):
  | 'unset'
  | 'hf-proxy'
  | 'hf-direct'
  | 'object-storage' {
  if (isPlaceholderStorageValue(baseUrl)) return 'unset';
  if (HF_PROXY_BASE_URL && isHuggingFaceUrl(baseUrl)) return 'hf-proxy';
  if (isHuggingFaceUrl(baseUrl)) return 'hf-direct';
  return 'object-storage';
}

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
  options: { preferProxy?: boolean } = {},
): string {
  if (!path) return '';

  const preferProxy = options.preferProxy ?? true;
  const resolvedBase = getResolvedStorageBaseUrl(baseUrl, preferProxy);

  // Absolute URL - check for HF proxy rewriting.
  if (/^https?:\/\//i.test(path)) {
    if (preferProxy && HF_PROXY_BASE_URL && isHuggingFaceUrl(path)) {
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

export function getDirectDownloadUrl(
  path: string | null | undefined,
  baseUrl: string = STORAGE_BASE_URL,
): string {
  if (!path) return '';

  let resolvedUrl = '';

  if (/^https?:\/\//i.test(path)) {
    resolvedUrl = path;
  } else {
    const directBase = getResolvedStorageBaseUrl(baseUrl, false);
    const cleanBase = directBase.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    resolvedUrl = cleanBase ? `${cleanBase}/${cleanPath}` : cleanPath;
  }

  resolvedUrl = normalizeDirectDownloadUrl(resolvedUrl);

  if (!/^https?:\/\//i.test(resolvedUrl)) {
    return resolvedUrl;
  }

  const validation = validateDirectFileUrl(resolvedUrl);
  if (!validation.valid) {
    return validation.normalizedUrl;
  }

  try {
    const url = new URL(resolvedUrl);
    url.searchParams.set('download', 'true');
    return url.toString();
  } catch {
    return resolvedUrl.includes('?') ? `${resolvedUrl}&download=true` : `${resolvedUrl}?download=true`;
  }
}

export function validateDirectFileUrl(url: string | null | undefined): DirectFileUrlValidationResult {
  if (!url) {
    return { normalizedUrl: '', valid: false, reason: NOT_DIRECT_FILE_URL_MESSAGE };
  }

  const normalizedUrl = normalizeDirectDownloadUrl(url);

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    const lastSegment = normalizedUrl.split('?')[0].split('/').filter(Boolean).pop() || '';
    const valid = Boolean(lastSegment) && !normalizedUrl.endsWith('/') && lastSegment.includes('.');
    return {
      normalizedUrl,
      valid,
      reason: valid ? null : NOT_DIRECT_FILE_URL_MESSAGE,
    };
  }

  try {
    const parsed = new URL(normalizedUrl);
    const pathname = parsed.pathname || '';
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';

    if (!lastSegment || pathname.endsWith('/')) {
      return { normalizedUrl, valid: false, reason: NOT_DIRECT_FILE_URL_MESSAGE };
    }

    if (isHuggingFaceResolveUrl(normalizedUrl)) {
      return { normalizedUrl, valid: true, reason: null };
    }

    if (lastSegment.includes('.')) {
      return { normalizedUrl, valid: true, reason: null };
    }

    const hasQueryHint = DIRECT_FILE_QUERY_HINTS.some((key) => parsed.searchParams.has(key));
    if (hasQueryHint) {
      return { normalizedUrl, valid: true, reason: null };
    }

    const hostLooksLikeStorage = STORAGE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
    if (hostLooksLikeStorage && pathname.split('/').filter(Boolean).length >= 2) {
      return { normalizedUrl, valid: true, reason: null };
    }

    return { normalizedUrl, valid: false, reason: NOT_DIRECT_FILE_URL_MESSAGE };
  } catch {
    return { normalizedUrl, valid: false, reason: NOT_DIRECT_FILE_URL_MESSAGE };
  }
}

// ---- HF proxy helpers -----------------------------------------------

/**
 * Detect Hugging Face Dataset resolve URLs.
 * Matches: https://huggingface.co/datasets/<user>/<repo>/resolve/main/...
 */
function isHuggingFaceUrl(url: string): boolean {
  return /huggingface\.co\/datasets\/[^/]+\/[^/]+\/resolve\/main/i.test(url);
}

function isHuggingFaceResolveUrl(url: string): boolean {
  return /huggingface\.co\/datasets\/[^/]+\/[^/]+\/resolve\/main\//i.test(url);
}

function isHuggingFaceBlobUrl(url: string): boolean {
  return /huggingface\.co\/datasets\/[^/]+\/[^/]+\/blob\/main\//i.test(url);
}

export function normalizeDirectDownloadUrl(url: string): string {
  if (!isHuggingFaceBlobUrl(url)) return url;
  return url.replace('/blob/main/', '/resolve/main/');
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
