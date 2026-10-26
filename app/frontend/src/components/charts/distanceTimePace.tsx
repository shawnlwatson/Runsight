"use client";

import { useEffect, useId, useRef, useState } from "react";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import { paceStatistics } from "@/lib/charts/paceStatistics";
import { distancePaceBoxplots } from "@/lib/charts/distancePaceBoxplots";
import { formatPace } from "@/lib/runFormatters";

type Run = {
  date: string; // Calendar date: YYYY-MM-DD
  id?: string;
  pace: number | null; // Minutes per mile
  distanceMiles?: number | null;
};

type Props = { runs: Run[]; fromDate: string; toDate: string };
const margin = { top: 16, right: 24, bottom: 48, left: 56 };
const dateLabel = (time: number) => new Date(time).toISOString().slice(2, 10);

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export default function DistanceTimePace({ runs, fromDate, toDate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();
  const tooltipId = useId();
  const [activeBox, setActiveBox] = useState<string | null>(null);
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
  const points = runs.map((run) => ({ ...run, time: parseDay(run.date) }))
    .filter((run): run is typeof run & { pace: number; distanceMiles: number } =>
      validRange && Number.isFinite(run.time) && run.time >= start && run.time <= end &&
      run.pace !== null && Number.isFinite(run.pace) && run.pace > 0 &&
      typeof run.distanceMiles === "number" && Number.isFinite(run.distanceMiles) && run.distanceMiles >= 0,
    ).sort((a, b) => a.time - b.time);

  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = plotWidth > 0 && plotHeight > 0;
  const boxes = distancePaceBoxplots(points);
  const selectedBox = boxes.find((box) => box.id === activeBox);
  const x = scaleLinear().domain([0, Math.max(1, ...points.map((run) => run.distanceMiles), ...boxes.map((box) => box.center + 0.2)) * 1.1])
    .nice().range([margin.left, size.width - margin.right]);
  const paces = points.map((run) => run.pace);
  const low = paces.length ? Math.min(...paces) : 6;
  const high = paces.length ? Math.max(...paces) : 14;
  const padding = Math.max((high - low) * 0.1, 0.25);
  const y = scaleLinear().domain([Math.max(0, low - padding), high + padding]).nice()
    .range([size.height - margin.bottom, margin.top]);
  // Match the other pace scatterplots: each plotted run contributes equally.
  const meanPace = paceStatistics(paces).mean;
  const first = points[0]?.time ?? 0;
  const last = points.at(-1)?.time ?? first;
  const color = scaleSequential(interpolateViridis).domain([first, last]);
  const boxWidth = Math.max(10, Math.min(28, x(0.4) - x(0)));
  const renderBoxShape = (box: (typeof boxes)[number]) => <>
    <line x1={x(box.center)} x2={x(box.center)} y1={y(box.lower)} y2={y(box.upper)} className="stroke-chart-teal" strokeWidth={1.5} />
    {[box.lower, box.upper].map((value, i) => <line key={i} x1={x(box.center) - boxWidth / 3} x2={x(box.center) + boxWidth / 3} y1={y(value)} y2={y(value)} className="stroke-chart-teal" strokeWidth={2} />)}
    <rect x={x(box.center) - boxWidth / 2} y={y(box.q3) - (box.q3 === box.q1 ? 1 : 0)} width={boxWidth} height={Math.max(2, y(box.q1) - y(box.q3))} className="fill-chart-teal stroke-chart-teal" strokeWidth={1.5} />
    <line x1={x(box.center) - boxWidth / 2} x2={x(box.center) + boxWidth / 2} y1={y(box.median)} y2={y(box.median)} className="stroke-surface" strokeWidth={2} />
  </>;

  return (
    <div className="flex h-full min-h-64 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-2">
          <svg width={20} height={8} aria-hidden="true"><line x2={20} y1={4} y2={4} className="stroke-chart-teal" strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" /></svg>
          Mean pace{meanPace !== null ? `: ${formatPace(meanPace)} min/mi` : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width={12} height={14} aria-hidden="true"><rect x={2} y={2} width={8} height={10} className="fill-chart-teal stroke-chart-teal" fillOpacity={0.25} /></svg>
          Pace quartiles
        </span></div>
        {points.length > 0 && <span className="flex items-center gap-2" aria-label={`Run dates from ${dateLabel(first)} to ${dateLabel(last)}`}>
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
        {ready && <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="group" aria-label="Distance versus pace, colored by run date"
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const px = event.clientX - bounds.left;
            const py = event.clientY - bounds.top;
            const hovered = boxes.find((box) => {
              const top = Math.min(y(box.upper), y(box.median) - 12);
              return Math.abs(px - x(box.center)) <= Math.max(24, boxWidth) / 2 &&
                py >= top && py <= top + Math.max(24, y(box.lower) - y(box.upper));
            });
            setActiveBox(hovered?.id ?? null);
          }} onPointerLeave={() => setActiveBox(null)}>
          <desc>Each point is one run: distance in miles on the horizontal axis and pace in minutes per mile on the vertical axis. Viridis color progresses from earliest to latest run date. The dotted horizontal line shows the arithmetic mean pace across plotted runs. Hover or focus a distance-group boxplot for pace quartiles and whiskers. Whiskers show observed values within 1.5 times the interquartile range; all runs remain visible as scatter points.</desc>
          <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`} fill="none" stroke="currentColor" pointerEvents="none" />
          {x.ticks(Math.max(2, Math.floor(plotWidth / 70))).map((distance) => <g key={distance} transform={`translate(${x(distance)},${size.height - margin.bottom})`} pointerEvents="none">
            <line y2={6} stroke="currentColor" /><text y={20} textAnchor="middle" fill="currentColor" fontSize={11}>{distance}</text>
          </g>)}
          {y.ticks(Math.max(2, Math.floor(plotHeight / 45))).map((pace) => <g key={pace} transform={`translate(${margin.left},${y(pace)})`} pointerEvents="none">
            <line x2={-6} stroke="currentColor" /><text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={11}>{formatPace(pace)}</text>
          </g>)}
          {boxes.map((box) => <g key={box.id} data-distance-pace-box={box.id}
            data-run-count={box.count} data-median={box.median}
            tabIndex={0} role="graphics-symbol" aria-label={`${box.label}: ${box.count} runs, median pace ${formatPace(box.median)} min/mi`}
            aria-describedby={selectedBox?.id === box.id ? tooltipId : undefined}
            opacity={activeBox === box.id ? 1 : 0.25}
            className="cursor-help outline-none"
            onFocus={() => setActiveBox(box.id)} onBlur={() => setActiveBox(null)}
            onClick={() => setActiveBox(box.id)} onKeyDown={(event) => { if (event.key === "Escape") setActiveBox(null); }}>
            {renderBoxShape(box)}
            <rect data-box-hit-area="true" x={x(box.center) - Math.max(24, boxWidth) / 2} y={Math.min(y(box.upper), y(box.median) - 12)} width={Math.max(24, boxWidth)} height={Math.max(24, y(box.lower) - y(box.upper))} fill="transparent" />
          </g>)}
          {meanPace !== null && <line data-distance-pace-mean={meanPace} x1={margin.left} x2={size.width - margin.right} y1={y(meanPace)} y2={y(meanPace)} className="stroke-chart-teal" strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" pointerEvents="none">
            <title>{`Mean pace: ${formatPace(meanPace)} min/mi across ${points.length} runs`}</title>
          </line>}
          {points.map((run, index) => <circle key={run.id ?? `${run.date}-${index}`} data-distance-pace-run="true" data-run-id={run.id}
            cx={x(run.distanceMiles)} cy={y(run.pace)} r={4} fill={color(run.time)} className="stroke-surface" strokeWidth={1}>
            <title>{`${run.date.slice(2)} · ${run.distanceMiles.toFixed(2)} miles · ${formatPace(run.pace)} min/mi`}</title>
          </circle>)}
          {selectedBox && <g data-distance-pace-box-overlay={selectedBox.id} opacity={1} pointerEvents="none" aria-hidden="true">
            {renderBoxShape(selectedBox)}
          </g>}
          <text x={margin.left + plotWidth / 2} y={size.height - 6} textAnchor="middle" fill="currentColor" fontSize={12}>Distance (miles)</text>
          <text transform={`translate(10,${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="currentColor" fontSize={12}>Pace (min/mile)</text>
          {!points.length && <text x={margin.left + plotWidth / 2} y={margin.top + plotHeight / 2} textAnchor="middle" fill="currentColor" fontSize={12}>
            {validRange ? "No distance and pace data in this period" : "Choose a valid date range"}
          </text>}
        </svg>}
        {ready && selectedBox && <div id={tooltipId} role="tooltip" className="pointer-events-none absolute z-10 w-48 rounded-md border border-control-border bg-surface p-2 text-xs text-foreground shadow-md"
          style={{ left: Math.max(0, Math.min(size.width - 192, x(selectedBox.center) + boxWidth)), top: 4 }}>
          <p className="font-semibold">{selectedBox.label}</p>
          <p className="mb-1 text-muted">{selectedBox.count} runs · pace in min/mi</p>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 tabular-nums">
            {([
              ["Upper whisker", selectedBox.upper], ["Q3 (75%)", selectedBox.q3],
              ["Median", selectedBox.median], ["Q1 (25%)", selectedBox.q1],
              ["Lower whisker", selectedBox.lower], ["Minimum", selectedBox.min], ["Maximum", selectedBox.max],
            ] as const).map(([label, value]) => <div key={label} className="contents"><dt>{label}</dt><dd className="text-right">{formatPace(value)}</dd></div>)}
          </dl>
          <p className="mt-1 text-[10px] text-muted">Whiskers: 1.5 × IQR · {selectedBox.outliers} outside</p>
        </div>}
      </div>
    </div>
  );
}
