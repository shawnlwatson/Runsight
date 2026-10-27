"use client";

import { useId, useState } from "react";
import { arc } from "d3-shape";
import RunRadar from "@/components/charts/runRadar";
import { customViewAttributes, rankAttributeRuns } from "@/lib/charts/customViewAttributes";
import { formatNumber, formatPace, formatTotalTime } from "@/lib/runFormatters";
import type { CurrentRun } from "@/types/run";

type Props = { runs: readonly CurrentRun[]; fromDate?: string; toDate?: string };
const MAX_SELECTIONS = 8;
const GLYPH_RADIUS = 33;
const radialBar = arc().cornerRadius(2);

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export default function Outliers({ runs, fromDate = "", toDate = "" }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const statusId = useId();
  const start = fromDate ? parseDay(fromDate) : -Infinity;
  const end = toDate ? parseDay(toDate) : Infinity;
  const cohort = runs.filter((run) => {
    const time = parseDay(run.date);
    return Number.isFinite(time) && time >= start && time <= end;
  });
  const rankings = customViewAttributes.map(({ metric }) => ({ metric, ...rankAttributeRuns(cohort, metric) }));
  const eligibleIds = new Set(rankings.flatMap(({ highest, lowest }) => [...highest, ...lowest].map(({ run }) => run.id)));
  const visibleSelectedIds = selectedIds.filter((id) => eligibleIds.has(id));
  const selectedRuns = visibleSelectedIds.map((id) => cohort.find((run) => run.id === id)!);
  const atLimit = selectedRuns.length >= MAX_SELECTIONS;

  return (
    <div className="min-w-0">
      <header className="px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Attribute Outliers</h2>
        <p className="mt-1 text-xs leading-5 text-muted">The three highest and three lowest values per attribute in the selected dates. Highest and lowest describe numeric values, not better or worse performance. Radial bars on the upper half show highest values; bars on the lower half show lowest values. Bar length indicates rank, not magnitude. Small selections may show a run in both groups.</p>
      </header>
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[2fr_3fr]">
        <div className="flex h-[640px] min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-y border-border bg-surface-muted px-4 py-3">
            <p id={statusId} aria-live="polite" className="text-[10px] text-muted">
              {selectedRuns.length} of {MAX_SELECTIONS} runs selected{atLimit ? ". Deselect a run to select another." : ""}
            </p>
            <button type="button" onClick={() => setSelectedIds([])} disabled={!selectedRuns.length}
              className="cursor-pointer rounded px-2 py-1 text-[10px] font-semibold text-brand hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">Clear selection</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 text-[10px] leading-4">
            <p className="mb-3 text-center text-muted">Upper half: highest 1–3 · Lower half: lowest 1–3 · Click a bar to compare</p>
            {!eligibleIds.size && <p className="py-8 text-center text-muted">No attribute values in this period.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {rankings.map(({ metric, highest, lowest }) => (
                <section key={metric.key} aria-label={`${metric.label} extremes`} className="min-w-0 rounded-lg border border-border bg-surface-muted">
                  <svg viewBox="0 0 160 236" className="block w-full" role="group" aria-label={`${metric.label} outlier glyph`}>
                    {([{ direction: "highest", entries: highest }, { direction: "lowest", entries: lowest }] as const).map(({ direction, entries }) => (
                      <g key={direction}>
                        {entries.map(({ run, value }, rank) => {
                          const selected = visibleSelectedIds.includes(run.id);
                          const disabled = atLimit && !selected;
                          const formatted = metric.format === "time" ? formatTotalTime(value) : metric.format === "pace" ? formatPace(value) : formatNumber(value, 1);
                          const length = [42, 31, 20][rank];
                          const angle = (direction === "highest" ? [0, -60, 60] : [180, 120, 240])[rank] * Math.PI / 180;
                          const barPath = radialBar({ innerRadius: GLYPH_RADIUS, outerRadius: GLYPH_RADIUS + length,
                            startAngle: angle - Math.PI / 24, endAngle: angle + Math.PI / 24 });
                          const description = `${metric.label}, ${direction} #${rank + 1}: ${run.date}, ${formatted} ${metric.unit}`;
                          const toggle = () => {
                            if (disabled) return;
                            setSelectedIds(selected ? visibleSelectedIds.filter((id) => id !== run.id) : [...visibleSelectedIds, run.id]);
                          };
                          return (
                            <path key={run.id} data-outlier-bar={direction} data-run-id={run.id} data-rank={rank + 1}
                              d={barPath ?? undefined} transform="translate(80,114)"
                              role="button" tabIndex={disabled ? -1 : 0} aria-pressed={selected} aria-disabled={disabled}
                              aria-describedby={statusId} aria-label={description}
                              onClick={toggle} onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  toggle();
                                }
                              }}
                              className={`${selected ? "fill-chart-gold stroke-chart-navy" : direction === "highest" ? "fill-chart-teal stroke-surface" : "fill-chart-berry stroke-surface"} ${disabled ? "opacity-30" : "cursor-pointer hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"}`}
                              strokeWidth={selected ? 2.5 : 1}>
                              <title>{`${description}${selected ? " · Selected; click to remove" : " · Click to compare"}`}</title>
                            </path>
                          );
                        })}
                      </g>
                    ))}
                    <circle cx={80} cy={114} r={33} className="fill-surface stroke-chart-teal/40" strokeWidth={1.5} />
                    <text x={80} y={metric.label.includes(" ") ? 111 : 117} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-brand" pointerEvents="none">
                      {metric.label.split(" ").map((word, index) => <tspan key={index} x={80} dy={index === 0 ? 0 : 12}>{word}</tspan>)}
                    </text>
                    <text x={80} y={228} textAnchor="middle" fontSize={10} className="fill-muted">{metric.unit}</text>
                    {!highest.length && <text x={80} y={55} textAnchor="middle" fontSize={10} className="fill-muted">No values</text>}
                  </svg>
                </section>
              ))}
            </div>
          </div>
        </div>
        <div className="h-[640px] min-w-0">
          <RunRadar runs={selectedRuns} referenceRuns={cohort} emptyMessage="Select outlier bars to compare runs." />
        </div>
      </div>
    </div>
  );
}
