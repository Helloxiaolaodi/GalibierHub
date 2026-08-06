'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Promoter, DashboardStats } from '@/types/genome';
import { SiteConfig } from '@/site-config';
import { getBrowserSupabase } from '@/utils/supabase-browser';
import SearchFilters, { type SearchFilters as FiltersType } from '@/components/search-filters';
import FlipCard from '@/components/flip-card';
import UserGuide from '@/components/user-guide';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import NotificationBell from '@/components/notification-bell';
import SiteUptime from '@/components/site-uptime';
import { resolveExpectedAdminGithubLogin } from '@/lib/admin-login';
import UserMenuPanel from '@/components/user-menu-panel';
import Logo from '@/components/logo';
import ThemeToggle from '@/components/theme-toggle';
import { useLoading } from '@/contexts/LoadingContext';

type PromoterSortMode = 'score_desc' | 'score_asc' | 'chrom_start' | 'sample_id';
import AuthModal from '@/components/auth-modal';
type SummaryMode = 'overview' | 'sample' | 'chromosome';
type ActiveTab = 'overview' | 'promoters' | 'genome-browser' | 'discussion' | 'downloads' | 'admin' | 'badges';

const GenomeBrowser = dynamic(() => import('@/components/genome-browser'), { ssr: false });
const StatsChart = dynamic(() => import('@/components/stats-chart'), { ssr: false, loading: () => <div className="h-72 rounded-lg border bg-white text-sm text-gray-400 flex items-center justify-center">Loading metrics...</div> });
const PromoterDetail = dynamic(() => import('@/components/promoter-detail'), { ssr: false });
const PromoterTable = dynamic(() => import('@/components/promoter-table'), { ssr: false, loading: () => <div className="rounded-lg border bg-white p-6 text-sm text-gray-400">Loading records...</div> });
const DownloadCatalogPanel = dynamic(() => import('@/components/download-catalog-panel'), { ssr: false });
const SiteFeedback = dynamic(() => import('@/components/site-feedback'), { ssr: false });
const AdminUserStats = dynamic(() => import('@/components/admin-user-stats'), { ssr: false });
const AdminBadgeStats = dynamic(() => import('@/components/admin-badge-stats'), { ssr: false });

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
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tutorialMenuOpen, setTutorialMenuOpen] = useState(false);
  const [pendingRecordSampleId, setPendingRecordSampleId] = useState<string | null>(null);
  const tutorialMenuRef = useRef<HTMLDivElement | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { showLoading, hideLoading } = useLoading();

  useEffect(() => {
    if (!tutorialMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!tutorialMenuRef.current || tutorialMenuRef.current.contains(event.target as Node)) return;
      setTutorialMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [tutorialMenuOpen]);
  const expectedAdminLogin = useMemo(
    () => resolveExpectedAdminGithubLogin({ fallbackLabel: SiteConfig.adminGithubLoginFallback }),
    [],
  );

  const handleRecordDownload = useCallback((sampleId: string, kind: 'vcf' | 'fasta') => {
    const filename = kind === 'vcf' ? `${sampleId}.vcf.gz` : `${sampleId}.fasta`;
    window.sessionStorage.setItem('galibier_pending_downloads', JSON.stringify([filename]));
    setPendingRecordSampleId(sampleId);
    setActiveTab('downloads');
  }, []);

  const handleSendSelectedToDownloads = useCallback((kind: 'vcf' | 'fasta', sampleIds: string[]) => {
    const filenames = sampleIds.map((sampleId) => (kind === 'vcf' ? `${sampleId}.vcf.gz` : `${sampleId}.fasta`));
    window.sessionStorage.setItem('galibier_pending_downloads', JSON.stringify(filenames));
    setPendingRecordSampleId(sampleIds[0] ?? null);
    setActiveTab('downloads');
  }, []);

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
            : session?.user?.email
              ? session.user.email.split('@')[0]
              : null;
      setCreatorLogin(login);
      if (login) {
        localStorage.setItem('galibierhub-github-user', login);
        if (session?.user?.id) {
          localStorage.setItem('galibierhub-user-id', session.user.id);
        }
      }
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
    const applyCommandAction = () => {
      const raw = window.sessionStorage.getItem('galibierhub-command-action');
      if (!raw) return;
      window.sessionStorage.removeItem('galibierhub-command-action');
      try {
        const action = JSON.parse(raw) as { tab?: ActiveTab; query?: Partial<FiltersType> };
        if (action.tab) setActiveTab(action.tab);
        if (action.query && Object.keys(action.query).length > 0) {
          setPageIndex(0);
          setCurrentFilters((prev) => ({ ...EMPTY_FILTERS, ...action.query }));
        }
      } catch {
        // Ignore malformed command payloads.
      }
    };

    applyCommandAction();
    window.addEventListener('galibierhub-command-action', applyCommandAction);
    return () => window.removeEventListener('galibierhub-command-action', applyCommandAction);
  }, []);

  useEffect(() => {
    showLoading(0, [
      'Initializing GalibierHub Telemetry...',
      'Establishing Secure Connection...',
      'Mounting Metagenomic Cohort Volumes...',
      'Loading Reference Assemblies...',
    ]);

    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setStats(data);
          setDataError(null);
          hideLoading();
          return;
        }
        setStats(null);
        setDataError(data?.error || 'Unable to load dashboard metrics from the current data source.');
        hideLoading();
      })
      .catch(() => {
        setStats(null);
        setDataError('Unable to load dashboard metrics from the current data source.');
        hideLoading();
      });
  }, [showLoading, hideLoading]);



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
      .finally(() => {
        setLoading(false);
        hideLoading();
      });
  }, [sortMode, hideLoading]);

  const shouldFetchPromoters = activeTab === 'promoters' || activeTab === 'genome-browser';
  useEffect(() => {
    if (shouldFetchPromoters) fetchPromoters(currentFilters, pageIndex, pageSize);
  }, [shouldFetchPromoters, currentFilters, fetchPromoters, pageIndex, pageSize]);

 const handleSearch = useCallback((filters: FiltersType) => {
    showLoading(0, [
      'Querying 393 Fecal Metagenomic Samples...',
      'Parsing Phenotypic Metadata...',
      'Computing Feature Overlaps...',
      'Aggregating Cohort Statistics...',
    ]);
    setPageIndex(0);
    setCurrentFilters(filters);
  }, [showLoading]);

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

  // Fetch total registered users for admin dashboard
  useEffect(() => {
    if (!isCreatorAdmin) return;
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => { if (d?.total_users) setTotalUsers(d.total_users); })
      .catch(() => {});
  }, [isCreatorAdmin]);
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
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="bg-white/70 backdrop-blur-xl saturate-150 border-b border-white/20 shadow-sm sticky top-0 z-40 dark:bg-[#16203A]/80 dark:border-[#334155]/90">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Logo />
          <nav className="flex flex-wrap items-center gap-1">
            {(['overview', 'promoters', 'genome-browser', 'downloads'] as const).map((tab) => (
              <button type="button" key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200/60 dark:text-[var(--color-text-secondary)] dark:hover:bg-[#334155]/60'
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
            {isCreatorAdmin && (
              <button type="button" onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200/60 dark:text-[var(--color-text-secondary)] dark:hover:bg-[#334155]/60'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                User Stats
              </button>
            )}
            {isCreatorAdmin && (
              <button type="button" onClick={() => setActiveTab('badges')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'badges'
                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200/60 dark:text-[var(--color-text-secondary)] dark:hover:bg-[#334155]/60'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Badges
              </button>
            )}
            <Link href="/discussions" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200/60 dark:text-[var(--color-text-secondary)] dark:hover:bg-[#334155]/60 transition-colors">Discussions</Link>
            <div className="w-px h-5 bg-gray-200 dark:bg-[var(--color-border)] mx-1" />
            {!mounted ? (
              <div className="w-[120px] h-8" />
            ) : creatorSession ? (
              <UserMenuPanel session={creatorSession} githubUser={creatorLogin} isAdmin={isCreatorAdmin} onSignOut={() => void handleCreatorSignOut()} avatarUrl={creatorSession?.user?.user_metadata?.avatar_url as string | undefined} />
            ) : (
              <button type="button" onClick={() => setAuthModalOpen(true)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-dark)]"
              >
                Sign in
              </button>

            )}
            <NotificationBell session={creatorSession} />
            <ThemeToggle />
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

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
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
            <StatsChart stats={stats} loading={!stats && !dataError} />
            {isCreatorAdmin && totalUsers !== null && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-slate-100 p-3">
                    <svg className="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Registered Users</p>
                    <p className="text-2xl font-bold text-slate-800">{totalUsers.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FlipCard
                front={
                  <>
                   <svg className="mb-3 h-10 w-10 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="mt-6 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
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
              }} onSummaryModeChange={setSummaryMode} onPageChange={handlePageChange} onRowClick={handleRowClick} onDownloadRecord={handleRecordDownload} onSendSelectedToDownloads={handleSendSelectedToDownloads} />

          </>
        )}
                {activeTab === 'genome-browser' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div id="galibierhub-genome-browser" />
            <div className="bg-slate-800 px-4 py-2 text-sm font-medium text-white">
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
          <>
          <SiteFeedback isAdminHint={isCreatorAdmin} accessToken={creatorAccessToken} creatorLogin={creatorLogin} refreshSignal={feedbackRefreshSignal} onFeedbackSubmitted={() => setFeedbackRefreshSignal((current) => current + 1)} />
          </>
        )}
        {activeTab === 'downloads' && (
          <>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Data Downloads</h2>
              <div className="relative" ref={tutorialMenuRef}>
                <button type="button" onClick={() => setTutorialMenuOpen(open => !open)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  Tutorials
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                </button>
                {tutorialMenuOpen && (
                  <div className="absolute right-0 mt-2 z-30 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <Link href="/docs/download-cli" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <svg className="h-5 w-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      <div><div className="text-sm font-medium text-gray-900">Download &amp; CLI Usage Guide</div><div className="text-xs text-gray-500">Download to Browser, CLI, and Cluster Batch Download</div></div>
                    </Link>
                    <Link href="/discussions?category=issue" className="flex items-center gap-3 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <svg className="h-5 w-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                      <div><div className="text-sm font-medium text-gray-900">Ask in Discussions</div><div className="text-xs text-gray-500">Post questions about the data downloads</div></div>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DownloadCatalogPanel
            isAdmin={isCreatorAdmin}
            accessToken={creatorAccessToken}
            pendingRecordSampleId={pendingRecordSampleId}
            onPendingRecordSampleHandled={() => setPendingRecordSampleId(null)}
          />
          </>
        )}
        {activeTab === 'admin' && isCreatorAdmin && (
          <AdminUserStats />
        )}
        {activeTab === 'badges' && isCreatorAdmin && (
          <AdminBadgeStats accessToken={creatorAccessToken} />
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
       />
      )}
      <SiteUptime startAt={SiteConfig.uptime.startAt} onNavigateTab={(tab) => setActiveTab(tab as ActiveTab)} />
          <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} onSignInError={(msg) => setCreatorSignInError(msg)} />
    </div>
  );
}





