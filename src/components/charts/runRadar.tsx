"use client";

import { useEffect, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { curveLinear, curveLinearClosed, lineRadial } from "d3-shape";
import { radarAngle, radarDomain, radarMetrics, radarValue } from "@/lib/charts/radarMetrics";
import { formatNumber, formatPace, formatTotalTime } from "@/lib/runFormatters";
import type { CurrentRun } from "@/types/run";

type Props = {
  runs: readonly CurrentRun[];
  referenceRuns?: readonly CurrentRun[];
};

type RadarPoint = { angle: number; radius: number; value: number | null };
const colors = ["var(--color-teal)", "var(--color-berry)", "var(--color-orange)", "var(--color-navy)", "var(--color-gold)"];
const dashPatterns = [undefined, "7 3", "2 3", "9 3 2 3", "12 4"];
const levels = [0.25, 0.5, 0.75, 1];

function formatMetric(value: number | null, index: number) {
  const metric = radarMetrics[index];
  if (metric.format === "time") return formatTotalTime(value);
  if (metric.format === "pace") return formatPace(value);
  return formatNumber(value, 1);
}

export default function RunRadar({ runs, referenceRuns = runs }: Props) {
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

  // Use the whole date cohort so checking another run does not change the axes.
  const scales = radarMetrics.map((metric) =>
    scaleLinear().domain(radarDomain(referenceRuns, metric)).nice(4).range([0, 1]).clamp(true),
  );
  const radius = Math.max(0, Math.min((size.width - 180) / 2, (size.height - 72) / 2));
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  const ring = lineRadial<number>().angle((_, index) => radarAngle(index)).radius((value) => value).curve(curveLinearClosed);
  const series = runs.map((run, runIndex) => {
    const points = radarMetrics.map((metric, index) => {
      const value = radarValue(run, metric);
      return { angle: radarAngle(index), radius: value === null ? 0 : scales[index](value) * radius, value };
    });
    const complete = points.every((point) => point.value !== null);
    const line = lineRadial<RadarPoint>()
      .angle((point) => point.angle).radius((point) => point.radius)
      .defined((point) => point.value !== null)
      .curve(complete ? curveLinearClosed : curveLinear);
    return {
      run, points, complete,
      path: line(complete ? points : [...points, points[0]]),
      color: colors[runIndex % colors.length],
      dash: dashPatterns[Math.floor(runIndex / colors.length) % dashPatterns.length],
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pt-4">
        <h2 className="text-base font-semibold text-foreground">Run Comparison</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Each spoke has its own scale. Outward means a larger value, not a better result.
        </p>
      </header>
      {series.length > 0 && (
        <ul aria-label="Compared runs" className="mt-3 flex max-h-20 shrink-0 flex-wrap gap-x-4 gap-y-2 overflow-y-auto px-5 text-xs">
          {series.map(({ run, color, dash }) => (
            <li key={run.id} className="flex items-center gap-2">
              <svg width="20" height="8" aria-hidden="true">
                <line x2="20" y1="4" y2="4" stroke={color} strokeWidth="3" strokeDasharray={dash} />
              </svg>
              <time dateTime={run.date}>{run.date.slice(2)}</time>
            </li>
          ))}
        </ul>
      )}
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {radius > 0 && (
          <svg width={size.width} height={size.height} className="absolute inset-0" role="img"
            aria-label={`Radar chart comparing ${runs.length} selected runs across ten attributes`}>
            <desc>Total time begins at 12:00. Attributes continue clockwise. Missing values leave gaps. Actual values are available in the comparison table below.</desc>
            <g transform={`translate(${centerX}, ${centerY})`}>
              {levels.map((level) => (
                <g key={level}>
                  <path d={ring(radarMetrics.map(() => radius * level)) ?? undefined}
                    className="stroke-teal/20" fill="none" />
                  <text x={5} y={-radius * level + 11} fontSize={9} className="fill-muted">{level * 100}%</text>
                </g>
              ))}
              {radarMetrics.map((metric, index) => {
                const angle = radarAngle(index);
                const sin = Math.sin(angle);
                const cos = Math.cos(angle);
                const labelRadius = radius + 20;
                return (
                  <g key={metric.key}>
                    <line x2={sin * radius} y2={-cos * radius} className="stroke-teal/25" />
                    <text x={sin * labelRadius} y={-cos * labelRadius}
                      textAnchor={sin > 0.1 ? "start" : sin < -0.1 ? "end" : "middle"}
                      fontSize={11} className="fill-foreground">
                      <tspan fontWeight={600}>{metric.label}</tspan>
                      <tspan x={sin * labelRadius} dy={13} fontSize={10} className="fill-muted">{metric.unit}</tspan>
                      <title>{`${metric.label}: ${formatMetric(scales[index].domain()[0], index)} to ${formatMetric(scales[index].domain()[1], index)} ${metric.unit}`}</title>
                    </text>
                  </g>
                );
              })}
              {series.map(({ run, points, complete, path, color, dash }) => (
                <g key={run.id}>
                  <path d={path ?? undefined} stroke={color} strokeWidth={2} strokeDasharray={dash}
                    fill={complete ? color : "none"} fillOpacity={0.1} />
                  {points.map((point, index) => point.value !== null && (
                    <circle key={radarMetrics[index].key} cx={Math.sin(point.angle) * point.radius}
                      cy={-Math.cos(point.angle) * point.radius} r={4} fill={color}
                      className="stroke-surface" strokeWidth={1.5}>
                      <title>{`${run.date.slice(2)} · ${radarMetrics[index].label}: ${formatMetric(point.value, index)} ${radarMetrics[index].unit}`}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </g>
          </svg>
        )}
        {!runs.length && (
          <p className="absolute inset-0 flex items-center justify-center px-20 text-center text-sm text-brand">
            Select one or more runs below to compare.
          </p>
        )}
      </div>
      <details className="max-h-44 shrink-0 overflow-auto border-t border-orange/20 px-5 py-3 text-xs">
        <summary className="cursor-pointer font-medium text-brand">View values and scale details</summary>
        <p className="my-2 text-muted">Scales use runs in the current date range. Missing values appear as — and leave gaps in the chart.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Selected run values and the outer limit for each spoke.</caption>
            <thead><tr><th scope="col" className="p-1">Attribute</th><th scope="col" className="p-1">Outer limit</th>
              {runs.map((run) => <th scope="col" key={run.id} className="p-1">{run.date.slice(2)}</th>)}
            </tr></thead>
            <tbody>{radarMetrics.map((metric, index) => (
              <tr key={metric.key} className="border-t border-border">
                <th scope="row" className="p-1 font-medium">{metric.label} ({metric.unit})</th>
                <td className="p-1">{formatMetric(scales[index].domain()[1], index)}</td>
                {runs.map((run) => <td key={run.id} className="p-1">{formatMetric(radarValue(run, metric), index)}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
