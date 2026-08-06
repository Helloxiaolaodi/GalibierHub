'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Promoter } from '@/types/genome';
import { getDirectDownloadUrl, NOT_DIRECT_FILE_URL_MESSAGE, validateDirectFileUrl } from '@/lib/storage';
import {
  buildDownloadResolvedInfo,
  DEFAULT_DOWNLOAD_METADATA,
  formatDownloadBytes,
  normalizeDownloadKey,
  type DownloadMetadataPayload,
  type DownloadResolvedInfo,
} from '@/lib/download-info';

type PromoterSortMode = 'score_desc' | 'score_asc' | 'chrom_start' | 'sample_id';
type SummaryMode = 'overview' | 'sample' | 'chromosome';
type RecordDownloadKind = 'vcf' | 'fasta';

type BatchFile = { sample_id: string; kind: string; url: string };
type BatchFileMeta = { size: number | null; sha256: string | null; md5: string | null };
type BatchDownloadItem = DownloadResolvedInfo & {
  sample_id: string;
  kind: string;
  source_url: string;
  batch_eligible: boolean;
  batch_skip_reason: string | null;
};

const NUMERIC_CELL_IDS = new Set(['start', 'end_pos', 'score']);
const MONO_CELL_IDS = new Set(['sample_id']);

const FILE_KIND_LABELS: Record<string, string> = {
  vcf: 'VCF', fasta: 'FASTA', gb: 'GenBank', bed: 'BED', gff3: 'GFF3',
};

function batchFileName(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop() || 'download.file';
    return decodeURIComponent(name);
  } catch {
    return url.split('/').pop() || 'download.file';
  }
}

async function readBatchFileMeta(url: string): Promise<BatchFileMeta> {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const kindIdx = parts.indexOf('datasets');
    const resolveIdx = parts.indexOf('resolve');
    if (kindIdx === -1 || resolveIdx === -1 || resolveIdx <= kindIdx + 2) {
      return { size: null, sha256: null, md5: null };
    }
    const repo = parts[kindIdx + 1] + '/' + parts[kindIdx + 2];
    const dirPath = parts.slice(resolveIdx + 2, -1).join('/');
    const fileName = parts[parts.length - 1];
    const api = `https://huggingface.co/api/datasets/${repo}/tree/main${dirPath ? '/' + dirPath : ''}?recursive=false`;
    const res = await fetch(api);
    if (!res.ok) return { size: null, sha256: null, md5: null };
    const data = (await res.json()) as Array<{ path: string; size?: number; lfs?: { oid?: string } }>;
    const hit = data.find((item) => item.path.split('/').pop() === fileName);
    return {
      size: hit?.size ?? null,
      sha256: hit?.lfs?.oid ?? null,
      md5: null,
    };
  } catch {
    return { size: null, sha256: null, md5: null };
  }
}

