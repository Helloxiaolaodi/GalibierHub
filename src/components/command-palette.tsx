"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type HomeTab = "overview" | "promoters" | "genome-browser" | "downloads";

interface SearchQuery {
  sampleId?: string;
  geneSymbol?: string;
  chrom?: string;
  start?: string;
  minScore?: string;
}

interface PaletteAction {
  id: string;
  label: string;
  description: string;
  keywords: string;
  group: "Navigate" | "Search records";
  href?: string;
  tab?: HomeTab;
  query?: SearchQuery;
}

const ACTIONS: PaletteAction[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Dashboard, charts, and module cards",
    keywords: "overview home dashboard stats charts",
    group: "Navigate",
    href: "/",
    tab: "overview",
  },
  {
    id: "promoters",
    label: "Records",
    description: "Filter promoter records and sample metadata",
    keywords: "records promoters table samples filter search",
    group: "Navigate",
    href: "/",
    tab: "promoters",
  },
  {
    id: "genome-browser",
    label: "Genome Browser",
    description: "Open JBrowse 2 at a locus or selected record",
    keywords: "genome browser jbrowse locus sequence",
    group: "Navigate",
    href: "/",
    tab: "genome-browser",
  },
  {
    id: "downloads",
    label: "Downloads",
    description: "Browse files and generate download commands",
    keywords: "downloads files fasta vcf hf cli slurm",
    group: "Navigate",
    href: "/",
    tab: "downloads",
  },
  {
    id: "discussions",
    label: "Discussions",
    description: "Community threads, questions, and releases",
    keywords: "discussions community forum threads issues",
    group: "Navigate",
    href: "/discussions",
  },
  {
    id: "tags",
    label: "Tags Cloud",
    description: "Browse community topics by tag frequency",
    keywords: "tags cloud community topics categories",
    group: "Navigate",
    href: "/tags",
  },
  {
    id: "cli-docs",
    label: "Download & CLI Usage Guide",
    description: "Step-by-step browser, CLI, and HPC workflows",
    keywords: "docs guide cli download hpc slurm tutorial",
    group: "Navigate",
    href: "/docs/download-cli",
  },
  {
    id: "sample-example",
    label: "Sample CNhs13205",
    description: "Filter Records by sample ID",
    keywords: "CNhs13205 sample id",
    group: "Search records",
    href: "/",
    tab: "promoters",
    query: { sampleId: "CNhs13205" },
  },
  {
    id: "gene-example",
    label: "Feature VIM",
    description: "Filter Records by gene symbol",
    keywords: "VIM vimentin gene symbol feature",
    group: "Search records",
    href: "/",
    tab: "promoters",
    query: { geneSymbol: "VIM" },
  },
  {
    id: "locus-example",
    label: "chr11:65266507",
    description: "Filter Records by chromosome and start position",
    keywords: "chr11 65266507 locus coordinate chromosome",
    group: "Search records",
    href: "/",
    tab: "promoters",
    query: { chrom: "chr11", start: "65266507" },
  },
  {
    id: "score-example",
    label: "Score > 0.95",
    description: "Filter Records by minimum score",
    keywords: "score 0.95 threshold quality",
    group: "Search records",
    href: "/",
    tab: "promoters",
    query: { minScore: "0.95" },
  },
];

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = window.setTimeout(() => inputRef.current?.focus(), 40);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(frame);
      document.body.style.overflow = "";
    };
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return ACTIONS;
    return ACTIONS.filter(
      (action) =>
        action.label.toLowerCase().includes(normalized) ||
        action.keywords.toLowerCase().includes(normalized),
    );
  }, [normalized]);

  const runAction = useCallback(
    (action: PaletteAction) => {
      setOpen(false);
      const payload = JSON.stringify({
        tab: action.tab,
        query: action.query,
      });
      sessionStorage.setItem("galibierhub-command-action", payload);
      window.dispatchEvent(new Event("galibierhub-command-action"));
      if (action.href && action.href !== pathname) {
        router.push(action.href);
      }
    },
    [pathname, router],
  );

  const dynamicAction: PaletteAction | null = normalized
    ? {
        id: "dynamic-record",
        label: `Search records for "${query.trim()}"`,
        description: "Match sample ID or gene symbol",
        keywords: normalized,
        group: "Search records",
        href: "/",
        tab: "promoters",
        query: {
          sampleId: query.trim(),
          geneSymbol: query.trim(),
        },
      }
    : null;

  const searchActions = dynamicAction ? [dynamicAction, ...filtered] : filtered;
  const navigateActions = searchActions.filter((action) => action.group === "Navigate");
  const recordActions = searchActions.filter((action) => action.group === "Search records");
  const hasResults = navigateActions.length > 0 || recordActions.length > 0;

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && (recordActions[0] || navigateActions[0])) {
      runAction(recordActions[0] || navigateActions[0]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-sm sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl shadow-slate-950/25">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, samples, genes, or loci..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
          {!hasResults && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">No matches for &quot;{query}&quot;</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try a sample ID, gene symbol, locus, or page name.</p>
            </div>
          )}

          {recordActions.length > 0 && (
            <div className="mb-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Search records
              </div>
              {recordActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAction(action)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text)]">{action.label}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{action.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {navigateActions.length > 0 && (
            <div>
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Navigate
              </div>
              {navigateActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAction(action)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M7 7l5 5-5 5" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text)]">{action.label}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{action.description}</span>
                  </span>
                  <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                    Enter
                  </kbd>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2.5 text-[10px] text-[var(--color-text-muted)]">
          <span>
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono">Ctrl</kbd>
            <span className="mx-1">+</span>
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono">K</kbd>
            <span className="ml-2">to toggle</span>
          </span>
          <span>GalibierHub quick access</span>
        </div>
      </div>
    </div>
  );
}
