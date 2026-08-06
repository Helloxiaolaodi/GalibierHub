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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a] p-6">
      <div className="flex flex-col items-center gap-5 w-full max-w-[500px]">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-light text-slate-200 tracking-[0.4em] uppercase drop-shadow-lg">
            GALIBIER<span className="font-extrabold text-[#0D9488]">HUB</span>
          </h1>
        </div>

        {/* Scene container */}
        <div className="relative w-full max-w-[500px] h-[440px] overflow-hidden rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-600"
             style={{ background: 'linear-gradient(180deg, #4a7c9b 0%, #6b8fa8 20%, #8aa3b8 45%, #7a95a8 75%, #5a7080 100%)' }}>

          {/* Clouds */}
          <div className="absolute top-0 left-0 w-[200%] h-[100px] z-[1] animate-cloudsDrift"
               style={{ background: 'radial-gradient(ellipse at 25% 50%, rgba(255,255,255,0.35) 0%, transparent 55%), radial-gradient(ellipse at 65% 35%, rgba(255,255,255,0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, rgba(255,255,255,0.3) 0%, transparent 45%)' }} />

          {/* Far peaks */}
          <div className="absolute top-[55px] left-0 w-full h-[210px] z-[2]">
            <div className="absolute bottom-0 w-full h-full opacity-40"
                 style={{ background: 'linear-gradient(180deg, #7a8a9a 0%, #5a6a7a 100%)', clipPath: 'polygon(0% 100%, 6% 40%, 16% 68%, 25% 28%, 38% 62%, 50% 18%, 63% 52%, 76% 22%, 88% 58%, 96% 32%, 100% 100%)', transform: 'translateX(10px) translateY(6px)' }} />
            <div className="absolute bottom-0 w-full h-full opacity-85"
                 style={{ background: 'linear-gradient(180deg, #e8edf2 0%, #c8d4e0 35%, #a0b0c0 100%)', clipPath: 'polygon(0% 100%, 6% 40%, 16% 68%, 25% 28%, 38% 62%, 50% 18%, 63% 52%, 76% 22%, 88% 58%, 96% 32%, 100% 100%)' }} />
          </div>

          {/* Mid mountains */}
          <div className="absolute top-[110px] left-0 w-full h-[170px] z-[3]">
            <div className="absolute bottom-0 w-full h-full opacity-65"
                 style={{ background: 'linear-gradient(180deg, #4a6a44 0%, #3a5a34 55%, #2a4a24 100%)', clipPath: 'polygon(0% 100%, 9% 50%, 20% 72%, 33% 42%, 43% 65%, 56% 34%, 66% 58%, 76% 38%, 86% 62%, 94% 44%, 100% 68%, 100% 100%)' }} />
            <div className="absolute bottom-0 w-full h-full"
                 style={{ background: 'linear-gradient(180deg, #3d5a3a 0%, #2d4a2a 45%, #1e3a1e 100%)', clipPath: 'polygon(0% 100%, 4% 55%, 14% 78%, 24% 45%, 34% 68%, 46% 35%, 58% 62%, 70% 40%, 80% 66%, 90% 48%, 100% 72%, 100% 100%)' }} />
          </div>

          {/* Cliff face */}
          <div className="absolute bottom-0 left-0 w-full h-[190px] z-[4]"
               style={{ background: 'linear-gradient(180deg, #5a6b7b 0%, #4a5b6b 35%, #3a4a5a 70%, #2a3a4a 100%)', clipPath: 'polygon(0% 25%, 12% 48%, 28% 30%, 42% 52%, 58% 35%, 72% 55%, 88% 40%, 100% 50%, 100% 100%, 0% 100%)' }} />
          <div className="absolute bottom-0 left-0 w-full h-[190px] z-[5]"
               style={{ background: 'radial-gradient(ellipse at 18% 65%, rgba(60,70,85,0.7) 0%, transparent 35%), radial-gradient(ellipse at 52% 55%, rgba(60,70,85,0.6) 0%, transparent 30%), radial-gradient(ellipse at 78% 70%, rgba(60,70,85,0.65) 0%, transparent 32%)', clipPath: 'polygon(0% 25%, 12% 48%, 28% 30%, 42% 52%, 58% 35%, 72% 55%, 88% 40%, 100% 50%, 100% 100%, 0% 100%)' }} />

          {/* Roadside rocks */}
          <div className="absolute bottom-[25px] left-0 w-full h-[55px] z-[5]">
            <div className="absolute bottom-[12px] left-[6%] w-[24px] h-[20px] bg-[#5a6b7b] opacity-75" style={{ clipPath: 'polygon(25% 0%, 75% 12%, 100% 100%, 0% 100%)' }} />
            <div className="absolute bottom-[6px] left-[28%] w-[20px] h-[16px] bg-[#5a6b7b] opacity-75" style={{ clipPath: 'polygon(25% 0%, 75% 12%, 100% 100%, 0% 100%)' }} />
            <div className="absolute bottom-[18px] left-[62%] w-[28px] h-[22px] bg-[#5a6b7b] opacity-75" style={{ clipPath: 'polygon(25% 0%, 75% 12%, 100% 100%, 0% 100%)' }} />
            <div className="absolute bottom-[8px] left-[84%] w-[22px] h-[18px] bg-[#5a6b7b] opacity-75" style={{ clipPath: 'polygon(25% 0%, 75% 12%, 100% 100%, 0% 100%)' }} />
          </div>

          {/* Mountain road */}
          <div className="absolute -bottom-[20px] -left-[40px] w-[620px] h-[190px] z-[6] rotate-[-11deg]"
               style={{ background: 'linear-gradient(180deg, #6b7b8b 0%, #4b5b6b 55%, #3b4b5b 100%)', clipPath: 'polygon(0% 42%, 100% 32%, 100% 62%, 0% 72%)', boxShadow: 'inset 0 5px 15px rgba(0,0,0,0.5)' }}>
            <div className="absolute top-[36%] left-0 w-full h-[5px] bg-[#8899aa] z-[7]"></div>
            <div className="absolute top-[50%] left-0 w-full h-[3px] z-[7] opacity-65"
                 style={{ background: 'repeating-linear-gradient(90deg, #facc15 0px, #facc15 28px, transparent 28px, transparent 48px)' }} />
            <div className="absolute top-[66%] left-0 w-full h-[5px] bg-[#556677] z-[7]"></div>
          </div>

          {/* Foreground bushes */}
          <div className="absolute -left-[18px] -bottom-[22px] w-[85px] h-[55px] z-[20] rounded-full"
               style={{ background: 'radial-gradient(ellipse at center, #2d4a28 0%, #1a3018 75%)' }} />
          <div className="absolute -right-[22px] -bottom-[28px] w-[95px] h-[60px] z-[20] rounded-full"
               style={{ background: 'radial-gradient(ellipse at center, #2d4a28 0%, #1a3018 75%)' }} />

          {/* Cyclist */}
          <div className="absolute bottom-[60px] left-[130px] rotate-[-11deg] animate-climbSway z-[15]">
            <svg width="220" height="145" viewBox="0 0 220 145" fill="none" overflow="visible" xmlns="http://www.w3.org/2000/svg">
              {/* Rear wheel */}
              <g className="animate-wheelSpin" style={{ transformOrigin: '52px 98px' }}>
                <circle cx="52" cy="98" r="23" fill="none" stroke="#0f172a" strokeWidth="5" />
                <circle cx="52" cy="98" r="16" fill="none" stroke="#334155" strokeWidth="1.3" strokeDasharray="3 5" />
                <circle cx="52" cy="98" r="4" fill="#0f172a" />
                <line x1="52" y1="75" x2="52" y2="121" stroke="#334155" strokeWidth="1.8" />
                <line x1="29" y1="98" x2="75" y2="98" stroke="#334155" strokeWidth="1.8" />
              </g>
              {/* Front wheel */}
              <g className="animate-wheelSpin" style={{ transformOrigin: '155px 98px' }}>
                <circle cx="155" cy="98" r="23" fill="none" stroke="#0f172a" strokeWidth="5" />
                <circle cx="155" cy="98" r="16" fill="none" stroke="#334155" strokeWidth="1.3" strokeDasharray="3 5" />
                <circle cx="155" cy="98" r="4" fill="#0f172a" />
                <line x1="155" y1="75" x2="155" y2="121" stroke="#334155" strokeWidth="1.8" />
                <line x1="132" y1="98" x2="178" y2="98" stroke="#334155" strokeWidth="1.8" />
              </g>
              {/* Frame */}
              <path d="M52 98 L98 98 L80 50 Z" fill="none" stroke="#0f172a" strokeWidth="5.5" strokeLinejoin="round" />
              <path d="M98 98 L155 50 L80 50" fill="none" stroke="#0f172a" strokeWidth="5.5" strokeLinejoin="round" />
              <path d="M155 98 L137 50" stroke="#0f172a" strokeWidth="5.5" strokeLinecap="round" />
              <path d="M137 50 L150 38 L144 32" fill="none" stroke="#0f172a" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M80 50 L74 44" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
              {/* Bottom bracket */}
              <circle cx="98" cy="98" r="9" fill="#1e293b" />
              <circle cx="98" cy="98" r="4.5" fill="#facc15" />
              {/* Right leg */}
              <g className="animate-rightThigh" style={{ transformOrigin: '74px 44px' }}>
                <path d="M74 44 L90 70" stroke="#F0B080" strokeWidth="9" strokeLinecap="round" />
                <g className="animate-crankSpin" style={{ transformOrigin: '98px 98px' }}>
                  <line x1="98" y1="98" x2="107" y2="103" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M90 70 L105 99" stroke="#F0B080" strokeWidth="8" strokeLinecap="round" />
                  <path d="M100 89 L105 99" stroke="#ffffff" strokeWidth="8.2" strokeLinecap="round" />
                  <g transform="translate(107, 103) rotate(15)">
                    <path d="M-6 -8 L7 -7 C 12 -6, 13 -2, 8 0 L-7 0 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M2 -7 L5 -6" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="0" cy="0" r="2.5" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1.5"/>
                    <path d="M-4 0 L4 0 L5 3.5 L-3 3.5 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round"/>
                  </g>
                </g>
              </g>
              {/* Left leg */}
              <g className="animate-leftThigh" style={{ transformOrigin: '74px 44px' }}>
                <path d="M74 44 L84 90" stroke="#E0A070" strokeWidth="8.5" strokeLinecap="round" />
                <g className="animate-crankSpin" style={{ transformOrigin: '98px 98px' }}>
                  <line x1="98" y1="98" x2="89" y2="93" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />
                  <path d="M84 90 L87 91.5" stroke="#E0A070" strokeWidth="8" strokeLinecap="round" />
                  <path d="M85 90.5 L87 91.5" stroke="#f1f5f9" strokeWidth="8.2" strokeLinecap="round" />
                  <g transform="translate(89, 93) rotate(15)">
                    <path d="M-6 -8 L7 -7 C 12 -6, 13 -2, 8 0 L-7 0 Z" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M2 -7 L5 -6" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="0" cy="0" r="2.5" fill="#94a3b8" stroke="#1e293b" strokeWidth="1.5"/>
                    <path d="M-4 0 L4 0 L5 3.5 L-3 3.5 Z" fill="#334155" stroke="#0f172a" strokeWidth="1.5" strokeLinejoin="round"/>
                  </g>
                </g>
              </g>
              {/* Torso */}
              <path d="M69 44 L69 -4 L79 -4 L79 44 Z" fill="#0D9488" stroke="#0f172a" strokeWidth="2" />
              <path d="M68 44 C 66 26, 67 10, 69 -4 L79 -4 C 81 10, 80 26, 78 44 Z" fill="#0D9488" stroke="#0f172a" strokeWidth="2" />
              <line x1="71" y1="37" x2="77" y2="37" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
              <line x1="70" y1="24" x2="78" y2="24" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="69" y1="11" x2="79" y2="11" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
              {/* Arms (optimized rendering) */}
              <path d="M72 0 L110 18 L140 30" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M72 0 L110 18 L140 30" stroke="#E0A070" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="140" cy="30" r="4.5" fill="#E0A070" stroke="#0f172a" strokeWidth="2" />
              <path d="M76 0 L114 22 L144 34" stroke="#1e293b" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M76 0 L114 22 L144 34" stroke="#F0B080" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="144" cy="34" r="4.8" fill="#F0B080" stroke="#0f172a" strokeWidth="2" />
              {/* Head */}
              <circle cx="74" cy="-14" r="15" fill="#F0B080" stroke="#0f172a" strokeWidth="2.5" />
              <path d="M57 -14 C 57 -32, 91 -32, 91 -14 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
              <rect x="66" y="-17" width="16" height="6" rx="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="70" cy="-24" r="2.2" fill="#f8fafc" />
              <circle cx="76" cy="-25" r="1.8" fill="#f8fafc" />
              <circle cx="82" cy="-23" r="1.5" fill="#f8fafc" />
              <circle cx="68" cy="-14" r="1.5" fill="#0f172a" />
              <circle cx="78" cy="-14" r="1.5" fill="#0f172a" />
              <path d="M71 -9 Q74 -6, 77 -9" stroke="#0f172a" strokeWidth="1.2" fill="none" />
            </svg>
          </div>
        </div>

        {/* Dashboard */}
        <div className="w-full max-w-[500px] bg-white/95 backdrop-blur-[12px] border-2 border-slate-800 rounded-[20px] shadow-[0_20px_35px_-10px_rgba(0,0,0,0.35)] p-[1.2rem_1.8rem] flex justify-between items-center relative z-30">
          <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 bg-yellow-400 border-2 border-slate-900 text-slate-900 font-bold text-xs tracking-[0.08em] px-[1.1rem] py-[0.2rem] rounded-sm whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
            D 902 · COL DU GALIBIER
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold tracking-[0.22em] uppercase mb-1">海拔高度</span>
            <div className="text-4xl md:text-5xl font-light text-[#0D9488] font-mono tabular-nums leading-none flex items-baseline">
              {Math.round(displayAltitude).toLocaleString()}
              <span className="text-base text-slate-400 ml-1.5">m</span>
            </div>
          </div>
          <div className="h-12 w-px bg-slate-300"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-bold tracking-[0.22em] uppercase mb-1">爬坡进度</span>
            <div className="text-4xl md:text-5xl font-bold text-slate-900 font-mono tabular-nums leading-none flex items-baseline">
              {internalProgress.toFixed(1)}
              <span className="text-base text-slate-400 ml-1.5">%</span>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes cloudsDrift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes climbSway {
          0% { transform: rotate(-11deg) translateY(0px) rotate(0deg); }
          100% { transform: rotate(-11deg) translateY(-8px) rotate(2.8deg); }
        }
        @keyframes wheelSpin {
          100% { transform: rotate(360deg); }
        }
        @keyframes crankSpin {
          100% { transform: rotate(360deg); }
        }
        @keyframes rightThighKick {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(9deg); }
          60% { transform: rotate(-11deg); }
          80% { transform: rotate(-17deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes leftThighKick {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(-17deg); }
          40% { transform: rotate(-11deg); }
          60% { transform: rotate(9deg); }
          80% { transform: rotate(15deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-cloudsDrift { animation: cloudsDrift 35s linear infinite; }
        .animate-climbSway { animation: climbSway 0.45s ease-in-out infinite alternate; }
        .animate-wheelSpin { animation: wheelSpin 0.32s linear infinite; }
        .animate-crankSpin { animation: crankSpin 0.5s linear infinite; }
        .animate-rightThigh { animation: rightThighKick 0.5s ease-in-out infinite; }
        .animate-leftThigh { animation: leftThighKick 0.5s ease-in-out infinite; }
      `}} />
    </div>
  );
}
