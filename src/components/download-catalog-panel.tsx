'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DownloadActions from '@/components/download-actions';
import { formatDownloadBytes } from '@/lib/download-info';

type DownloadCatalogItem = {
  id: string;
  url: string;
  label: string;
  description: string;
  sizeLabel: string;
  sizeBytes: number | null;
  showCli: boolean;
  providerLabel: string;
  sourceScope: 'featured' | 'sample' | 'mixed';
  sampleCount: number;
  sampleIds: string[];
  kinds: string[];
  hidden?: boolean;
  updatedAt?: string | null;
  sha256Checksum?: string | null;
  md5Checksum?: string | null;
};

type FolderNode = {
  name: string;
  path: string;
  folders: Map<string, FolderNode>;
  items: DownloadCatalogItem[];
};

type FileRow = DownloadCatalogItem & {
  fileName: string;
  directoryPath: string;
  fileType: string;
  updatedLabel: string;
  sourceLabel: string;
};

type SortKey = 'name' | 'size' | 'updated';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

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
  if (!url) return 'galibierhub-data';
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const datasetsIndex = parts.indexOf('datasets');
    if (datasetsIndex !== -1 && parts.length > datasetsIndex + 2) {
      return decodeURIComponent(parts[datasetsIndex + 2]);
    }
    const firstSegment = parts[0];
    return firstSegment ? decodeURIComponent(firstSegment) : 'galibierhub-data';
  } catch {
    const parts = url.split('?')[0].split('/').filter(Boolean);
    return parts[0] || 'galibierhub-data';
  }
}

function deriveRootLabelFromItems(items: DownloadCatalogItem[]): string {
  for (const item of items) {
    if (!item.url) continue;
    const label = deriveRootLabel(item.url);
    if (label) return label;
  }
  return 'galibierhub-data';
}

function deriveFileType(fileName: string): string {
  const dotIndex = fileName.indexOf('.');
  if (dotIndex === -1) return 'File';
  return fileName.slice(dotIndex);
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

function folderSummary(node: FolderNode): { folderCount: number; fileCount: number } {
  let folderCount = node.folders.size;
  let fileCount = node.items.length;
  for (const folder of node.folders.values()) {
    const child = folderSummary(folder);
    folderCount += child.folderCount;
    fileCount += child.fileCount;
  }
  return { folderCount, fileCount };
}

function collectNodeItems(node: FolderNode): DownloadCatalogItem[] {
  const results = [...node.items];
  for (const folder of node.folders.values()) {
    results.push(...collectNodeItems(folder));
  }
  return results;
}

function formatUpdatedDate(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toISOString().slice(0, 10);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildFolderCommands(folderItems: FileRow[], rootLabel: string, path: string): { wget: string; curl: string; hf: string } {
  const scopeLabelValue = path ? `${rootLabel}/${path}` : rootLabel;
  const publicItems = folderItems.filter((item) => item.url);
  const header = `# GalibierHub directory download\n# Scope: ${scopeLabelValue}\n# Files: ${publicItems.length}\n`;
  const wget = `${header}${publicItems.map((item) => `wget -c -O "${item.fileName}" "${item.url}"`).join('\n')}`;
  const curl = `${header}${publicItems.map((item) => `curl -L -C - -o "${item.fileName}" "${item.url}"`).join('\n')}`;
  const hf = `${header}${publicItems
    .map((item) => {
      const marker = '/resolve/main/';
      const parsed = new URL(item.url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const datasetsIndex = parts.indexOf('datasets');
      const repo = datasetsIndex !== -1 && parts.length > datasetsIndex + 2
        ? `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`
        : null;
      const markerIndex = parsed.pathname.indexOf(marker);
      const relative = markerIndex >= 0 ? parsed.pathname.slice(markerIndex + marker.length) : '';
      if (!repo || !relative) return '';
      return `hf download ${repo} ${relative} --repo-type dataset --local-dir .`;
    })
    .filter(Boolean)
    .join('\n')}`;
  return { wget, curl, hf };
}

function buildManifestRows(folderItems: FileRow[], rootLabel: string): Array<Record<string, string>> {
  return folderItems.map((item) => ({
    Directory_Path: item.directoryPath ? `${rootLabel}/${item.directoryPath}` : rootLabel,
    File_Name: item.fileName,
    File_Type: item.fileType,
    Size_Bytes: item.sizeBytes != null ? String(item.sizeBytes) : '',
    Direct_URL: item.url,
    'SHA-256': item.sha256Checksum || 'NA',
  }));
}

function buildManifestTsv(rows: Array<Record<string, string>>): string {
  const headers = ['Directory_Path', 'File_Name', 'File_Type', 'Size_Bytes', 'Direct_URL', 'SHA-256'];
  return [
    headers.join('\t'),
    ...rows.map((row) => headers.map((header) => row[header] ?? '').join('\t')),
  ].join('\n');
}

function buildManifestCsv(rows: Array<Record<string, string>>): string {
  const headers = ['Directory_Path', 'File_Name', 'File_Type', 'Size_Bytes', 'Direct_URL', 'SHA-256'];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(',')),
  ].join('\n');
}

