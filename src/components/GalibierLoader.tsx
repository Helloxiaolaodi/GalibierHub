'use client';

import React, { useEffect, useState, useRef } from 'react';

interface LoaderProps {
  progress?: number;
}

const SCIENTIFIC_LOGS = [
  'Establishing secure connection...',
  'Allocating HPC cluster nodes...',
  'Mounting metagenomic volumes...',
  'Loading FANTOM5 reference assemblies...',
  'Indexing variant call formats (VCF)...',
  'Computing locus coordinate overlaps...',
  'Aggregating cohort phenotypic metadata...',
  'Finalizing data chunks for client delivery...',
];

export default function GalibierLoader({ progress }: LoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [displayNumber, setDisplayNumber] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    if (progress !== undefined) {
      setInternalProgress(progress);
      return;
    }
    const timer = setInterval(() => {
      setInternalProgress((old) => {
        if (old >= 98) return old;
        const increment = old < 60 ? (Math.random() * 3 + 1) : (Math.random() * 0.5 + 0.1);
        return Math.min(old + increment, 98);
      });
    }, 300);
    return () => clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    const updateNumber = () => {
      setDisplayNumber((prev) => {
        const diff = internalProgress - prev;
        if (Math.abs(diff) < 0.01) return internalProgress;
        return prev + diff * 0.1;
      });
      requestRef.current = requestAnimationFrame(updateNumber);
    };
    requestRef.current = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [internalProgress]);

  useEffect(() => {
    const logTimer = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % SCIENTIFIC_LOGS.length);
    }, 1200);
    return () => clearInterval(logTimer);
  }, []);

  const mountainPath = 'M 5 95 Q 30 90 45 70 T 80 50 S 110 30 140 10 S 170 80 195 95';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B1120]/95 backdrop-blur-md transition-colors duration-500">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
           style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-[400px] flex flex-col items-center">
        <div className="relative w-full h-48">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0D9488" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#2DD4BF" stopOpacity="1" />
                <stop offset="100%" stopColor="#0D9488" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d={`${mountainPath} L 195 100 L 5 100 Z`} fill="url(#neonGradient)" opacity="0.05" />
            <path
              d={mountainPath}
              stroke="url(#neonGradient)"
              className="mountain-line"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div
            className="absolute top-0 left-0 w-8 h-8 -ml-4 -mt-4 transition-all duration-700 ease-out"
            style={{
              offsetPath: `path('${mountainPath}')`,
              offsetDistance: `${internalProgress}%`,
              offsetRotate: 'auto',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute -left-2 top-1/2 w-4 h-[2px] bg-teal-400 blur-[2px] opacity-70 transform -translate-y-1/2"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]">
                <circle cx="17" cy="17" r="3.5" />
                <circle cx="7" cy="17" r="3.5" />
                <path d="M7 17 L11 10 L16 10 L17 17" />
                <path d="M11 10 L8 5" />
                <path d="M16 10 L19 5 L21 5" />
                <circle cx="12" cy="4" r="1.5" fill="#2DD4BF" />
                <path d="M12 5.5 L10 10" />
                <path d="M12 5.5 L17 8" />
              </svg>
            </div>
          </div>
        </div>

        <div className="w-full mt-2 flex flex-col items-center">
          <div className="font-mono text-3xl font-light text-teal-400 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]">
            {displayNumber.toFixed(2)}
            <span className="text-sm text-teal-700 ml-1">%</span>
          </div>

          <div className="mt-1 text-slate-300 text-xs font-semibold tracking-[0.25em] uppercase">
            HC Category Climb
          </div>

          <div className="mt-4 h-5 overflow-hidden flex justify-center items-center">
             <div
               key={logIndex}
               className="font-mono text-[11px] text-slate-500 animate-fade-in-up"
             >
               {'>'} {SCIENTIFIC_LOGS[logIndex]}
               <span className="animate-pulse ml-1 text-teal-500">_</span>
             </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .mountain-line {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: drawMountain 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes drawMountain {
          to { stroke-dashoffset: 0; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
