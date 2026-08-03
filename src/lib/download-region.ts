export type DownloadRegion = 'global' | 'apac';

const APAC_TZ_PREFIXES = ['Asia/', 'Australia/', 'Pacific/'];

function extractFileName(url: string): string {
  if (!url) return 'download.file';
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop() || 'download.file';
    return decodeURIComponent(name);
  } catch {
    return url.split('?')[0].split('/').filter(Boolean).pop() || 'download.file';
  }
}

export function getPreferredDownloadRegion(): DownloadRegion {
  if (typeof window === 'undefined') return 'global';
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (APAC_TZ_PREFIXES.some((prefix) => timeZone === prefix.slice(0, -1) || timeZone.startsWith(prefix))) {
      return 'apac';
    }
  } catch {
    // Fall through to UTC offset detection.
  }
  try {
    const utcOffsetMinutes = -new Date().getTimezoneOffset();
    if (utcOffsetMinutes >= 300 && utcOffsetMinutes <= 780) return 'apac';
  } catch {
    // Fall through to the default global endpoint.
  }
  return 'global';
}

export function selectDownloadUrl(
  publicUrl: string | null | undefined,
  mirrorUrl: string | null | undefined,
  region: DownloadRegion,
): string | null {
  if (region === 'apac' && mirrorUrl) return mirrorUrl;
  return publicUrl || mirrorUrl || null;
}

export function triggerBrowserDownload(url: string, filename?: string | null): void {
  if (typeof window === 'undefined' || !url) return;
  const safeFilename = filename || extractFileName(url);
  const downloadUrl = `/api/download-file?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeFilename)}`;
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = safeFilename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function resolveBrowserDownload(params: {
  download_key: string;
  label?: string | null;
  description?: string | null;
  password?: string;
  region?: DownloadRegion;
}): Promise<{ url: string; filename: string }> {
  const region = params.region || getPreferredDownloadRegion();
  const response = await fetch('/api/download-metadata/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      download_key: params.download_key,
      password: params.password || undefined,
      label: params.label || undefined,
      description: params.description || undefined,
    }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    url?: string;
    resolved?: {
      public_url?: string | null;
      mirror_public_url?: string | null;
      file_name?: string | null;
    };
    error?: string;
  };
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to prepare download URL.');
  }
  const targetUrl = selectDownloadUrl(data.resolved?.public_url || data.url, data.resolved?.mirror_public_url, region) || data.url;
  const filename = data.resolved?.file_name || extractFileName(targetUrl);
  return { url: targetUrl, filename };
}
