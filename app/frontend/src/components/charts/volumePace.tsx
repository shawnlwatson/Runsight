"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { priorRunningVolume, runDistanceBands } from "@/lib/charts/priorRunningVolume";
import type { VolumeRun } from "@/lib/charts/weeklyVolume";
import { formatPace } from "@/lib/runFormatters";

type Props = { runs: readonly VolumeRun[]; fromDate?: string; toDate?: string };
const margin = { top: 16, right: 28, bottom: 52, left: 60 };

export default function VolumePace({ runs, fromDate = "", toDate = "" }: Props) {
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

  const validRange = (!fromDate || Number.isFinite(Date.parse(`${fromDate}T00:00:00Z`))) &&
    (!toDate || Number.isFinite(Date.parse(`${toDate}T00:00:00Z`))) &&
    (!fromDate || !toDate || fromDate <= toDate);
  // Calculate history first: the displayed date range must not truncate lookbacks.
  const points = priorRunningVolume(runs).filter((run) => validRange &&
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate));
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const x = scaleLinear().domain([0, Math.max(1, ...points.map((run) => run.priorMiles)) * 1.1])
    .nice().range([margin.left + 5, size.width - margin.right - 5]);
  const paces = points.map((run) => run.pace);
  const low = paces.length ? Math.min(...paces) : 6;
  const high = paces.length ? Math.max(...paces) : 14;
  const padding = Math.max(0.25, (high - low) * 0.1);
  const y = scaleLinear().domain([Math.max(0, low - padding), high + padding]).nice()
    .range([size.height - margin.bottom, margin.top]);

  return <div className="flex h-full min-h-64 flex-col">
    <div aria-label="Run distance colors" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 text-xs text-muted">
      <span>Run distance:</span>
      {runDistanceBands.map((band) => <span key={band.label} className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2.5 w-2.5" style={{ backgroundColor: band.color }} />{band.label}
      </span>)}
    </div>
    <div ref={containerRef} className="relative min-h-0 flex-1">
      {plotWidth > 0 && plotHeight > 0 && <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="group" aria-label="Prior 30-day running volume versus pace">
        <desc>Each equal-sized square represents one run in the selected date range. X is total miles during the 30 calendar days before the run, excluding its date and including available history before the selected range. Y is that run’s pace. Color groups the run’s own distance: under 3, 3 to under 4, 4 to under 5, 5 to under 6, and 6 or more miles. Excluded runs are omitted from marks and lookback totals.</desc>
        {x.ticks(Math.max(2, Math.floor(plotWidth / 80))).map((miles) => <g key={miles} transform={`translate(${x(miles)},${size.height - margin.bottom})`} pointerEvents="none">
          <line y2={6} stroke="currentColor" /><text y={22} textAnchor="middle" fill="currentColor" fontSize={11}>{miles}</text>
        </g>)}
        {y.ticks(Math.max(2, Math.floor(plotHeight / 50))).map((pace) => <g key={pace} transform={`translate(${margin.left},${y(pace)})`} pointerEvents="none">
          <line x2={-6} stroke="currentColor" /><line x2={plotWidth} className="stroke-border" />
          <text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={11}>{formatPace(pace)}</text>
        </g>)}
        <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`} fill="none" stroke="currentColor" pointerEvents="none" />
        {points.map((run, index) => {
          const description = `${run.date.slice(2)} · ${run.distanceMiles.toFixed(2)} mile run · ${formatPace(run.pace)} min/mi · Prior 30 days: ${run.priorMiles.toFixed(2)} miles`;
          return <rect key={run.id ?? `${run.date}-${index}`} data-volume-run="true" data-run-id={run.id}
            data-prior-miles={run.priorMiles} data-distance-band={run.band.label}
            x={x(run.priorMiles) - 4} y={y(run.pace) - 4} width={8} height={8}
            fill={run.band.color} tabIndex={0} role="graphics-symbol" aria-label={description}
            className="stroke-surface focus:stroke-chart-navy focus:stroke-2 focus:outline-none" strokeWidth={1}>
            <title>{description}</title>
          </rect>;
        })}
        <text x={margin.left + plotWidth / 2} y={size.height - 8} textAnchor="middle" fill="currentColor" fontSize={12}>Prior 30-day running volume (miles)</text>
        <text transform={`translate(12,${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={12}>Pace (min/mile)</text>
        {!points.length && <text x={margin.left + plotWidth / 2} y={margin.top + plotHeight / 2} textAnchor="middle" fill="currentColor" fontSize={12}>{validRange ? "No runs with distance and pace data in this period" : "Choose a valid date range"}</text>}
      </svg>}
    </div>
  </div>;
}
