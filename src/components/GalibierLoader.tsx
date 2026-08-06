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

  // Progress engine
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

  // Altitude interpolation
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0B1120] backdrop-blur-sm transition-colors duration-500">
      {/* Header */}
      <div className="mb-4 text-center relative z-10">
        <h1 className="text-xl md:text-2xl font-light text-slate-800 dark:text-slate-200 tracking-[0.3em] uppercase m-0">
          GALIBIER<span className="font-bold text-[#0D9488]">HUB</span>
        </h1>
        <p className="text-[9px] font-mono text-slate-400 tracking-[0.25em] uppercase mt-1.5 m-0">
          HC Category Alpine Climb Telemetry
        </p>
      </div>

      {/* Alpine scene container */}
      <div className="relative w-[440px] h-[380px] overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-slate-100 dark:from-[#1e3a5f] dark:via-[#16203A] dark:to-[#0B1120] rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-300 dark:border-slate-800">
        {/* Alpine peaks silhouette */}
        <div className="absolute top-[40px] left-0 w-[200%] h-[160px] bg-gradient-to-b from-white/80 to-slate-300/40 dark:from-slate-400/30 dark:to-slate-700/20 opacity-70 animate-peaksPan z-0" style={{ clipPath: 'polygon(0% 100%, 5% 70%, 12% 85%, 20% 50%, 28% 75%, 35% 40%, 45% 80%, 55% 45%, 65% 75%, 75% 35%, 85% 70%, 92% 50%, 100% 100%)' }}></div>

        {/* Flying rocks */}
        <div className="absolute bottom-[110px] w-[24px] h-[35px] bg-slate-600 dark:bg-slate-500 opacity-60 animate-rockPan z-0" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
        <div className="absolute bottom-[125px] w-[35px] h-[20px] bg-slate-600 dark:bg-slate-500 opacity-60 animate-rockPan rock-delay z-0" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>

        {/* Mountain road */}
        <div className="absolute -bottom-[120px] -left-[80px] w-[650px] h-[260px] bg-gradient-to-b from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-900 rotate-[-14deg] shadow-[inset_0_6px_15px_rgba(0,0,0,0.3)]">
          <div className="absolute bottom-0 left-0 w-full h-[12px] bg-slate-600 dark:bg-slate-700 border-t-2 border-slate-400 dark:border-slate-500"></div>
        </div>

        {/* Cyclist group */}
        <div className="absolute bottom-[75px] left-[110px] rotate-[-14deg] animate-climbBob z-10">
          <svg width="200" height="130" viewBox="0 0 200 130" fill="none" style={{ width: '200px', height: '130px' }} xmlns="http://www.w3.org/2000/svg">
            {/* Rear wheel */}
            <g className="animate-wheelSpin" style={{ transformOrigin: '45px 95px' }}>
              <circle cx="45" cy="95" r="22" fill="none" stroke="#0F172A" strokeWidth="4" />
              <circle cx="45" cy="95" r="16" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx="45" cy="95" r="3" fill="#0F172A" />
              <line x1="45" y1="73" x2="45" y2="117" stroke="#334155" strokeWidth="1" />
              <line x1="23" y1="95" x2="67" y2="95" stroke="#334155" strokeWidth="1" />
            </g>
            {/* Front wheel */}
            <g className="animate-wheelSpin" style={{ transformOrigin: '155px 95px' }}>
              <circle cx="155" cy="95" r="22" fill="none" stroke="#0F172A" strokeWidth="4" />
              <circle cx="155" cy="95" r="16" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />
              <circle cx="155" cy="95" r="3" fill="#0F172A" />
              <line x1="155" y1="73" x2="155" y2="117" stroke="#334155" strokeWidth="1" />
              <line x1="133" y1="95" x2="177" y2="95" stroke="#334155" strokeWidth="1" />
            </g>
            {/* Frame */}
            <path d="M45 95 L90 95 L75 50 Z" fill="none" stroke="#0F172A" strokeWidth="4.5" strokeLinejoin="round" />
            <path d="M90 95 L155 50 L75 50" fill="none" stroke="#0F172A" strokeWidth="4.5" strokeLinejoin="round" />
            <path d="M155 95 L140 50" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M140 50 L152 38 L147 33" fill="none" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="90" cy="95" r="7" fill="#0F172A" />
            {/* Saddle */}
            <path d="M65 53 Q75 47 85 52" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />
            {/* Legs */}
            <path d="M78 52 L90 78 L90 95" stroke="#FDBA74" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M90 78 L98 95" stroke="#FFFFFF" strokeWidth="6.5" strokeLinecap="round" />
            {/* Torso */}
            <path d="M70 50 C 70 38, 100 36, 125 45 C 132 48, 118 58, 92 55 Z" fill="#0D9488" />
            {/* Arm */}
            <path d="M112 45 L138 42 L147 33" stroke="#FDBA74" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Head & helmet */}
            <circle cx="126" cy="27" r="11" fill="#FDBA74" />
            <path d="M113 23 C 113 11, 142 11, 139 27 Z" fill="#0F172A" />
            <rect x="123" y="23" width="15" height="4.5" rx="2" fill="#0EA5E9" />
          </svg>
        </div>
      </div>

      {/* Dashboard */}
      <div className="mt-4 w-[440px] relative z-20">
        <div className="bg-white dark:bg-[#16203A] border-2 border-slate-800 dark:border-slate-700 rounded-xl shadow-lg p-4 flex justify-between items-center relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 border-2 border-slate-800 dark:border-slate-700 text-slate-900 font-bold text-xs px-3 py-0.5 rounded-sm shadow-sm">
            D 902
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-bold tracking-[0.25em] uppercase mb-1">Target Altitude</span>
            <div className="text-3xl font-light text-[#0D9488] font-mono tabular-nums leading-none">
              {Math.round(displayAltitude).toLocaleString()}<span className="text-sm text-slate-400 ml-1">m</span>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-bold tracking-[0.25em] uppercase mb-1">Process Status</span>
            <div className="text-3xl font-bold text-slate-800 dark:text-slate-200 font-mono tabular-nums leading-none">
              {internalProgress.toFixed(1)}<span className="text-sm text-slate-400 ml-1">%</span>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes peaksPan {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes rockPan {
          0% { left: 480px; }
          100% { left: -60px; }
        }
        @keyframes climbBob {
          0% { transform: rotate(-14deg) translateY(0); }
          100% { transform: rotate(-14deg) translateY(-4px); }
        }
        @keyframes wheelSpin {
          100% { transform: rotate(360deg); }
        }
        .animate-peaksPan { animation: peaksPan 15s linear infinite; }
        .animate-rockPan { animation: rockPan 1.5s linear infinite; }
        .rock-delay { animation-delay: 0.75s; }
        .animate-climbBob { animation: climbBob 0.45s ease-in-out infinite alternate; }
        .animate-wheelSpin { animation: wheelSpin 0.3s linear infinite; }
      `}} />
    </div>
  );
}
