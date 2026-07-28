'use client';

import { type ReactNode } from 'react';

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
}

/**
 * A hover-triggered 3D flip card using pure CSS/Tailwind transforms.
 *
 * Usage notes:
 * - Works best for static feature cards, FAQ items, team introductions.
 * - Do NOT apply to download buttons, data table rows, or high-frequency
 *   interactive controls where sudden layout changes would frustrate users.
 */
export default function FlipCard({ front, back, className = '' }: FlipCardProps) {
  return (
    <div className={`group h-64 w-full [perspective:1000px] cursor-default ${className}`}>
      <div className="relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
        {/* ---- Front ---- */}
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 [backface-visibility:hidden] dark:border-gray-700 dark:bg-gray-800">
          {front}
        </div>

        {/* ---- Back ---- */}
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-xl bg-gray-900 p-6 text-gray-100 [transform:rotateY(180deg)] [backface-visibility:hidden] dark:bg-gray-700">
          {back}
        </div>
      </div>
    </div>
  );
}