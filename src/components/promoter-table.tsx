'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Promoter } from '@/types/genome';

interface PromoterTableProps {
  data: Promoter[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  loading?: boolean;
  filterSummary?: Array<{ label: string; value: string }>;
  topChromosomes?: Array<{ label: string; count: number }>;
  topSamples?: Array<{ label: string; count: number }>;
  onRowClick?: (promoter: Promoter) => void;
  onPageChange: (pageIndex: number, pageSize: number) => void;
}

export default function PromoterTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  loading,
  filterSummary = [],
  topChromosomes = [],
  topSamples = [],
  onRowClick,
  onPageChange,
}: PromoterTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageInput, setPageInput] = useState(String(pageIndex + 1));
  const currentPagination = { pageIndex, pageSize };
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, (pageIndex + 1) * pageSize);

  useEffect(() => {
    setPageInput(String(pageIndex + 1));
  }, [pageIndex]);

  const columns = useMemo<ColumnDef<Promoter>[]>(
    () => [
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
        header: 'Gene',
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
        header: 'Sample',
        size: 120,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting, pagination: currentPagination },
    manualPagination: true,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
          Promoter Predictions ({totalCount} total)
        </h2>
        {loading ? (
          <span className="text-xs text-gray-500">Loading page...</span>
        ) : null}
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
            <p className="mt-2 text-sm text-gray-500">No active filters. Add chromosome, gene, score, sample, or metadata constraints to narrow the full result set.</p>
          )}
        </div>

        <div className="rounded-lg border bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Current page summary
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-gray-500">Top chromosomes</div>
              <div className="mt-1 space-y-1 text-sm text-gray-700">
                {topChromosomes.length > 0 ? topChromosomes.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    <span className="tabular-nums text-gray-500">{item.count}</span>
                  </div>
                )) : <div className="text-gray-500">No rows on this page.</div>}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500">Top samples</div>
              <div className="mt-1 space-y-1 text-sm text-gray-700">
                {topSamples.length > 0 ? topSamples.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    <span className="tabular-nums text-gray-500">{item.count}</span>
                  </div>
                )) : <div className="text-gray-500">No rows on this page.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' \u2191', desc: ' \u2193' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-gray-500">
                  No promoter records matched the current filters.
                </td>
              </tr>
            ) : table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1.5 whitespace-nowrap">
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
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1), pageSize)}
            disabled={!canPreviousPage}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageIndex + 1, pageSize)}
            disabled={!canNextPage}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount - 1, pageSize)}
            disabled={!canNextPage}
            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span>
            Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()} records
          </span>

          <label className="flex items-center gap-2">
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(e) => onPageChange(pageIndex, Number.parseInt(e.target.value, 10))}
              className="rounded border px-2 py-1 bg-white"
            >
              {[20, 50, 100].map((size) => (
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
            <span>Jump to</span>
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
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
