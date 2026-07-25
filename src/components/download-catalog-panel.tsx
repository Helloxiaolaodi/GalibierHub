'use client';

import { useEffect, useMemo, useState } from 'react';
import DownloadActions from '@/components/download-actions';

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
  hidden?: boolean;
};

type DownloadCatalogGroup = {
  folderPath: string;
  items: DownloadCatalogItem[];
};

type DownloadSortMode = 'folder_asc' | 'folder_desc' | 'file_asc' | 'file_desc';

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
  const [warning, setWarning] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<DownloadSortMode>('folder_asc');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setWarning(null);
    const headers: HeadersInit = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
    fetch('/api/download-catalog', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data?.items)) {
          setItems(data.items as DownloadCatalogItem[]);
          setWarning(typeof data?.warning === 'string' && data.warning.trim() ? data.warning : null);
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
  }, [accessToken]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const fileName = deriveFileName(item.url).toLowerCase();
      const folderPath = deriveFolderPath(item.url).toLowerCase();
      const label = item.label.toLowerCase();
      const description = item.description.toLowerCase();
      return fileName.includes(keyword)
        || folderPath.includes(keyword)
        || label.includes(keyword)
        || description.includes(keyword);
    });
  }, [items, searchText]);

  const groupedItems = useMemo<DownloadCatalogGroup[]>(() => {
    const groups = new Map<string, DownloadCatalogItem[]>();
    for (const item of filteredItems) {
      const key = deriveFolderPath(item.url);
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    }

    const sortItems = (grouped: DownloadCatalogItem[]) => {
      const direction = sortMode === 'file_desc' ? -1 : 1;
      return grouped.sort((a, b) => direction * deriveFileName(a.url).localeCompare(deriveFileName(b.url)));
    };

    return Array.from(groups.entries())
      .map(([folderPath, grouped]) => ({
        folderPath,
        items: sortItems(grouped),
      }))
      .sort((a, b) => {
        const direction = sortMode === 'folder_desc' ? -1 : 1;
        if (sortMode === 'file_asc' || sortMode === 'file_desc') {
          if (a.folderPath === 'Root') return -1;
          if (b.folderPath === 'Root') return 1;
          return a.folderPath.localeCompare(b.folderPath);
        }
        if (a.folderPath === 'Root') return -1;
        if (b.folderPath === 'Root') return 1;
        return direction * a.folderPath.localeCompare(b.folderPath);
      });
  }, [filteredItems, sortMode]);

  const totals = useMemo(() => ({
    all: filteredItems.length,
    hf: filteredItems.filter((item) => item.providerLabel === 'Hugging Face').length,
    cf: filteredItems.filter((item) => item.providerLabel === 'Cloudflare').length,
  }), [filteredItems]);

  const showBlockingLoader = loading && items.length === 0;

  const handleMetadataSaved = (itemId: string, hidden: boolean) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, hidden } : item)));
  };

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
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Filter by file name or folder"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-500 lg:max-w-md"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSortMode('folder_asc')}
              className={`rounded px-3 py-2 ${sortMode === 'folder_asc' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Folder A-Z
            </button>
            <button
              type="button"
              onClick={() => setSortMode('folder_desc')}
              className={`rounded px-3 py-2 ${sortMode === 'folder_desc' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Folder Z-A
            </button>
            <button
              type="button"
              onClick={() => setSortMode('file_asc')}
              className={`rounded px-3 py-2 ${sortMode === 'file_asc' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              File A-Z
            </button>
            <button
              type="button"
              onClick={() => setSortMode('file_desc')}
              className={`rounded px-3 py-2 ${sortMode === 'file_desc' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              File Z-A
            </button>
          </div>
        </div>
      </div>

      {showBlockingLoader && <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">Loading download catalog...</div>}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
      {!error && warning && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{warning}</div>}

      {!loading && !error && groupedItems.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          No matching downloads were found.
        </div>
      )}

      {!error && groupedItems.map((group) => (
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
                    <div className="text-lg font-semibold text-gray-900 break-all leading-snug">{fileName}</div>
                    <div className="text-xs font-normal text-gray-500">{item.label}</div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className="rounded bg-gray-100 px-2 py-0.5">{item.providerLabel}</span>
                      <span className="rounded bg-gray-100 px-2 py-0.5">{scopeLabel(item.sourceScope)}</span>
                      {item.hidden && isAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">Hidden</span>}
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
                    initialHidden={item.hidden}
                    onMetadataSaved={(next) => handleMetadataSaved(item.id, next.hidden)}
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
