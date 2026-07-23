'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Promoter } from '@/types/genome';

const DEMO_PROMOTERS: Record<string, Promoter> = {
  'NC_045512.2_266_21555': {
    id: '1', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 266, end_pos: 21555,
    score: 0.98, strand: '+', gene_symbol: 'ORF1ab',
    sequence: null,
    created_at: '2025-01-15',
  },
  'NC_045512.2_21563_25384': {
    id: '2', sample_id: 'SCOV2-REF-001', chrom: 'NC_045512.2', start: 21563, end_pos: 25384,
    score: 0.97, strand: '+', gene_symbol: 'S',
    sequence: null,
    created_at: '2025-01-16',
  },
};

export default function PromoterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      setPromoter(DEMO_PROMOTERS[p.id] || null);
      setLoading(false);
    });
  }, [params]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>;

  if (!promoter) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Promoter Not Found</h1>
        <p className="text-gray-500">ID: {id}</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-blue-600 hover:underline">Back to Database</Link>
          <div className="w-px h-5 bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">Promoter Detail</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
          <span className="font-mono">{promoter.chrom}:{promoter.start.toLocaleString()}-{promoter.end_pos.toLocaleString()}</span>
          <span>|</span>
          <span>{promoter.gene_symbol}</span>
          <span>|</span>
          <span>{promoter.strand} strand</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Gene</div><div className="text-xl font-bold">{promoter.gene_symbol || 'N/A'}</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Score</div><div className="text-xl font-bold" style={{ color: promoter.score > 0.85 ? '#22c55e' : promoter.score > 0.7 ? '#eab308' : '#ef4444' }}>{promoter.score.toFixed(4)}</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Length</div><div className="text-xl font-bold">{(promoter.end_pos - promoter.start).toLocaleString()} bp</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Sample</div><div className="text-sm font-bold">{promoter.sample_id}</div></div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Prediction Score</h3>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: (promoter.score * 100) + '%', backgroundColor: promoter.score > 0.85 ? '#22c55e' : promoter.score > 0.7 ? '#eab308' : '#ef4444' }} />
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">View in Genome Browser</Link>
          <button type="button" onClick={() => navigator.clipboard.writeText([promoter.chrom, promoter.start, promoter.end_pos, promoter.gene_symbol || 'NA', promoter.score, promoter.strand].join('\t'))} className="px-4 py-2 border rounded-lg text-sm">Copy as BED</button>
        </div>
      </main>
    </div>
  );
}
