'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const VISITOR_STORAGE_KEY = 'galibierhub-visitor-id';

interface SiteUptimeProps {
  startAt: string;
  onNavigateTab?: (tab: string) => void;
}

interface VisitorResponse {
  totalVisitors?: number;
  error?: string;
}

function getStoredVisitorId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && existing.trim().length >= 12) {
      return existing.trim();
    }

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(VISITOR_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function buildVisitorFingerprint() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const parts = [
    getStoredVisitorId(),
    navigator.userAgent,
    navigator.language,
    window.screen?.width || 0,
    window.screen?.height || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  ];

  return parts.join('|');
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

export default function SiteUptime({ startAt, onNavigateTab }: SiteUptimeProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const loadVisitors = async () => {
      try {
        const response = await fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: buildVisitorFingerprint() }),
        });
        const data = await response.json() as VisitorResponse;
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load visitor count.');
        }
        if (typeof data.totalVisitors === 'number') {
          setVisitorCount(data.totalVisitors);
          return;
        }
        throw new Error('Visitor count payload is missing totalVisitors.');
      } catch {
        try {
          const response = await fetch('/api/visitors');
          const data = await response.json() as VisitorResponse;
          if (!response.ok) {
            throw new Error(data.error || 'Failed to load visitor count.');
          }
          if (typeof data.totalVisitors === 'number') {
            setVisitorCount(data.totalVisitors);
            return;
          }
          throw new Error('Visitor count payload is missing totalVisitors.');
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

  const platformLinks = [
    { label: 'Overview', tab: 'overview' },
    { label: 'Records', tab: 'promoters' },
    { label: 'Genome Browser', tab: 'genome-browser' },
    { label: 'Downloads', tab: 'downloads' },
    { label: 'Discussions', tab: 'discussion' },
  ];

  return (
    <footer className="border-t border-gray-200 bg-[var(--color-surface-muted)]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              <span className="text-sm font-bold tracking-tight text-gray-900">GalibierHub</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Open cohort-scale genomic resources for FASTA/VCF exploration, batch download, and HPC-ready research workflows.
            </p>
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-gray-500 shadow-sm">
              <span className="font-semibold text-gray-800">Site uptime</span> <span className="font-mono tabular-nums">{text}</span>
              {typeof visitorCount === 'number' && (
                <>
                  <span className="mx-2 text-gray-300">|</span>
                  <span className="font-semibold text-gray-800">{visitorCount.toLocaleString()}</span> visitors
                </>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Platform</div>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-gray-600">
              {platformLinks.map((link) => (
                <button
                  key={link.tab}
                  type="button"
                  onClick={() => onNavigateTab?.(link.tab)}
                  className="text-left transition-colors hover:text-teal-700"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Resources</div>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-gray-600">
              <Link href="/docs/download-cli" className="transition-colors hover:text-teal-700">Download &amp; CLI Usage Guide</Link>
              <Link href="/acknowledgments" className="transition-colors hover:text-teal-700">Acknowledgments &amp; Data Sources</Link>
              <Link href="/security" className="transition-colors hover:text-teal-700">Security</Link>
              <Link href="/discussions" className="transition-colors hover:text-teal-700">Community</Link>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Research &amp; Legal</div>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-gray-600">
              <Link href="/acknowledgments" className="transition-colors hover:text-teal-700">Citation Guide</Link>
              <Link href="/acknowledgments" className="transition-colors hover:text-teal-700">Open Data Statement</Link>
              <Link href="/security" className="transition-colors hover:text-teal-700">Privacy &amp; Terms</Link>
              <Link href="/discussions" className="transition-colors hover:text-teal-700">GitHub Discussions</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ecosystem</div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            {["Hugging Face", "Supabase", "Cloudflare", "FANTOM5", "RIKEN"].map((name) => (
              <span key={name} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-medium text-gray-400 shadow-sm">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          2026 GalibierHub · Academic cohort data, downloads, and reproducible HPC workflows.
        </div>
      </div>
    </footer>
  );
}

