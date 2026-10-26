"use client";

import { useEffect, useId, useRef, useState } from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { radarDomain, radarValue } from "@/lib/charts/radarMetrics";
import { formatNumber, formatPace, formatTotalTime } from "@/lib/runFormatters";
import { chartColors, chartDashes } from "@/lib/charts/chartTheme";
import type { CurrentRun } from "@/types/run";
import { customViewAttributes as attributes } from "@/lib/charts/customViewAttributes";

type Props = { runs: readonly CurrentRun[]; fromDate?: string; toDate?: string };
type Metric = (typeof attributes)[number]["metric"];
const margin = { top: 48, right: 48, bottom: 24, left: 64 };

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

function formatMetric(value: number | null, metric: Metric) {
  if (metric.format === "time") return formatTotalTime(value);
  if (metric.format === "pace") return formatPace(value);
  return formatNumber(value, metric.key === "calories" || metric.key === "elevation" ? 0 : 1);
}

export default function CustomViews({ runs, fromDate = "", toDate = "" }: Props) {
  const [enabled, setEnabled] = useState<string[]>(["distance", "pace"]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
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
  const validRange = !Number.isNaN(start) && !Number.isNaN(end) && end >= start;
  const cohort = runs.filter((run) => {
    const time = parseDay(run.date);
    return validRange && Number.isFinite(time) && time >= start && time <= end;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const selectedAttributes = attributes.filter(({ metric }) => enabled.includes(metric.key));
  const x = scalePoint<string>().domain(selectedAttributes.map(({ metric }) => metric.key))
    .range([margin.left, size.width - margin.right]);
  // Full-cohort domains keep existing axes stable when another axis is toggled.
  const axes = selectedAttributes.map(({ metric }) => {
    const values = cohort.map((run) => radarValue(run, metric)).filter((value): value is number => value !== null);
    let domain = radarDomain(cohort, metric);
    if (values.length) {
      const low = Math.min(...values);
      const high = Math.max(...values);
      const padding = Math.max((high - low) * 0.1, Math.abs(high) * 0.02, 0.25);
      domain = [metric.key === "temperature" ? low - padding : Math.max(0, low - padding), high + padding];
    }
    const y = scaleLinear().domain(domain).nice(4).range([size.height - margin.bottom, margin.top]);
    return { metric, y, hasValues: values.length > 0 };
  });
  const series = cohort.map((run, index) => {
    const points = axes.map(({ metric, y }) => {
      const value = radarValue(run, metric);
      return { metric, value, x: x(metric.key)!, y: value === null ? 0 : y(value) };
    });
    const path = line<(typeof points)[number]>().defined((point) => point.value !== null)
      .x((point) => point.x).y((point) => point.y)(points);
    return { run, points, path, color: chartColors[index % chartColors.length], dash: chartDashes[index % chartDashes.length] };
  });
  const hasValues = series.some(({ points }) => points.some(({ value }) => value !== null));
  const activeSeries = series.find(({ run }) => run.id === activeRunId);
  const ready = size.width > margin.left + margin.right && size.height > margin.top + margin.bottom;
  const renderRun = ({ points, path, color, dash }: (typeof series)[number], highlighted = false) => <>
    <path d={path ?? undefined} fill="none" stroke={color} strokeWidth={highlighted ? 4 : 1.5} strokeOpacity={highlighted ? 1 : 0.6} strokeDasharray={dash} />
    {points.map(({ metric, value, x, y }) => value !== null && <circle key={metric.key} data-custom-point={metric.key}
      cx={x} cy={y} r={highlighted ? 6 : 3.5} fill={color} className="stroke-surface" strokeWidth={highlighted ? 2 : 1} />)}
  </>;

  return <div className="min-w-0">
    <header className="px-4 pt-4">
      <h2 className="text-base font-semibold text-foreground">Custom Views</h2>
      <p className="mt-1 text-xs leading-5 text-muted">One line per run. Select two to nine attributes to add vertical axes. Each axis has its own units and scale; higher means a larger value. Hover or focus a line to see all selected metrics.</p>
    </header>
    <fieldset className="m-4 flex flex-wrap gap-x-5 gap-y-3 rounded-lg border border-border p-3" aria-describedby={`${tooltipId}-selection`}>
      <legend className="px-1 text-sm font-medium text-foreground">Show attributes</legend>
      {attributes.map(({ metric }) => <label key={metric.key} className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={enabled.includes(metric.key)} disabled={enabled.length <= 2 && enabled.includes(metric.key)}
          onChange={(event) => setEnabled((current) => event.target.checked ? [...current, metric.key] : current.length > 2 ? current.filter((key) => key !== metric.key) : current)}
          className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-default" />
        {metric.label}
      </label>)}
    </fieldset>
    <p id={`${tooltipId}-selection`} className="px-4 pb-3 text-[11px] text-muted">{enabled.length} of 9 axes selected. Keep at least two selected. Missing values leave gaps; scroll horizontally when needed.</p>
    <div className="relative">
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative h-96 w-full" style={{ minWidth: Math.max(360, selectedAttributes.length * 128) }}>
          {ready && <svg width={size.width} height={size.height} role="group" aria-label="Custom running attributes parallel coordinates" className="absolute inset-0 text-muted">
            <desc>Each run connects the selected vertical attribute axes in their original order. Each axis uses actual values and its own scale. Hover or focus a run to highlight its whole line and show all selected values, including unavailable measurements.</desc>
            {axes.map(({ metric, y }) => <g key={metric.key} data-custom-axis={metric.key} transform={`translate(${x(metric.key)},0)`}>
              <line y1={margin.top} y2={size.height - margin.bottom} stroke="currentColor" opacity={0.5} />
              <text y={17} textAnchor="middle" fontSize={11} className="fill-foreground" fontWeight={600}>{metric.label}</text>
              <text y={32} textAnchor="middle" fontSize={10} fill="currentColor">{metric.unit}</text>
              {y.ticks(4).map((value) => <g key={value} transform={`translate(0,${y(value)})`}>
                <line x2={-4} stroke="currentColor" /><text x={-7} dy="0.32em" textAnchor="end" fontSize={10} fill="currentColor">{formatMetric(value, metric)}</text>
              </g>)}
            </g>)}
            {series.map((item) => <g key={item.run.id} data-custom-run={item.run.id}
              tabIndex={item.points.some(({ value }) => value !== null) ? 0 : undefined} role="graphics-symbol"
              aria-label={`${item.run.date.slice(2)} · ${item.points.map(({ metric, value }) => `${metric.label}: ${value === null ? "Not available" : `${formatMetric(value, metric)} ${metric.unit}`}`).join(" · ")}`}
              aria-describedby={activeSeries?.run.id === item.run.id ? tooltipId : undefined}
              opacity={activeSeries && activeSeries.run.id !== item.run.id ? 0.2 : 1} className="cursor-help outline-none"
              onPointerEnter={() => setActiveRunId(item.run.id)} onPointerLeave={() => setActiveRunId(null)}
              onFocus={() => setActiveRunId(item.run.id)} onBlur={() => setActiveRunId(null)}
              onClick={() => setActiveRunId(item.run.id)} onKeyDown={(event) => { if (event.key === "Escape") setActiveRunId(null); }}>
              {renderRun(item)}
              <path data-custom-hit-area="true" d={item.path ?? undefined} fill="none" stroke="transparent" strokeWidth={10} pointerEvents="stroke" />
            </g>)}
            {activeSeries && <g data-custom-highlight={activeSeries.run.id} pointerEvents="none" aria-hidden="true">{renderRun(activeSeries, true)}</g>}
          </svg>}
          {(!ready || !hasValues) && <p role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center px-16 text-center text-sm text-muted">
            {!validRange ? "Choose a valid date range." : !ready ? "Waiting for container space" : "No data for the selected attributes in this period."}
          </p>}
        </div>
      </div>
      {activeSeries && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute right-4 top-12 z-10 w-60 max-w-[calc(100%-2rem)] rounded-lg border border-control-border bg-surface p-3 text-xs text-foreground shadow-md">
        <p className="mb-2 font-semibold">Run · <time dateTime={activeSeries.run.date}>{activeSeries.run.date.slice(2)}</time></p>
        <dl className="space-y-2">
          {activeSeries.points.map(({ metric, value }) => <div key={metric.key} className="flex items-start justify-between gap-3">
            <dt className="text-muted">{metric.label}</dt>
            <dd className="text-right font-medium tabular-nums">{value === null ? "Not available" : `${formatMetric(value, metric)} ${metric.unit}`}</dd>
          </div>)}
        </dl>
      </div>}
    </div>
    <details className="mx-4 border-t border-border py-3 text-xs">
      <summary className="cursor-pointer font-medium text-brand">View attribute scales</summary>
      <p className="my-2 text-muted">Scales fit the selected date range and excluded-run settings. Toggling an attribute keeps the other scales fixed. Equal heights on different axes do not mean equal values.</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-foreground">
        {axes.map(({ metric, y, hasValues }) => <li key={metric.key}><strong>{metric.label}: </strong>
          {formatMetric(y.domain()[0], metric)}–{formatMetric(y.domain()[1], metric)} {metric.unit}{!hasValues && " (no data)"}
        </li>)}
      </ul>
    </details>
  </div>;
}
