'use client';

import ExportableChart from '@/components/exportable-chart';
import type { DashboardStats } from '@/types/genome';

interface StatsChartProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export default function StatsChart({ stats, loading }: StatsChartProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-gray-400">
          Loading metrics...
        </div>
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-gray-400">
          Loading charts...
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-center text-gray-500">
          Metrics are unavailable from the current data source.
        </div>
        <div className="border rounded-lg p-4 h-72 flex items-center justify-center text-center text-gray-500">
          Connect a reachable dataset to display species and score distributions.
        </div>
      </div>
    );
  }

  const speciesOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        // Okabe-Ito palette: colorblind-safe (protanopia, deuteranopia, tritanopia)
        color: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000', '#999999', '#882255'],
        data: Object.entries(stats.species_distribution).map(([name, value]) => ({
          name,
          value,
        })),
        label: { fontSize: 11 },
      },
    ],
  };

  const scoreOption = {
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
            // Viridis: perceptually uniform, colorblind-friendly palette
            const colors: string[] = [
              '#440154', '#482878', '#3e4989', '#31688e', '#26828e',
              '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725',
            ];
            return colors[params.dataIndex % colors.length];
          },
        },
      },
    ],
  };

  const summaryCards = [
    { label: 'Total Samples', value: stats.total_samples.toLocaleString(), color: 'bg-blue-50 text-blue-700' },
    { label: 'Total Records', value: stats.total_promoters.toLocaleString(), color: 'bg-emerald-50 text-emerald-700' },
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
