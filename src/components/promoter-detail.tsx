'use client';

import type { Promoter } from '@/types/genome';

interface PromoterDetailProps {
  promoter: Promoter | null;
  onClose: () => void;
}

export default function PromoterDetail({ promoter, onClose }: PromoterDetailProps) {
  if (!promoter) return null;

  const strandColor = promoter.strand === '+' ? 'text-blue-600' : 'text-red-600';

  const handleCopyBed = () => {
    const bed = `${promoter.chrom}\t${promoter.start}\t${promoter.end}\t${promoter.gene_symbol || 'NA'}\t${promoter.score}\t${promoter.strand}`;
    navigator.clipboard.writeText(bed);
  };

  const handleCopyFasta = () => {
    if (promoter.sequence) {
      const header = `>${promoter.gene_symbol || 'promoter'}_${promoter.chrom}:${promoter.start}-${promoter.end}:${promoter.strand}`;
      navigator.clipboard.writeText(`${header}\n${promoter.sequence}`);
    }
  };

  const handleViewInBrowser = () => {
    const locus = `${promoter.chrom}:${Math.max(0, promoter.start - 2000).toLocaleString()}-${(promoter.end + 2000).toLocaleString()}`;
    window.location.hash = `locus=${encodeURIComponent(locus)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Promoter Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Gene and coordinate info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Gene Symbol</div>
                <div className="text-lg font-semibold text-gray-900">
                  {promoter.gene_symbol || '\u2014'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Chromosome</div>
                <div className="font-mono text-gray-900">{promoter.chrom}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Strand</div>
                <div className={`font-mono font-bold ${strandColor}`}>
                  {promoter.strand} strand
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Position</div>
                <div className="font-mono text-gray-900">
                  {promoter.start.toLocaleString()} \u2014 {promoter.end.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Length</div>
                <div className="font-mono text-gray-900">
                  {(promoter.end - promoter.start).toLocaleString()} bp
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Sample</div>
                <div className="text-sm text-gray-700">{promoter.sample_id}</div>
              </div>
            </div>
          </div>

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">Prediction Score</span>
              <span className="font-bold text-lg">
                {promoter.score.toFixed(4)}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${promoter.score * 100}%`,
                  backgroundColor:
                    promoter.score > 0.85 ? '#22c55e' :
                    promoter.score > 0.7 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0.0</span>
              <span>Low</span>
              <span>0.5</span>
              <span>High</span>
              <span>1.0</span>
            </div>
          </div>

          {/* Sequence display */}
          {promoter.sequence && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Promoter Sequence
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
                        className={`inline-block w-3.5 h-5 flex items-center justify-center rounded-sm ${colors[base.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {base.toUpperCase()}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleViewInBrowser}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              View in Genome Browser
            </button>
            <button
              onClick={handleCopyBed}
              className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
            >
              Copy as BED
            </button>
            {promoter.sequence && (
              <button
                onClick={handleCopyFasta}
                className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
              >
                Copy FASTA
              </button>
            )}
          </div>

          {/* Permalink */}
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="truncate">
              /promoter/{promoter.chrom}_{promoter.start}_{promoter.end}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
