"use client";

import { useEffect, useId, useRef, useState } from "react";
import { scaleLinear, scaleSequential, scaleSqrt } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import { line } from "d3-shape";
import { weeklyVolume, type VolumeRun, type WeeklyVolume } from "@/lib/charts/weeklyVolume";
import { formatPace } from "@/lib/runFormatters";

type Props = { runs: readonly VolumeRun[]; fromDate?: string; toDate?: string };
const margin = { top: 28, right: 28, bottom: 52, left: 60 };
const dateLabel = (time: number) => new Date(time).toISOString().slice(2, 10);

export default function VolumePace({ runs, fromDate = "", toDate = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
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

  const weeks = weeklyVolume(runs, fromDate, toDate);
  const points = weeks.filter((week): week is WeeklyVolume & { pace: number } => week.pace !== null);
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...points.map((week) => week.runCount));
  // Circle area is proportional to run count.
  const radius = scaleSqrt().domain([0, maxCount]).range([0, 14]);
  const x = scaleLinear().domain([0, Math.max(1, ...points.map((week) => week.miles)) * 1.1])
    .nice().range([margin.left + 16, size.width - margin.right - 16]);
  const paces = points.map((week) => week.pace);
  const low = paces.length ? Math.min(...paces) : 6;
  const high = paces.length ? Math.max(...paces) : 14;
  const padding = Math.max(0.25, (high - low) * 0.1);
  const y = scaleLinear().domain([Math.max(0, low - padding), high + padding]).nice()
    .range([size.height - margin.bottom - 16, margin.top + 16]);
  const first = points[0]?.weekStart ?? 0;
  const last = points.at(-1)?.weekStart ?? first;
  const color = scaleSequential(interpolateViridis).domain([first, last]);
  const connection = line<WeeklyVolume>().defined((week) => week.pace !== null)
    .x((week) => x(week.miles)).y((week) => y(week.pace!))(weeks);

  return (
    <div className="flex h-full min-h-64 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-2 text-xs text-muted">
        <span>Mark area: weekly run count</span>
        {points.length > 0 && <span className="flex items-center gap-2" aria-label={`Week dates from ${dateLabel(first)} to ${dateLabel(last)}`}>
          {dateLabel(first)}
          <svg width={80} height={10} aria-hidden="true">
            <defs><linearGradient id={gradientId}>
              {Array.from({ length: 11 }, (_, i) => <stop key={i} offset={`${i * 10}%`} stopColor={first === last ? interpolateViridis(0.5) : interpolateViridis(i / 10)} />)}
            </linearGradient></defs>
            <rect width={80} height={10} rx={2} fill={`url(#${gradientId})`} />
          </svg>
          {dateLabel(last)}
        </span>}
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {plotWidth > 0 && plotHeight > 0 && <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="img" aria-label="Weekly volume versus pace">
          <desc>Monday–Sunday weeks connected in date order. X shows weekly miles, Y shows distance-weighted pace. Circle area shows run count and Viridis color progresses from earliest to latest week.</desc>
          <path data-week-connection="true" d={connection ?? undefined} fill="none" stroke="#d1d5db" strokeWidth={1.25} />
          {points.map((week) => <circle key={week.weekStart} data-volume-week="true"
            cx={x(week.miles)} cy={y(week.pace)} r={radius(week.runCount)}
            fill={color(week.weekStart)} className="stroke-surface" strokeWidth={1.5}>
            <title>{`Week of ${dateLabel(week.weekStart)} · ${week.runCount} runs · ${week.miles.toFixed(2)} miles · ${formatPace(week.pace)} min/mi${week.paceMiles < week.miles ? ` · Pace available for ${week.paceMiles.toFixed(2)} miles` : ""}`}</title>
          </circle>)}
          <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`} fill="none" stroke="currentColor" />
          {x.ticks(Math.max(2, Math.floor(plotWidth / 80))).map((miles) => <g key={miles} transform={`translate(${x(miles)},${size.height - margin.bottom})`}>
            <line y2={6} stroke="currentColor" /><text y={22} textAnchor="middle" fill="currentColor" fontSize={11}>{miles}</text>
          </g>)}
          {y.ticks(Math.max(2, Math.floor(plotHeight / 50))).map((pace) => <g key={pace} transform={`translate(${margin.left},${y(pace)})`}>
            <line x2={-6} stroke="currentColor" /><text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={11}>{formatPace(pace)}</text>
          </g>)}
          <text x={margin.left + plotWidth / 2} y={size.height - 8} textAnchor="middle" fill="currentColor" fontSize={12}>Weekly distance (miles)</text>
          <text transform={`translate(12,${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={12}>Pace (min/mile)</text>
          {!points.length && <text x={margin.left + plotWidth / 2} y={margin.top + plotHeight / 2} textAnchor="middle" fill="currentColor" fontSize={12}>No weekly distance and pace data in this period</text>}
        </svg>}
      </div>
    </div>
  );
}
