'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { SiteConfig } from '@/site-config';
import { getDirectDownloadUrl } from '@/lib/storage';
import type { Promoter, SampleMetadata } from '@/types/genome';
import DownloadActions from './download-actions';

interface PromoterDetailProps {
  promoter: Promoter | null;
  onViewInBrowser?: (promoter: Promoter) => void;
  onClose: () => void;
}

type SampleState = SampleMetadata | null | undefined;

const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;
const MIN_PANEL_HEIGHT = 420;
const MAX_PANEL_HEIGHT = 900;
const PANEL_MARGIN = 16;
const DESKTOP_HEADER_OFFSET = 88;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, [role="button"]'));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function bmiClass(bmi: number | null): { label: string; color: string } | null {
  if (bmi == null) return null;

  const { underweight, normal, overweight } = SiteConfig.bmiBands;

  if (bmi < underweight[1]) {
    return { label: `Underweight | ${bmi.toFixed(1)}`, color: 'text-sky-700 bg-sky-50' };
  }
  if (bmi < normal[1]) {
    return { label: `Normal | ${bmi.toFixed(1)}`, color: 'text-emerald-700 bg-emerald-50' };
  }
  if (bmi < overweight[1]) {
    return { label: `Overweight | ${bmi.toFixed(1)}`, color: 'text-amber-700 bg-amber-50' };
  }

  return { label: `Obese | ${bmi.toFixed(1)}`, color: 'text-rose-700 bg-rose-50' };
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-white">
      <header className="border-b bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        {title}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-gray-900">{children}</div>
    </div>
  );
}

function displayValue(value: string | number | null | undefined): string {
  if (value == null || value === '') return 'N/A';
  return String(value);
}

