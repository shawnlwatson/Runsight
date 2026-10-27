"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { area, line } from "d3-shape";
import { rollingPaceStatistics } from "@/lib/charts/rollingPaceStatistics";

type Run = {
  date: string; // Calendar date: YYYY-MM-DD
  id?: string;
  pace: number | null; // Pace in minutes per mile
};

type Props<T extends Run> = {
  runs: T[];
  onSelectRun?: (run: T) => void;
  fromDate: string;
  toDate: string;
};

const DAY = 86_400_000; // Number of milliseconds in a day
const margin = { top: 24, right: 24, bottom: 36, left: 56 };

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);

  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN;
}

function formatPace(value: number) {
  const seconds = Math.round(value * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PaceTime<T extends Run>({
  runs,
  fromDate,
  toDate,
  onSelectRun,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const datedRuns = runs
    .map((run) => ({ ...run, time: parseDay(run.date) }))
    .filter((run) => Number.isFinite(run.time));

  const dates = datedRuns.map((run) => run.time);
  const start = fromDate
  ? parseDay(fromDate)
  : dates.length ? Math.min(...dates) : NaN;
  const end = toDate
  ? parseDay(toDate)
  : dates.length ? Math.max(...dates) : NaN;

  const validRange =
    Number.isFinite(start) && Number.isFinite(end) && end >= start;

  const cohortRuns = validRange
    ? datedRuns.filter((run) => run.time >= start && run.time <= end)
        .sort((a, b) => a.time - b.time || (a.id ?? "").localeCompare(b.id ?? ""))
    : [];
  const paceRuns = cohortRuns.filter((run): run is typeof run & { pace: number } =>
    run.pace !== null && Number.isFinite(run.pace) && run.pace > 0,
  );
  const paces = paceRuns.map((run) => run.pace);
  const statistics = rollingPaceStatistics(paces);
  const rolling = paceRuns.map((run, index) => ({ ...statistics[index], time: run.time }));
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = validRange && plotWidth > 0 && plotHeight > 0;

  // Include the final day and single-day selections
  const x = scaleUtc()
    .domain([new Date(start), new Date(end + DAY)])
    .range([margin.left, size.width - margin.right]);

  // Leave breathing room, including when every run has the same pace
  const minimum = paces.length ? Math.min(...paces) : 0;
  const maximum = paces.length ? Math.max(...paces) : 0;
  const padding = Math.max((maximum - minimum) * 0.1, 0.25);

  const y = scaleLinear()
    // Use a preview range until the selected cohort contains pace data.
    .domain(paces.length ? [Math.max(0, minimum - padding), maximum + padding] : [6, 14])
    .nice()
    .range([size.height - margin.bottom, margin.top]);

  const xTicks = ready
    ? x.ticks(Math.max(2, Math.floor(plotWidth / 100))).filter(
      (date) =>
        date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0,
    )
    : [];

  const yTicks = ready
    ? y.ticks(Math.max(2, Math.floor(plotHeight / 50)))
    : [];
  const medianPath = line<(typeof rolling)[number]>()
    .x((point) => x(new Date(point.time + DAY / 2))).y((point) => y(point.median))(rolling);
  const iqrPath = area<(typeof rolling)[number]>()
    .x((point) => x(new Date(point.time + DAY / 2)))
    .y0((point) => y(point.q1)).y1((point) => y(point.q3))(rolling);
  return (
    <div ref={containerRef} className="relative h-full min-h-64 w-full">
      {ready ? (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0 text-muted"
          role="group"
          aria-label="Pace consistency over time"
        >
          <desc>Each mark is a run. The line shows a rolling median over the latest ten selected runs, including the current run; early windows contain fewer runs. The shaded band spans the rolling 25th to 75th percentiles. Triangles mark runs beyond 1.5 times the interquartile range outside those quartiles, after at least four runs. Other runs are circles.</desc>
          <g fontSize={10} className="fill-muted">
            <circle cx={margin.left + 3} cy={9} r={3} className="fill-chart-berry" />
            <text x={margin.left + 11} y={13}>Runs</text>
            <line x1={margin.left + 48} x2={margin.left + 62} y1={9} y2={9} className="stroke-chart-teal" strokeWidth={2} />
            <text x={margin.left + 67} y={13}>Rolling median</text>
            <rect x={margin.left + 148} y={5} width={12} height={8} className="fill-chart-teal/15" />
            <text x={margin.left + 165} y={13}>IQR</text>
            <polygon points="0,-5 4,3 -4,3" transform={`translate(${margin.left + 202},9)`} className="fill-chart-orange stroke-chart-navy" strokeWidth={1.5} />
            <text x={margin.left + 211} y={13}>Outlier</text>
          </g>
          {iqrPath && (
            <path data-pace-band="true" d={iqrPath} className="fill-chart-teal/15" pointerEvents="none">
              <title>Rolling interquartile range: 25th–75th percentile of the latest 10 selected runs</title>
            </path>
          )}
          {medianPath && (
            <path data-pace-median="true" d={medianPath} fill="none" className="stroke-chart-teal" strokeWidth={2.5} pointerEvents="none">
              <title>Rolling median pace: latest 10 selected runs</title>
            </path>
          )}
          {rolling.length === 1 && <circle cx={x(new Date(rolling[0].time + DAY / 2))} cy={y(rolling[0].median)} r={7} fill="none" className="stroke-chart-teal" strokeWidth={2} pointerEvents="none" />}
          {paceRuns.map((run, index) => {
            const { outlier, q1, median, q3, count } = statistics[index];
            const Mark = outlier ? "polygon" : "circle";
            const markX = x(new Date(run.time + DAY / 2));
            const markY = y(run.pace);
            return (
            <Mark key={run.id ?? `${run.date}-${index}`}
              data-pace-run="true" data-outlier={outlier}
              data-rolling-median={median} data-rolling-q1={q1} data-rolling-q3={q3} data-window-count={count}
              role={onSelectRun ? "button" : undefined}
              tabIndex={onSelectRun ? 0 : undefined}
              aria-label={`View run details for ${run.date}, pace ${formatPace(run.pace)} min/mi`}
              aria-haspopup={onSelectRun ? "dialog" : undefined}
              onClick={() => onSelectRun?.(run)}
              onKeyDown={(event) => {
                if (onSelectRun && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelectRun(run);
                }
              }}
              {...(outlier ? { points: "0,-8 7,4 -7,4", transform: `translate(${markX},${markY})` } : { cx: markX, cy: markY, r: 4 })}
              className={`${outlier ? "fill-chart-orange stroke-chart-navy" : "fill-chart-berry stroke-surface"} ${onSelectRun ? "cursor-pointer hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" : ""}`}
              strokeWidth={outlier ? 2.5 : 1.5}>
              <title>{`${run.date.slice(2)} · ${formatPace(run.pace)} min/mi · Rolling median: ${formatPace(median)} · IQR: ${formatPace(q1)}–${formatPace(q3)} min/mi · ${count} runs${outlier ? " · Outlier: beyond 1.5×IQR fences" : ""}`}</title>
            </Mark>
            );
          })}
          {/* Horizontal axis */}
          <line
            x1={margin.left}
            x2={size.width - margin.right}
            y1={size.height - margin.bottom}
            y2={size.height - margin.bottom}
            stroke="currentColor" pointerEvents="none"
          />

          {xTicks.map((date) => (
            <g
              key={date.getTime()}
              transform={`translate(${x(date)}, ${size.height - margin.bottom})`}
            >
              <line y2={6} stroke="currentColor" pointerEvents="none" />
              <text y={22} textAnchor="middle" fill="currentColor" fontSize={11}>
                {date.toISOString().slice(2, 10)}
              </text>
            </g>
          ))}

          {/* Vertical axis */}
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={size.height - margin.bottom}
            stroke="currentColor" pointerEvents="none"
          />

          {yTicks.map((pace) => (
            <g key={pace} transform={`translate(${margin.left}, ${y(pace)})`}>
              <line x2={-6} stroke="currentColor" pointerEvents="none" />
              <text
                x={-8}
                dy="0.32em"
                textAnchor="end"
                fill="currentColor"
                fontSize={11}
              >
                {formatPace(pace)}
              </text>
            </g>
          ))}
          <text
            transform={`translate(10, ${margin.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="currentColor"
            fontSize={12}
          >
            Pace (min/mile)
          </text>

          {!paceRuns.length && (
            <text
              x={margin.left + plotWidth / 2}
              y={margin.top + plotHeight / 2}
              textAnchor="middle"
              fill="currentColor"
              fontSize={12}
            >
              No pace data in this period
            </text>
          )}
        </svg>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          {validRange ? "Waiting for container space" : "Select dates or supply run data"}
        </p>
      )}
    </div>
  );
}
