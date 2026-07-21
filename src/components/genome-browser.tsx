'use client';

import { useState, useCallback } from 'react';

interface GenomeBrowserProps {
  assemblyName?: string;
  fastaUrl?: string;
  faiUrl?: string;
  tracks?: {
    name: string;
    type: string;
    url: string;
    format: string;
  }[];
  locus?: string;
  onLocusChange?: (locus: string) => void;
}

export default function GenomeBrowser({
  assemblyName = 'Reference Genome',
  fastaUrl,
  faiUrl,
  tracks = [],
  locus = 'chr1:1-1000000',
  onLocusChange,
}: GenomeBrowserProps) {
  const [currentLocus, setCurrentLocus] = useState(locus);
  const [inputLocus, setInputLocus] = useState(locus);

  const handleNavigate = useCallback(() => {
    setCurrentLocus(inputLocus);
    onLocusChange?.(inputLocus);
  }, [inputLocus, onLocusChange]);

  const parseLocusRange = (loc: string) => {
    const parts = loc.split(':');
    if (parts.length < 2) return null;
    const chrom = parts[0];
    const range = parts[1].split('-');
    const start = parseInt(range[0].replace(/,/g, '')) || 0;
    const end = range.length > 1 ? parseInt(range[1].replace(/,/g, '')) : start + 1000000;
    return { chrom, start, end };
  };

  const rangeInfo = parseLocusRange(currentLocus);
  const tickMarks = rangeInfo
    ? Array.from({ length: 9 }, (_, i) => {
        const step = Math.max(1, Math.floor((rangeInfo.end - rangeInfo.start) / 8));
        return (rangeInfo.start + step * i).toLocaleString();
      })
    : [];

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Browser header with navigation */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-sm">{assemblyName}</span>
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={inputLocus}
            onChange={(e) => setInputLocus(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
            placeholder="e.g. chr1:1000-5000 or BRCA1"
            className="px-2 py-1 rounded text-sm text-gray-900 flex-1 min-w-[200px]"
          />
          <button
            onClick={handleNavigate}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium"
          >
            Go
          </button>
        </div>
        {fastaUrl && (
          <span className="text-xs text-gray-400 truncate max-w-[200px]" title={fastaUrl}>
            FASTA: {fastaUrl.split('/').pop()}
          </span>
        )}
      </div>

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="bg-gray-50 border-b px-4 py-1.5 flex flex-wrap gap-2">
          {tracks.map((track, i) => {
            const bgColors = ['#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#fce7f3'];
            const textColors = ['#1e40af', '#166534', '#92400e', '#6b21a8', '#9d174d'];
            const dotColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: bgColors[i % 5],
                  color: textColors[i % 5],
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColors[i % 5] }} />
                {track.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Genome visualization area */}
      <div className="relative bg-gradient-to-b from-blue-50 to-white p-4 min-h-[320px]">
        {/* Coordinate ruler */}
        <div className="flex items-center text-xs text-gray-500 mb-2">
          <span className="w-20">{rangeInfo?.chrom}</span>
          <div className="flex-1 flex justify-between px-2">
            {tickMarks.map((tick, i) => (
              <span key={i} className="tabular-nums">{tick}</span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {/* Reference sequence track */}
          <div className="border rounded bg-white">
            <div className="bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 border-b">
              Reference Sequence
            </div>
            <div className="h-16 px-3 py-2 font-mono text-xs text-gray-700 flex items-center gap-0.5 overflow-hidden">
              {Array.from({ length: 60 }, (_, i) => {
                const bases = ['A', 'T', 'G', 'C'];
                const base = bases[Math.abs(Math.sin(i * 7 + 3)) * 4 | 0];
                const colors: Record<string, string> = {
                  A: 'text-green-600', T: 'text-red-600',
                  G: 'text-amber-600', C: 'text-blue-600',
                };
                return (
                  <span key={i} className={`${colors[base]} font-bold`}>{base}</span>
                );
              })}
            </div>
          </div>

          {/* Gene annotation track */}
          <div className="border rounded bg-white">
            <div className="bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 border-b">
              Gene Annotations
            </div>
            <div className="h-12 px-3 py-2 relative">
              {[
                { left: '5%', width: '18%', label: 'GeneA', color: '#3b82f6' },
                { left: '30%', width: '12%', label: 'GeneB', color: '#22c55e' },
                { left: '52%', width: '22%', label: 'GeneC', color: '#f59e0b' },
                { left: '80%', width: '15%', label: 'GeneD', color: '#a855f7' },
              ].map((gene, i) => (
                <div
                  key={i}
                  className="absolute h-7 rounded-sm flex items-center px-1"
                  style={{ left: gene.left, width: gene.width, backgroundColor: gene.color }}
                >
                  <span className="text-white text-[9px] font-bold truncate">{gene.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Promoter prediction track */}
          <div className="border rounded bg-white">
            <div className="bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border-b">
              Predicted Promoters
            </div>
            <div className="h-12 px-3 py-2 relative">
              {[
                { left: '8%', width: '10%', score: 0.95 },
                { left: '25%', width: '7%', score: 0.82 },
                { left: '45%', width: '12%', score: 0.91 },
                { left: '65%', width: '8%', score: 0.73 },
                { left: '82%', width: '11%', score: 0.88 },
              ].map((prom, i) => (
                <div
                  key={i}
                  className="absolute h-8 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    left: prom.left,
                    width: prom.width,
                    backgroundColor: prom.score > 0.85 ? '#22c55e' : prom.score > 0.7 ? '#eab308' : '#ef4444',
                  }}
                  title={`Score: ${prom.score}`}
                >
                  <span className="text-white text-[8px] font-bold">{prom.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional data tracks */}
          {tracks.map((track, i) => {
            const barColors = ['#93c5fd', '#86efac', '#fcd34d', '#d8b4fe', '#f9a8d4'];
            return (
              <div key={i} className="border rounded bg-white">
                <div className="bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 border-b">
                  {track.name}
                </div>
                <div className="h-10 px-3 py-2 flex items-end gap-px">
                  {Array.from({ length: 80 }, (_, j) => {
                    const h = Math.abs(Math.sin(j * 0.3 + i * 2)) * 28 + 4;
                    return (
                      <div
                        key={j}
                        className="flex-1 rounded-t-sm"
                        style={{ height: `${h}px`, backgroundColor: barColors[i % 5] }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-100 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>Showing: {currentLocus}</span>
        <div className="flex items-center gap-4">
          <span>Assembly: {assemblyName}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Connected
          </span>
        </div>
      </div>
    </div>
  );
}
