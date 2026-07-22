'use client';

import { useEffect, useState } from 'react';
import type { Promoter, SampleMetadata } from '@/types/genome';

interface PromoterDetailProps {
  promoter: Promoter | null;
  onClose: () => void;
}

// WHO adult BMI reference bands
// Underweight <18.5 | Normal 18.5–24.9 | Overweight 25.0–29.9 | Obese >=30.0
function bmiClass(bmi: number | null): { label: string; color: string } | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: `Underweight · ${bmi.toFixed(1)}`, color: 'text-sky-700 bg-sky-50' };
  if (bmi < 25)   return { label: `Normal · ${bmi.toFixed(1)}`,       color: 'text-emerald-700 bg-emerald-50' };
  if (bmi < 30)   return { label: `Overweight · ${bmi.toFixed(1)}`,   color: 'text-amber-700 bg-amber-50' };
  return           { label: `Obese · ${bmi.toFixed(1)}`,              color: 'text-rose-700 bg-rose-50' };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-lg bg-white overflow-hidden">
      <header className="bg-gray-50 border-b px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
        {title}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm text-gray-900 mt-0.5">{children}</div>
    </div>
  );
}

export default function PromoterDetail({ promoter, onClose }: PromoterDetailProps) {
  const [sample, setSample] = useState<SampleMetadata | null>(null);

  useEffect(() => {
    if (!promoter) return;
    setSample(null);
    fetch(`/api/samples/${encodeURIComponent(promoter.sample_id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSample(data && !data.error ? data : null))
      .catch(() => setSample(null));
  }, [promoter]);

  if (!promoter) return null;

  const strandColor = promoter.strand === '+' ? 'text-blue-600' : 'text-red-600';
  const length = promoter.end_pos - promoter.start;
  const bmi = sample ? bmiClass(sample.bmi) : null;

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
    const locus = `${promoter.chrom}:${Math.max(0, promoter.start - 2000).toLocaleString()}-${(promoter.end_pos + 2000).toLocaleString()}`;
    window.location.hash = `locus=${encodeURIComponent(locus)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Promoter · {promoter.gene_symbol || 'unnamed'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {promoter.chrom}:{promoter.start.toLocaleString()}-{promoter.end_pos.toLocaleString()} ({promoter.strand})
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Card 1 — Genomic coordinates */}
          <Card title="Genomic coordinates">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KV label="Chromosome">{promoter.chrom}</KV>
              <KV label="Start">{promoter.start.toLocaleString()}</KV>
              <KV label="End">{promoter.end_pos.toLocaleString()}</KV>
              <KV label="Length">{length.toLocaleString()} bp</KV>
              <KV label="Strand">
                <span className={`font-bold ${strandColor}`}>{promoter.strand}</span>
              </KV>
              <KV label="Gene">{promoter.gene_symbol || '—'}</KV>
              <div className="col-span-2">
                <div className="text-[11px] text-gray-500 uppercase tracking-wider">Prediction score</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${promoter.score * 100}%`,
                        backgroundColor:
                          promoter.score > 0.85 ? '#22c55e' :
                          promoter.score > 0.7  ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm tabular-nums">{promoter.score.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 — Sequence & motif */}
          <Card title="Sequence & motif">
            {promoter.sequence ? (
              <div>
                <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">
                  Promoter sequence ({promoter.sequence.length} nt)
                </div>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  <div className="flex flex-wrap gap-0">
                    {promoter.sequence.split('').map((base, i) => {
                      const colors: Record<string, string> = {
                        A: 'bg-green-100 text-green-700',
                        T: 'bg-red-100 text-red-700',
                        G: 'bg-yellow-100 text-yellow-700',
                        C: 'bg-blue-100 text-blue-700',
                      };
                      return (
                        <span
                          key={i}
                          className={`inline-flex w-3.5 h-5 items-center justify-center rounded-sm ${colors[base.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {base.toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                Sequence not stored for this promoter. Fetch on demand from the FASTA in R2.
              </div>
            )}
          </Card>

          {/* Card 3 — Sample phenotype */}
          <Card title="Sample phenotype">
            {sample === null ? (
              <div className="text-sm text-gray-400">Loading sample metadata…</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <KV label="Sample ID">{sample.sample_id}</KV>
                <KV label="Cohort">
                  {sample.cohort ? (
                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold">
                      {sample.cohort}
                    </span>
                  ) : (
                    '—'
                  )}
                </KV>
                <KV label="Species">{sample.species || '—'}</KV>
                <KV label="Tissue">{sample.tissue || '—'}</KV>
                <KV label="Sequencing">{sample.sequencing_platform || '—'}</KV>
                <KV label="Assembly">{sample.assembly_version || '—'}</KV>
                <KV label="Coverage">
                  {sample.coverage != null ? `${sample.coverage.toFixed(1)}×` : '—'}
                </KV>
                <KV label="Age / Sex">
                  {sample.age != null ? `${sample.age} y` : '—'}
                  {sample.sex ? ` · ${sample.sex}` : ''}
                </KV>
                <div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wider">BMI class</div>
                  {bmi ? (
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${bmi.color}`}>
                      {bmi.label}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={handleViewInBrowser}
              className="flex-1 min-w-[10rem] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View in Genome Browser
            </button>
            <button
              onClick={handleCopyBed}
              className="flex-1 min-w-[10rem] px-4 py-2 border border-gray-300 hover:bg-gray-50 bg-white rounded-lg text-sm font-medium transition-colors"
            >
              Copy as BED
            </button>
            {promoter.sequence && (
              <button
                onClick={handleCopyFasta}
                className="flex-1 min-w-[10rem] px-4 py-2 border border-gray-300 hover:bg-gray-50 bg-white rounded-lg text-sm font-medium transition-colors"
              >
                Copy FASTA
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
