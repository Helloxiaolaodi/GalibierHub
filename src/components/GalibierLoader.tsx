'use client';

import React, { useEffect, useState, useRef } from 'react';

interface LoaderProps {
  progress?: number;
}

const TELEMETRY_LOGS = [
  'INITIALIZING GALIBIERHC TELEMETRY...',
  'ALLOCATING SLURM HPC NODES...',
  'MOUNTING METAGENOMIC COHORT VOLUMES...',
  'PARSING FANTOM5 REFERENCE ASSEMBLIES...',
  'INDEXING VARIANT CALL FORMATS (VCF)...',
  'COMPUTING LOCUS COORDINATE OVERLAPS...',
  'FINALIZING DATA BUNDLE FOR DELIVERY...',
];

export default function GalibierLoader({ progress }: LoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [displayAltitude, setDisplayAltitude] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const requestRef = useRef<number>(0);

  const MAX_ALTITUDE = 2642;

  useEffect(() => {
    if (progress !== undefined) {
      setInternalProgress(progress);
      return;
    }
    const timer = setInterval(() => {
      setInternalProgress((old) => {
        if (old >= 95) return old;
        const increment = old < 60 ? (Math.random() * 2 + 1) : (Math.random() * 0.5 + 0.1);
        return Math.min(old + increment, 95);
      });
    }, 400);
    return () => clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    const updateTelemetry = () => {
      setDisplayAltitude((prev) => {
        const targetAltitude = (internalProgress / 100) * MAX_ALTITUDE;
        const diff = targetAltitude - prev;
        if (Math.abs(diff) < 1) return targetAltitude;
        return prev + diff * 0.08;
      });
      requestRef.current = requestAnimationFrame(updateTelemetry);
    };
    requestRef.current = requestAnimationFrame(updateTelemetry);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [internalProgress]);

  useEffect(() => {
    const logTimer = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % TELEMETRY_LOGS.length);
    }, 1500);
    return () => clearInterval(logTimer);
  }, []);

  // Logo-inspired switchback path: matches the zigzag in galibierhub-logo.svg
  const climbPath = 'M 10 180 L 70 150 L 50 135 L 110 100 L 95 85 L 150 40 L 135 25 L 180 5';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] backdrop-blur-sm transition-colors duration-500">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-10"
           style={{ backgroundImage: 'linear-gradient(#0F172A 1px, transparent 1px), linear-gradient(90deg, #0F172A 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="relative z-10 w-[600px] flex flex-col items-center">
        <div className="relative w-[360px] h-[200px] flex justify-center items-center">
          {/* Logo monogram as background watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] dark:opacity-[0.12]">
            <svg width="200" height="200" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="60" height="60" rx="10" fill="currentColor" className="text-slate-400 dark:text-slate-600"/>
              <path d="M16 52V12h32v18H26v8h14v14H16z" fill="currentColor" className="text-slate-500 dark:text-slate-400"/>
              <path d="M30 46 40 34 34 28 46 18" stroke="currentColor" className="text-[#0D9488]" strokeWidth="5" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
            </svg>
          </div>

          {/* Climbing route track (dashed guide) */}
          <svg className="absolute w-full h-full overflow-visible" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d={climbPath}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth="1"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Rider telemetry dot */}
          <div
            className="absolute top-0 left-0 w-8 h-8 -ml-4 -mt-4 transition-all duration-[400ms] ease-out flex items-center justify-center"
            style={{
              offsetPath: `path('${climbPath}')`,
              offsetDistance: `${internalProgress}%`,
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute w-8 h-8 bg-[#0D9488] rounded-full opacity-20 animate-ping"></div>
              <div className="w-2 h-2 bg-[#0D9488] rounded-full shadow-[0_0_8px_#0D9488]"></div>
              <svg className="absolute -top-6 -right-2 w-7 h-7 text-[#0D9488] dark:text-[#2DD4BF] animate-bounce" style={{ animationDuration: '2s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="17" r="3" />
                <path d="M7 17 L11 11 L16 11 L17 17" />
                <path d="M11 11 L8 6" />
                <path d="M16 11 L19 6 L21 6" />
                <circle cx="13" cy="4" r="1.5" fill="currentColor" />
                <path d="M13 5.5 L10 11" />
                <path d="M13 5.5 L18 8" />
              </svg>
            </div>
          </div>
        </div>

        <div className="w-full mt-8 flex flex-col items-center">
          <div className="flex items-end space-x-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-[0.2em] uppercase mb-1">Altitude</span>
              <div className="font-mono text-4xl font-light text-[#0F172A] dark:text-slate-200">
                {Math.round(displayAltitude).toLocaleString()} <span className="text-sm text-slate-400">m</span>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-300 dark:bg-slate-700"></div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-[0.2em] uppercase mb-1">Progress</span>
              <div className="font-mono text-4xl font-light text-[#0D9488] dark:text-[#2DD4BF]">
                {internalProgress.toFixed(1)} <span className="text-sm opacity-60">%</span>
              </div>
            </div>
          </div>

          <div className="mt-6 px-3 py-1 border border-slate-300 dark:border-slate-700 rounded-full flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#0D9488] animate-pulse"></span>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tracking-wider">
              COL DU GALIBIER | HC CATEGORY CLIMB
            </span>
          </div>

          <div className="mt-6 w-full max-w-md h-6 overflow-hidden flex justify-center items-center bg-slate-100 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-800">
            <div key={logIndex} className="font-mono text-[10px] text-slate-500 dark:text-slate-400 animate-fade-in-up">
              <span className="text-[#0D9488] mr-2">SYS_</span>
              {TELEMETRY_LOGS[logIndex]}
              <span className="animate-pulse ml-1 text-[#0F172A] dark:text-slate-200">_</span>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
