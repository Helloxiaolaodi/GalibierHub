'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Promoter, DashboardStats } from '@/types/genome';
import { SiteConfig } from '@/site-config';
import { getBrowserSupabase } from '@/utils/supabase-browser';
import SearchFilters, { type SearchFilters as FiltersType } from '@/components/search-filters';
import StatsChart from '@/components/stats-chart';
import FlipCard from '@/components/flip-card';
import PromoterTable from '@/components/promoter-table';
import PromoterDetail from '@/components/promoter-detail';
import GenomeBrowser from '@/components/genome-browser';
import UserGuide from '@/components/user-guide';
import Link from 'next/link';
import NotificationBell from '@/components/notification-bell';
import DownloadCatalogPanel from '@/components/download-catalog-panel';
import SiteFeedback from '@/components/site-feedback';
import SiteUptime from '@/components/site-uptime';
import { resolveExpectedAdminGithubLogin } from '@/lib/admin-login';
import UserMenuPanel from '@/components/user-menu-panel';

type PromoterSortMode = 'score_desc' | 'score_asc' | 'chrom_start' | 'sample_id';
type SummaryMode = 'overview' | 'sample' | 'chromosome';
type ActiveTab = 'overview' | 'promoters' | 'genome-browser' | 'discussion' | 'downloads';

function buildPromoterLocus(promoter: Promoter) {
  return `${promoter.chrom}:${Math.max(1, promoter.start - 2000)}-${Math.max(promoter.end_pos + 2000, promoter.start + 1)}`;
}

