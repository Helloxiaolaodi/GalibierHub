'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Promoter, DashboardStats } from '@/types/genome';
import SearchFilters, { type SearchFilters as FiltersType } from '@/components/search-filters';
import StatsChart from '@/components/stats-chart';
import PromoterTable from '@/components/promoter-table';
import PromoterDetail from '@/components/promoter-detail';
import GenomeBrowser from '@/components/genome-browser';
import UserGuide from '@/components/user-guide';

// Fallback demo data - used only when Supabase is not yet connected
const DEMO_PROMOTERS: Promoter[] = [
  { id: '1', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 266, end_pos: 21555, score: 0.98, strand: '+', gene_symbol: 'ORF1ab', sequence: null, created_at: '2025-01-15' },
  { id: '2', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 21563, end_pos: 25384, score: 0.97, strand: '+', gene_symbol: 'S', sequence: null, created_at: '2025-01-15' },
  { id: '3', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 25393, end_pos: 26220, score: 0.9, strand: '+', gene_symbol: 'ORF3a', sequence: null, created_at: '2025-01-16' },
  { id: '4', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 26245, end_pos: 26472, score: 0.84, strand: '+', gene_symbol: 'E', sequence: null, created_at: '2025-01-16' },
  { id: '5', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 26523, end_pos: 27191, score: 0.92, strand: '+', gene_symbol: 'M', sequence: null, created_at: '2025-01-17' },
  { id: '6', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27202, end_pos: 27387, score: 0.76, strand: '+', gene_symbol: 'ORF6', sequence: null, created_at: '2025-01-17' },
  { id: '7', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27394, end_pos: 27759, score: 0.82, strand: '+', gene_symbol: 'ORF7a', sequence: null, created_at: '2025-01-18' },
  { id: '8', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27756, end_pos: 27887, score: 0.71, strand: '+', gene_symbol: 'ORF7b', sequence: null, created_at: '2025-01-18' },
  { id: '9', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 27894, end_pos: 28259, score: 0.8, strand: '+', gene_symbol: 'ORF8', sequence: null, created_at: '2025-01-19' },
  { id: '10', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 28274, end_pos: 29533, score: 0.95, strand: '+', gene_symbol: 'N', sequence: null, created_at: '2025-01-19' },
  { id: '11', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 29558, end_pos: 29674, score: 0.68, strand: '+', gene_symbol: 'ORF10', sequence: null, created_at: '2025-01-20' },
];

const DEMO_STATS: DashboardStats = {
  total_samples: 1,
  total_promoters: 11,
  total_variants: 0,
  species_distribution: {
    'Severe acute respiratory syndrome coronavirus 2': 1,
  },
  score_distribution: [
    { range: '0.0-0.1', count: 0 },
    { range: '0.1-0.2', count: 0 },
    { range: '0.2-0.3', count: 0 },
    { range: '0.3-0.4', count: 0 },
    { range: '0.4-0.5', count: 0 },
    { range: '0.5-0.6', count: 0 },
    { range: '0.6-0.7', count: 1 },
    { range: '0.7-0.8', count: 3 },
    { range: '0.8-0.9', count: 3 },
    { range: '0.9-1.0', count: 4 },
  ],
};

export default function HomePage() {
  const [promoters, setPromoters] = useState<Promoter[]>(DEMO_PROMOTERS);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedPromoter, setSelectedPromoter] = useState<Promoter | null>(null);
  const [browserLocus, setBrowserLocus] = useState('NC_045512.2:21,563-25,384');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'promoters' | 'genome'>('overview');
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data && !data.error ? data : DEMO_STATS);
      })
      .catch(() => setStats(DEMO_STATS));
  }, []);

  const handleSearch = useCallback((filters: FiltersType) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.chrom) params.set('chrom', filters.chrom);
    if (filters.geneSymbol) params.set('gene_symbol', filters.geneSymbol);
    if (filters.minScore) params.set('min_score', filters.minScore);
    if (filters.start) params.set('start', filters.start);
    if (filters.end_pos) params.set('end_pos', filters.end_pos);
    if (filters.sampleId) params.set('sample_id', filters.sampleId);
    if (filters.species) params.set('species', filters.species);
    if (filters.tissue) params.set('tissue', filters.tissue);
    if (filters.cohort) params.set('cohort', filters.cohort);
    if (filters.bmiClass) params.set('bmi_class', filters.bmiClass);

    fetch(`/api/promoters?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) setPromoters(data.data);
      })
      .catch(() => {
        let filtered = DEMO_PROMOTERS;
        if (filters.chrom) filtered = filtered.filter((p) => p.chrom === filters.chrom);
        if (filters.geneSymbol) filtered = filtered.filter((p) => p.gene_symbol?.toLowerCase().includes(filters.geneSymbol.toLowerCase()));
        if (filters.minScore) filtered = filtered.filter((p) => p.score >= parseFloat(filters.minScore));
        if (filters.start) filtered = filtered.filter((p) => p.start >= parseInt(filters.start));
        if (filters.end_pos) filtered = filtered.filter((p) => p.end_pos <= parseInt(filters.end_pos));
        if (filters.sampleId) filtered = filtered.filter((p) => p.sample_id.toLowerCase().includes(filters.sampleId.toLowerCase()));
        setPromoters(filtered);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRowClick = useCallback((promoter: Promoter) => {
    setSelectedPromoter(promoter);
    const locus = `${promoter.chrom}:${Math.max(0, promoter.start - 2000).toLocaleString()}-${(promoter.end_pos + 2000).toLocaleString()}`;
    setBrowserLocus(locus);
    setActiveTab('genome');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              SE
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                SeqEdge
              </h1>
              <p className="text-xs text-gray-500">
                A Modern Edge-Native Portal for Genomic Databases
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
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button
              onClick={() => setGuideOpen((v) => !v)}
              aria-expanded={guideOpen}
              aria-controls="seqedge-user-guide"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                guideOpen ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              User Guide
            </button>
          </nav>
        </div>
      </header>
      <UserGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'overview' && (
          <>
            <StatsChart stats={stats} />
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <PromoterTable
              data={promoters}
              onRowClick={(p) => {
                setSelectedPromoter(p);
                const locus = `${p.chrom}:${Math.max(0, p.start - 2000).toLocaleString()}-${(p.end_pos + 2000).toLocaleString()}`;
                setBrowserLocus(locus);
              }}
            />
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
                Genome Browser - Click a promoter row to navigate
              </div>
              <GenomeBrowser
                locus={browserLocus}
                onLocusChange={setBrowserLocus}
              />
            </div>
          </>
        )}

        {activeTab === 'promoters' && (
          <>
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <PromoterTable data={promoters} onRowClick={handleRowClick} />
          </>
        )}

        {activeTab === 'genome' && (
          <>
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <GenomeBrowser
              locus={browserLocus}
              onLocusChange={setBrowserLocus}
            />
            <div className="text-sm text-gray-500">
              Showing {promoters.length} promoters in current view. Click a row in the table to navigate to that promoter.
            </div>
          </>
        )}
      </main>

      {selectedPromoter && (
        <PromoterDetail
          promoter={selectedPromoter}
          onClose={() => setSelectedPromoter(null)}
        />
      )}
    </div>
  );
}
