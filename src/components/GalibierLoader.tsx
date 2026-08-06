'use client';

import React, { useEffect, useState, useRef } from 'react';

interface LoaderProps {
  progress?: number;
}

export default function GalibierLoader({ progress }: LoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [displayAltitude, setDisplayAltitude] = useState(0);
  const requestRef = useRef<number>(0);

  const MAX_ALTITUDE = 2642;

  useEffect(() => {
    if (progress !== undefined) {
      setInternalProgress(progress);
      return;
    }
    const timer = setInterval(() => {
      setInternalProgress((old) => {
        if (old >= 99) return old;
        const increment = old < 80 ? (Math.random() * 2 + 0.5) : (Math.random() * 0.2 + 0.01);
        return Math.min(old + increment, 99.9);
      });
    }, 200);
    return () => clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    const updateTelemetry = () => {
      setDisplayAltitude((prev) => {
        const targetAltitude = (internalProgress / 100) * MAX_ALTITUDE;
        const diff = targetAltitude - prev;
        if (Math.abs(diff) < 0.5) return targetAltitude;
        return prev + diff * 0.15;
      });
      requestRef.current = requestAnimationFrame(updateTelemetry);
    };
    requestRef.current = requestAnimationFrame(updateTelemetry);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [internalProgress]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8FAFC] p-6">
      <div className="flex flex-col items-center w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-4">
          <h1 className="text-4xl md:text-5xl font-normal text-slate-800 tracking-[0.25em] uppercase m-0 flex items-center justify-center gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4H10V10H4V4Z" fill="#0D9488"/>
              <path d="M14 4H20V10H14V4Z" fill="#0F172A"/>
              <path d="M4 14H10V20H4V14Z" fill="#0F172A"/>
              <path d="M14 14H20V20H14V14Z" fill="#0D9488"/>
            </svg>
            <span>GALIBIER<span className="font-extrabold text-[#0D9488]">HUB</span></span>
          </h1>
          <p className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mt-3 font-semibold">
            HC Category Alpine Climb Telemetry
          </p>
        </div>

        {/* Dashboard panel */}
        <div className="relative w-full max-w-[500px] bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_20px_40px_-10px_rgba(15,23,42,0.08)] p-[1.5rem_2rem] flex justify-between items-center">
          <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 bg-[#FACC15] border-2 border-[#0F172A] text-[#0F172A] font-extrabold text-xs tracking-[0.1em] px-[0.75rem] py-[0.15rem] rounded-[4px] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] whitespace-nowrap">
            D 902 · COL DU GALIBIER
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mb-1">Target Altitude</span>
            <div className="text-4xl md:text-5xl font-light text-[#0D9488] font-mono tabular-nums leading-none flex items-baseline">
              <span>{Math.round(displayAltitude).toLocaleString()}</span>
              <span className="text-base text-slate-400 ml-1">m</span>
            </div>
          </div>

          <div className="h-12 w-px bg-slate-200"></div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mb-1">Upload Progress</span>
            <div className="text-4xl md:text-5xl font-bold text-slate-800 font-mono tabular-nums leading-none flex items-baseline">
              <span>{internalProgress.toFixed(1)}</span>
              <span className="text-base text-slate-400 ml-1">%</span>
            </div>
          </div>

          {/* Bottom progress bar */}
          <div className="absolute bottom-0 left-0 w-full h-[4px] bg-[#F1F5F9] overflow-hidden rounded-b-[16px]">
            <div
              className="h-full bg-[#0D9488] transition-[width] duration-100 linear"
              style={{ width: `${internalProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
