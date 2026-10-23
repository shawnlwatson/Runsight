"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";

type Run = {
  date: string; // Calendar date: YYYY-MM-DD
  id?: string;
  pace: number | null; // Pace in minutes per mile
  distanceMiles?: number | null;
};

type Props = {
  runs: Run[];
  fromDate: string;
  toDate: string;
};

const DAY = 86_400_000; // Number of milliseconds in a day
const margin = { top: 24, right: 56, bottom: 36, left: 56 };

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

export default function DistanceTimePace({
  runs,
  fromDate,
  toDate,
}: Props) {
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
  const distanceRuns = cohortRuns.filter((run): run is typeof run & { distanceMiles: number } =>
    typeof run.distanceMiles === "number" && Number.isFinite(run.distanceMiles) && run.distanceMiles >= 0,
  );
  const paces = paceRuns.map((run) => run.pace);
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
  const distanceMax = distanceRuns.reduce((maximum, run) => Math.max(maximum, run.distanceMiles), 0);
  const distanceY = scaleLinear().domain([0, distanceMax > 0 ? distanceMax * 1.1 : 6])
    .nice().range([size.height - margin.bottom, margin.top]);
  const distanceTicks = ready ? distanceY.ticks(Math.max(2, Math.floor(plotHeight / 50))) : [];
  const distancePath = line<(typeof distanceRuns)[number]>()
    .x((run) => x(new Date(run.time + DAY / 2)))
    .y((run) => distanceY(run.distanceMiles))(distanceRuns);
  const pacePath = line<(typeof paceRuns)[number]>()
    .x((run) => x(new Date(run.time + DAY / 2)))
    .y((run) => y(run.pace))(paceRuns);

  return (
    <div ref={containerRef} className="relative h-full min-h-64 w-full">
      {ready ? (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0 text-muted"
          role="img"
          aria-label="Distance and pace lines over time"
        >
          <g fontSize={10} className="fill-muted">
            <line x1={margin.left} x2={margin.left + 10} y1={9} y2={9} className="stroke-chart-gold" strokeWidth={2} />
            <text x={margin.left + 15} y={13}>Distance</text>
            <line x1={margin.left + 80} x2={margin.left + 94} y1={9} y2={9} className="stroke-chart-berry" strokeWidth={2} />
            <text x={margin.left + 100} y={13}>Pace</text>
          </g>
          <path d={distancePath ?? undefined} fill="none" className="stroke-chart-gold" strokeWidth={2} />
          {distanceRuns.map((run, index) => (
            <circle key={run.id ?? `${run.date}-${index}`}
              cx={x(new Date(run.time + DAY / 2))} cy={distanceY(run.distanceMiles)} r={4}
              className="fill-chart-gold stroke-surface" strokeWidth={1.5}>
              <title>{`${run.date.slice(2)} · ${run.distanceMiles} miles`}</title>
            </circle>
          ))}
          <path d={pacePath ?? undefined} fill="none" className="stroke-chart-berry" strokeWidth={2} />
          {paceRuns.map((run, index) => (
            <circle key={run.id ?? `${run.date}-${index}`}
              cx={x(new Date(run.time + DAY / 2))} cy={y(run.pace)} r={4}
              className="fill-chart-berry stroke-surface" strokeWidth={1.5}>
              <title>{`${run.date.slice(2)} · ${formatPace(run.pace)} min/mi`}</title>
            </circle>
          ))}
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
          <line x1={size.width - margin.right} x2={size.width - margin.right}
            y1={margin.top} y2={size.height - margin.bottom} stroke="currentColor" />
          {distanceTicks.map((distance) => (
            <g key={distance} transform={`translate(${size.width - margin.right}, ${distanceY(distance)})`}>
              <line x2={5} stroke="currentColor" />
              <text x={8} dy="0.32em" fill="currentColor" fontSize={11}>{distance}</text>
            </g>
          ))}
          <text transform={`translate(${size.width - 10}, ${margin.top + plotHeight / 2}) rotate(90)`}
            textAnchor="middle" fill="currentColor" fontSize={12}>Distance (mi)</text>

          <text
            transform={`translate(10, ${margin.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="currentColor"
            fontSize={12}
          >
            Pace (min/mile)
          </text>

          {!paceRuns.length && !distanceRuns.length && (
            <text
              x={margin.left + plotWidth / 2}
              y={margin.top + plotHeight / 2}
              textAnchor="middle"
              fill="currentColor"
              fontSize={12}
            >
              No run data in this period
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
