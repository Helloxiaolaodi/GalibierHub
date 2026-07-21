'use client';

import ReactECharts from 'echarts-for-react';
import type { DashboardStats } from '@/types/genome';

interface StatsChartProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export default function StatsChart({ stats, loading }: StatsChartProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-gray-400">
          Loading statistics...
        </div>
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-gray-400">
          Loading distribution...
        </div>
      </div>
    );
  }

  const speciesOption = {
    title: { text: 'Samples by Species', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        data: Object.entries(stats.species_distribution).map(([name, value]) => ({
          name,
          value,
        })),
        label: { fontSize: 11 },
      },
    ],
  };

  const scoreOption = {
    title: { text: 'Promoter Score Distribution', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: stats.score_distribution.map((d) => d.range),
      axisLabel: { fontSize: 10, rotate: 30 },
    },
    yAxis: { type: 'value', name: 'Count' },
    series: [
      {
        type: 'bar',
        data: stats.score_distribution.map((d) => d.count),
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const colors = [
              '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
              '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
            ];
            return colors[params.dataIndex % colors.length];
          },
        },
      },
    ],
  };

  const summaryCards = [
    { label: 'Total Samples', value: stats.total_samples.toLocaleString(), color: 'bg-blue-50 text-blue-700' },
    { label: 'Total Promoters', value: stats.total_promoters.toLocaleString(), color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total Variants', value: stats.total_variants.toLocaleString(), color: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-lg p-3 text-center`}>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-xs mt-0.5 opacity-80">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-2">
          <ReactECharts option={speciesOption} style={{ height: 260 }} />
        </div>
        <div className="border rounded-lg p-2">
          <ReactECharts option={scoreOption} style={{ height: 260 }} />
        </div>
      </div>
    </div>
  );
}
