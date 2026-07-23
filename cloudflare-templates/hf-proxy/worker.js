// SeqEdge HF Proxy Worker
// ============================================================
// Bridges Hugging Face Datasets to JBrowse 2 by fixing CORS,
// Range headers, and 302 redirect chains that make HF-backed
// genome browsers take 5 minutes to load instead of 10 seconds.
//
// Deploy as a standalone Cloudflare Worker, then point
// NEXT_PUBLIC_STORAGE_BASE_URL (or NEXT_PUBLIC_HF_PROXY_URL)
// at the resulting *.workers.dev address.

const INDEX_FILE_PATTERN = /\.(bai|tbi|csi|fai|crai|gzi)$/i;

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const hfBase = env.HF_REPO_BASE;

    if (!hfBase) {
      return new Response('HF_REPO_BASE not configured', { status: 500 });
    }

    const cleanBase = hfBase.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    const targetUrl = `${cleanBase}/${cleanPath}`;

    // ---- CORS preflight (OPTIONS) ---------------------------------
    // JBrowse 2 sends OPTIONS before cross-origin Range GET.
    // HF's 302→Xet chain often fails preflight.  We answer it here
    // so the browser never sees a cross-origin redirect.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: preflightHeaders(),
      });
    }

    // ---- Forward request ------------------------------------------
    // Preserve Range so JBrowse can do byte-range reads.
    // Also forward conditional headers so upstream may return 304.
    const fetchHeaders = new Headers();
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) fetchHeaders.set('Range', rangeHeader);
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch) fetchHeaders.set('If-None-Match', ifNoneMatch);
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (ifModifiedSince) fetchHeaders.set('If-Modified-Since', ifModifiedSince);

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: fetchHeaders,
        redirect: 'follow',
        // ^^^ handles huggingface.co→xethub.hf.co 302 internally
      });
    } catch (err) {
      return new Response(`Upstream fetch failed: ${err.message}`, {
        status: 502,
        headers: errorHeaders(),
      });
    }

    // ---- Build corrected response ---------------------------------
    const responseHeaders = new Headers(upstreamResponse.headers);

    // CORS: allow any SeqEdge frontend to read these files
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set(
      'Access-Control-Expose-Headers',
      'Content-Range, Accept-Ranges, Content-Length, Content-Type, Content-Encoding, ETag, Last-Modified',
    );

    // Signal Range support (required by JBrowse for partial reads)
    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // Edge caching: index files get 24 h, data files 1 h.
    // Only apply to full (200) responses — caching 206 Partial
    // Content responses can confuse the CDN for Range requests.
    if (upstreamResponse.status === 200) {
      const filename = cleanPath.split('/').pop() || '';
      if (INDEX_FILE_PATTERN.test(filename)) {
        responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        responseHeaders.set('CDN-Cache-Control', 'public, max-age=86400');
      } else {
        responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        responseHeaders.set('CDN-Cache-Control', 'public, max-age=3600');
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

function preflightHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type, If-None-Match, If-Modified-Since',
    'Access-Control-Max-Age': '86400',
  };
}

function errorHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
  };
}
