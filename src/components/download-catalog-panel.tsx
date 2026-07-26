'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type FolderNode = {
  name: string;
  path: string;
  folders: Map<string, FolderNode>;
  items: DownloadCatalogItem[];
};

function deriveFolderPath(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const marker = '/resolve/main/';
    const pathname = parsed.pathname;
    const index = pathname.indexOf(marker);
    const relative = index >= 0 ? pathname.slice(index + marker.length) : pathname.replace(/^\/+/, '');
    const segments = relative.split('/').filter(Boolean);
    if (segments.length <= 1) return '';
    return segments.slice(0, -1).join('/');
  } catch {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    if (segments.length <= 1) return '';
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

function deriveRootLabel(url: string | undefined): string {
  if (!url) return 'seqedge-data';
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const datasetsIndex = parts.indexOf('datasets');
    if (datasetsIndex !== -1 && parts.length > datasetsIndex + 2) {
      return decodeURIComponent(parts[datasetsIndex + 2]);
    }
    const firstSegment = parts[0];
    return firstSegment ? decodeURIComponent(firstSegment) : 'seqedge-data';
  } catch {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    return parts[0] || 'seqedge-data';
  }
}

function deriveRootLabelFromItems(items: DownloadCatalogItem[]): string {
  for (const item of items) {
    if (!item.url) continue;
    const label = deriveRootLabel(item.url);
    if (label) return label;
  }
  return 'seqedge-data';
}

function scopeLabel(scope: DownloadCatalogItem['sourceScope']): string {
  if (scope === 'mixed') return 'Overview + records';
  if (scope === 'featured') return 'Overview source';
  return 'Record source';
}

function buildTree(items: DownloadCatalogItem[]): FolderNode {
  const root: FolderNode = {
    name: 'Root',
    path: '',
    folders: new Map<string, FolderNode>(),
    items: [],
  };

  for (const item of items) {
    const folderPath = deriveFolderPath(item.url);
    const segments = folderPath ? folderPath.split('/').filter(Boolean) : [];
    let current = root;
    for (const segment of segments) {
      const nextPath = current.path ? `${current.path}/${segment}` : segment;
      if (!current.folders.has(segment)) {
        current.folders.set(segment, {
          name: segment,
          path: nextPath,
          folders: new Map<string, FolderNode>(),
          items: [],
        });
      }
      current = current.folders.get(segment)!;
    }
    current.items.push(item);
  }

  return root;
}

