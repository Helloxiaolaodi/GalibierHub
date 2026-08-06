import { NextRequest, NextResponse } from 'next/server';
import { HF_PROXY_BASE_URL, STORAGE_BASE_URL } from '@/lib/storage';

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

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url') || '';
  if (!isAllowedDownloadUrl(url)) {
    return new Response('Download URL is not allowed.', { status: 400 });
  }

  return NextResponse.redirect(new URL(url), 302);
}