export default function PromoterDetail({ promoter, onViewInBrowser, onClose }: PromoterDetailProps) {
  const initializedPromoterIdRef = useRef<string | null>(null);
  const [sample, setSample] = useState<SampleState>(undefined);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState({ x: 0, y: DESKTOP_HEADER_OFFSET });
  const [size, setSize] = useState({ width: 448, height: 720 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(false);
  const [resizeOrigin, setResizeOrigin] = useState({
    pointerX: 0,
    pointerY: 0,
    width: 448,
    height: 720,
  });

  useEffect(() => {
    if (!promoter) return;

    setSample(undefined);
    fetch(`/api/samples/${encodeURIComponent(promoter.sample_id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSample(data && !data.error ? data : null))
      .catch(() => setSample(null));
  }, [promoter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewport = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setViewport({ width: viewportWidth, height: viewportHeight });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!promoter) {
      initializedPromoterIdRef.current = null;
      return;
    }
    if (viewport.width === 0 || viewport.height === 0) return;
    if (initializedPromoterIdRef.current === promoter.id) return;

    const initialWidth = clamp(Math.min(448, viewport.width - PANEL_MARGIN * 2), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
    const initialHeight = clamp(
      viewport.height - PANEL_MARGIN * 2,
      MIN_PANEL_HEIGHT,
      Math.min(MAX_PANEL_HEIGHT, viewport.height - PANEL_MARGIN * 2),
    );
    setSize({ width: initialWidth, height: initialHeight });
    setPosition({
      x: PANEL_MARGIN,
      y: viewport.width >= 1024 ? DESKTOP_HEADER_OFFSET : PANEL_MARGIN,
    });
    initializedPromoterIdRef.current = promoter.id;
  }, [promoter, viewport.height, viewport.width]);

  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;

    setPosition((current) => ({
      x: clamp(current.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.width - size.width - PANEL_MARGIN)),
      y: clamp(current.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.height - size.height - PANEL_MARGIN)),
    }));

    setSize((current) => {
      const nextWidth = clamp(
        current.width,
        MIN_PANEL_WIDTH,
        Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewport.width - PANEL_MARGIN * 2)),
      );
      const nextHeight = clamp(
        current.height,
        MIN_PANEL_HEIGHT,
        Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, viewport.height - PANEL_MARGIN * 2)),
      );
      return nextWidth === current.width && nextHeight === current.height
        ? current
        : { width: nextWidth, height: nextHeight };
    });
  }, [size.height, size.width, viewport.height, viewport.width]);

  const isDesktop = viewport.width >= 1024;
  const maxPanelHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, (viewport.height || MAX_PANEL_HEIGHT) - PANEL_MARGIN * 2));
  const panelWidthClass = size.width >= 560 ? 'sm:grid-cols-4' : 'sm:grid-cols-2';

  if (!promoter) return null;

  const strandColor = promoter.strand === '+' ? 'text-blue-600' : 'text-red-600';
  const length = promoter.end_pos - promoter.start;
  const bmi = sample && sample !== null ? bmiClass(sample.bmi) : null;
 const vcfDownloadUrl = sample && sample !== null ? getDirectDownloadUrl(sample.vcf_download_url) : '';
 const fastaDownloadUrl = sample && sample !== null ? getDirectDownloadUrl(sample.fasta_download_url) : '';
  const gbDownloadUrl = sample && sample !== null ? getDirectDownloadUrl(sample.gb_download_url) : '';
  const bedDownloadUrl = sample && sample !== null ? getDirectDownloadUrl(sample.bed_download_url) : '';
  const gff3DownloadUrl = sample && sample !== null ? getDirectDownloadUrl(sample.gff3_download_url) : '';
 const showVcfCli = sample?.vcf_download_mode === 'cli';
  const showFastaCli = sample?.fasta_download_mode === 'cli';

  const handleCopyBed = () => {
    const bed = `${promoter.chrom}\t${promoter.start}\t${promoter.end_pos}\t${promoter.gene_symbol || 'NA'}\t${promoter.score}\t${promoter.strand}`;
    navigator.clipboard.writeText(bed);
  };

  const handleCopyFasta = () => {
    if (!promoter.sequence) return;
    const header = `>${promoter.gene_symbol || 'promoter'}_${promoter.chrom}:${promoter.start}-${promoter.end_pos}:${promoter.strand}`;
    navigator.clipboard.writeText(`${header}\n${promoter.sequence}`);
  };

  const handleViewInBrowser = () => {
    onViewInBrowser?.(promoter);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDesktop || isInteractiveTarget(event.target)) return;
    setDragging(true);
    setDragOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !isDesktop) return;
    const nextX = clamp(event.clientX - dragOffset.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.width - size.width - PANEL_MARGIN));
    const nextY = clamp(event.clientY - dragOffset.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewport.height - size.height - PANEL_MARGIN));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDesktop) return;
    event.stopPropagation();
    setResizing(true);
    setResizeOrigin({
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: size.width,
      height: size.height,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizing || !isDesktop) return;
    const maxWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, viewport.width - position.x - PANEL_MARGIN));
    const maxHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, viewport.height - position.y - PANEL_MARGIN));
    const nextWidth = clamp(resizeOrigin.width + event.clientX - resizeOrigin.pointerX, MIN_PANEL_WIDTH, maxWidth);
    const nextHeight = clamp(resizeOrigin.height + event.clientY - resizeOrigin.pointerY, MIN_PANEL_HEIGHT, maxHeight);
    setSize({ width: nextWidth, height: nextHeight });
  };

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizing) return;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} role="presentation">
    <div
      className="fixed z-50 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isDesktop ? `${size.width}px` : 'calc(100vw - 2rem)',
        maxWidth: 'calc(100vw - 2rem)',
        height: isDesktop ? `${size.height}px` : 'auto',
        maxHeight: `min(${maxPanelHeight}px, calc(100vh - 2rem))`,
      }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[inherit] flex-col overflow-hidden">
        <div
          className={`sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 ${dragging ? 'cursor-grabbing' : 'cursor-default lg:cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-gray-900">Promoter | {promoter.gene_symbol || 'unnamed'}</h2>
            <p className="mt-0.5 font-mono text-xs text-gray-500">
              {promoter.chrom}:{promoter.start.toLocaleString()}-{promoter.end_pos.toLocaleString()} ({promoter.strand})
            </p>
            <p className="mt-1 hidden text-[11px] text-gray-400 lg:block">
              Drag this header to reposition the detail panel.
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onClose(); }}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 shrink-0"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* Card 1 - Genomic coordinates */}
          <Card title="Genomic coordinates">
            <div className={`grid grid-cols-2 gap-4 ${panelWidthClass}`}>
              <KV label="Chromosome">{promoter.chrom}</KV>
              <KV label="Start">{promoter.start.toLocaleString()}</KV>
              <KV label="End">{promoter.end_pos.toLocaleString()}</KV>
              <KV label="Length">{length.toLocaleString()} bp</KV>
              <KV label="Strand">
                <span className={`font-bold ${strandColor}`}>{promoter.strand}</span>
              </KV>
              <KV label="Gene">{displayValue(promoter.gene_symbol)}</KV>
              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wider text-gray-500">Prediction score</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${promoter.score * 100}%`,
                        backgroundColor:
                          promoter.score > 0.85 ? '#22c55e' : promoter.score > 0.7 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm tabular-nums">{promoter.score.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 - Sequence and motif */}
          <Card title="Sequence & motif">
            {promoter.sequence ? (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">
                  Promoter sequence ({promoter.sequence.length} nt)
                </div>
                <div className="overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs">
                  <div className="flex flex-wrap gap-0">
                    {promoter.sequence.split('').map((base, index) => {
                      const colors: Record<string, string> = {
                        A: 'bg-green-100 text-green-700',
                        T: 'bg-red-100 text-red-700',
                        G: 'bg-yellow-100 text-yellow-700',
                        C: 'bg-blue-100 text-blue-700',
                      };

                      return (
                        <span
                          key={index}
                          className={`inline-flex h-5 w-3.5 items-center justify-center rounded-sm ${colors[base.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {base.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm italic text-gray-500">
                Sequence not stored for this promoter. Retrieve it from the configured FASTA source when needed.
              </div>
            )}
          </Card>

          {/* Card 3 - Sample phenotype */}
          <Card title="Sample phenotype">
            {sample === undefined ? (
              <div className="text-sm text-gray-400">Loading sample metadata...</div>
            ) : sample === null ? (
              <div className="text-sm text-gray-500">No sample metadata is available for this promoter.</div>
            ) : (
              <div className={`grid grid-cols-2 gap-4 ${size.width >= 640 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <KV label="Sample ID">{sample.sample_id}</KV>
                <KV label="Cohort">
                  {sample.cohort ? (
                    <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {sample.cohort}
                    </span>
                  ) : (
                    'N/A'
                  )}
                </KV>
                <KV label="Species">{displayValue(sample.species)}</KV>
                <KV label="Tissue">{displayValue(sample.tissue)}</KV>
                <KV label="Sequencing">{displayValue(sample.sequencing_platform)}</KV>
                <KV label="Assembly">{displayValue(sample.assembly_version)}</KV>
                <KV label="Coverage">{sample.coverage != null ? `${sample.coverage.toFixed(1)}x` : 'N/A'}</KV>
                <KV label="Age / Sex">
                  {sample.age != null ? `${sample.age} y` : 'N/A'}
                  {sample.sex ? ` | ${sample.sex}` : ''}
                </KV>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">BMI class</div>
                  {bmi ? (
                    <span className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-semibold ${bmi.color}`}>
                      {bmi.label}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </div>
              </div>
            )}
          </Card>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleViewInBrowser}
              className="min-w-[10rem] flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              View in Genome Browser
            </button>
            <button
              type="button"
              onClick={handleCopyBed}
              className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            >
              Copy as BED
            </button>
            {promoter.sequence && (
              <button
                type="button"
                onClick={handleCopyFasta}
                className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                Copy FASTA
              </button>
            )}
          </div>

          {(vcfDownloadUrl || fastaDownloadUrl || gbDownloadUrl || bedDownloadUrl || gff3DownloadUrl) && (
            <Card title="Sample file downloads">
              <div className="space-y-4">
                {vcfDownloadUrl && (
                  <DownloadActions
                    url={vcfDownloadUrl}
                    label="Download VCF"
                    description="Direct sample-level variant file download from the public storage host."
                    showCli={showVcfCli}
                  />
                )}
               {fastaDownloadUrl && (
                 <DownloadActions
                   url={fastaDownloadUrl}
                   label="Download FASTA"
                   description="Direct sample-level FASTA download from the public storage host."
                   showCli={showFastaCli}
                 />
               )}
                {gbDownloadUrl && (
                  <DownloadActions
                    url={gbDownloadUrl}
                    label="Download GenBank"
                    description="Direct sample-level GenBank (.gb) download from the public storage host."
                    showCli={false}
                  />
                )}
                {bedDownloadUrl && (
                  <DownloadActions
                    url={bedDownloadUrl}
                    label="Download BED"
                    description="Direct sample-level BED annotation download from the public storage host."
                    showCli={false}
                  />
                )}
                {gff3DownloadUrl && (
                  <DownloadActions
                    url={gff3DownloadUrl}
                    label="Download GFF3"
                    description="Direct sample-level GFF3 annotation download from the public storage host."
                    showCli={false}
                  />
                )}
              </div>
            </Card>
          )}
        </div>

        <button
          type="button"
          aria-label="Resize promoter detail panel"
          className={`absolute bottom-1 right-1 hidden h-8 w-8 items-end justify-end rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-600 lg:flex ${resizing ? 'cursor-se-resize bg-white text-gray-600' : 'cursor-se-resize'}`}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l8-8M12 20l8-8M16 20l4-4" />
          </svg>
        </button>
      </div>
    </div>
    </div>
  );
}
