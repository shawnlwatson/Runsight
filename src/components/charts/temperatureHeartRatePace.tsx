"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateOrRd } from "d3-scale-chromatic";

export type TemperatureHeartRatePaceRun = {
  id: string;
  date: string; // Workout calendar date, YYYY-MM-DD.
  pace: number | null; // Decimal minutes per mile.
  heartRate: number | null; // Average beats per minute.
  temperature: number | null; // Degrees Fahrenheit.
};

type Props = {
  runs: readonly TemperatureHeartRatePaceRun[];
  title?: string;
};

type CompleteRun = TemperatureHeartRatePaceRun & {
  pace: number;
  heartRate: number;
  temperature: number;
};

function domain(values: number[], fallback: [number, number], minimumPadding: number): [number, number] {
  if (!values.length) return fallback;
  const minimum = values.reduce((a, b) => Math.min(a, b));
  const maximum = values.reduce((a, b) => Math.max(a, b));
  const padding = Math.max((maximum - minimum) * 0.08, minimumPadding);
  return [minimum - padding, maximum + padding];
}

function formatPace(pace: number) {
  const seconds = Math.round(pace * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const margin = { top: 16, right: 24, bottom: 46, left: 56 };

export default function TemperatureHeartRatePace({ runs, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const points = runs.filter((run): run is CompleteRun =>
    run.pace !== null && Number.isFinite(run.pace) && run.pace > 0 &&
    run.heartRate !== null && Number.isFinite(run.heartRate) && run.heartRate > 0 &&
    run.temperature !== null && Number.isFinite(run.temperature),
  );
  const paceDomain = domain(points.map((run) => run.pace), [6, 14], 0.25);
  const heartRateDomain = domain(points.map((run) => run.heartRate), [100, 190], 5);
  paceDomain[0] = Math.max(0, paceDomain[0]);
  heartRateDomain[0] = Math.max(0, heartRateDomain[0]);

  const temperatures = points.map((run) => run.temperature);
  let temperatureDomain: [number, number] = [30, 90];
  if (temperatures.length) {
    const low = temperatures.reduce((a, b) => Math.min(a, b));
    const high = temperatures.reduce((a, b) => Math.max(a, b));
    temperatureDomain = low === high ? [low - 1, high + 1] : [low, high];
  }

  const plotWidth = size.width - margin.left - margin.right;
  const plotHeight = size.height - margin.top - margin.bottom;
  const ready = plotWidth > 0 && plotHeight > 0;
  const x = scaleLinear().domain(paceDomain).nice().range([margin.left, size.width - margin.right]);
  const y = scaleLinear().domain(heartRateDomain).nice().range([size.height - margin.bottom, margin.top]);
  const color = scaleSequential(interpolateOrRd).domain(temperatureDomain).clamp(true);
  const xTicks = ready ? x.ticks(Math.max(2, Math.floor(plotWidth / 65))) : [];
  const yTicks = ready ? y.ticks(Math.max(2, Math.floor(plotHeight / 40))) : [];
  const legendGradient = `linear-gradient(to right, ${Array.from({ length: 21 }, (_, index) =>
    `${interpolateOrRd(index / 20)} ${index * 5}%`,
  ).join(", ")})`;

  return (
    <div className="flex h-full min-h-64 w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3">
        {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
        <div className="ml-auto w-36 shrink-0 text-muted">
          <p className="text-center text-[11px] leading-4">
            Temperature (°F){!points.length ? " · preview" : ""}
          </p>
          <div className="mt-1 h-2 rounded-sm border border-muted/50"
            style={{ background: legendGradient }} />
          <div className="mt-0.5 flex justify-between text-[10px] leading-3">
            <span>{temperatureDomain[0].toFixed(0)}°</span>
            <span>{temperatureDomain[1].toFixed(0)}°</span>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
      {ready && (
        <svg width={size.width} height={size.height} className="absolute inset-0 text-muted" role="img"
          aria-label={`Pace versus heart rate, colored by temperature. ${points.length} runs.`}>
          <desc>Each point represents one run. Lighter orange means cooler, and darker red means warmer. Axes fit the supplied runs.</desc>
          {yTicks.map((heartRate) => (
            <g key={heartRate} transform={`translate(${margin.left}, ${y(heartRate)})`}>
              <line x2={plotWidth} className="stroke-border" />
              <line x2={-5} stroke="currentColor" />
              <text x={-8} dy="0.32em" textAnchor="end" fill="currentColor" fontSize={11}>{heartRate}</text>
            </g>
          ))}
          <path d={`M${margin.left},${margin.top}V${size.height - margin.bottom}H${size.width - margin.right}`}
            fill="none" stroke="currentColor" />
          {xTicks.map((pace) => (
            <g key={pace} transform={`translate(${x(pace)}, ${size.height - margin.bottom})`}>
              <line y2={5} stroke="currentColor" />
              <text y={20} textAnchor="middle" fill="currentColor" fontSize={11}>{formatPace(pace)}</text>
            </g>
          ))}

          {points.map((run) => (
            <circle key={run.id} cx={x(run.pace)} cy={y(run.heartRate)} r={5}
              fill={color(run.temperature)} fillOpacity={0.9} tabIndex={0}
              className="stroke-brand stroke-1 focus:stroke-berry focus:stroke-2 focus:outline-none"
              aria-label={`${run.date}, pace ${formatPace(run.pace)} per mile, heart rate ${run.heartRate} bpm, temperature ${run.temperature} degrees Fahrenheit`}>
              <title>{`${run.date.slice(2)} · ${formatPace(run.pace)} min/mi · ${run.heartRate} bpm · ${run.temperature}°F`}</title>
            </circle>
          ))}
          <text x={margin.left + plotWidth / 2} y={size.height - 7} textAnchor="middle" fill="currentColor" fontSize={12}>
            Pace (min/mile)
          </text>
          <text transform={`translate(13, ${margin.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle" fill="currentColor" fontSize={12}>Heart rate (bpm)</text>
          {!points.length && (
            <text x={margin.left + plotWidth / 2} y={margin.top + plotHeight / 2}
              textAnchor="middle" fill="currentColor" fontSize={12}>No matching run data</text>
          )}
        </svg>
      )}
      </div>
    </div>
  );
}
