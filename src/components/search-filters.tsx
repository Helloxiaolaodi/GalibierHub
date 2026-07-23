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

const CHROMOSOMES = [
  'chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7', 'chr8',
  'chr9', 'chr10', 'chr11', 'chr12', 'chr13', 'chr14', 'chr15', 'chr16',
  'chr17', 'chr18', 'chr19', 'chr20', 'chr21', 'chr22', 'chrX', 'chrY', 'chrMT',
];

// Species / tissue lists mirror the seed data in schema.sql - extend as your
// genome_samples table grows.
const SPECIES = ['Homo sapiens', 'Oryza sativa', 'Escherichia coli'];
const TISSUES = ['liver', 'brain', 'leaf', 'breast', 'root', 'whole_cell'];

// Cohort tokens follow the P- / C- / V- prefix convention documented in the
// paper: P-Cohort is the primary discovery cohort, C-Cohort is the matched
// control set, V-Validation is the held-out validation cohort.
const COHORTS = [
  { value: 'P-Cohort', label: 'P-Cohort - Primary' },
  { value: 'C-Cohort', label: 'C-Cohort - Control' },
  { value: 'V-Validation', label: 'V-Validation' },
];

// WHO adult BMI classification (kg/m^2) - matches the paper's inclusion table
const BMI_CLASSES = [
  { value: 'underweight', label: 'Underweight (<18.5)' },
  { value: 'normal',      label: 'Normal (18.5-24.9)' },
  { value: 'overweight',  label: 'Overweight (25.0-29.9)' },
  { value: 'obese',       label: 'Obese (>=30.0)' },
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
          Search &amp; Cohort Inclusion Filters
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Reproduce the paper&apos;s inclusion / exclusion criteria - cohort prefix,
          WHO adult BMI bands, species and tissue - combined with the
          promoter-level coordinate and score filters.
        </p>
      </div>

      {/* Sample-level metadata (drives the genome_samples pre-filter) */}
      <div className="px-4 pb-2">
        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
          Sample metadata
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Species</label>
            <select value={filters.species} onChange={(e) => set('species', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tissue</label>
            <select value={filters.tissue} onChange={(e) => set('tissue', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {TISSUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cohort prefix</label>
            <select value={filters.cohort} onChange={(e) => set('cohort', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {COHORTS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              BMI class <span className="text-gray-400">(WHO adult)</span>
            </label>
            <select value={filters.bmiClass} onChange={(e) => set('bmiClass', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {BMI_CLASSES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Promoter-level filters (coordinate / score / free-text) */}
      <div className="px-4 pt-2 pb-4">
        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
          Promoter locus
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chromosome</label>
            <select value={filters.chrom} onChange={(e) => set('chrom', e.target.value)} className={cellCls}>
              <option value="">All</option>
              {CHROMOSOMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start position</label>
            <input type="number" placeholder="e.g. 1000000" value={filters.start}
              onChange={(e) => set('start', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End position</label>
            <input type="number" placeholder="e.g. 2000000" value={filters.end_pos}
              onChange={(e) => set('end_pos', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gene symbol</label>
            <input type="text" placeholder="e.g. BRCA1" value={filters.geneSymbol}
              onChange={(e) => set('geneSymbol', e.target.value)} className={cellCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Min score <span className="text-gray-400">0 - 1</span>
            </label>
            <input type="number" step="0.01" min="0" max="1" placeholder="0.75"
              value={filters.minScore} onChange={(e) => set('minScore', e.target.value)}
              className={cellCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sample ID</label>
            <input type="text" placeholder="e.g. P-SAMPLE-001" value={filters.sampleId}
              onChange={(e) => set('sampleId', e.target.value)} className={cellCls} />
          </div>
          <div className="lg:col-span-2 flex items-end gap-2">
            <button
              onClick={() => onSearch(filters)}
              disabled={loading}
              className="flex-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Searching...' : 'Apply filters'}
            </button>
            <button
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

