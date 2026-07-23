'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Promoter, DashboardStats } from '@/types/genome';
import { SiteConfig } from '@/site-config';
import SearchFilters, { type SearchFilters as FiltersType } from '@/components/search-filters';
import StatsChart from '@/components/stats-chart';
import PromoterTable from '@/components/promoter-table';
import PromoterDetail from '@/components/promoter-detail';
import GenomeBrowser from '@/components/genome-browser';
import UserGuide from '@/components/user-guide';

type PromoterSortMode = 'score_desc' | 'score_asc' | 'chrom_start' | 'sample_id';
type SummaryMode = 'overview' | 'sample' | 'chromosome';

function buildPromoterLocus(promoter: Promoter) {
  return `${promoter.chrom}:${Math.max(0, promoter.start - 2000)}-${promoter.end_pos + 2000}`;
}

const EMPTY_FILTERS: FiltersType = {
  chrom: '',
  start: '',
  end_pos: '',
  geneSymbol: '',
  minScore: '',
  species: '',
  tissue: '',
  cohort: '',
  bmiClass: '',
  sampleId: '',
};

export default function HomePage() {
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedPromoter, setSelectedPromoter] = useState<Promoter | null>(null);
  const [browserLocus, setBrowserLocus] = useState<string>(SiteConfig.jbrowse.defaultLocus);
  const [loading, setLoading] = useState(false);
  const [totalPromoters, setTotalPromoters] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(SiteConfig.pageSize);
  const [currentFilters, setCurrentFilters] = useState<FiltersType>(EMPTY_FILTERS);
  const [sortMode, setSortMode] = useState<PromoterSortMode>('score_desc');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('overview');
  const [activeTab, setActiveTab] = useState<'overview' | 'promoters' | 'genome'>('overview');
  const [guideOpen, setGuideOpen] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const configurationHints = useMemo(() => {
    if (!dataError) return [] as string[];

    const hints: string[] = [];
    if (dataError.includes('Supabase is not configured')) {
      hints.push('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to real values in .env.local or your deployment environment.');
    }
    if (dataError.includes('Promoter queries require a real data source')) {
      hints.push('Import real rows into genome_samples and predicted_promoters after running schema.sql.');
    }
    return hints;
  }, [dataError]);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setStats(data);
          setDataError(null);
          return;
        }
        setStats(null);
        setDataError(data?.error || 'Failed to load dashboard statistics from the configured data source.');
      })
      .catch(() => {
        setStats(null);
        setDataError('Failed to load dashboard statistics from the configured data source.');
      });
  }, []);

  const fetchPromoters = useCallback((filters: FiltersType, nextPageIndex: number, nextPageSize: number) => {
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
    params.set('sort_by', sortMode);
    params.set('limit', String(nextPageSize));
    params.set('offset', String(nextPageIndex * nextPageSize));

    fetch(`/api/promoters?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) {
          setPromoters(data.data);
          if (typeof data.total === 'number') {
            setTotalPromoters(data.total);
          }
          setDataError(null);
          return;
        }
        setPromoters([]);
        setTotalPromoters(0);
        setDataError(data?.error || 'Failed to load promoter records from the configured data source.');
      })
      .catch(() => {
        setPromoters([]);
        setTotalPromoters(0);
        setDataError('Failed to load promoter records from the configured data source.');
      })
      .finally(() => setLoading(false));
  }, [sortMode]);

  useEffect(() => {
    fetchPromoters(currentFilters, pageIndex, pageSize);
  }, [currentFilters, fetchPromoters, pageIndex, pageSize]);

  const handleSearch = useCallback((filters: FiltersType) => {
    setPageIndex(0);
    setCurrentFilters(filters);
  }, []);

  const handlePageChange = useCallback((nextPageIndex: number, nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPageIndex(nextPageSize === pageSize ? nextPageIndex : 0);
  }, [pageSize]);

  const handleRowClick = useCallback((promoter: Promoter) => {
    setSelectedPromoter(promoter);
    setBrowserLocus(buildPromoterLocus(promoter));
    setActiveTab('genome');
  }, []);

  const filterSummary = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (currentFilters.chrom) items.push({ label: 'Chromosome', value: currentFilters.chrom });
    if (currentFilters.start || currentFilters.end_pos) {
      items.push({
        label: 'Coordinates',
        value: `${currentFilters.start || '?'}-${currentFilters.end_pos || '?'}`,
      });
    }
    if (currentFilters.geneSymbol) items.push({ label: 'Gene', value: currentFilters.geneSymbol });
    if (currentFilters.minScore) items.push({ label: 'Min score', value: currentFilters.minScore });
    if (currentFilters.sampleId) items.push({ label: 'Sample ID', value: currentFilters.sampleId });
    if (currentFilters.species) items.push({ label: 'Species', value: currentFilters.species });
    if (currentFilters.tissue) items.push({ label: 'Tissue', value: currentFilters.tissue });
    if (currentFilters.cohort) items.push({ label: 'Cohort', value: currentFilters.cohort });
    if (currentFilters.bmiClass) items.push({ label: 'BMI class', value: currentFilters.bmiClass });
    items.push({
      label: 'Sort',
      value: sortMode === 'score_desc'
        ? 'Score high to low'
        : sortMode === 'score_asc'
          ? 'Score low to high'
          : sortMode === 'chrom_start'
            ? 'Chromosome + start'
            : 'Sample ID',
    });
    return items;
  }, [currentFilters, sortMode]);

  const pageSummary = useMemo(() => {
    const countTop = (values: string[]) => Object.entries(
      values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    return {
      visibleCount: promoters.length,
      topChromosomes: countTop(promoters.map((promoter) => promoter.chrom || 'Unknown')),
      topSamples: countTop(promoters.map((promoter) => promoter.sample_id || 'Unknown')),
    };
  }, [promoters]);

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
                {SiteConfig.title}
              </h1>
              <p className="text-xs text-gray-500">
                {SiteConfig.subtitle}
              </p>
              <p className="text-xs text-gray-400">
                {SiteConfig.creatorCreditPrefix}{' '}
                <a
                  href={SiteConfig.creatorCreditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  [{SiteConfig.creatorCreditLabel}]
                </a>
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {(['overview', 'promoters', 'genome'] as const).map((tab) => (
              <button type="button" key={tab}
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
            <button type="button" onClick={() => setGuideOpen((v) => !v)}
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
        {dataError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-2">
            <div>{dataError}</div>
            {configurationHints.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
                {configurationHints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {activeTab === 'overview' && (
          <>
            <StatsChart stats={stats} />
            <SearchFilters onSearch={handleSearch} loading={loading} />
            <PromoterTable data={promoters} totalCount={totalPromoters} pageIndex={pageIndex} pageSize={pageSize} loading={loading} filterSummary={filterSummary} topChromosomes={pageSummary.topChromosomes} topSamples={pageSummary.topSamples} visibleCount={pageSummary.visibleCount} sortMode={sortMode} summaryMode={summaryMode} onSortModeChange={(nextMode) => {
                setSortMode(nextMode);
                setPageIndex(0);
              }} onSummaryModeChange={setSummaryMode} onPageChange={handlePageChange} onRowClick={(p) => {
                setSelectedPromoter(p);
                setBrowserLocus(buildPromoterLocus(p));
              }}
            />
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2 text-sm font-medium">
                Genome Browser - Real-data reference view
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
            <PromoterTable data={promoters} totalCount={totalPromoters} pageIndex={pageIndex} pageSize={pageSize} loading={loading} filterSummary={filterSummary} topChromosomes={pageSummary.topChromosomes} topSamples={pageSummary.topSamples} visibleCount={pageSummary.visibleCount} sortMode={sortMode} summaryMode={summaryMode} onSortModeChange={(nextMode) => {
                setSortMode(nextMode);
                setPageIndex(0);
              }} onSummaryModeChange={setSummaryMode} onPageChange={handlePageChange} onRowClick={handleRowClick} />
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
              Showing {promoters.length} promoter records in the current result set. Select a real record to synchronize the browser view.
            </div>
          </>
        )}
      </main>

      {selectedPromoter && (
        <PromoterDetail
          promoter={selectedPromoter}
          onViewInBrowser={(promoter) => {
            setBrowserLocus(buildPromoterLocus(promoter));
            setActiveTab('genome');
          }}
          onClose={() => setSelectedPromoter(null)}
        />
      )}
    </div>
  );
}
