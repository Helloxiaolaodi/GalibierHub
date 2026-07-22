'use client';

import { useRef } from 'react';
import ReactECharts from 'echarts-for-react';

type EChartsOption = Record<string, unknown>;

interface ExportableChartProps {
  option: EChartsOption;
  /** Base filename used when saving PNG/SVG (extension is appended automatically). */
  exportBaseName: string;
  /** Header title rendered above the chart. Also drives the SVG/PNG frame. */
  title?: string;
  height?: number;
}

function downloadURL(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// SVG export needs the SVG renderer, but the on-screen chart uses canvas for
// smoother interactions. Spin up a hidden SVG-rendered instance on demand to
// grab a print-ready vector snapshot without disturbing the visible chart.
async function exportAsSVG(
  option: EChartsOption,
  width: number,
  height: number,
  filename: string,
) {
  const echarts = await import('echarts');
  const div = document.createElement('div');
  div.style.cssText = `position:absolute;left:-9999px;top:0;width:${width}px;height:${height}px`;
  document.body.appendChild(div);
  try {
    const inst = echarts.init(div, undefined, { renderer: 'svg' });
    inst.setOption(option);
    const svg = div.querySelector('svg');
    if (!svg) throw new Error('SVG not rendered');
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('style', `${clone.getAttribute('style') || ''};background:#fff`);
    const svgString = new XMLSerializer().serializeToString(clone);
    downloadURL(
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString),
      filename,
    );
    inst.dispose();
  } finally {
    document.body.removeChild(div);
  }
}

export default function ExportableChart({
  option,
  exportBaseName,
  title,
  height = 260,
}: ExportableChartProps) {
  const ref = useRef<ReactECharts | null>(null);

  const handlePNG = () => {
    const inst = ref.current?.getEchartsInstance();
    if (!inst) return;
    const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    downloadURL(url, `${exportBaseName}.png`);
  };

  const handleSVG = () => {
    const inst = ref.current?.getEchartsInstance();
    const w = inst?.getWidth() ?? 800;
    const h = inst?.getHeight() ?? height;
    exportAsSVG(option, w, h, `${exportBaseName}.svg`);
  };

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-gray-50">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {title}
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePNG}
            title="Download 2× PNG"
            className="px-2 py-0.5 text-[11px] font-medium border rounded hover:bg-white text-gray-700"
          >
            PNG
          </button>
          <button
            onClick={handleSVG}
            title="Download publication-ready SVG"
            className="px-2 py-0.5 text-[11px] font-medium border rounded hover:bg-white text-gray-700"
          >
            SVG
          </button>
        </div>
      </div>
      <ReactECharts ref={ref} option={option} style={{ height }} />
    </div>
  );
}
