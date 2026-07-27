'use client';

import { useEffect, useMemo, useState } from 'react';

interface SiteUptimeProps {
  startAt: string;
}

function formatDuration(startAt: string, now: number) {
  const start = new Date(startAt).getTime();
  if (Number.isNaN(start) || start > now) {
    return '0 d 0 h 0 m 0 s';
  }

  let diffSeconds = Math.floor((now - start) / 1000);
  const days = Math.floor(diffSeconds / 86400);
  diffSeconds -= days * 86400;
  const hours = Math.floor(diffSeconds / 3600);
  diffSeconds -= hours * 3600;
  const minutes = Math.floor(diffSeconds / 60);
  diffSeconds -= minutes * 60;
  const seconds = diffSeconds;

  return `${days} d ${hours} h ${minutes} m ${seconds} s`;
}

export default function SiteUptime({ startAt }: SiteUptimeProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const buildVisitorFingerprint = () => {
      const parts = [
        navigator.userAgent,
        navigator.language,
        window.screen?.width || 0,
        window.screen?.height || 0,
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      ];
      return parts.join('|');
    };

    const loadVisitors = async () => {
      try {
        const response = await fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: buildVisitorFingerprint() }),
        });
        const data = await response.json() as { totalVisitors?: number; error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load visitor count.');
        }
        setVisitorCount(typeof data.totalVisitors === 'number' ? data.totalVisitors : null);
      } catch {
        try {
          const response = await fetch('/api/visitors');
          const data = await response.json() as { totalVisitors?: number; error?: string };
          if (!response.ok) {
            throw new Error(data.error || 'Failed to load visitor count.');
          }
          setVisitorCount(typeof data.totalVisitors === 'number' ? data.totalVisitors : null);
        } catch {
          setVisitorCount(null);
        }
      }
    };

    void loadVisitors();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const text = useMemo(() => formatDuration(startAt, now), [now, startAt]);

  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
      Site uptime: <span className="font-medium text-gray-700">{text}</span>
      {typeof visitorCount === 'number' && (
        <>
          {' '}
          <span className="text-gray-300">|</span>{' '}
          Visitors: <span className="font-medium text-gray-700">{visitorCount.toLocaleString()}</span>
        </>
      )}
    </footer>
  );
}
