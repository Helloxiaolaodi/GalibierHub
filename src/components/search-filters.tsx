'use client';

import { useState } from 'react';

export interface SearchFilters {
  chrom: string;
  start: string;
  end_pos: string;
  geneSymbol: string;
  minScore: string;
  species: string;
  tissue: string;
  cohort: string;
  bmiClass: string;
  sampleId: string;
}

interface SearchFiltersProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

// Chinese adult BMI classification (kg/m^2)
const BMI_CLASSES = [
  { value: 'underweight', label: 'Underweight (<18.5)' },
  { value: 'normal',      label: 'Normal (18.5-24.0)' },
  { value: 'overweight',  label: 'Overweight (24.0-28.0)' },
  { value: 'obese',       label: 'Obese (>=28.0)' },
];

const EMPTY: SearchFilters = {
  chrom: '', start: '', end_pos: '', geneSymbol: '',
  minScore: '', species: '', tissue: '', cohort: '',
  bmiClass: '', sampleId: '',
};

export default function SearchFilters({ onSearch, loading }: SearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY);

  const set = (key: keyof SearchFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const cellCls = 'w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="bg-white border rounded-lg">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Search Filters
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Filter promoter records by chromosome, coordinate range, gene symbol, minimum score, sample ID, species, tissue, cohort, and BMI class.
        </p>
      </div>

      {/* Sample-level metadata */}
      <div className="px-4 pb-2">
        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
          Sample metadata
        </div>
        <p className="text-xs text-gray-500 mb-2">
          These fields first narrow matching entries in <code>genome_samples</code>, then apply the resulting <code>sample_id</code> set to promoter records.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="filter-species" className="block text-xs text-gray-500 mb-1">Species</label>
            <input id="filter-species" type="text" placeholder="Enter species" value={filters.species}
              onChange={(e) => set('species', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-tissue" className="block text-xs text-gray-500 mb-1">Tissue</label>
            <input id="filter-tissue" type="text" placeholder="Enter tissue or source" value={filters.tissue}
              onChange={(e) => set('tissue', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-cohort" className="block text-xs text-gray-500 mb-1">Cohort</label>
            <input id="filter-cohort" type="text" placeholder="Enter cohort label" value={filters.cohort}
              onChange={(e) => set('cohort', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-bmi" className="block text-xs text-gray-500 mb-1">
              BMI class <span className="text-gray-400">(optional)</span>
            </label>
            <select id="filter-bmi" value={filters.bmiClass} onChange={(e) => set('bmiClass', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {BMI_CLASSES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Promoter-level filters */}
      <div className="px-4 pt-2 pb-4">
        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
          Promoter locus
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Use locus and feature filters to query <code>predicted_promoters</code> directly by coordinate window, feature label, score cutoff, or sample ID.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="filter-chrom" className="block text-xs text-gray-500 mb-1">Chromosome</label>
            <input id="filter-chrom" type="text" placeholder="Enter chromosome or contig" value={filters.chrom}
              onChange={(e) => set('chrom', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-start" className="block text-xs text-gray-500 mb-1">Start position</label>
            <input id="filter-start" type="number" placeholder="Start coordinate" value={filters.start}
              onChange={(e) => set('start', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-end" className="block text-xs text-gray-500 mb-1">End position</label>
            <input id="filter-end" type="number" placeholder="End coordinate" value={filters.end_pos}
              onChange={(e) => set('end_pos', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-gene" className="block text-xs text-gray-500 mb-1">Gene symbol</label>
            <input id="filter-gene" type="text" placeholder="Enter gene or feature name" value={filters.geneSymbol}
              onChange={(e) => set('geneSymbol', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-score" className="block text-xs text-gray-500 mb-1">
              Min score <span className="text-gray-400">0 - 1</span>
            </label>
            <input id="filter-score" type="number" step="0.01" min="0" max="1" placeholder="0.75"
              value={filters.minScore} onChange={(e) => set('minScore', e.target.value)}
              className={cellCls} />
          </div>
          <div>
            <label htmlFor="filter-sample" className="block text-xs text-gray-500 mb-1">Sample ID</label>
            <input id="filter-sample" type="text" placeholder="Enter sample ID" value={filters.sampleId}
              onChange={(e) => set('sampleId', e.target.value)} className={cellCls} />
          </div>
          <div className="lg:col-span-2 flex items-end gap-2">
            <button
              type="button"
              onClick={() => onSearch(filters)}
              disabled={loading}
              className="flex-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="px-4 py-1.5 border hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

