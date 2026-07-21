'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Promoter } from '@/types/genome';

interface PromoterTableProps {
  data: Promoter[];
  onRowClick?: (promoter: Promoter) => void;
}

export default function PromoterTable({ data, onRowClick }: PromoterTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

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
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Promoter Predictions ({data.length})
        </h2>
        <input
          type="text"
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search gene, chr, sample..."
          className="px-3 py-1.5 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
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
            {table.getRowModel().rows.map((row) => (
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

      <div className="flex items-center justify-between text-sm text-gray-600">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
