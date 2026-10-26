"use client";

import { useEffect, useId, useRef, useState } from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { formatNumber, formatPace } from "@/lib/runFormatters";
import { chartDashes } from "@/lib/charts/chartTheme";
import type { FatigueRun } from "@/types/fatigue";

type Props = { runs: readonly FatigueRun[]; fromDate?: string; toDate?: string };
type Dimension = {
  key: "sleepHours" | "activeEnergyKcal" | "steps" | "pace";
  label: string;
  unit: string;
  fallback: [number, number];
};
const dimensions: Dimension[] = [
  { key: "sleepHours", label: "Sleep", unit: "hours", fallback: [0, 10] },
  { key: "activeEnergyKcal", label: "Active Energy", unit: "kcal/day", fallback: [0, 1000] },
  { key: "steps", label: "Steps", unit: "steps/day", fallback: [0, 15000] },
  { key: "pace", label: "Pace", unit: "min/mile", fallback: [6, 14] },
];
const colors = ["var(--color-chart-berry)", "var(--color-chart-teal)", "var(--color-chart-orange)", "var(--color-chart-gold)", "var(--color-chart-navy)"];
const margin = { top: 48, right: 24, bottom: 20, left: 52 };

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

function metricValue(run: FatigueRun, dimension: Dimension) {
  const value = run[dimension.key];
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (dimension.key === "pace" && value === 0) return null;
  return value;
}

function formatValue(value: number | null, dimension: Dimension) {
  return dimension.key === "pace" ? formatPace(value) : formatNumber(value, dimension.key === "steps" ? 0 : 1);
}

