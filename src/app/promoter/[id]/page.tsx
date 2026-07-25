'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Promoter } from '@/types/genome';
import { getDirectDownloadUrl } from '@/lib/storage';
import type { SampleMetadata } from '@/types/genome';
import DownloadActions from '@/components/download-actions';
import { useDownloadVisibility } from '@/hooks/use-download-visibility';

export default function PromoterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [sample, setSample] = useState<SampleMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const vcfDownloadUrl = getDirectDownloadUrl(sample?.vcf_download_url);
  const fastaDownloadUrl = getDirectDownloadUrl(sample?.fasta_download_url);
  const gbDownloadUrl = getDirectDownloadUrl(sample?.gb_download_url);
  const bedDownloadUrl = getDirectDownloadUrl(sample?.bed_download_url);
  const gff3DownloadUrl = getDirectDownloadUrl(sample?.gff3_download_url);
  const { isVisible: isDownloadVisible, loaded: downloadsLoaded } = useDownloadVisibility(
    [vcfDownloadUrl, fastaDownloadUrl, gbDownloadUrl, bedDownloadUrl, gff3DownloadUrl],
    false,
  );
  const visibleVcfDownloadUrl = isDownloadVisible(vcfDownloadUrl) ? vcfDownloadUrl : '';
  const visibleFastaDownloadUrl = isDownloadVisible(fastaDownloadUrl) ? fastaDownloadUrl : '';
  const visibleGbDownloadUrl = isDownloadVisible(gbDownloadUrl) ? gbDownloadUrl : '';
  const visibleBedDownloadUrl = isDownloadVisible(bedDownloadUrl) ? bedDownloadUrl : '';
  const visibleGff3DownloadUrl = isDownloadVisible(gff3DownloadUrl) ? gff3DownloadUrl : '';

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      fetch(`/api/promoters?limit=1&id=${encodeURIComponent(p.id)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const match = data?.data?.find((item: Promoter) => item.id === p.id) ?? null;
          setPromoter(match);
          if (match?.sample_id) {
            fetch(`/api/samples/${encodeURIComponent(match.sample_id)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((sampleData) => setSample(sampleData && !sampleData.error ? sampleData : null))
              .catch(() => setSample(null));
          } else {
            setSample(null);
          }
        })
        .catch(() => setPromoter(null))
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Loading...</div></div>;

  if (!promoter) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Record Not Found</h1>
        <p className="text-gray-500">ID: {id}</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-blue-600 hover:underline">Back to Portal</Link>
          <div className="w-px h-5 bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">Record Detail</h1>
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
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Feature</div><div className="text-xl font-bold">{promoter.gene_symbol || 'N/A'}</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Score</div><div className="text-xl font-bold" style={{ color: promoter.score > 0.85 ? '#22c55e' : promoter.score > 0.7 ? '#eab308' : '#ef4444' }}>{promoter.score.toFixed(4)}</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Length</div><div className="text-xl font-bold">{(promoter.end_pos - promoter.start).toLocaleString()} bp</div></div>
          <div className="bg-white border rounded-lg p-4"><div className="text-xs text-gray-500 uppercase">Item</div><div className="text-sm font-bold">{promoter.sample_id}</div></div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Record Score</h3>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: (promoter.score * 100) + '%', backgroundColor: promoter.score > 0.85 ? '#22c55e' : promoter.score > 0.7 ? '#eab308' : '#ef4444' }} />
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Open in Browser</Link>
          <button type="button" onClick={() => navigator.clipboard.writeText([promoter.chrom, promoter.start, promoter.end_pos, promoter.gene_symbol || 'NA', promoter.score, promoter.strand].join('\t'))} className="px-4 py-2 border rounded-lg text-sm">Copy as BED</button>
        </div>
        {(downloadsLoaded && (visibleVcfDownloadUrl || visibleFastaDownloadUrl || visibleGbDownloadUrl || visibleBedDownloadUrl || visibleGff3DownloadUrl)) && (
          <section className="bg-white border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">File downloads</h3>
            {visibleVcfDownloadUrl && (
              <DownloadActions
                url={visibleVcfDownloadUrl}
                label="Download VCF"
                description="Sample-level file download from the configured storage host."
                showCli={sample?.vcf_download_mode === 'cli'}
              />
            )}
            {visibleFastaDownloadUrl && (
              <DownloadActions
                url={visibleFastaDownloadUrl}
                label="Download FASTA"
                description="Sample-level file download from the configured storage host."
                showCli={sample?.fasta_download_mode === 'cli'}
              />
            )}
            {visibleGbDownloadUrl && (
              <DownloadActions
                url={visibleGbDownloadUrl}
                label="Download Package"
                description="Sample-level file download from the configured storage host."
                showCli={true}
              />
            )}
            {visibleBedDownloadUrl && (
              <DownloadActions
                url={visibleBedDownloadUrl}
                label="Download BED"
                description="Sample-level file download from the configured storage host."
                showCli={true}
              />
            )}
            {visibleGff3DownloadUrl && (
              <DownloadActions
                url={visibleGff3DownloadUrl}
                label="Download GFF3"
                description="Sample-level file download from the configured storage host."
                showCli={true}
              />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
