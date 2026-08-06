'use client';

import { useEffect, useState } from 'react';
import ExportableChart from '@/components/exportable-chart';
import type { DashboardStats } from '@/types/genome';

interface StatsChartProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export default function StatsChart({ stats, loading }: StatsChartProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    sync();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => sync();
    media.addEventListener('change', onMedia);
    window.addEventListener('galibierhub-theme-changed', sync);
    window.addEventListener('galibierhub-settings-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', onMedia);
      window.removeEventListener('galibierhub-theme-changed', sync);
      window.removeEventListener('galibierhub-settings-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard metrics">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="mt-2 h-3 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 h-72">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="mt-6 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 h-72">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="mt-6 flex items-end gap-2 h-44">
              {[0, 1, 2, 3, 4, 5].map((bar) => (
                <div key={bar} className="flex-1 rounded-t bg-slate-200 dark:bg-slate-700 animate-pulse" style={{ height: `${32 + (bar % 4) * 14}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 h-72 flex flex-col items-center justify-center text-center">
          <svg className="mb-3 h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-gray-700">Metrics are unavailable</p>
          <p className="mt-1 text-xs text-gray-500">Connect a reachable dataset to display dashboard summaries.</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 h-72 flex flex-col items-center justify-center text-center">
          <svg className="mb-3 h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-700">Distribution charts are unavailable</p>
          <p className="mt-1 text-xs text-gray-500">Species and score distributions will appear once the dataset is reachable.</p>
        </div>
      </div>
    );
  }

  const tooltipBg = dark ? '#1E293B' : '#FFFFFF';
  const tooltipBorder = dark ? '#334155' : '#E2E8F0';
  const tooltipText = dark ? '#F1F5F9' : '#334155';
  const axisText = dark ? '#94A3B8' : '#64748B';
  const axisMuted = dark ? '#64748B' : '#94A3B8';
  const axisLine = dark ? '#334155' : '#E2E8F0';
  const shadowColor = dark ? 'rgba(0,0,0,0.35)' : 'rgba(15,23,42,0.10)';
  const axisPointer = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const chartColors: string[] = dark
    ? ['#38BDF8', '#34D399', '#FACC15', '#FB7185', '#A78BFA', '#FB923C', '#22D3EE', '#4ADE80', '#F472B6', '#FDE047']
    : ['#7DD3FC', '#6EE7B7', '#FCD34D', '#F9A8D4', '#C4B5FD', '#FDBA74', '#93C5FD', '#A7F3D0', '#FDE68A', '#F0ABFC'];

  const speciesOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: tooltipText, fontSize: 12 },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px ' + shadowColor + ';',
    },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        color: chartColors,
        data: Object.entries(stats.species_distribution).map(([name, value]) => ({
          name,
          value,
        })),
        label: { fontSize: 11 },
      },
    ],
  };

  const scoreOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: tooltipText, fontSize: 12 },
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px ' + shadowColor + ';',
      axisPointer: { type: 'shadow', shadowStyle: { color: axisPointer } },
    },
    xAxis: {
      type: 'category',
      data: stats.score_distribution.map((d) => d.range),
      axisLabel: { fontSize: 10, rotate: 30, color: axisText, margin: 12 },
      axisLine: { lineStyle: { color: axisLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Count',
      nameTextStyle: { color: axisMuted, fontSize: 11 },
      axisLabel: { color: axisMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: axisLine, width: 1, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: stats.score_distribution.map((d) => d.count),
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const colors: string[] = chartColors;
            return colors[params.dataIndex % colors.length];
          },
        },
        barMaxWidth: 36,
      },
    ],
  };

  const summaryCards = [
    { label: 'Total Samples', value: stats.total_samples.toLocaleString(), color: 'border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)]' },
    { label: 'Total Records', value: stats.total_promoters.toLocaleString(), color: 'border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)]' },
    { label: 'Total Variants', value: stats.total_variants.toLocaleString(), color: 'border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)]' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-3 text-center shadow-sm`}>
            <div className="text-2xl font-bold tabular-nums">{card.value}</div>
            <div className="text-xs mt-0.5 opacity-80">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExportableChart
          title="Samples by species"
          option={speciesOption}
          height={260}
          exportBaseName="species-distribution"
        />
        <ExportableChart
          title="Record score distribution"
          option={scoreOption}
          height={260}
          exportBaseName="score-distribution"
        />
      </div>
    </div>
  );
}
