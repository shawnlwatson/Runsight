"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { isPaceOutlier, paceStatistics } from "@/lib/charts/paceStatistics";

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
        .sort((a, b) => a.time - b.time)
    : [];
  const paceRuns = cohortRuns.filter((run): run is typeof run & { pace: number } =>
    run.pace !== null && Number.isFinite(run.pace) && run.pace > 0,
  );
  const paces = paceRuns.map((run) => run.pace);
  // Every visible run contributes equally, rather than weighting by distance.
  const statistics = paceStatistics(paces);
  const meanPace = statistics.mean;
  const spread = statistics.standardDeviation;
  const bandLow = meanPace !== null && spread !== null ? Math.max(0, meanPace - spread) : null;
  const bandHigh = meanPace !== null && spread !== null ? meanPace + spread : null;
  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = validRange && plotWidth > 0 && plotHeight > 0;

  // Include the final day and single-day selections
  const x = scaleUtc()
    .domain([new Date(start), new Date(end + DAY)])
    .range([margin.left, size.width - margin.right]);

  // Leave breathing room, including when every run has the same pace
  const minimum = paces.length ? Math.min(...paces, bandLow ?? Infinity) : 0;
  const maximum = paces.length ? Math.max(...paces, bandHigh ?? -Infinity) : 0;
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
  return (
    <div ref={containerRef} className="relative h-full min-h-64 w-full">
      {ready ? (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0 text-muted"
          role="group"
          aria-label="Pace over time"
        >
          <desc>Each point is a run. The horizontal line shows mean pace for the selected period. The shaded band extends one sample standard deviation above and below the mean. Larger outlined points are more than two standard deviations from the mean.</desc>
          <g fontSize={10} className="fill-muted">
            <circle cx={margin.left + 3} cy={9} r={3} className="fill-chart-berry" />
            <text x={margin.left + 11} y={13}>Runs</text>
            <line x1={margin.left + 48} x2={margin.left + 62} y1={9} y2={9} className="stroke-chart-teal" strokeWidth={2} />
            <text x={margin.left + 67} y={13}>Mean</text>
            <rect x={margin.left + 106} y={5} width={12} height={8} className="fill-chart-teal/15" />
            <text x={margin.left + 123} y={13}>±1 SD</text>
            <circle cx={margin.left + 174} cy={9} r={4} className="fill-chart-orange stroke-chart-navy" strokeWidth={2} />
            <text x={margin.left + 183} y={13}>Outlier</text>
          </g>
          {bandLow !== null && bandHigh !== null && spread !== null && spread > 0 && (
            <rect data-pace-band="true" x={margin.left} y={y(bandHigh)}
              width={plotWidth} height={y(bandLow) - y(bandHigh)} className="fill-chart-teal/15">
              <title>{`Mean ±1 sample SD: ${formatPace(bandLow)}–${formatPace(bandHigh)} min/mi`}</title>
            </rect>
          )}
          {meanPace !== null && (
            <line data-pace-mean="true" x1={margin.left} x2={size.width - margin.right}
              y1={y(meanPace)} y2={y(meanPace)} className="stroke-chart-teal" strokeWidth={2} strokeDasharray="6 3">
              <title>{`Mean pace: ${formatPace(meanPace)} min/mi across ${statistics.count} runs`}</title>
            </line>
          )}
          {paceRuns.map((run, index) => {
            const outlier = isPaceOutlier(run.pace, statistics);
            return (
            <circle key={run.id ?? `${run.date}-${index}`}
              data-pace-run="true" data-outlier={outlier}
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
              cx={x(new Date(run.time + DAY / 2))} cy={y(run.pace)} r={outlier ? 6.5 : 4}
              className={`${outlier ? "fill-chart-orange stroke-chart-navy" : "fill-chart-berry stroke-surface"} ${onSelectRun ? "cursor-pointer hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" : ""}`}
              strokeWidth={outlier ? 2.5 : 1.5}>
              <title>{`${run.date.slice(2)} · ${formatPace(run.pace)} min/mi${outlier ? " · Outlier: more than 2 SD from the mean" : ""}`}</title>
            </circle>
            );
          })}
          {/* Horizontal axis */}
          <line
            x1={margin.left}
            x2={size.width - margin.right}
            y1={size.height - margin.bottom}
            y2={size.height - margin.bottom}
            stroke="currentColor"
          />

          {xTicks.map((date) => (
            <g
              key={date.getTime()}
              transform={`translate(${x(date)}, ${size.height - margin.bottom})`}
            >
              <line y2={6} stroke="currentColor" />
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
            stroke="currentColor"
          />

          {yTicks.map((pace) => (
            <g key={pace} transform={`translate(${margin.left}, ${y(pace)})`}>
              <line x2={-6} stroke="currentColor" />
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
