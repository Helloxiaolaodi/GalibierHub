'use client';

interface SkeletonScreenProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export default function SkeletonScreen({ rows = 8, cols = 6, className = '' }: SkeletonScreenProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="skeleton h-6 rounded"
              style={{ flex: colIdx === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={`skel-${rowIdx}`} aria-hidden="true">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="px-3 py-2">
              <div
                className="skeleton h-4 rounded"
                style={{ width: `${35 + Math.random() * 65}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
