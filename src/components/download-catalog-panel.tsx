'use client';

import { useEffect, useMemo, useState } from 'react';
import DownloadActions from '@/components/download-actions';
import { useDownloadVisibility } from '@/hooks/use-download-visibility';
import { getDirectDownloadUrl } from '@/lib/storage';

type DownloadCatalogItem = {
  id: string;
  url: string;
  label: string;
  description: string;
  sizeLabel: string;
  showCli: boolean;
  providerLabel: string;
  sourceScope: 'featured' | 'sample' | 'mixed';
  sampleCount: number;
  sampleIds: string[];
  kinds: string[];
};

type DownloadCatalogGroup = {
  folderPath: string;
  items: DownloadCatalogItem[];
};

function deriveFolderPath(url: string): string {
  if (!url) return 'Root';
  try {
    const parsed = new URL(url);
    const marker = '/resolve/main/';
    const pathname = parsed.pathname;
    const index = pathname.indexOf(marker);
    const relative = index >= 0 ? pathname.slice(index + marker.length) : pathname.replace(/^\/+/, '');
    const segments = relative.split('/').filter(Boolean);
    if (segments.length <= 1) return 'Root';
    return segments.slice(0, -1).join('/');
  } catch {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    if (segments.length <= 1) return 'Root';
    return segments.slice(0, -1).join('/');
  }
}

function deriveFileName(url: string): string {
  if (!url) return 'download.file';
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'download.file');
  } catch {
    return url.split('?')[0].split('/').filter(Boolean).pop() || 'download.file';
  }
}

function scopeLabel(scope: DownloadCatalogItem['sourceScope']): string {
  if (scope === 'mixed') return 'Overview + records';
  if (scope === 'featured') return 'Overview source';
  return 'Record source';
}

export default function DownloadCatalogPanel({
  isAdmin = false,
  accessToken = null,
}: {
  isAdmin?: boolean;
  accessToken?: string | null;
}) {
  const [items, setItems] = useState<DownloadCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch('/api/download-catalog')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data?.items)) {
          setItems(data.items as DownloadCatalogItem[]);
          return;
        }
        setError(data?.error || 'Failed to load download catalog.');
      })
      .catch(() => {
        if (active) setError('Failed to load download catalog.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedItems = useMemo(
    () => items.map((item) => ({ ...item, url: getDirectDownloadUrl(item.url) })),
    [items],
  );

  const { isVisible, loaded } = useDownloadVisibility(
    normalizedItems.map((item) => item.url),
    isAdmin,
  );

  const visibleItems = useMemo(
    () => normalizedItems.filter((item) => isVisible(item.url)),
    [normalizedItems, isVisible],
  );

  const groupedItems = useMemo<DownloadCatalogGroup[]>(() => {
    const groups = new Map<string, DownloadCatalogItem[]>();
    for (const item of visibleItems) {
      const key = deriveFolderPath(item.url);
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    }
    return Array.from(groups.entries())
      .map(([folderPath, grouped]) => ({
        folderPath,
        items: grouped.sort((a, b) => deriveFileName(a.url).localeCompare(deriveFileName(b.url))),
      }))
      .sort((a, b) => {
        if (a.folderPath === 'Root') return -1;
        if (b.folderPath === 'Root') return 1;
        return a.folderPath.localeCompare(b.folderPath);
      });
  }, [visibleItems]);

  const totals = useMemo(() => ({
    all: visibleItems.length,
    hf: visibleItems.filter((item) => item.providerLabel === 'Hugging Face').length,
    cf: visibleItems.filter((item) => item.providerLabel === 'Cloudflare').length,
  }), [visibleItems]);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Downloads</h2>
            <p className="mt-1 text-sm text-gray-600">
              Browse all downloadable files exposed by this site, grouped by their storage folder path.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="rounded bg-gray-100 px-2 py-1">All: {totals.all}</span>
            <span className="rounded bg-gray-100 px-2 py-1">Hugging Face: {totals.hf}</span>
            <span className="rounded bg-gray-100 px-2 py-1">Cloudflare: {totals.cf}</span>
          </div>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">Loading download catalog...</div>}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && !loaded && <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">Checking visibility rules...</div>}

      {!loading && !error && loaded && groupedItems.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          No public downloads are currently available.
        </div>
      )}

      {!loading && !error && loaded && groupedItems.map((group) => (
        <section key={group.folderPath} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                {group.folderPath === 'Root' ? 'Root' : group.folderPath}
              </span>
              <span className="text-xs text-gray-500">
                {group.folderPath === 'Root'
                  ? 'Files stored at the repository root.'
                  : 'Files stored in this folder path.'}
              </span>
            </div>
          </div>
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
            {group.items.map((item) => {
              const fileName = deriveFileName(item.url);
              return (
                <div key={item.id} className="flex min-h-36 flex-col justify-between gap-3 border border-gray-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 break-all">{fileName}</div>
                    <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className="rounded bg-gray-100 px-2 py-0.5">{item.providerLabel}</span>
                      <span className="rounded bg-gray-100 px-2 py-0.5">{scopeLabel(item.sourceScope)}</span>
                      {item.sampleCount > 0 && <span className="rounded bg-gray-100 px-2 py-0.5">Samples: {item.sampleCount}</span>}
                      {item.kinds.length > 0 && <span className="rounded bg-gray-100 px-2 py-0.5">Types: {item.kinds.join(', ')}</span>}
                    </div>
                  </div>
                  <DownloadActions
                    url={item.url}
                    label="Download"
                    sizeLabel={item.sizeLabel}
                    description={item.description}
                    showCli={item.showCli}
                    isAdmin={isAdmin}
                    accessToken={accessToken}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
