import { NextRequest } from 'next/server';
import { HF_PROXY_BASE_URL, STORAGE_BASE_URL } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_HOST_SUFFIXES = [
  'huggingface.co',
  '.huggingface.co',
  'hf-mirror.com',
  '.hf-mirror.com',
  '.supabase.co',
  '.r2.dev',
  '.amazonaws.com',
  'storage.googleapis.com',
  'blob.core.windows.net',
];

function isAllowedDownloadUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(suffix))) return true;
    const configuredHosts = [STORAGE_BASE_URL, HF_PROXY_BASE_URL].filter(Boolean);
    return configuredHosts.some((candidate) => {
      try {
        return new URL(candidate).hostname.toLowerCase() === hostname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .replace(/[\r\n\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim();
  return cleaned || 'download.file';
}

function buildContentDisposition(filename: string): string {
  const safeFilename = sanitizeFilename(filename);
  const asciiFallback = safeFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encodedFilename = encodeURIComponent(safeFilename).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

function getUpstreamUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (/^hf-mirror\.com$/i.test(parsed.hostname)) {
      parsed.hostname = 'huggingface.co';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') || '';
  if (!isAllowedDownloadUrl(url)) {
    return new Response('Download URL is not allowed.', { status: 400 });
  }

  const filename = sanitizeFilename(request.nextUrl.searchParams.get('filename') || '');
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('User-Agent', 'GalibierHub/1.0');
  upstreamHeaders.set('Accept', '*/*');
  const range = request.headers.get('range');
  if (range) upstreamHeaders.set('Range', range);

  let upstream: Response;
  try {
    upstream = await fetch(getUpstreamUrl(url), {
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    return new Response('Upstream download failed.', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`Upstream download failed with status ${upstream.status}.`, {
      status: upstream.status,
    });
  }

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Disposition', buildContentDisposition(filename));
  responseHeaders.set('Content-Type', 'application/octet-stream');
  responseHeaders.set('Cache-Control', 'private, no-store');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);
  const contentEncoding = upstream.headers.get('content-encoding');
  if (contentEncoding) responseHeaders.set('Content-Encoding', contentEncoding);
  if (upstream.status === 206) {
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);
    responseHeaders.set('Accept-Ranges', 'bytes');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