export default function DownloadCatalogPanel({
  isAdmin = false,
  accessToken = null,
}: {
  isAdmin?: boolean;
  accessToken?: string | null;
}) {
  const [items, setItems] = useState<DownloadCatalogItem[]>([]);
  const [effectiveIsAdmin, setEffectiveIsAdmin] = useState(isAdmin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [currentPath, setCurrentPath] = useState('');

  const loadCatalog = useCallback(async () => {
    let active = true;
    setLoading(true);
    setError(null);
    const headers: HeadersInit = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
    try {
      const res = await fetch('/api/download-catalog', { headers });
      const data = await res.json();
      if (!active) return () => {
        active = false;
      };
      if (Array.isArray(data?.items)) {
        setItems(data.items as DownloadCatalogItem[]);
        setEffectiveIsAdmin(Boolean(isAdmin) || Boolean(data?.isAdmin));
        setWarning(typeof data?.warning === 'string' && data.warning.trim() ? data.warning : null);
      } else {
        setError(data?.error || 'Failed to load download catalog.');
      }
    } catch {
      if (active) setError('Failed to load download catalog.');
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  useEffect(() => {
    let cleanup: undefined | (() => void);
    void loadCatalog().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [loadCatalog]);

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

  const tree = useMemo(() => buildTree(filteredItems), [filteredItems]);

  const currentNode = useMemo(() => {
    if (!currentPath) return tree;
    const segments = currentPath.split('/').filter(Boolean);
    let node: FolderNode | undefined = tree;
    for (const segment of segments) {
      node = node.folders.get(segment);
      if (!node) break;
    }
    return node || tree;
  }, [tree, currentPath]);

  const breadcrumbParts = useMemo(() => currentPath.split('/').filter(Boolean), [currentPath]);
  const rootLabel = useMemo(() => deriveRootLabelFromItems(items), [items]);

  const childFolders = useMemo(() => {
    const entries = Array.from(currentNode.folders.values());
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [currentNode]);

  const visibleFiles = useMemo(() => {
    return [...currentNode.items].sort((a, b) => deriveFileName(a.url).localeCompare(deriveFileName(b.url)));
  }, [currentNode]);

  const totals = useMemo(() => ({
    all: filteredItems.length,
    hf: filteredItems.filter((item) => item.providerLabel === 'Hugging Face').length,
    cf: filteredItems.filter((item) => item.providerLabel === 'Cloudflare').length,
  }), [filteredItems]);

  const showBlockingLoader = loading && items.length === 0;

  const handleMetadataSaved = (itemId: string, hidden: boolean) => {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, hidden } : item)));
    setStatusMessage(
      hidden
        ? 'Hidden from visitors. Still visible to Administrator.'
        : 'Visible to visitors.',
    );
    void loadCatalog();
  };

  const goToFolder = (path: string) => setCurrentPath(path);

  const goUp = () => {
    if (!currentPath) return;
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    setCurrentPath(segments.join('/'));
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Downloads</h2>
            <p className="mt-1 text-sm text-gray-600">
              Browse files by directory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">All: {totals.all}</span>
            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Hugging Face: {totals.hf}</span>
            <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Cloudflare: {totals.cf}</span>
          </div>
        </div>
        <div className="mt-4">
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search files or folders"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-500 lg:max-w-md"
          />
        </div>
        {effectiveIsAdmin && (
          <p className="mt-3 text-xs text-amber-700">
            Hidden files are visible only to Administrator.
          </p>
        )}
      </div>

      {showBlockingLoader && <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">Loading files...</div>}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
      {!error && warning && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{warning}</div>}
      {!error && statusMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">{statusMessage}</div>}

      {!error && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => goToFolder('')}
              className={`rounded px-2 py-1 ${currentPath === '' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
            >
              {rootLabel}
            </button>
            {breadcrumbParts.map((part, index) => {
              const path = breadcrumbParts.slice(0, index + 1).join('/');
              const active = path === currentPath;
              return (
                <div key={path} className="flex items-center gap-2">
                  <span className="text-gray-400">/</span>
                  <button
                    type="button"
                    onClick={() => goToFolder(path)}
                    className={`rounded px-2 py-1 ${active ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                  >
                    {part}
                  </button>
                </div>
              );
            })}
            {currentPath && (
              <button
                type="button"
                onClick={goUp}
                className="ml-auto rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
              >
                Up
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && childFolders.length === 0 && visibleFiles.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
          No matching files or folders.
        </div>
      )}

      {!error && childFolders.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">Folders</div>
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {childFolders.map((folder) => (
              <button
                key={folder.path}
                type="button"
                onClick={() => goToFolder(folder.path)}
                className="flex min-h-24 flex-col items-start justify-between rounded-lg border border-blue-100 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="text-base font-semibold text-gray-900 break-all">{folder.name}</div>
                <div className="text-xs text-gray-500">
                  Folders: {folder.folders.size} | Files: {folder.items.length}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!error && visibleFiles.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">Files</div>
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
            {visibleFiles.map((item) => {
              const fileName = deriveFileName(item.url);
              return (
                <div key={item.id} className="flex min-h-36 flex-col justify-between gap-3 border border-gray-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-gray-900 break-all leading-snug">{fileName}</div>
                    <div className="text-xs font-normal text-gray-500">{item.label}</div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span className={`rounded px-2 py-0.5 ${item.providerLabel === 'Cloudflare' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{item.providerLabel}</span>
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{scopeLabel(item.sourceScope)}</span>
                    {item.hidden && effectiveIsAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">Hidden</span>}
                      {item.sampleCount > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">Samples: {item.sampleCount}</span>}
                      {item.kinds.length > 0 && <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Types: {item.kinds.join(', ')}</span>}
                    </div>
                  </div>
                  <DownloadActions
                    url={item.url}
                    label="Download"
                    sizeLabel={item.sizeLabel}
                    description={item.description}
                    showCli={item.showCli}
                        isAdmin={effectiveIsAdmin}
                    accessToken={accessToken}
                    initialHidden={item.hidden}
                    onMetadataSaved={(next) => handleMetadataSaved(item.id, next.hidden)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
