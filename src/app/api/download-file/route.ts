import { NextRequest } from 'next/server';
import { extractDownloadFileName } from '@/lib/download-info';
import { HF_PROXY_BASE_URL, STORAGE_BASE_URL } from '@/lib/storage';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

function safeContentDispositionFilename(filename: string): string {
  const cleaned = filename.replace(/[\u0000-\u001f\u007f]/g, '').replace(/["\\]/g, '_').trim();
  return cleaned || 'download.file';
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') || '';
  const filename = request.nextUrl.searchParams.get('filename') || extractDownloadFileName(url);
  if (!isAllowedDownloadUrl(url)) {
    return new Response('Download URL is not allowed.', { status: 400 });
  }

  const safeFilename = safeContentDispositionFilename(filename);
  const fallbackFilename = safeFilename.replace(/[^\x20-\x7e]/g, '_');
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'GalibierHub-Download/1.0',
  };
  const range = request.headers.get('range');
  if (range) upstreamHeaders.Range = range;

  try {
    const upstream = await fetch(url, { redirect: 'follow', headers: upstreamHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Upstream download failed (${upstream.status}).`, { status: upstream.status || 502 });
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Disposition', `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    responseHeaders.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.set('Accept-Ranges', 'bytes');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    if (!upstream.body) {
      return new Response('Upstream download returned an empty body.', { status: 502 });
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return new Response('Failed to reach the upstream download URL.', { status: 502 });
  }
}
