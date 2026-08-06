import { NextRequest } from 'next/server';
import { STORAGE_BASE_URL } from '@/lib/storage';

// Same-site fallback for JBrowse range requests. Production should prefer the
// external Worker configured through NEXT_PUBLIC_HF_PROXY_URL so large data
// bytes do not flow through the Next.js app.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INDEX_FILE_PATTERN = /\.(bai|tbi|csi|fai|crai|gzi)$/i;
const EXPOSED_HEADERS = 'Content-Range, Accept-Ranges, Content-Length, Content-Type, Content-Encoding, ETag, Last-Modified';

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': EXPOSED_HEADERS,
  };
}

function isHuggingFaceResolveBase(url: string): boolean {
  return /huggingface\.co\/datasets\/[^/]+\/[^/]+\/resolve\/main/i.test(url);
}

function getTargetUrl(pathSegments: string[]): string {
  const base = STORAGE_BASE_URL.replace(/\/+$/, '');
  const path = pathSegments.join('/').replace(/^\/+/, '');
  return `${base}/${path}`;
}

function getProxyError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: buildCorsHeaders(),
  });
}

async function handleProxy(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...buildCorsHeaders(),
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (!STORAGE_BASE_URL || !isHuggingFaceResolveBase(STORAGE_BASE_URL)) {
    return getProxyError('NEXT_PUBLIC_STORAGE_BASE_URL must point to a public Hugging Face resolve/main base.', 500);
  }

  const { path = [] } = await context.params;
  if (path.length === 0) {
    return getProxyError('Missing Hugging Face proxy target path.', 400);
  }

  const upstreamHeaders = new Headers();
  for (const name of ['Range', 'If-None-Match', 'If-Modified-Since']) {
    const value = request.headers.get(name);
    if (value) {
      upstreamHeaders.set(name, value);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(getTargetUrl(path), {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upstream fetch error';
    return getProxyError(`Upstream fetch failed: ${message}`, 502);
  }

  const responseHeaders = new Headers(upstream.headers);
  const corsHeaders = buildCorsHeaders();
  for (const [name, value] of Object.entries(corsHeaders)) {
    responseHeaders.set(name, value);
  }

  if (!responseHeaders.has('Accept-Ranges')) {
    responseHeaders.set('Accept-Ranges', 'bytes');
  }

  if (upstream.status === 200) {
    const filename = path[path.length - 1] || '';
    if (INDEX_FILE_PATTERN.test(filename)) {
      responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      responseHeaders.set('CDN-Cache-Control', 'public, max-age=86400');
    } else {
      responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      responseHeaders.set('CDN-Cache-Control', 'public, max-age=3600');
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  return handleProxy(request, context);
}
