"use client";

import { useEffect, useId, useRef, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { parsePaceInput, temperatureHeartRateSummary, type TemperaturePaceRun } from "@/lib/charts/temperatureHeartRate";

type Props = { runs: readonly TemperaturePaceRun[] };
const margin = { top: 24, right: 16, bottom: 48, left: 56 };

export default function TemperatureHeartRateByPace({ runs }: Props) {
  const [minimumPace, setMinimumPace] = useState("9:00");
  const [maximumPace, setMaximumPace] = useState("9:30");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const errorId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const min = parsePaceInput(minimumPace);
  const max = parsePaceInput(maximumPace);
  const error = min === null || max === null ? "Enter both paces as m:ss (for example, 9:00)."
    : min > max ? "The starting pace must be less than or equal to the ending pace." : null;
  const groups = temperatureHeartRateSummary(runs, min ?? NaN, max ?? NaN);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = plotWidth > 0 && plotHeight > 0;
  const x = scaleBand().domain(groups.map((group) => group.id)).range([margin.left, size.width - margin.right]).padding(0.35);
  const y = scaleLinear().domain([0, Math.max(100, ...groups.map((group) => (group.averageHeartRate ?? 0) * 1.18))]).nice()
    .range([size.height - margin.bottom, margin.top]);

  return <div className="flex h-full min-h-64 flex-col">
    <div className="shrink-0 space-y-1 px-4 pt-3">
      <h2 className="text-base font-semibold text-foreground">Heart Rate by Temperature</h2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
        <span className="font-medium">Average run pace:</span>
        <label className="inline-flex items-center gap-1">From
          <input aria-label="Minimum average pace" aria-invalid={!!error} aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
            type="text" value={minimumPace} onChange={(event) => setMinimumPace(event.target.value)} placeholder="9:00" maxLength={6}
            className="w-16 rounded border border-control-border bg-surface px-2 py-1 tabular-nums focus-visible:outline-2 focus-visible:outline-brand" />
        </label>
        <label className="inline-flex items-center gap-1">To
          <input aria-label="Maximum average pace" aria-invalid={!!error} aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
            type="text" value={maximumPace} onChange={(event) => setMaximumPace(event.target.value)} placeholder="9:30" maxLength={6}
            className="w-16 rounded border border-control-border bg-surface px-2 py-1 tabular-nums focus-visible:outline-2 focus-visible:outline-brand" />
        </label>
        <span className="text-muted">min/mi</span>
      </div>
      <p id={helpId} className="text-[10px] text-muted">Mean heart rate per run · temperature bands include the lower bound · {total} matching {total === 1 ? "run" : "runs"}</p>
      {error && <p id={errorId} role="alert" className="text-xs text-foreground">{error}</p>}
    </div>
    <div ref={containerRef} className="relative min-h-0 flex-1">
      {ready && <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="group" aria-label="Average heart rate by temperature for runs in the selected pace range">
        <desc>Four temperature groups show the arithmetic mean of average run heart rates, with one equal contribution per run. Only runs within the entered pace range and the page date selection are included. Counts appear below each temperature group. Empty groups have no bar.</desc>
        {y.ticks(Math.max(2, Math.floor(plotHeight / 40))).map((value) => <g key={value} transform={`translate(${margin.left},${y(value)})`}>
          <line x2={plotWidth} className="stroke-border" /><text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={10}>{value}</text>
        </g>)}
        <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`} fill="none" stroke="currentColor" />
        {groups.map((group) => {
          const left = x(group.id)!;
          const center = left + x.bandwidth() / 2;
          return <g key={group.id} data-temperature-group={group.id} data-run-count={group.count} data-average-heart-rate={group.averageHeartRate ?? ""}>
            {!error && group.averageHeartRate !== null && <>
              <rect x={left} y={y(group.averageHeartRate)} width={x.bandwidth()} height={y(0) - y(group.averageHeartRate)} rx={2} fill={group.color}
                tabIndex={0} role="graphics-symbol" aria-label={`${group.label}: ${group.averageHeartRate.toFixed(1)} bpm, ${group.count} runs`}
                className="stroke-chart-teal/50 focus:stroke-chart-berry focus:stroke-2 focus:outline-none">
                <title>{`${group.label}: ${group.averageHeartRate.toFixed(1)} bpm average heart rate · ${group.count} runs · pace ${minimumPace}–${maximumPace} min/mi`}</title>
              </rect>
              <text x={center} y={y(group.averageHeartRate) - 6} textAnchor="middle" fill="currentColor" fontSize={11}>{group.averageHeartRate.toFixed(1)}</text>
            </>}
            <text x={center} y={size.height - margin.bottom + 17} textAnchor="middle" fill="currentColor" fontSize={11}>{group.label}</text>
            <text x={center} y={size.height - margin.bottom + 32} textAnchor="middle" fill="currentColor" fontSize={10}>{group.count ? `${group.count} ${group.count === 1 ? "run" : "runs"}` : "No runs"}</text>
          </g>;
        })}
        <text transform={`translate(13,${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={11}>Avg heart rate (bpm)</text>
        {!error && !total && <text x={margin.left + plotWidth / 2} y={margin.top + plotHeight / 2} textAnchor="middle" fill="currentColor" fontSize={11}>No runs match this pace range and date selection</text>}
      </svg>}
    </div>
  </div>;
}
