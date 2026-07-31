import { NextResponse } from 'next/server';
import { SiteConfig } from '@/site-config';
import { getEffectiveStorageBaseUrl, getStorageUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sanitizeBed(text: string): string {
  const lines = stripBom(text).split(/\r\n|\r|\n/);
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/[\t ]+$/, '');
    if (!line.trim()) continue;

    const trimmed = line.trimStart();
    if (trimmed.startsWith('#') || /^(track|browser|chrom)\s/i.test(trimmed)) continue;

    const tabIndex = line.indexOf('\t');
    if (tabIndex <= 0) continue;

    const refName = line.slice(0, tabIndex).trim();
    if (!refName || /\s/.test(refName)) continue;

    cleaned.push(line);
  }

  return cleaned.join('\n') + (cleaned.length ? '\n' : '');
}

const TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=300, s-maxage=300',
};

export async function GET() {
  const assemblyName = SiteConfig.jbrowse.defaultAssembly;
  const assembly = SiteConfig.jbrowse.assemblies[assemblyName];
  const bedTrack = assembly?.tracks?.find((track) => track.trackId === 'annotations-bed');
  const sourcePath = bedTrack?.adapter?.bedLocation;

  if (!sourcePath) {
    return NextResponse.json({ error: 'Reference BED track is not configured.' }, { status: 500 });
  }

  const sourceUrl = getStorageUrl(sourcePath, getEffectiveStorageBaseUrl(), { preferProxy: false });
  if (!sourceUrl) {
    return NextResponse.json({ error: 'Reference storage is not configured.' }, { status: 500 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl, { cache: 'no-store', redirect: 'follow' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Failed to load reference BED: ${message}`, { status: 502, headers: TEXT_HEADERS });
  }

  if (!upstream.ok) {
    return new Response(`Failed to load reference BED: ${upstream.status}`, { status: 502, headers: TEXT_HEADERS });
  }

  const text = await upstream.text();
  return new Response(sanitizeBed(text), { status: 200, headers: TEXT_HEADERS });
}