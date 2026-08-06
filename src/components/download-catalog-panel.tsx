'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import DownloadActions from '@/components/download-actions';
import { buildHfMirrorUrl, formatDownloadBytes, normalizeDownloadKey } from '@/lib/download-info';
import { getPreferredDownloadRegion, resolveBrowserDownload, triggerBrowserDownload, type DownloadRegion } from '@/lib/download-region';
import { renderMarkdown } from '@/lib/markdown';

type DownloadCatalogItem = {
  id: string;
  url: string;
  label: string;
  description: string;
  sizeLabel: string;
  sizeBytes: number | null;
  showCli: boolean;
  providerLabel: string;
  sourceScope: 'featured' | 'sample' | 'dataset' | 'mixed';
  sampleCount: number;
  sampleIds: string[];
  kinds: string[];
  catalogFolder?: string;
  hidden?: boolean;
  updatedAt?: string | null;
  sha256Checksum?: string | null;
  md5Checksum?: string | null;
  sha256_checksum?: string | null;
  sha256?: string | null;
  oid?: string | null;
  cksum?: string | null;
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

function fileTypeBadgeClass(fileType: string): string {
  const extension = fileType.replace(/^\./, '').toLowerCase();
  if (extension === 'pdf') return 'bg-red-50 text-red-700';
  if (['fasta', 'fa', 'fna', 'faa', 'fq', 'fastq'].includes(extension)) return 'bg-blue-50 text-blue-700';
  if (['gff', 'gff3', 'gtf', 'vcf', 'bed'].includes(extension)) return 'bg-violet-50 text-violet-700';
  if (['gb', 'genbank', 'gbk'].includes(extension)) return 'bg-emerald-50 text-emerald-700';
  if (['md', 'txt', 'readme', 'json', 'csv', 'tsv'].includes(extension)) return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-700';
}

function scopeLabel(scope: DownloadCatalogItem['sourceScope']): string {
  if (scope === 'mixed') return 'Mixed source';
  if (scope === 'featured') return 'Overview source';
  if (scope === 'sample') return 'Record source';
  return 'Dataset source';
}

function compareFolderNames(a: FolderNode, b: FolderNode): number {
  if (a.name === 'Records') return -1;
  if (b.name === 'Records') return 1;
  return a.name.localeCompare(b.name);
}

function buildTree(items: DownloadCatalogItem[], injectRecordsFolder = false): FolderNode {
  const root: FolderNode = {
    name: 'Root',
    path: '',
    folders: new Map<string, FolderNode>(),
    items: [],
  };

  if (injectRecordsFolder && !root.folders.has('Records')) {
    root.folders.set('Records', {
      name: 'Records',
      path: 'Records',
      folders: new Map<string, FolderNode>(),
      items: [],
    });
  }

  for (const item of items) {
    const folderPath = item.catalogFolder || deriveFolderPath(item.url);
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

function cleanChecksum(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'na' || trimmed.toLowerCase() === 'n/a') return '';
  return trimmed;
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

function deriveHfRepoId(folderItems: FileRow[]): string {
  for (const item of folderItems) {
    if (!item.url) continue;
    try {
      const parsed = new URL(item.url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const datasetsIndex = parts.indexOf('datasets');
      if (datasetsIndex !== -1 && parts.length > datasetsIndex + 2) {
        return `${parts[datasetsIndex + 1]}/${parts[datasetsIndex + 2]}`;
      }
    } catch {
      // Continue to the next item.
    }
  }
  return 'Helloxiaolaodi/seqedge-data';
}

function buildClusterPythonScript(repoId: string, folderPattern: string, region: DownloadRegion): string {
  if (region === 'apac') {
    return `import os
from huggingface_hub import snapshot_download

# ==========================================
# 1. Environment Variables: Mirror Routing & Acceleration
# ==========================================
# Force routing to the Asia-Pacific mirror node
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"

# ==========================================
# 2. Initialization and Download
# ==========================================
# <-- [USER MODIFICATION REQUIRED] Change to your target Hugging Face repository
repo_id = "${repoId}"

# <-- [USER MODIFICATION REQUIRED] Define the folder path you want to download recursively.
# Use 'folder_name/*' to grab all contents inside the target folder.
target_folder_pattern = "${folderPattern}"

# We will instruct the script to download to the current working directory
download_dir = "./"

print("\\nInitializing recursive folder download via Asia-Pacific (Mirror) Node...")

try:
    print(f"Fetching contents of '{target_folder_pattern}' from '{repo_id}'...")
    folder_path = snapshot_download(
        repo_id=repo_id,
        repo_type="dataset",
        allow_patterns=target_folder_pattern,
        local_dir=download_dir,
        local_dir_use_symlinks=False
    )
    print(f"\\nDownload successful! Folder contents safely downloaded to: {folder_path}")
except Exception as e:
    print(f"\\nDownload failed: {e}")
`;
  }

  return `import os
from huggingface_hub import snapshot_download

# ==========================================
# 1. Environment Variables: Official Node & Acceleration
# ==========================================
# Ensure no mirror endpoint is set in the environment for official routing
if "HF_ENDPOINT" in os.environ:
    del os.environ["HF_ENDPOINT"]

os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"
os.environ["HF_HUB_DISABLE_XET"] = "1"

# ==========================================
# 2. Initialization and Download
# ==========================================
# <-- [USER MODIFICATION REQUIRED] Change to your target Hugging Face repository
repo_id = "${repoId}"

# <-- [USER MODIFICATION REQUIRED] Define the folder path you want to download recursively.
# Use 'folder_name/*' to grab all contents inside the target folder.
target_folder_pattern = "${folderPattern}"

# We will instruct the script to download to the current working directory
download_dir = "./"

print("\\nInitializing recursive folder download via Global (Official) Node...")

try:
    print(f"Fetching contents of '{target_folder_pattern}' from '{repo_id}'...")
    folder_path = snapshot_download(
        repo_id=repo_id,
        repo_type="dataset",
        allow_patterns=target_folder_pattern,
        local_dir=download_dir,
        local_dir_use_symlinks=False
    )
    print(f"\\nDownload successful! Folder contents safely downloaded to: {folder_path}")
except Exception as e:
    print(f"\\nDownload failed: {e}")
`;
}

function buildClusterSlurmScript(repoId: string, folderPattern: string, region: DownloadRegion): string {
  const route = region === 'apac' ? 'mirror' : 'official';
  const envBlock = region === 'apac'
    ? `export HF_ENDPOINT="https://hf-mirror.com"
export HF_HUB_ENABLE_HF_TRANSFER="1"
export HF_HUB_DISABLE_XET="1"`
    : `unset HF_ENDPOINT
export HF_HUB_ENABLE_HF_TRANSFER="1"
export HF_HUB_DISABLE_XET="1"`;

  return `#!/bin/bash
#SBATCH --job-name=GalibierHub-dl-${route}-folder
#SBATCH --partition=cu             # <-- [USER MODIFICATION REQUIRED] Change to your cluster's specific partition/queue name
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=16G
#SBATCH --time=12:00:00
#SBATCH --output=/home/user/GalibierHub/logs/GalibierHub-dl-${route}-folder_%j.out # <-- [USER MODIFICATION REQUIRED] Update path if needed
#SBATCH --error=/home/user/GalibierHub/logs/GalibierHub-dl-${route}-folder_%j.err  # <-- [USER MODIFICATION REQUIRED] Update path if needed
#SBATCH --exclude=cu01             # <-- [USER MODIFICATION REQUIRED] Modify or remove based on your cluster's node status

set -euo pipefail

# <-- [USER MODIFICATION REQUIRED] Change to your project's absolute main directory path
PROJ_DIR="/home/user/GalibierHub"
NET_SCRIPT="\${PROJ_DIR}/GalibierHub-download-${route}-folder.py"
NET_OUT_DIR="\${PROJ_DIR}/downloads"

LOCAL_SCRATCH="/tmp/yanglun_job_\${SLURM_JOB_ID}"
trap 'rm -rf "\${LOCAL_SCRATCH}"' EXIT

mkdir -p "\${LOCAL_SCRATCH}/input" "\${LOCAL_SCRATCH}/output" "\${NET_OUT_DIR}" "\${PROJ_DIR}/logs"

cp "\${NET_SCRIPT}" "\${LOCAL_SCRATCH}/input/"

# <-- [USER MODIFICATION REQUIRED] Change to your specific conda installation path and environment name
source /home/user/miniconda3/bin/activate python3.9-env

${envBlock}

cd "\${LOCAL_SCRATCH}/output"
python "\${LOCAL_SCRATCH}/input/GalibierHub-download-${route}-folder.py" | tee "download_task.log" 2>&1

cp -r "\${LOCAL_SCRATCH}/output/"* "\${NET_OUT_DIR}/"
`;
}

function normalizeScriptSpaces(script: string): string {
  return script.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
}

function buildManifestRows(folderItems: FileRow[], rootLabel: string): Array<Record<string, string>> {
  return folderItems.map((item) => ({
    Directory_Path: item.directoryPath ? `${rootLabel}/${item.directoryPath}` : rootLabel,
    File_Name: item.fileName,
    File_Type: item.fileType,
    Size_Bytes: item.sizeBytes != null ? String(item.sizeBytes) : '',
    Direct_URL: item.url,
    'SHA-256': cleanChecksum(item.sha256_checksum || item.sha256Checksum || item.sha256 || item.oid || item.cksum),
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
    .filter((item) => (algorithm === 'sha256' ? cleanChecksum(item.sha256Checksum || item.sha256_checksum || item.sha256 || item.oid || item.cksum) : item.md5Checksum))
    .map((item) => `${algorithm === 'sha256' ? cleanChecksum(item.sha256Checksum || item.sha256_checksum || item.sha256 || item.oid || item.cksum) : item.md5Checksum}  ${item.fileName}`);
  return lines.join('\n');
}

export default function DownloadCatalogPanel({
  isAdmin = false,
  accessToken = null,
  pendingRecordSampleId = null,
  onPendingRecordSampleHandled,
}: {
  isAdmin?: boolean;
  accessToken?: string | null;
  pendingRecordSampleId?: string | null;
  onPendingRecordSampleHandled?: () => void;
}) {
  const [items, setItems] = useState<DownloadCatalogItem[]>([]);
  const [recordsAvailable, setRecordsAvailable] = useState(false);
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
  const { showLoading, hideLoading } = useLoading();
  const [folderCliCopied, setFolderCliCopied] = useState<string | null>(null);
  const [clusterScriptOpen, setClusterScriptOpen] = useState<'python' | 'slurm' | null>(null);
  const [clusterVerifyOpen, setClusterVerifyOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [downloadRegion, setDownloadRegion] = useState<DownloadRegion>(() => getPreferredDownloadRegion());
  const [batchBrowserDownloading, setBatchBrowserDownloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const pendingRecordHandledRef = useRef(false);
  const pendingSessionHandledRef = useRef(false);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const loadCatalog = useCallback(async (nocache?: boolean) => {
    let active = true;
    setLoading(true);
    setError(null);
    const headers: HeadersInit = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};
    try {
      const url = '/api/download-catalog' + (nocache ? `?nocache=1&ts=${Date.now()}` : '');
      const res = await fetch(url, { headers, cache: 'no-store' });
      const data = await res.json();
      if (!active) return () => {
        active = false;
      };
      if (Array.isArray(data?.items)) {
        setItems(data.items as DownloadCatalogItem[]);
        setRecordsAvailable(Boolean(data?.recordsAvailable));
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

  useEffect(() => {
    if (pendingSessionHandledRef.current || loading || items.length === 0) return;
    if (typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem('galibier_pending_downloads');
    if (!raw) return;

    let filenames: unknown;
    try {
      filenames = JSON.parse(raw);
    } catch {
      window.sessionStorage.removeItem('galibier_pending_downloads');
      return;
    }

    const pendingNames = (Array.isArray(filenames) ? filenames : [])
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      .map((name) => name.trim());
    if (pendingNames.length === 0) {
      window.sessionStorage.removeItem('galibier_pending_downloads');
      return;
    }

    const matching = items.filter((item) => pendingNames.includes(deriveFileName(item.url)));
    pendingSessionHandledRef.current = true;
    window.sessionStorage.removeItem('galibier_pending_downloads');

    if (matching.length === 0) return;

    const firstFolder = matching[0].catalogFolder || deriveFolderPath(matching[0].url) || 'Records';
    setCurrentPath(firstFolder);
    setSearchText('');
    setCurrentPage(1);
    setPageInput('1');
    setSelectedIds(new Set(matching.map((item) => item.id)));
    setHighlightedIds(new Set(matching.map((item) => item.id)));

    window.setTimeout(() => {
      const first = matching[0];
      const target = document.querySelector(`[data-download-id="${CSS.escape(first.id)}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    window.setTimeout(() => setHighlightedIds(new Set()), 2600);
  }, [items, loading]);

  useEffect(() => {
    if (!pendingRecordSampleId) {
      pendingRecordHandledRef.current = false;
      return;
    }
    if (pendingRecordHandledRef.current || loading || items.length === 0) return;

    const folderPath = 'Records';
    const matching = items.filter((item) => (item.catalogFolder || '').startsWith('Records') && item.sampleIds.includes(pendingRecordSampleId));
    pendingRecordHandledRef.current = true;
    setCurrentPath(matching[0]?.catalogFolder || folderPath);
    if (matching.length > 0) {
      setSelectedIds(new Set(matching.map((item) => item.id)));
    }
    setSearchText('');
    setCurrentPage(1);
    setPageInput('1');
    onPendingRecordSampleHandled?.();
  }, [items, loading, onPendingRecordSampleHandled, pendingRecordSampleId]);


  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const fileName = deriveFileName(item.url).toLowerCase();
      const folderPath = (item.catalogFolder || deriveFolderPath(item.url)).toLowerCase();
      const label = item.label.toLowerCase();
      const description = item.description.toLowerCase();
      return fileName.includes(keyword)
        || folderPath.includes(keyword)
        || label.includes(keyword)
        || description.includes(keyword);
    });
  }, [items, searchText]);

  const tree = useMemo(() => {
    const hasRecordsFolder = filteredItems.some((item) => {
      const folderPath = item.catalogFolder || deriveFolderPath(item.url);
      return folderPath.split('/').filter(Boolean)[0] === 'Records';
    });
    return buildTree(filteredItems, recordsAvailable && !hasRecordsFolder);
  }, [filteredItems, recordsAvailable]);

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
    return entries.sort(compareFolderNames);
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
        directoryPath: item.catalogFolder || deriveFolderPath(item.url),
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
        directoryPath: item.catalogFolder || deriveFolderPath(item.url),
        fileType: deriveFileType(fileName),
        updatedLabel: formatUpdatedDate(item.updatedAt),
        sourceLabel: scopeLabel(item.sourceScope),
      };
    });
  }, [currentNode]);

  const currentFolderSummary = useMemo(() => folderSummary(currentNode), [currentNode]);

  const clusterFolderPattern = currentPath
    ? `${currentPath}/*`
    : '*';
  const clusterRepoId = deriveHfRepoId(currentFolderItems);
  const clusterSuffix = downloadRegion === 'apac' ? 'mirror' : 'official';
  const clusterVerifyDir = currentPath
    ? `downloads/${currentPath}/`
    : `downloads/${rootLabel}/`;
  const clusterPythonFileName = `GalibierHub-download-${clusterSuffix}-folder.py`;
  const clusterSlurmFileName = `GalibierHub-download-${clusterSuffix}-folder.sh`;
  const clusterPythonScript = normalizeScriptSpaces(buildClusterPythonScript(clusterRepoId, clusterFolderPattern, downloadRegion));
  const clusterSlurmScript = normalizeScriptSpaces(buildClusterSlurmScript(clusterRepoId, clusterFolderPattern, downloadRegion));
  const clusterChecksumLines = currentFolderItems
    .map((item) => {
      const checksum = cleanChecksum(item.sha256_checksum || item.sha256Checksum || item.sha256 || item.oid || item.cksum);
      if (!checksum) return '';
      const relative = item.directoryPath ? `${item.directoryPath}/${item.fileName}` : item.fileName;
      return `${checksum}  ${relative}`;
    })
    .filter(Boolean)
    .join('\n');
  const clusterVerifyCommand = clusterChecksumLines
    ? `cd ${clusterVerifyDir}\ncat <<'EOF' > SHA256SUMS\n${clusterChecksumLines}\nEOF\nsha256sum -c SHA256SUMS`
    : `cd ${clusterVerifyDir}\nfind . -type f -exec sha256sum {} + > SHA256SUMS\nsha256sum -c SHA256SUMS`;

  const showBlockingLoader = loading && items.length === 0;

  const readmeText = useMemo(() => {
    const header = '# Directory: ' + rootLabel + (currentPath ? '/' + currentPath : '') + '\n\n';
    const summary = 'Files: ' + currentFolderItems.length + ' | Folders: ' + currentFolderSummary.folderCount + '\n\n';
    const fileList = currentFolderItems.map((item) => {
      const size = item.sizeBytes ? formatDownloadBytes(item.sizeBytes) : (item.sizeLabel || 'Unknown');
      const location = item.directoryPath
        ? `${rootLabel}/${item.directoryPath}/${item.fileName}`
        : `${rootLabel}/${item.fileName}`;
      return '- ' + location + '  (' + size + (item.updatedLabel ? ', ' + item.updatedLabel : '') + ')';
    });
    return header + summary + fileList.join('\n');
  }, [rootLabel, currentPath, currentFolderItems, currentFolderSummary]);

  const totalPages = Math.max(1, Math.ceil(visibleFiles.length / pageSize));
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleFiles.slice(start, start + pageSize);
  }, [visibleFiles, currentPage, pageSize]);

  const handleJump = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    setCurrentPage(Math.min(Math.max(parsed, 1), totalPages));
  };

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setCurrentPage(1);
    setPageInput('1');
  };

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

  const selectedFiles = useMemo<FileRow[]>(() => items
    .filter((item) => selectedIds.has(item.id))
    .map((item) => {
      const fileName = deriveFileName(item.url);
      return {
        ...item,
        fileName,
        directoryPath: item.catalogFolder || deriveFolderPath(item.url),
        fileType: deriveFileType(fileName),
        updatedLabel: formatUpdatedDate(item.updatedAt),
        sourceLabel: scopeLabel(item.sourceScope),
      };
    }), [items, selectedIds]);
  const batchCliFiles = selectedFiles.map((item) => {
    const cliUrl = downloadRegion === 'apac' ? buildHfMirrorUrl(item.url) || item.url : item.url;
    return { ...item, url: cliUrl, fileName: deriveFileName(cliUrl) };
  });

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

  const handleBatchBrowserDownload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setBatchBrowserDownloading(true);
    setStatusMessage(null);
    const region = downloadRegion;
    let failed = 0;
    try {
      for (const item of selectedFiles) {
        try {
          const resolved = await resolveBrowserDownload({
            download_key: normalizeDownloadKey(item.url),
            label: item.label,
            description: item.description,
            region,
          });
          triggerBrowserDownload(resolved.url, resolved.filename);
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        } catch {
          failed += 1;
        }
      }
      setStatusMessage(
        failed === 0
          ? `Started browser downloads for ${selectedFiles.length} file(s).`
          : `Started ${selectedFiles.length - failed} browser download(s); ${failed} could not be prepared.`,
      );
    } finally {
      setBatchBrowserDownloading(false);
    }
  }, [selectedFiles, downloadRegion]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Downloads</h2>
            <p className="mt-1 text-sm text-gray-600">
              Browse files by directory, export manifests, and choose browser or CLI delivery.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded bg-teal-50 px-2 py-1 text-teal-700">Files: {currentFolderSummary.fileCount}</span>
              
              {currentFolderItems.length > 0 && (
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

      {showBlockingLoader && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6">
          <div className="grid gap-3">
            <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
          </div>
        </div>
      )}
      {!loading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
      {!error && warning && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{warning}</div>}
      {!error && statusMessage && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-800">{statusMessage}</div>}

      {/* Academic License Banner */}
      {!error && !loading && (
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100 p-4 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700 text-sm font-bold">CC</span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:!text-emerald-400">Open Access Data</p>
                <p className="text-xs text-teal-700">Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline hover:text-slate-900">CC BY 4.0</a>. Please cite GalibierHub when using this data in publications.</p>
              </div>
            </div>
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors">Learn more</a>
          </div>
        </div>
      )}

      {!error && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => goToFolder('')}
              className={`rounded px-2 py-1 ${currentPath === '' ? 'font-semibold text-gray-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              Downloads
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => goToFolder('')}
              className={`rounded px-2 py-1 ${currentPath === '' ? 'font-semibold text-gray-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {rootLabel}
            </button>
            {breadcrumbParts.map((part, index) => {
              const path = breadcrumbParts.slice(0, index + 1).join('/');
              const active = path === currentPath;
              return (
                <div key={path} className="contents">
                  <span className="text-slate-300">/</span>
                  {active ? (
                    <span className="rounded px-2 py-1 font-semibold text-slate-900">{part}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToFolder(path)}
                      className="rounded px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
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
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search files or folders"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-all placeholder:text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] focus:bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/15 lg:max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { showLoading(0, [ 'Allocating SLURM HPC Nodes...', 'Generating Cluster Batch Download Scripts...', 'Validating SHA-256 Checksums...', 'Finalizing Data Bundle For Delivery...' ]); setTimeout(() => { setFolderCliOpen(true); hideLoading(); }, 800); }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-slate-700 active:bg-slate-900 active:scale-[0.98] transition-all"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  Cluster Batch Download
                </button>
                <button
                  type="button"
                  onClick={() => exportManifest('csv')}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all"
                >
                  Export Manifest CSV
                </button>
                {selectedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBatchOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-slate-700 active:bg-slate-900 active:scale-[0.98] transition-all"
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
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-gray-500">
          No matching files or folders.
        </div>
      )}

      {!error && childFolders.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {childFolderSummaries.map(({ folder, summary }) => (
              <button
                key={folder.path}
                type="button"
                onClick={() => goToFolder(folder.path)}
                className="card-hover flex min-h-24 flex-col items-start justify-between rounded-lg border bg-white p-4 text-left hover:bg-slate-50"
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
        <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">Files</div>
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
            {paginatedFiles.map((item) => (
              <div key={item.id} data-download-id={item.id} className={`flex min-h-44 flex-col justify-between gap-4 border p-4 ${selectedIds.has(item.id) ? 'border-slate-300 bg-teal-50/30' : 'border-[var(--color-border)] bg-[var(--color-surface)]'} ${highlightedIds.has(item.id) ? 'target-highlight-row' : ''}`}>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-slate-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-gray-900 break-all leading-snug">{item.fileName}</div>
                    </div>
                    {item.hidden && effectiveIsAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Hidden</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${fileTypeBadgeClass(item.fileType)}`}>{item.fileType}</span>
                    {item.sampleCount > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">Samples: {item.sampleCount}</span>}
                  </div>
                  <div className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                    <div>Size: {formatDownloadBytes(item.sizeBytes) || item.sizeLabel || 'Unknown'}</div>
                    <div>Updated: {item.updatedLabel}</div>
                  </div>
                </div>
                <DownloadActions
                  url={item.url}
                  label="Download to Browser"
                  sizeLabel={item.sizeLabel}
                  initialSizeBytes={item.sizeBytes}
                  initialUpdatedAt={item.updatedAt}
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
        <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="overflow-x-auto">
            <table className="data-table min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-10">
                    <input
                      type="checkbox"
                      checked={paginatedFiles.length > 0 && paginatedFiles.every((item) => selectedIds.has(item.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-slate-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 text-left text-gray-600 hover:text-gray-900">
                      Name
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    <button type="button" onClick={() => toggleSort('size')} className="inline-flex items-center gap-1 text-right text-gray-600 hover:text-gray-900">
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
                  <tr key={item.id} data-download-id={item.id} className={`${selectedIds.has(item.id) ? 'bg-teal-50/30' : ''} ${highlightedIds.has(item.id) ? 'target-highlight-row' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-slate-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded px-2 text-[11px] font-medium ${fileTypeBadgeClass(item.fileType)}`}>
                          {item.fileType.replace('.', '') || 'file'}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 break-all">{item.fileName}</span>
                            {item.hidden && effectiveIsAdmin && <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Hidden</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatDownloadBytes(item.sizeBytes) || item.sizeLabel || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.updatedLabel}</td>
                    <td className="px-4 py-3">
                      <DownloadActions
                        url={item.url}
                        label="Download to Browser"
                        sizeLabel={item.sizeLabel}
                        initialSizeBytes={item.sizeBytes}
                        initialUpdatedAt={item.updatedAt}
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
      {visibleFiles.length > 0 && (
        <nav className="mt-4 flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-700 lg:flex-row lg:items-center lg:justify-between">
          <div>
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, visibleFiles.length)}</span> of <span className="font-medium">{visibleFiles.length}</span> files
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Last
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <label className="flex items-center gap-2">
              <span>Page size</span>
              <select
                value={pageSize}
                onChange={(event) => handlePageSizeChange(Number.parseInt(event.target.value, 10))}
                className="rounded border bg-white px-2 py-1"
              >
                {[10, 20, 30].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <span>Page {currentPage} of {totalPages}</span>
            <label className="flex items-center gap-2">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleJump();
                }}
                className="w-20 rounded border bg-white px-2 py-1"
              />
            </label>
            <button
              type="button"
              onClick={handleJump}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100"
            >
              Go
            </button>
          </div>
        </nav>
      )}

      {folderCliOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setFolderCliOpen(false)}>
          <div className="my-8 w-full max-w-4xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Cluster Batch Download</h3>
                <p className="mt-1 text-sm text-gray-600">{currentPath ? `${rootLabel}/${currentPath}` : rootLabel}</p>
              </div>
              <button type="button" onClick={() => setFolderCliOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="text-xs font-medium text-gray-700">Network Routing</div>
                <div className="mt-2 inline-flex rounded-lg border border-slate-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setDownloadRegion('global')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'global' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    Global (Official)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadRegion('apac')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${downloadRegion === 'apac' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    Asia-Pacific (Mirror)
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setClusterScriptOpen(current => current === 'python' ? null : 'python')}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">Python Core Script</span>
                    <span className="ml-2 font-mono text-xs text-gray-500">{clusterPythonFileName}</span>
                  </span>
                  <span className="text-xs text-slate-500">{clusterScriptOpen === 'python' ? 'Hide' : 'Show'}</span>
                </button>
                {clusterScriptOpen === 'python' && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    <pre className="code-panel max-h-[28rem] overflow-auto whitespace-pre rounded-lg px-3 py-3 font-mono text-xs text-gray-800">{clusterPythonScript}</pre>
                    <button
                      type="button"
                      onClick={() => void handleCopyFolderCommand('python', clusterPythonScript)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {folderCliCopied === 'python' ? (
                        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                      )}
                      {folderCliCopied === 'python' ? 'Copied' : 'Copy All'}
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setClusterScriptOpen(current => current === 'slurm' ? null : 'slurm')}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">SLURM Scheduler Script</span>
                    <span className="ml-2 font-mono text-xs text-gray-500">{clusterSlurmFileName}</span>
                  </span>
                  <span className="text-xs text-slate-500">{clusterScriptOpen === 'slurm' ? 'Hide' : 'Show'}</span>
                </button>
                {clusterScriptOpen === 'slurm' && (
                  <div className="border-t border-gray-200 px-4 py-3">
                    <pre className="code-panel max-h-[28rem] overflow-auto whitespace-pre rounded-lg px-3 py-3 font-mono text-xs text-gray-800">{clusterSlurmScript}</pre>
                    <button
                      type="button"
                      onClick={() => void handleCopyFolderCommand('slurm', clusterSlurmScript)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {folderCliCopied === 'slurm' ? (
                        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                      )}
                      {folderCliCopied === 'slurm' ? 'Copied' : 'Copy All'}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-700">
                <div className="text-sm font-medium text-slate-900">How to use Cluster Batch Download</div>
                <ol className="mt-4 space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">1</span>
                    <span className="min-w-0 flex-1">Choose the network environment: use Asia-Pacific (Mirror) for mainland or restricted networks; use Global (Official) for direct overseas access.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">2</span>
                    <span className="min-w-0 flex-1">Open Show Python Script and Show SLURM Script, then copy both scripts to your cluster.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">3</span>
                    <span className="min-w-0 flex-1">Update every {'<-- [USER MODIFICATION REQUIRED]'} marker for repository, folder pattern, cluster partition, project paths, and conda environment.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">4</span>
                    <span className="min-w-0 flex-1">
                      <span className="block">Submit with:</span>
                      <pre className="code-panel mt-2 overflow-auto whitespace-pre rounded-lg px-3 py-2 font-mono text-xs text-gray-800">sbatch {clusterSlurmFileName}</pre>
                    </span>
                  </li>
                </ol>
                <div className="mt-4 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <button
                    type="button"
                    onClick={() => setClusterVerifyOpen(current => !current)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">5</span>
                      <span className="text-sm font-medium text-slate-900">Verify Folder Integrity (Optional)</span>
                    </span>
                    <span className="text-xs text-slate-500">{clusterVerifyOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {clusterVerifyOpen && (
                    <div className="border-t border-slate-200 px-4 py-3">
                      <p className="text-xs text-slate-700">After the job completes, navigate to your download directory and check file integrity using sha256sum.</p>
                      <pre className="code-panel mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg px-3 py-2 font-mono text-xs text-gray-800">{clusterVerifyCommand}</pre>
                      <button
                        type="button"
                        onClick={() => void handleCopyFolderCommand('verify', clusterVerifyCommand)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {folderCliCopied === 'verify' ? (
                          <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                        )}
                        {folderCliCopied === 'verify' ? 'Copied' : 'Copy All'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Batch download dialog */}
      {batchOpen && selectedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setBatchOpen(false)}>
          <div className="my-8 w-full max-w-3xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl" onClick={(event) => event.stopPropagation()}>
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
                    onClick={() => void handleBatchBrowserDownload()}
                    disabled={batchBrowserDownloading}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-slate-700 active:bg-slate-900 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {batchBrowserDownloading ? 'Preparing downloads...' : 'Start Browser Download'}
                  </button>
                </div>
                {[
                  { key: 'wget', title: 'wget (Linux/macOS, resume)', cmd: batchCliFiles.map((item) => `wget -c -O "${item.fileName}" "${item.url}"`).join('\n') },
                  { key: 'curl', title: 'curl (Windows/Linux/macOS, resume)', cmd: batchCliFiles.map((item) => `curl -L -C - -o "${item.fileName}" "${item.url}"`).join('\n') },
                ].map((block) => (
                <div key={block.key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">{block.title}</span>
                    <button
                      type="button"
                      onClick={() => void handleCopyFolderCommand(`batch-${block.key}`, block.cmd)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                    >
                      {folderCliCopied === `batch-${block.key}` ? (
                        <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" /></svg>
                      )}
                      {folderCliCopied === `batch-${block.key}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <code className="code-panel block max-h-[18rem] overflow-auto whitespace-pre-wrap break-all rounded-lg px-3 py-3 font-mono text-xs text-gray-800">{block.cmd}</code>
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
            className="w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
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
            <div className="markdown-content max-h-[70vh] overflow-y-auto px-4 py-3 text-gray-700">
              {renderMarkdown(readmeText)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
