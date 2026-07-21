'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Promoter, DashboardStats } from '@/types/genome';
import SearchFilters, { type SearchFilters as FiltersType } from '@/components/search-filters';
import StatsChart from '@/components/stats-chart';
import PromoterTable from '@/components/promoter-table';
import PromoterDetail from '@/components/promoter-detail';
import GenomeBrowser from '@/components/genome-browser';

// Demo data for development — replace with Supabase queries in production
const DEMO_PROMOTERS: Promoter[] = [
  { id: '1', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43044295, end: 43045800, score: 0.95, strand: '+', gene_symbol: 'BRCA1', sequence: 'ATGCGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCATCGATCG', created_at: '2025-01-15' },
  { id: '2', sample_id: 'SAMPLE-001', chrom: 'chr17', start: 43050000, end: 43051500, score: 0.88, strand: '-', gene_symbol: 'BRCA1', sequence: 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-15' },
  { id: '3', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55000000, end: 55002000, score: 0.91, strand: '+', gene_symbol: 'EGFR', sequence: 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC', created_at: '2025-01-16' },
  { id: '4', sample_id: 'SAMPLE-002', chrom: 'chr7', start: 55010000, end: 55011500, score: 0.73, strand: '-', gene_symbol: 'EGFR', sequence: 'TTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC', created_at: '2025-01-16' },
  { id: '5', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25000000, end: 25001800, score: 0.82, strand: '+', gene_symbol: 'KRAS', sequence: 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-17' },
  { id: '6', sample_id: 'SAMPLE-003', chrom: 'chr12', start: 25005000, end: 25006000, score: 0.67, strand: '+', gene_symbol: 'KRAS', sequence: 'AACGTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-17' },
  { id: '7', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150000000, end: 150002000, score: 0.89, strand: '-', gene_symbol: 'TP53', sequence: 'ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-18' },
  { id: '8', sample_id: 'SAMPLE-004', chrom: 'chr1', start: 150010000, end: 150011500, score: 0.94, strand: '+', gene_symbol: 'TP53', sequence: 'GCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-18' },
  { id: '9', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47000000, end: 47002500, score: 0.78, strand: '+', gene_symbol: 'MYCN', sequence: 'TTACGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-19' },
  { id: '10', sample_id: 'SAMPLE-005', chrom: 'chr2', start: 47008000, end: 47009500, score: 0.86, strand: '-', gene_symbol: 'ALK', sequence: 'GCTAGCTAGCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG', created_at: '2025-01-19' },
  { id: '11', sample_id: 'SAMPLE-006', chrom: 'chr3', start: 178000000, end: 178002000, score: 0.71, strand: '+', gene_symbol: 'PIK3CA', sequence: null, created_at: '2025-01-20' },
  { id: '12', sample_id: 'SAMPLE-006', chrom: 'chr3', start: 178010000, end: 178012000, score: 0.83, strand: '-', gene_symbol: 'PIK3CA', sequence: null, created_at: '2025-01-20' },
];

const DEMO_STATS: DashboardStats = {
  total_samples: 6,
  total_promoters: 125430,
  total_variants: 8947521,
  species_distribution: {
    'Homo sapiens': 3,
    'Oryza sativa': 2,
    'Escherichia coli': 1,
  },
  score_distribution: [
    { range: '0.0-0.1', count: 1204 },
    { range: '0.1-0.2', count: 3456 },
    { range: '0.2-0.3', count: 8901 },
    { range: '0.3-0.4', count: 15230 },
    { range: '0.4-0.5', count: 22340 },
    { range: '0.5-0.6', count: 28910 },
    { range: '0.6-0.7', count: 19870 },
    { range: '0.7-0.8', count: 14560 },
    { range: '0.8-0.9', count: 7890 },
    { range: '0.9-1.0', count: 1069 },
  ],
};

export default function HomePage() {
  const [promoters, setPromoters] = useState<Promoter[]>(DEMO_PROMOTERS);
  const [stats] = useState<DashboardStats>(DEMO_STATS);
  const [selectedPromoter, setSelectedPromoter] = useState<Promoter | null>(null);
  const [browserLocus, setBrowserLocus] = useState('chr17:43,044,295-43,125,483');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'promoters' | 'genome'>('overview');

  const handleSearch = useCallback((filters: FiltersType) => {
    setLoading(true);
    // Filter demo data — in production, this queries Supabase
    setTimeout(() => {
      let filtered = DEMO_PROMOTERS;
      if (filters.chrom) filtered = filtered.filter((p) => p.chrom === filters.chrom);
      if (filters.geneSymbol) filtered = filtered.filter((p) => p.gene_symbol?.toLowerCase().includes(filters.geneSymbol.toLowerCase()));
      if (filters.minScore) filtered = filtered.filter((p) => p.score >= parseFloat(filters.minScore));
      if (filters.start) filtered = filtered.filter((p) => p.start >= parseInt(filters.start));
      if (filters.end) filtered = filtered.filter((p) => p.end <= parseInt(filters.end));
      if (filters.sampleId) filtered = filtered.filter((p) => p.sample_id.toLowerCase().includes(filters.sampleId.toLowerCase()));
      setPromoters(filtered);
      setLoading(false);
    }, 300);
  }, []);

  const handleRowClick = useCallback((promoter: Promoter) => {
    setSelectedPromoter(promoter);
    const locus = `${promoter.chrom}:${Math.max(0, promoter.start - 2000).toLocaleString()}-${(promoter.end + 2000).toLocaleString()}`;
    setBrowserLocus(locus);
    setActiveTab('genome');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              GP
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Genomes & Promoters
              </h1>
              <p className="text-xs text-gray-500">
                Whole Genome Promoter Prediction Database
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {(['overview', 'promoters', 'genome'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'promoters' ? 'Promoters' : 'Genome Browser'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <>
            <StatsChart stats={stats} />
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <PromoterTable
              data={promoters}
              onRowClick={(p) => {
                setSelectedPromoter(p);
                const locus = `${p.chrom}:${Math.max(0, p.start - 2000).toLocaleString()}-${(p.end + 2000).toLocaleString()}`;
                setBrowserLocus(locus);
              }}
            />
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
                Genome Browser — Click a promoter row to navigate
              </div>
              <GenomeBrowser
                assemblyName="Demo Assembly (hg38)"
                locus={browserLocus}
                onLocusChange={setBrowserLocus}
                tracks={[
                  { name: 'Predicted Promoters', type: 'annotation', url: '', format: 'bed' },
                  { name: 'RNA-seq Coverage', type: 'quantitative', url: '', format: 'bigwig' },
                ]}
              />
            </div>
          </>
        )}

        {/* Promoters tab */}
        {activeTab === 'promoters' && (
          <>
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <PromoterTable data={promoters} onRowClick={handleRowClick} />
          </>
        )}

        {/* Genome browser tab */}
        {activeTab === 'genome' && (
          <>
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <GenomeBrowser
              assemblyName="Demo Assembly (hg38)"
              locus={browserLocus}
              onLocusChange={setBrowserLocus}
              tracks={[
                { name: 'Predicted Promoters', type: 'annotation', url: '', format: 'bed' },
                { name: 'Gene Annotations', type: 'annotation', url: '', format: 'gff3' },
                { name: 'RNA-seq Coverage', type: 'quantitative', url: '', format: 'bigwig' },
                { name: 'ChIP-seq Peaks', type: 'annotation', url: '', format: 'bed' },
              ]}
            />
            <div className="text-sm text-gray-500">
              Showing {promoters.length} promoters in current view. Click a row in the table to navigate to that promoter.
            </div>
          </>
        )}
      </main>

      {/* Promoter detail modal */}
      {selectedPromoter && (
        <PromoterDetail
          promoter={selectedPromoter}
          onClose={() => setSelectedPromoter(null)}
        />
      )}
    </div>
  );
}