export default function Fatigue({ runs, fromDate = "", toDate = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const start = fromDate ? parseDay(fromDate) : -Infinity;
  const end = toDate ? parseDay(toDate) : Infinity;
  const cohort = runs.filter((run) => {
    const time = parseDay(run.date);
    return Number.isFinite(time) && time >= start && time <= end;
  }).sort((a, b) => a.date.localeCompare(b.date));
  const x = scalePoint<string>().domain(dimensions.map((dimension) => dimension.key))
    .range([margin.left, size.width - margin.right]);
  const axes = dimensions.map((dimension) => {
    const values = cohort.map((run) => metricValue(run, dimension)).filter((value): value is number => value !== null);
    const low = values.length ? Math.min(...values) : dimension.fallback[0];
    const high = values.length ? Math.max(...values) : dimension.fallback[1];
    const padding = Math.max((high - low) * 0.1, high * 0.02, 0.25);
    const y = scaleLinear().domain([Math.max(0, low - padding), high + padding]).nice(4)
      .range([size.height - margin.bottom, margin.top]);
    return { dimension, y };
  });
  const series = cohort.map((run, index) => {
    const points = axes.map(({ dimension, y }) => {
      const value = metricValue(run, dimension);
      return { dimension, value, x: x(dimension.key)!, y: value === null ? 0 : y(value) };
    });
    const path = line<typeof points[number]>().defined((point) => point.value !== null)
      .x((point) => point.x).y((point) => point.y)(points);
    return { run, points, path, color: colors[index % colors.length], dash: chartDashes[index % chartDashes.length] };
  });
  const hasValues = series.some(({ points }) => points.some(({ value }) => value !== null));
  const activeSeries = series.find(({ run }) => run.id === activeRunId);
  const renderRun = ({ points, path, color, dash }: (typeof series)[number], highlighted = false) => <>
    <path d={path ?? undefined} fill="none" stroke={color} strokeWidth={highlighted ? 4 : 2} strokeOpacity={highlighted ? 1 : 0.7} strokeDasharray={dash} />
    {points.map(({ dimension, value, x, y }) => value !== null && <circle key={dimension.key} data-fatigue-point={dimension.key} cx={x} cy={y} r={highlighted ? 6 : 4} fill={color} className="stroke-surface" strokeWidth={highlighted ? 2 : 1.5} />)}
  </>;

  return (
    <div className="min-w-0">
      <header className="px-4 pt-4">
        <h2 className="text-base font-semibold text-foreground">Fatigue and Pace</h2>
        <p className="mt-1 text-xs leading-5 text-muted">One line per run. Hover or focus a line to see all four metrics. Each axis has its own scale; missing values leave gaps.</p>
      </header>
      <ul aria-label="Fatigue chart runs" className="flex max-h-20 flex-wrap gap-x-4 gap-y-2 overflow-y-auto px-4 pt-3 text-xs text-foreground">
        {series.map(({ run, color, dash }) => <li key={run.id} className="flex items-center gap-2">
          <svg width={20} height={8} aria-hidden="true"><line x2={20} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dash} /></svg>
          <time dateTime={run.date}>{run.date.slice(2)}</time>
        </li>)}
      </ul>
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative h-96 min-w-[360px]">
          {size.width > 0 && <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="group" aria-label="Parallel coordinates for sleep, active energy, steps, and pace">
            <desc>Each run connects Sleep in hours, daily Active Energy in kilocalories, daily step count, and Pace in minutes per mile. Hover or focus any run line to highlight the whole run and display all four values. Missing values are marked as not available.</desc>
            {axes.map(({ dimension, y }) => <g key={dimension.key} data-fatigue-axis={dimension.key} transform={`translate(${x(dimension.key)},0)`}>
              <line y1={margin.top} y2={size.height - margin.bottom} stroke="currentColor" opacity={0.5} />
              <text y={17} textAnchor="middle" fontSize={11} className="fill-foreground" fontWeight={600}>{dimension.label}</text>
              <text y={32} textAnchor="middle" fontSize={10} fill="currentColor">{dimension.unit}</text>
              {y.ticks(4).map((value) => <g key={value} transform={`translate(0,${y(value)})`}>
                <line x2={-4} stroke="currentColor" /><text x={-7} dy="0.32em" textAnchor="end" fontSize={10} fill="currentColor">{formatValue(value, dimension)}</text>
              </g>)}
            </g>)}
            {series.map((item) => <g key={item.run.id} data-fatigue-run={item.run.id}
              tabIndex={item.points.some(({ value }) => value !== null) ? 0 : undefined} role="graphics-symbol"
              aria-label={`${item.run.date.slice(2)} · ${item.points.map(({ dimension, value }) => `${dimension.label}: ${value === null ? "Not available" : `${formatValue(value, dimension)} ${dimension.unit}`}`).join(" · ")}`}
              aria-describedby={activeSeries?.run.id === item.run.id ? tooltipId : undefined}
              className="cursor-help outline-none" opacity={activeSeries && activeSeries.run.id !== item.run.id ? 0.2 : 1}
              onPointerEnter={() => setActiveRunId(item.run.id)} onPointerLeave={() => setActiveRunId(null)}
              onFocus={() => setActiveRunId(item.run.id)} onBlur={() => setActiveRunId(null)}
              onClick={() => setActiveRunId(item.run.id)} onKeyDown={(event) => { if (event.key === "Escape") setActiveRunId(null); }}>
              {renderRun(item)}
              <path data-fatigue-hit-area="true" d={item.path ?? undefined} fill="none" stroke="transparent" strokeWidth={10} pointerEvents="stroke" />
            </g>)}
            {activeSeries && <g data-fatigue-highlight={activeSeries.run.id} pointerEvents="none" aria-hidden="true">
              {renderRun(activeSeries, true)}
            </g>}
            {!hasValues && <text x={size.width / 2} y={size.height / 2} textAnchor="middle" fill="currentColor" fontSize={12}>No health and pace data in this period</text>}
          </svg>}
          {activeSeries && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute right-4 top-12 z-10 w-52 rounded-lg border border-control-border bg-surface p-3 text-xs text-foreground shadow-md">
            <p className="mb-2 font-semibold">Run · <time dateTime={activeSeries.run.date}>{activeSeries.run.date.slice(2)}</time></p>
            <dl className="space-y-2">
              {activeSeries.points.map(({ dimension, value }) => <div key={dimension.key} className="flex items-start justify-between gap-3">
                <dt className="text-muted">{dimension.label}</dt>
                <dd className="text-right font-medium tabular-nums">{value === null ? "Not available" : `${formatValue(value, dimension)} ${dimension.unit}`}</dd>
              </div>)}
            </dl>
          </div>}
        </div>
      </div>
      <details className="mx-4 border-t border-border py-3 text-xs">
        <summary className="cursor-pointer font-medium text-brand">View health values</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <caption className="sr-only">Health measurements and pace for each run.</caption>
            <thead><tr><th scope="col" className="p-1">Date</th>{dimensions.map((dimension) => <th key={dimension.key} scope="col" className="p-1">{dimension.label} ({dimension.unit})</th>)}</tr></thead>
            <tbody>{cohort.map((run) => <tr key={run.id} className="border-t border-border"><th scope="row" className="p-1 font-medium">{run.date.slice(2)}</th>{dimensions.map((dimension) => <td key={dimension.key} className="p-1">{formatValue(metricValue(run, dimension), dimension)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
