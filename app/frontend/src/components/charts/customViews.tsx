"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import { radarDomain, radarMetrics, radarValue } from "@/lib/charts/radarMetrics";
import { formatNumber, formatPace, formatTotalTime } from "@/lib/runFormatters";
import type { CurrentRun } from "@/types/run";
import { customViewAttributes as attributes } from "@/lib/charts/customViewAttributes";

type Props = {
  runs: readonly CurrentRun[];
  fromDate?: string;
  toDate?: string;
};

const DAY = 86_400_000;
const margin = { top: 20, right: 66, bottom: 38, left: 60 };
const colors = ["#18435a", "#c9a654", "#89023e", "#de643f", "#2563eb", "#9333ea", "#15803d", "#0891b2", "#b45309", "#526775"];
const dashes = [undefined, "7 3", undefined, "3 3", "9 3 2 3", "7 3", "3 3", "9 3 2 3", "12 4", "2 4"];

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

function formatMetric(value: number | null, index: number) {
  const metric = radarMetrics[index];
  if (metric.format === "time") return formatTotalTime(value);
  if (metric.format === "pace") return formatPace(value);
  return formatNumber(value, 1);
}

export default function CustomViews({ runs, fromDate = "", toDate = "" }: Props) {
  const [enabled, setEnabled] = useState<string[]>(["pace"]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setSize({
      width: entry.contentRect.width, height: entry.contentRect.height,
    }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const dated = runs.map((run) => ({ run, time: parseDay(run.date) }))
    .filter(({ time }) => Number.isFinite(time)).sort((a, b) => a.time - b.time);
  const start = fromDate ? parseDay(fromDate) : dated[0]?.time ?? NaN;
  const end = toDate ? parseDay(toDate) : dated.at(-1)?.time ?? NaN;
  const validRange = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  const cohort = validRange ? dated.filter(({ time }) => time >= start && time <= end) : [];
  const cohortRuns = cohort.map(({ run }) => run);
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = validRange && plotWidth > 0 && plotHeight > 0;
  const x = scaleUtc().domain([new Date(start), new Date(end + DAY)])
    .range([margin.left, size.width - margin.right]);
  const paces = cohortRuns.map((run) => radarValue(run, radarMetrics[2]))
    .filter((value): value is number => value !== null);
  const low = paces.length ? Math.min(...paces) : 6;
  const high = paces.length ? Math.max(...paces) : 14;
  const padding = Math.max(0.25, (high - low) * 0.1);
  const paceY = scaleLinear().domain([Math.max(0, low - padding), high + padding]).nice()
    .range([size.height - margin.bottom, margin.top]);
  const normalizedY = scaleLinear().domain([0, 100])
    .range([size.height - margin.bottom, margin.top]);
  // Domains use every run in the date cohort and stay fixed when toggling lines.
  const series = attributes.map(({ metric, index }) => {
    const scale = scaleLinear().domain(radarDomain(cohortRuns, metric)).nice(4).range([0, 100]);
    const points = cohort.map(({ run, time }) => ({ run, time, value: radarValue(run, metric) }));
    const path = line<typeof points[number]>().defined((point) => point.value !== null)
      .x((point) => x(new Date(point.time + DAY / 2)))
      .y((point) => metric.key === "pace" ? paceY(point.value!) : normalizedY(scale(point.value!)))(points);
    return { metric, index, points, path, scale };
  });
  const activeSeries = series.filter(({ metric }) => enabled.includes(metric.key));
  const hasOtherLines = activeSeries.some(({ metric }) => metric.key !== "pace");
  const hasValues = activeSeries.some(({ points }) => points.some(({ value }) => value !== null));
  const xTicks = ready ? x.ticks(Math.max(2, Math.floor(plotWidth / 100)))
    .filter((date) => date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) : [];

  return (
    <div className="min-w-0">
      <header className="px-4 pt-4">
        <h2 className="text-base font-semibold text-foreground">Custom Views</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Pace uses the left axis. Other lines use the right axis: 0–100% of each attribute’s own scale, not percent change. Hover over marks for actual values.
        </p>
      </header>
      <fieldset className="m-4 flex flex-wrap gap-x-5 gap-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium text-foreground">Show attributes</legend>
        {attributes.map(({ metric, index }) => <label key={metric.key} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={enabled.includes(metric.key)}
            onChange={(event) => setEnabled((current) => event.target.checked ? [...current, metric.key] : current.filter((key) => key !== metric.key))}
            className="h-4 w-4 accent-brand" />
          <svg width={20} height={8} aria-hidden="true"><line x2={20} y1={4} y2={4} stroke={colors[index]} strokeWidth={2.5} strokeDasharray={dashes[index]} /></svg>
          {metric.label}
        </label>)}
      </fieldset>
      <div ref={containerRef} className="relative h-80 w-full">
        {ready && <svg width={size.width} height={size.height} role="img" aria-label="Custom running attributes over time" className="absolute inset-0 text-muted">
          <desc>Run dates on the horizontal axis. Pace is in minutes per mile on the left axis. Other attributes each have independent normalized scales on the right. Missing values leave gaps. Toggle attributes using the checkboxes above.</desc>
          <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`} fill="none" stroke="currentColor" />
          {xTicks.map((date) => <g key={date.getTime()} transform={`translate(${x(date)},${size.height - margin.bottom})`}>
            <line y2={6} stroke="currentColor" /><text y={22} textAnchor="middle" fill="currentColor" fontSize={11}>{date.toISOString().slice(2, 10)}</text>
          </g>)}
          {paceY.ticks(Math.max(2, Math.floor(plotHeight / 50))).map((pace) => <g key={pace} transform={`translate(${margin.left},${paceY(pace)})`}>
            <line x2={-6} stroke="currentColor" /><text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={11}>{formatPace(pace)}</text>
          </g>)}
          <text transform={`translate(12,${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={12}>Pace (min/mile)</text>
          {hasOtherLines && <g>
            <line x1={size.width - margin.right} x2={size.width - margin.right} y1={margin.top} y2={size.height - margin.bottom} stroke="currentColor" />
            {[0, 25, 50, 75, 100].map((value) => <g key={value} transform={`translate(${size.width - margin.right},${normalizedY(value)})`}>
              <line x2={6} stroke="currentColor" /><text x={9} dy="0.32em" fill="currentColor" fontSize={10}>{value}%</text>
            </g>)}
            <text transform={`translate(${size.width - 8},${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={11}>Attribute scale</text>
          </g>}
          {activeSeries.map(({ metric, index, points, path, scale }) => <g key={metric.key} data-custom-series={metric.key}>
            <path d={path ?? undefined} fill="none" stroke={colors[index]} strokeWidth={2} strokeDasharray={dashes[index]} />
            {points.map(({ run, time, value }) => value !== null && <circle key={run.id} data-custom-point={metric.key}
              cx={x(new Date(time + DAY / 2))} cy={metric.key === "pace" ? paceY(value) : normalizedY(scale(value))}
              r={4} fill={colors[index]} className="stroke-surface" strokeWidth={1.5}>
              <title>{`${run.date.slice(2)} · ${metric.label}: ${formatMetric(value, index)} ${metric.unit}`}</title>
            </circle>)}
          </g>)}
        </svg>}
        {(!ready || !hasValues) && <p role="status" className="absolute inset-0 flex items-center justify-center px-16 text-center text-sm text-muted">
          {!enabled.length ? "Select an attribute above to show its line." : !validRange ? "Select dates or supply run data." : !ready ? "Waiting for container space" : "No data for the selected attributes in this period."}
        </p>}
      </div>
      <details className="mx-4 border-t border-border py-3 text-xs">
        <summary className="cursor-pointer font-medium text-brand">View attribute scales</summary>
        <p className="my-2 text-muted">Scales use the selected date range. Lines with different units share a viewing area; their heights cannot be compared as actual values.</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-foreground">
          {activeSeries.map(({ metric, index, scale, points }) => <li key={metric.key}>
            <strong>{metric.label}: </strong>
            {metric.key === "pace" ? `${formatPace(paceY.domain()[0])}–${formatPace(paceY.domain()[1])}` : `${formatMetric(scale.domain()[0], index)}–${formatMetric(scale.domain()[1], index)}`} {metric.unit}
            {!points.some(({ value }) => value !== null) && " (no data)"}
          </li>)}
        </ul>
      </details>
    </div>
  );
}