function buildHighlightRegion(promoter: Promoter | null) {
  if (!promoter) {
    return null;
  }

  return {
    refName: promoter.chrom,
    start: promoter.start,
    end: promoter.end_pos,
    name: promoter.gene_symbol || promoter.sample_id,
  };
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [creatorSignInError, setCreatorSignInError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [feedbackRefreshSignal, setFeedbackRefreshSignal] = useState(0);
  const [creatorSession, setCreatorSession] = useState<Session | null>(null);
  const [creatorLogin, setCreatorLogin] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const expectedAdminLogin = useMemo(
    () => resolveExpectedAdminGithubLogin({ fallbackLabel: SiteConfig.adminGithubLoginFallback }),
    [],
  );

  const configurationHints = useMemo(() => {
    if (!dataError) return [] as string[];

    const hints: string[] = [];
    if (dataError.includes('Supabase is not configured')) {
      hints.push('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or your deployment environment.');
    }
    if (dataError.includes('require a real data source')) {
      hints.push('Load data into the resource tables after running schema.sql.');
    }
    return hints;
  }, [dataError]);

  useEffect(() => {
    setMounted(true);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return undefined;
    }

    const syncSession = (session: Session | null) => {
      setCreatorSession(session);
      const metadata = session?.user?.user_metadata && typeof session.user.user_metadata === 'object'
        ? session.user.user_metadata as Record<string, unknown>
        : {};
      const login = typeof metadata.user_name === 'string'
        ? metadata.user_name
        : typeof metadata.preferred_username === 'string'
          ? metadata.preferred_username
          : typeof metadata.login === 'string'
            ? metadata.login
            : null;
      setCreatorLogin(login);
    };

    void supabase.auth.getSession().then(({ data }) => {
      syncSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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
        setDataError(data?.error || 'Unable to load dashboard metrics from the current data source.');
      })
      .catch(() => {
        setStats(null);
        setDataError('Unable to load dashboard metrics from the current data source.');
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
        setDataError(data?.error || 'Unable to load records from the current data source.');
      })
      .catch(() => {
        setPromoters([]);
        setTotalPromoters(0);
        setDataError('Unable to load records from the current data source.');
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
    setActiveTab('genome-browser');
  }, []);
  const filterSummary = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (currentFilters.chrom) items.push({ label: 'Reference', value: currentFilters.chrom });
    if (currentFilters.start || currentFilters.end_pos) {
      items.push({
        label: 'Coordinates',
        value: `${currentFilters.start || '?'}-${currentFilters.end_pos || '?'}`,
      });
    }
    if (currentFilters.geneSymbol) items.push({ label: 'Feature', value: currentFilters.geneSymbol });
    if (currentFilters.minScore) items.push({ label: 'Min score', value: currentFilters.minScore });
    if (currentFilters.sampleId) items.push({ label: 'Sample ID', value: currentFilters.sampleId });
    if (currentFilters.species) items.push({ label: 'Species', value: currentFilters.species });
    if (currentFilters.tissue) items.push({ label: 'Tissue', value: currentFilters.tissue });
    if (currentFilters.cohort) items.push({ label: 'Cohort', value: currentFilters.cohort });
    if (currentFilters.bmiClass) items.push({ label: 'BMI class', value: currentFilters.bmiClass });
    items.push({
      label: 'Sort by',
      value: sortMode === 'score_desc'
        ? 'Score (Descending)'
        : sortMode === 'score_asc'
          ? 'Score (Ascending)'
          : sortMode === 'chrom_start'
            ? 'Chromosome + Start'
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

  const highlightedPromoterRegion = useMemo(
    () => buildHighlightRegion(selectedPromoter),
    [selectedPromoter],
  );

  const creatorAccessToken = creatorSession?.access_token || null;
  const isCreatorAdmin = Boolean(
    creatorLogin &&
    creatorAccessToken &&
    expectedAdminLogin &&
    creatorLogin.toLowerCase() === expectedAdminLogin,
  );
  const handleCreatorSignIn = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || typeof window === 'undefined') {
      return;
    }

    setCreatorSignInError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) {
      if (error.message.includes('provider is not enabled') || error.message.includes('Unsupported provider')) {
        setCreatorSignInError('GitHub OAuth is not enabled for this project. Enable GitHub under Authentication -> Sign In / Providers in Supabase.');
      } else {
        setCreatorSignInError(error.message);
      }
    }
  }, []);

  const handleCreatorSignOut = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="bg-white/70 backdrop-blur-xl saturate-150 border-b border-white/20 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              GH
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {SiteConfig.title}
              </h1>
              {SiteConfig.subtitle && (
                <p className="text-xs text-gray-500">
                  {SiteConfig.subtitle}
                </p>
              )}
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
          <nav className="flex flex-wrap items-center gap-1">
            {(['overview', 'promoters', 'genome-browser', 'downloads'] as const).map((tab) => (
              <button type="button" key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200/60'
                }`}
              >
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'promoters'
                    ? 'Records'
                    : tab === 'genome-browser'
                      ? 'Genome Browser'
                      
                        : 'Downloads'}
              </button>
            ))}
            <Link href="/discussions" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200/60 transition-colors">Discussions</Link>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            {!mounted ? (
              <div className="w-[120px] h-8" />
            ) : creatorSession ? (
              <UserMenuPanel session={creatorSession} githubUser={creatorLogin} isAdmin={isCreatorAdmin} onSignOut={() => void handleCreatorSignOut()} avatarUrl={creatorSession?.user?.user_metadata?.avatar_url as string | undefined} />
            ) : (
              <button type="button" onClick={() => void handleCreatorSignIn()}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                Log in with GitHub
              </button>
            )}
            <NotificationBell session={creatorSession} />
            <button type="button" onClick={() => setGuideOpen((v) => !v)}
              aria-expanded={guideOpen}
              aria-controls="galibierhub-user-guide"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                guideOpen ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
        {creatorSignInError && (
          <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3 shadow-sm">
            <span>{creatorSignInError}</span>
            <button type="button" onClick={() => setCreatorSignInError(null)} aria-label="Dismiss" className="shrink-0 text-red-400 hover:text-red-600">X</button>
          </div>
       )}
        {creatorSession && isCreatorAdmin && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            Administrator access enabled for @{creatorLogin || 'unknown'}.
          </div>
        )}
        {dataError && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 space-y-2 shadow-sm">
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
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FlipCard
                front={
                  <>
                   <svg className="mb-3 h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                   </svg>
                   <h3 className="text-lg font-semibold text-gray-900">Search &amp; Discovery</h3>
                   <p className="mt-2 text-center text-sm text-gray-500">
                     Filter by locus, gene, score, species, tissue, cohort, and BMI class
                   </p>
                 </>
               }
               back={
                 <>
                   <h3 className="text-lg font-semibold text-white">Search &amp; Discovery</h3>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Locus &amp; gene-based precision search</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Score, species, tissue, cohort &amp; BMI filtering</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Real-time cursor-based pagination</li>
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTab('promoters'); }}
                      className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Explore Records
                    </button>
                  </>
                }
              />
              <FlipCard
                front={
                  <>
                    <svg className="mb-3 h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                   <h3 className="text-lg font-semibold text-gray-900">Genome Browser</h3>
                   <p className="mt-2 text-center text-sm text-gray-500">
                     Interactive JBrowse 2 viewer with track selection and navigation
                   </p>
                  </>
                }
                back={
                  <>
                    <h3 className="text-lg font-semibold text-white">Genome Browser</h3>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> JBrowse 2 linear genome view</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Multi-track annotation display</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Fullscreen zen mode supported</li>
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTab('genome-browser'); }}
                      className="mt-6 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      View Browser
                    </button>
                  </>
                }
              />
              <FlipCard
                front={
                  <>
                    <svg className="mb-3 h-10 w-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                   <h3 className="text-lg font-semibold text-gray-900">File Distribution</h3>
                   <p className="mt-2 text-center text-sm text-gray-500">
                     Browser download, wget, curl, and hf download in one modal
                   </p>
                  </>
                }
                back={
                  <>
                    <h3 className="text-lg font-semibold text-white">File Distribution</h3>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Unified download modal with multi-path access</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> SHA256 &amp; MD5 checksum verification</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> .sh and .bat batch scripts for public files</li>
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTab('downloads'); }}
                      className="mt-6 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                    >
                      Browse Downloads
                    </button>
                  </>
                }
              />
              <FlipCard
                front={
                  <>
                    <svg className="mb-3 h-10 w-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                   <h3 className="text-lg font-semibold text-gray-900">Community &amp; Moderation</h3>
                   <p className="mt-2 text-center text-sm text-gray-500">
                     Public discussions, image uploads, likes, and admin moderation
                   </p>
                  </>
                }
                back={
                  <>
                    <h3 className="text-lg font-semibold text-white">Community &amp; Moderation</h3>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Public or admin-only discussions</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> GitHub sign-in for official replies</li>
                      <li className="flex items-center gap-2"><span className="text-emerald-400">&#x2713;</span> Like, bookmark, pin, hide and delete tools</li>
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTab('discussion'); }}
                      className="mt-6 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      Join Discussion
                    </button>
                  </>
                }
              />
            </section>
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
                {activeTab === 'genome-browser' && (
          <div className="border rounded-lg overflow-hidden">
            <div id="galibierhub-genome-browser" />
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white">
              Genome Browser
            </div>
            <GenomeBrowser
              locus={browserLocus}
              onLocusChange={setBrowserLocus}
              highlightRegion={highlightedPromoterRegion}
            />
          </div>
        )}
{activeTab === 'discussion' && (
          <SiteFeedback isAdminHint={isCreatorAdmin} accessToken={creatorAccessToken} creatorLogin={creatorLogin} refreshSignal={feedbackRefreshSignal} onFeedbackSubmitted={() => setFeedbackRefreshSignal((current) => current + 1)} />
        )}
        {activeTab === 'downloads' && (
          <DownloadCatalogPanel
            isAdmin={isCreatorAdmin}
            accessToken={creatorAccessToken}
          />
        )}
      </main>
      {selectedPromoter && (
       <PromoterDetail
         promoter={selectedPromoter}
         onViewInBrowser={(promoter) => {
           setBrowserLocus(buildPromoterLocus(promoter));
           setActiveTab('genome-browser');
         }}
         onClose={() => setSelectedPromoter(null)}
         isAdmin={isCreatorAdmin}
         accessToken={creatorAccessToken}
       />
      )}
      <SiteUptime startAt={SiteConfig.uptime.startAt} />
    </div>
  );
}