function buildChecksumFile(folderItems: FileRow[], algorithm: 'md5' | 'sha256'): string {
  const lines = folderItems
    .filter((item) => (algorithm === 'sha256' ? item.sha256Checksum : item.md5Checksum))
    .map((item) => `${algorithm === 'sha256' ? item.sha256Checksum : item.md5Checksum}  ${item.fileName}`);
  return lines.join('\n');
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
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [folderCliOpen, setFolderCliOpen] = useState(false);
  const [folderCliCopied, setFolderCliCopied] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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

  const childFolderSummaries = useMemo(
    () => childFolders.map((folder) => ({ folder, summary: folderSummary(folder) })),
    [childFolders],
  );

  const visibleFiles = useMemo<FileRow[]>(() => {
    const rows = currentNode.items.map((item) => {
      const fileName = deriveFileName(item.url);
      return {
        ...item,
        fileName,
        directoryPath: deriveFolderPath(item.url),
        fileType: deriveFileType(fileName),
        updatedLabel: formatUpdatedDate(item.updatedAt),
        sourceLabel: scopeLabel(item.sourceScope),
      };
    });
    return rows.sort((a, b) => {
      let value = 0;
      if (sortKey === 'name') value = a.fileName.localeCompare(b.fileName);
      if (sortKey === 'size') value = (a.sizeBytes ?? -1) - (b.sizeBytes ?? -1);
      if (sortKey === 'updated') value = (a.updatedAt ? new Date(a.updatedAt).getTime() : 0) - (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return sortDirection === 'asc' ? value : -value;
    });
  }, [currentNode, sortDirection, sortKey]);

  const currentFolderItems = useMemo<FileRow[]>(() => {
    return collectNodeItems(currentNode).map((item) => {
      const fileName = deriveFileName(item.url);
      return {
        ...item,
        fileName,
        directoryPath: deriveFolderPath(item.url),
        fileType: deriveFileType(fileName),
        updatedLabel: formatUpdatedDate(item.updatedAt),
        sourceLabel: scopeLabel(item.sourceScope),
      };
    });
  }, [currentNode]);

  const totals = useMemo(() => ({
    all: filteredItems.length,
    hf: filteredItems.filter((item) => item.providerLabel === 'Hugging Face').length,
    cf: filteredItems.filter((item) => item.providerLabel === 'Cloudflare').length,
  }), [filteredItems]);

  const currentFolderSummary = useMemo(() => folderSummary(currentNode), [currentNode]);

  const folderCommands = useMemo(
    () => buildFolderCommands(currentFolderItems, rootLabel, currentPath),
    [currentFolderItems, currentPath, rootLabel],
  );

  const showBlockingLoader = loading && items.length === 0;

  const readmeText = useMemo(() => {
    const header = '# Directory: ' + rootLabel + (currentPath ? '/' + currentPath : '') + '\n\n';
    const summary = 'Files: ' + visibleFiles.length + ' | Folders: ' + currentFolderSummary.folderCount + '\n\n';
    const fileList = visibleFiles.map((item) => {
      const size = item.sizeBytes ? formatDownloadBytes(item.sizeBytes) : (item.sizeLabel || 'Unknown');
      return '- ' + item.fileName + '  (' + size + (item.updatedLabel ? ', ' + item.updatedLabel : '') + ')';
    });
    return header + summary + fileList.join('\n');
  }, [rootLabel, currentPath, visibleFiles, currentFolderSummary]);

  const totalPages = Math.max(1, Math.ceil(visibleFiles.length / pageSize));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleFiles.slice(start, start + pageSize);
  }, [visibleFiles, currentPage, pageSize]);

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleFiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleFiles.map((item) => item.id)));
    }
  };

  const selectedFiles = visibleFiles.filter((item) => selectedIds.has(item.id));

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'updated' ? 'desc' : 'asc');
  };

  const exportManifest = (format: 'tsv' | 'csv') => {
    const rows = buildManifestRows(currentFolderItems, rootLabel);
    const fileBase = currentPath ? currentPath.replace(/[\/]/g, '_') : rootLabel;
    if (format === 'tsv') {
      downloadText(`${fileBase}-manifest.tsv`, buildManifestTsv(rows), 'text/tab-separated-values;charset=utf-8');
      return;
    }
    downloadText(`${fileBase}-manifest.csv`, buildManifestCsv(rows), 'text/csv;charset=utf-8');
  };

  const _exportChecksum = (algorithm: 'md5' | 'sha256') => {
    const fileBase = currentPath ? currentPath.replace(/[\/]/g, '_') : rootLabel;
    const content = buildChecksumFile(currentFolderItems, algorithm);
    if (!content.trim()) {
      setStatusMessage(`No ${algorithm.toUpperCase()} checksums are available in this directory yet.`);
      return;
    }
    downloadText(`${fileBase}-${algorithm}sum.txt`, content, 'text/plain;charset=utf-8');
  };

  const handleCopyFolderCommand = useCallback(async (copyKey: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFolderCliCopied(copyKey);
      window.setTimeout(() => {
        setFolderCliCopied((current) => (current === copyKey ? null : current));
      }, 1600);
    } catch {
      setFolderCliCopied(null);
    }
  }, []);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Downloads</h2>
            <p className="mt-1 text-sm text-gray-600">
              Browse files by directory, export manifests, and choose browser or CLI delivery.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Files: {totals.all}</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">Folders: {currentFolderSummary.folderCount}</span>
              {visibleFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReadmeOpen(true)}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  README
                </button>
              )}
            </div>
          </div>
          {effectiveIsAdmin && (
            <p className="text-xs text-amber-700">
              Hidden files remain visible only to Administrator.
            </p>
          )}
        </div>
      </div>

      {showBlockingLoader && <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">Loading files...</div>}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
      {!error && warning && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{warning}</div>}
      {!error && statusMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">{statusMessage}</div>}

      {/* Academic License Banner */}
      {!error && !loading && (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-sm font-bold">CC</span>
              <div>
                <p className="text-sm font-semibold text-blue-900">Open Access Data</p>
                <p className="text-xs text-blue-700">Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline hover:text-blue-900">CC BY 4.0</a>. Please cite GalibierHub when using this data in publications.</p>
              </div>
            </div>
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors">Learn more</a>
          </div>
        </div>
      )}

      {!error && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => goToFolder('')}
              className={`rounded px-2 py-1 ${currentPath === '' ? 'font-semibold text-gray-900' : 'text-blue-700 hover:bg-blue-50'}`}
            >
              Downloads
            </button>
            <span className="text-gray-400">/</span>
            <button
              type="button"
              onClick={() => goToFolder('')}
              className={`rounded px-2 py-1 ${currentPath === '' ? 'font-semibold text-gray-900' : 'text-blue-700 hover:bg-blue-50'}`}
            >
              {rootLabel}
            </button>
            {breadcrumbParts.map((part, index) => {
              const path = breadcrumbParts.slice(0, index + 1).join('/');
              const active = path === currentPath;
              return (
                <div key={path} className="contents">
                  <span className="text-gray-400">/</span>
                  {active ? (
                    <span className="rounded px-2 py-1 font-semibold text-gray-900">{part}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToFolder(path)}
                      className="rounded px-2 py-1 text-blue-700 hover:bg-blue-50"
                    >
                      {part}
                    </button>
                  )}
                </div>
              );
            })}
            {currentPath && (
              <button
                type="button"
                onClick={goUp}
                className="ml-auto rounded border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                Up one level
              </button>
            )}
          </div>
        </div>
      )}

      {!error && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search files or folders"
                className="w-full rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-2 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 hover:bg-slate-200/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 lg:max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFolderCliOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  Copy Folder CLI
                </button>
                <button
                  type="button"
                  onClick={() => exportManifest('csv')}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all"
                >
                  Export Manifest CSV
                </button>
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] transition-all"
                  >
                    Download Selected ({selectedFiles.length})
                  </button>
                )}
              </div>
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                aria-label="Grid view"
                title="Grid view"
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                aria-label="Table view"
                title="Table view"
              >
                Table
              </button>
            </div>
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
            {childFolderSummaries.map(({ folder, summary }) => (
              <button
                key={folder.path}
                type="button"
                onClick={() => goToFolder(folder.path)}
                className="flex min-h-24 flex-col items-start justify-between rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <div>
                  <div className="text-base font-semibold text-gray-900 break-all">{folder.name}</div>
                  <div className="mt-1 text-xs text-gray-500 break-all">
                    {rootLabel}/{folder.path}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Folders: {summary.folderCount} | Files: {summary.fileCount}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!error && visibleFiles.length > 0 && viewMode === 'grid' && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">Files</div>
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
            {paginatedFiles.map((item) => (
              <div key={item.id} className={`flex min-h-44 flex-col justify-between gap-4 border p-4 ${selectedIds.has(item.id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-gray-900 break-all leading-snug">{item.fileName}</div>
                      <div className="mt-1 text-xs text-gray-500 break-all">{rootLabel}/{item.directoryPath || ''}</div>
                    </div>
                    {item.hidden && effectiveIsAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Hidden</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{item.fileType}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{item.sourceLabel}</span>
                    {item.sampleCount > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">Samples: {item.sampleCount}</span>}
                  </div>
                  <div className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                    <div>Size: {formatDownloadBytes(item.sizeBytes) || item.sizeLabel || 'Unknown'}</div>
                    <div>Updated: {item.updatedLabel}</div>
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
                  compact
                  onMetadataSaved={(next) => handleMetadataSaved(item.id, next.hidden)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {!error && visibleFiles.length > 0 && viewMode === 'table' && (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-10">
                    <input
                      type="checkbox"
                      checked={paginatedFiles.length > 0 && paginatedFiles.every((item) => selectedIds.has(item.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 text-left text-gray-600 hover:text-gray-900">
                      Name
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <button type="button" onClick={() => toggleSort('size')} className="inline-flex items-center gap-1 text-left text-gray-600 hover:text-gray-900">
                      Size
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <button type="button" onClick={() => toggleSort('updated')} className="inline-flex items-center gap-1 text-left text-gray-600 hover:text-gray-900">
                      Updated
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedFiles.map((item) => (
                  <tr key={item.id} className={selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded bg-blue-50 px-2 text-[11px] font-medium text-blue-700">
                          {item.fileType.replace('.', '') || 'file'}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 break-all">{item.fileName}</span>
                            {item.hidden && effectiveIsAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Hidden</span>}
                          </div>
                          <div className="mt-1 text-xs text-gray-500 break-all">{rootLabel}/{item.directoryPath || ''}</div>
                          <div className="mt-1 text-xs text-gray-400">
                            {item.sourceLabel}
                            {item.sampleCount > 0 ? ` | Samples: ${item.sampleCount}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatDownloadBytes(item.sizeBytes) || item.sizeLabel || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.updatedLabel}</td>
                    <td className="px-4 py-3">
                      <DownloadActions
                        url={item.url}
                        label="Download"
                        sizeLabel={item.sizeLabel}
                        description={item.description}
                        showCli={item.showCli}
                        isAdmin={effectiveIsAdmin}
                        accessToken={accessToken}
                        initialHidden={item.hidden}
                        compact
                        onMetadataSaved={(next) => handleMetadataSaved(item.id, next.hidden)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}


      {/* Pagination controls */}
      {visibleFiles.length > pageSize && (
        <nav className="mt-4 flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, visibleFiles.length)}</span> of <span className="font-medium">{visibleFiles.length}</span> files
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`inline-flex items-center rounded px-3 py-1.5 text-sm font-medium ${page === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {folderCliOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setFolderCliOpen(false)}>
          <div className="my-8 w-full max-w-4xl rounded-lg border border-gray-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Directory CLI</h3>
                <p className="mt-1 text-sm text-gray-600">{currentPath ? `${rootLabel}/${currentPath}` : rootLabel}</p>
              </div>
              <button type="button" onClick={() => setFolderCliOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-600">
                Export commands for the current directory and all nested files. Use the manifest TSV/CSV when you need downstream pipeline input tables.
              </p>
              {[
                { key: 'wget', title: 'wget -c', content: folderCommands.wget },
                { key: 'curl', title: 'curl -L -C -', content: folderCommands.curl },
                { key: 'hf', title: 'hf download', content: folderCommands.hf },
              ].map((block) => (
                <div key={block.key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">{block.title}</span>
                    <button type="button" onClick={() => void handleCopyFolderCommand(block.key, block.content)} className="text-xs text-blue-600 hover:underline">
                      {folderCliCopied === block.key ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <code className="block whitespace-pre-wrap break-all rounded bg-white px-3 py-3 font-mono text-xs text-gray-800 ring-1 ring-gray-200">
                    {block.content || '# No command available for this directory.'}
                  </code>
                </div>
              ))}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                For reproducibility, pair these commands with <code>sha256sum.txt</code> and the manifest export from the same directory.
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Batch download dialog */}
      {batchOpen && selectedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setBatchOpen(false)}>
          <div className="my-8 w-full max-w-3xl rounded-lg border border-gray-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Batch Download ({selectedFiles.length} files)</h3>
                <p className="mt-1 text-sm text-gray-600">Download selected files via browser or command line.</p>
              </div>
              <button type="button" onClick={() => setBatchOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-800">Browser download</span>
                </div>
                <p className="mb-3 text-xs text-gray-600">Downloads each file directly in your browser. Multiple files will download sequentially.</p>
                <button
                  type="button"
                  onClick={() => { selectedFiles.forEach((item) => { const a = document.createElement('a'); a.href = item.url; a.download = item.fileName || ''; a.click(); }); }}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  Start Browser Download
                </button>
              </div>
              {[
                { key: 'wget', title: 'wget', cmd: selectedFiles.map((item) => `wget -c "${item.url}"`).join('\n') },
                { key: 'curl', title: 'curl', cmd: selectedFiles.map((item) => `curl -L -C - -O "${item.url}"`).join('\n') },
              ].map((block) => (
                <div key={block.key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">{block.title}</span>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(block.cmd); }} className="text-xs text-blue-600 hover:underline">Copy</button>
                  </div>
                  <code className="block whitespace-pre-wrap break-all rounded bg-white px-3 py-3 font-mono text-xs text-gray-800 ring-1 ring-gray-200">{block.cmd}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* README floating card */}
      {readmeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end overflow-y-auto bg-black/30 p-4" onClick={() => setReadmeOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">README</h3>
              <button
                type="button"
                onClick={() => setReadmeOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close README"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="prose prose-sm max-w-none px-4 py-3 text-gray-700" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {readmeText}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
