'use client';

import { useState } from 'react';

export interface SearchFilters {
  chrom: string;
  start: string;
  end: string;
  geneSymbol: string;
  minScore: string;
  species: string;
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

export default function SearchFilters({ onSearch, loading }: SearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    chrom: '',
    start: '',
    end: '',
    geneSymbol: '',
    minScore: '',
    species: '',
    sampleId: '',
  });

  const handleChange = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    const empty: SearchFilters = {
      chrom: '', start: '', end: '', geneSymbol: '',
      minScore: '', species: '', sampleId: '',
    };
    setFilters(empty);
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
        Search Promoters
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Chromosome */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Chromosome</label>
          <select
            value={filters.chrom}
            onChange={(e) => handleChange('chrom', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">All</option>
            {CHROMOSOMES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Position range */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Position</label>
          <input
            type="number"
            placeholder="e.g. 1000000"
            value={filters.start}
            onChange={(e) => handleChange('start', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Position</label>
          <input
            type="number"
            placeholder="e.g. 2000000"
            value={filters.end}
            onChange={(e) => handleChange('end', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Gene symbol */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Gene Symbol</label>
          <input
            type="text"
            placeholder="e.g. BRCA1"
            value={filters.geneSymbol}
            onChange={(e) => handleChange('geneSymbol', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Min score */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min Score</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            placeholder="0.0 — 1.0"
            value={filters.minScore}
            onChange={(e) => handleChange('minScore', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Species */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Species</label>
          <input
            type="text"
            placeholder="e.g. Homo sapiens"
            value={filters.species}
            onChange={(e) => handleChange('species', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Sample ID */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sample ID</label>
          <input
            type="text"
            placeholder="e.g. SAMPLE-001"
            value={filters.sampleId}
            onChange={(e) => handleChange('sampleId', e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-end gap-2">
          <button
            onClick={() => onSearch(filters)}
            disabled={loading}
            className="flex-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 border hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