async function readBatchDbMeta(key: string): Promise<DownloadMetadataPayload> {
  try {
    const res = await fetch(`/api/download-metadata?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('failed');
    const data = (await res.json()) as Partial<DownloadMetadataPayload>;
    return { ...DEFAULT_DOWNLOAD_METADATA, ...data };
  } catch {
    return DEFAULT_DOWNLOAD_METADATA;
  }
}

function buildSh(files: BatchDownloadItem[]): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const publicFiles = files.filter((file) => file.batch_eligible && file.access_mode === 'public_url' && file.wget_command);
  const privateFiles = files.filter((file) => !file.batch_eligible);
  const body = files
    .filter((file) => file.batch_eligible && file.access_mode === 'public_url' && file.wget_command)
    .map((file) => `# sample: ${file.sample_id} (${FILE_KIND_LABELS[file.kind] || file.kind})\n${file.wget_command}`)
    .join('\n\n');
  return `#!/usr/bin/env bash
# GalibierHub batch download, generated ${now} (UTC)
# ${publicFiles.length} public file(s). "wget -c" resumes partial downloads.
# ${privateFiles.length} file(s) are omitted because they are protected or do not use a direct file URL.
# Run on this server to auto-download all selected public sample files.
set -u

${body}
`;
}

function buildBat(files: BatchDownloadItem[]): string {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const publicFiles = files.filter((file) => file.batch_eligible && file.access_mode === 'public_url' && file.curl_command);
  const privateFiles = files.filter((file) => !file.batch_eligible);
  const body = files
    .filter((file) => file.batch_eligible && file.access_mode === 'public_url' && file.curl_command)
    .map((file) => `REM sample: ${file.sample_id} (${FILE_KIND_LABELS[file.kind] || file.kind})\r${file.curl_command}`)
    .join('\r\n\r\n');
  return `@echo off\r\nREM GalibierHub batch download, generated ${now} (UTC)\r\nREM ${publicFiles.length} public file(s). "curl -C -" resumes partial downloads.\r\nREM ${privateFiles.length} file(s) are omitted because they are protected or do not use a direct file URL.\r\n\r\n${body}\r\n`;
}

function downloadText(filename: string, text: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

interface PromoterTableProps {
  data: Promoter[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  loading?: boolean;
  filterSummary?: Array<{ label: string; value: string }>;
  visibleCount?: number;
  sortMode: PromoterSortMode;
  summaryMode: SummaryMode;
  topChromosomes?: Array<{ label: string; count: number }>;
  topSamples?: Array<{ label: string; count: number }>;
  onRowClick?: (promoter: Promoter) => void;
  onDownloadRecord?: (sampleId: string, kind: RecordDownloadKind) => void;
  onSendSelectedToDownloads?: (kind: RecordDownloadKind, sampleIds: string[]) => void;
  onSortModeChange: (mode: PromoterSortMode) => void;
  onSummaryModeChange: (mode: SummaryMode) => void;
  onPageChange: (pageIndex: number, pageSize: number) => void;
}

export default function PromoterTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  loading,
  filterSummary = [],
  visibleCount = 0,
  sortMode,
  summaryMode,
  topChromosomes = [],
  topSamples = [],
  onRowClick,
  onDownloadRecord,
  onSendSelectedToDownloads,
  onSortModeChange,
  onSummaryModeChange,
  onPageChange,
}: PromoterTableProps) {
  const [pageInput, setPageInput] = useState(String(pageIndex + 1));
  const currentPagination = { pageIndex, pageSize };
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, (pageIndex + 1) * pageSize);
  const groupedItems = summaryMode === 'chromosome' ? topChromosomes : topSamples;

  useEffect(() => {
    setPageInput(String(pageIndex + 1));
  }, [pageIndex]);

  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMetaLoading, setBatchMetaLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchDownloadItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [downloadMenuSampleId, setDownloadMenuSampleId] = useState<string | null>(null);

  const pageSampleIdArray = useMemo(() => {
    const seen = new Set<string>();
    for (const p of data) {
      if (!seen.has(p.sample_id)) seen.add(p.sample_id);
    }
    return [...seen];
  }, [data]);

  const allPageSelected = pageSampleIdArray.length > 0 && pageSampleIdArray.every((id) => selectedSampleIds.has(id));
  const somePageSelected = !allPageSelected && pageSampleIdArray.some((id) => selectedSampleIds.has(id));

  const toggleSample = useCallback((id: string) => {
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllPage = useCallback(() => {
    setSelectedSampleIds((prev) => {
      const next = new Set(prev);
      if (pageSampleIdArray.length > 0 && pageSampleIdArray.every((id) => next.has(id))) {
        for (const id of pageSampleIdArray) next.delete(id);
      } else {
        for (const id of pageSampleIdArray) next.add(id);
      }
      return next;
    });
  }, [pageSampleIdArray]);

  const clearSelection = useCallback(() => setSelectedSampleIds(new Set()), []);

  const openBatch = useCallback(async () => {
    setBatchOpen(true);
    setBatchLoading(true);
    setBatchMetaLoading(false);
    setBatchError(null);
    setBatchItems([]);
    try {
      const ids = [...selectedSampleIds];
      const res = await fetch('/api/samples/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_ids: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to resolve sample download URLs.');
      const results: Array<Record<string, unknown>> = Array.isArray(json?.results) ? json.results : [];
      const files: BatchFile[] = [];
      for (const row of results) {
        if (!row || typeof row.sample_id !== 'string') continue;
        const sid = row.sample_id as string;
        const entries: Array<[string, unknown]> = [
          ['vcf', row.vcf_download_url],
          ['fasta', row.fasta_download_url],
          ['gb', row.gb_download_url],
          ['bed', row.bed_download_url],
          ['gff3', row.gff3_download_url],
        ];
        for (const [kind, raw] of entries) {
          const url = getDirectDownloadUrl(typeof raw === 'string' ? raw : null);
          if (url) files.push({ sample_id: sid, kind, url });
        }
      }
      if (files.length === 0) setBatchError('No downloadable files found for the selected samples.');
      if (files.length > 0) {
        setBatchMetaLoading(true);
        const uniqueUrls = [...new Set(files.map((file) => file.url))];
        const entries = await Promise.all(
          uniqueUrls.map(async (fileUrl) => {
            const key = normalizeDownloadKey(fileUrl);
            const [hfMeta, dbMeta] = await Promise.all([readBatchFileMeta(fileUrl), readBatchDbMeta(key)]);
            return [fileUrl, { hfMeta, dbMeta }] as const;
          })
        );
        const items = files.map((file) => {
          const source = entries.find(([fileUrl]) => fileUrl === file.url)?.[1];
          const dbMeta = source?.dbMeta || DEFAULT_DOWNLOAD_METADATA;
          const hfMeta = source?.hfMeta || { size: null, sha256: null, md5: null };
          const resolved = buildDownloadResolvedInfo(normalizeDownloadKey(file.url), dbMeta, `${FILE_KIND_LABELS[file.kind] || file.kind} download`, null);
          const validation = validateDirectFileUrl(file.url);
          const batchEligible = resolved.access_mode === 'public_url' ? validation.valid : false;
          const batchSkipReason = resolved.access_mode !== 'public_url'
            ? 'Protected signed URL is not exported into reusable batch scripts.'
            : (!validation.valid ? (validation.reason || NOT_DIRECT_FILE_URL_MESSAGE) : null);
          return {
            ...resolved,
            sample_id: file.sample_id,
            kind: file.kind,
            source_url: file.url,
            batch_eligible: batchEligible,
            batch_skip_reason: batchSkipReason,
            file_name: resolved.file_name || batchFileName(file.url),
            file_type: dbMeta.custom_file_type || FILE_KIND_LABELS[file.kind] || file.kind,
            size_bytes: dbMeta.custom_size_bytes ?? hfMeta.size ?? resolved.size_bytes,
            sha256_checksum: dbMeta.sha256_checksum ?? hfMeta.sha256 ?? resolved.sha256_checksum,
            md5_checksum: dbMeta.md5_checksum ?? hfMeta.md5 ?? resolved.md5_checksum,
          } satisfies BatchDownloadItem;
        });
        setBatchItems(items);
      }
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'Failed to resolve sample download URLs.');
    } finally {
      setBatchMetaLoading(false);
      setBatchLoading(false);
    }
  }, [selectedSampleIds]);

  const handleCopy = useCallback(async (copyKey: string, text: string | null | undefined) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(copyKey);
      window.setTimeout(() => setCopied((current) => (current === copyKey ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }, []);

  const batchPublicCount = useMemo(
    () => batchItems.filter((item) => item.batch_eligible && item.access_mode === 'public_url' && item.public_url).length,
    [batchItems],
  );

  const batchPrivateCount = useMemo(
    () => batchItems.filter((item) => !item.batch_eligible).length,
    [batchItems],
  );

  const allSha256Text = useMemo(
    () => batchItems
      .filter((item) => item.sha256_checksum)
      .map((item) => `${item.sample_id}\t${item.kind}\t${item.file_name}\t${item.sha256_checksum}`)
      .join('\n'),
    [batchItems],
  );

  const columns = useMemo<ColumnDef<Promoter>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all samples on this page"
            checked={allPageSelected}
            ref={(el) => { if (el) el.indeterminate = somePageSelected; }}
            onChange={toggleAllPage}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select sample ${row.original.sample_id}`}
            checked={selectedSampleIds.has(row.original.sample_id)}
            onChange={() => toggleSample(row.original.sample_id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer"
          />
        ),
        size: 44,
        enableSorting: false,
      },
      {
        accessorKey: 'chrom',
        header: 'Chr',
        size: 70,
      },
      {
        accessorKey: 'start',
        header: 'Start',
        size: 100,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'end_pos',
        header: 'End Pos',
        size: 100,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'gene_symbol',
        header: 'Feature',
        size: 120,
        cell: ({ getValue }) => (getValue() as string) || '\u2014',
      },
      {
        accessorKey: 'score',
        header: 'Score',
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as number;
          const pct = Math.min(Math.max(v * 100, 0), 100);
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums">{v.toFixed(2)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'strand',
        header: 'Strand',
        size: 70,
        cell: ({ getValue }) => (
          <span className={getValue() === '+' ? 'text-blue-600' : 'text-red-600'}>
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'sample_id',
        header: 'Sample ID',
        size: 120,
      },
      {
        id: 'download',
        header: 'Download',
        size: 110,
        enableSorting: false,
        cell: ({ row }) => {
          const sampleId = row.original.sample_id;
          const menuOpen = downloadMenuSampleId === sampleId;
          return (
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDownloadMenuSampleId(menuOpen ? null : sampleId);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-700"
              >
                Download
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDownloadMenuSampleId(null);
                      onDownloadRecord?.(sampleId, 'vcf');
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download Variant (VCF)
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDownloadMenuSampleId(null);
                      onDownloadRecord?.(sampleId, 'fasta');
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Download Sequence (FASTA)
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [selectedSampleIds, allPageSelected, somePageSelected, toggleAllPage, toggleSample, onDownloadRecord, downloadMenuSampleId]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination: currentPagination },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex + 1 < pageCount;

  const handleJump = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(pageIndex + 1));
      return;
    }
    const nextPage = Math.min(Math.max(parsed, 1), pageCount);
    onPageChange(nextPage - 1, pageSize);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Resource Records ({totalCount.toLocaleString()} total)
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <span>Sort by</span>
            <select
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as PromoterSortMode)}
              className="rounded border px-2 py-1 text-sm text-gray-700 bg-white"
            >
              <option value="score_desc">Score (Descending)</option>
              <option value="score_asc">Score (Ascending)</option>
              <option value="chrom_start">Chromosome + Start</option>
              <option value="sample_id">Sample ID</option>
            </select>
          </label>
          {loading ? (
            <span className="text-xs text-gray-500">Refreshing results...</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Active filters
          </div>
          {filterSummary.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {filterSummary.map((item) => (
                <span key={`${item.label}-${item.value}`} className="rounded-md border bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
                  <span className="font-medium text-gray-500">{item.label}:</span> {item.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No filters applied. Add chromosome, feature, score, sample, or metadata filters to narrow results.</p>
          )}
        </div>

        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Page summary
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'sample', label: 'Group by sample' },
              { key: 'chromosome', label: 'Group by chromosome' },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onSummaryModeChange(option.key)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${summaryMode === option.key ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {summaryMode === 'overview' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-gray-500">Top chromosomes on this page</div>
                <div className="mt-1 space-y-1 text-sm text-gray-700">
                  {topChromosomes.length > 0 ? topChromosomes.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="tabular-nums text-gray-500">{item.count}</span>
                    </div>
                  )) : <div className="text-gray-500">No records on this page.</div>}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Top samples on this page</div>
                <div className="mt-1 space-y-1 text-sm text-gray-700">
                  {topSamples.length > 0 ? topSamples.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="tabular-nums text-gray-500">{item.count}</span>
                    </div>
                  )) : <div className="text-gray-500">No records on this page.</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-500">
                {summaryMode === 'sample' ? 'Sample groups' : 'Chromosome groups'} ({visibleCount} visible rows)
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                {groupedItems.length > 0 ? groupedItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    <span className="tabular-nums text-gray-500">{item.count}</span>
                  </div>
                )) : <div className="text-gray-500">No records on this page.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedSampleIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/95 px-4 py-2.5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-md">
          <span className="text-sm font-medium text-white">
            {selectedSampleIds.size} sample{selectedSampleIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onSendSelectedToDownloads?.('vcf', [...selectedSampleIds])} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">VCF</button>
            <button type="button" onClick={() => onSendSelectedToDownloads?.('fasta', [...selectedSampleIds])} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">FASTA</button>
            <button type="button" onClick={clearSelection} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">Clear</button>
            <button type="button" onClick={openBatch} disabled={batchLoading} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">Batch download</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="data-table records-table min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={header.column.id === 'select' ? 'px-3 py-2 text-left' : 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500'}
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
           {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading records...
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-800">No matching samples found</p>
                    <p className="mt-1 text-sm text-slate-500">Try widening the filters or clearing one or more conditions.</p>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-1.5 whitespace-nowrap ${NUMERIC_CELL_IDS.has(cell.column.id) ? 'text-right tabular-nums' : ''} ${MONO_CELL_IDS.has(cell.column.id) ? 'font-mono' : ''}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-gray-600 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(0, pageSize)}
            disabled={!canPreviousPage}
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1), pageSize)}
            disabled={!canPreviousPage}
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageIndex + 1, pageSize)}
            disabled={!canNextPage}
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount - 1, pageSize)}
            disabled={!canNextPage}
            className="rounded border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span>
            Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()}
          </span>

          <label className="flex items-center gap-2">
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(e) => onPageChange(pageIndex, Number.parseInt(e.target.value, 10))}
              className="rounded border px-2 py-1 bg-white"
            >
              {[10, 20, 30].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <span>
            Page {pageIndex + 1} of {pageCount.toLocaleString()}
          </span>

          <label className="flex items-center gap-2">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJump();
                }
              }}
              className="w-20 rounded border px-2 py-1"
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
      </div>

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setBatchOpen(false)}>
          <div className="my-8 w-full max-w-6xl rounded-lg border border-gray-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-base font-semibold text-gray-900">Batch download</h3>
              <button type="button" onClick={() => setBatchOpen(false)} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-600">
                Review downloads for <span className="font-medium text-gray-900">{selectedSampleIds.size}</span> selected sample{selectedSampleIds.size === 1 ? '' : 's'}. Public direct URLs can be exported as resumable scripts. Protected or indirect files are listed but excluded.
              </p>
              {batchLoading && <p className="text-sm text-gray-500">Resolving download links...</p>}
              {!batchLoading && batchMetaLoading && <p className="text-sm text-gray-500">Loading file metadata...</p>}
              {batchError && <p className="text-sm text-red-600">{batchError}</p>}
              {!batchLoading && !batchError && batchItems.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                    <span>{batchItems.length} files. {batchPublicCount} public, {batchPrivateCount} excluded.</span>
                    {allSha256Text && <button type="button" onClick={() => handleCopy('sha256-all', allSha256Text)} className="text-teal-700 hover:underline">{copied === 'sha256-all' ? 'Copied' : 'Copy all SHA-256'}</button>}
                  </div>
                  <div className="max-h-[32rem] overflow-auto rounded border border-gray-100 bg-gray-50">
                    <table className="data-table min-w-full text-xs text-gray-700">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Sample</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Type</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Access</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Batch</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">File</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Description</th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">Size</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Created</th>
                          <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">Downloads</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">SHA256</th>
                          <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">MD5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchItems.map((item, i) => {
                          const sha256 = item.sha256_checksum || 'Unavailable';
                          const md5 = item.md5_checksum || 'N/A';
                          return (
                            <tr key={`${item.sample_id}-${item.kind}-${i}`} className="border-t border-gray-200 align-top">
                              <td className="px-3 py-2 font-mono text-gray-900">{item.sample_id}</td>
                              <td className="px-3 py-2">
                                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px]">{FILE_KIND_LABELS[item.kind] || item.kind}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] ${item.access_mode === 'public_url' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.access_mode === 'public_url' ? 'Public URL' : 'Signed URL'}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.batch_eligible ? (
                                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">Included</span>
                                ) : (
                                  <div className="max-w-[180px] break-words text-[11px] text-amber-700" title={item.batch_skip_reason || undefined}>
                                    {item.batch_skip_reason || NOT_DIRECT_FILE_URL_MESSAGE}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="max-w-[220px] truncate font-medium" title={item.file_name}>{item.file_name}</div>
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                <div className="max-w-[260px] break-words" title={item.description || undefined}>{item.description || 'No description'}</div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                {formatDownloadBytes(item.size_bytes) || 'Unknown'}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-gray-600">
                                {item.download_count.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] leading-5 text-gray-800">
                                <div className="flex items-start gap-2">
                                  <div className="max-w-[260px] break-all" title={sha256}>{sha256}</div>
                                  {item.sha256_checksum && <button type="button" onClick={() => handleCopy(`sha256-${i}`, item.sha256_checksum)} className="shrink-0 text-blue-600 hover:underline">{copied === `sha256-${i}` ? 'Copied' : 'Copy'}</button>}
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] leading-5 text-gray-500">
                                <div className="max-w-[160px] break-all" title={md5}>{md5}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => downloadText('galibierhub-batch-download.sh', buildSh(batchItems))} className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Download .sh (Linux/macOS, resumable)</button>
                    <button type="button" onClick={() => downloadText('galibierhub-batch-download.bat', buildBat(batchItems))} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Download .bat (Windows, resumable)</button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">Preview .sh</summary>
                      <pre className="code-panel mt-2 max-h-56 overflow-auto p-3 font-mono text-[11px] text-slate-900">{buildSh(batchItems)}</pre>
                    </details>
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">Preview .bat</summary>
                      <pre className="code-panel mt-2 max-h-56 overflow-auto p-3 font-mono text-[11px] text-slate-900 whitespace-pre-wrap">{buildBat(batchItems)}</pre>
                    </details>
                  </div>
                  <p className="text-xs text-gray-400">Public scripts support resume (`wget -c` / `curl -C -`). Protected signed URLs and non-direct links are excluded. SHA-256 appears when available. MD5 remains `N/A` unless set. Counts mainly reflect downloads started on the site.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
