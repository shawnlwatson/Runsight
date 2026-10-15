"use client";

import { useId, useState } from "react";
import RunRadar from "@/components/charts/runRadar";
import { customViewAttributes, rankAttributeRuns } from "@/lib/charts/customViewAttributes";
import { formatNumber, formatPace, formatTotalTime } from "@/lib/runFormatters";
import type { CurrentRun } from "@/types/run";

type Props = { runs: readonly CurrentRun[]; fromDate?: string; toDate?: string };
const MAX_SELECTIONS = 8;

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
        <p className="mt-1 text-xs leading-5 text-muted">The three highest and three lowest values per attribute in the selected dates. Highest and lowest describe numeric values, not better or worse performance. Small selections may show a run in both lists.</p>
      </header>
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[2fr_3fr]">
        <div className="flex h-[640px] min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-y border-border bg-teal/5 px-4 py-3">
            <p id={statusId} aria-live="polite" className="text-[10px] text-muted">
              {selectedRuns.length} of {MAX_SELECTIONS} runs selected{atLimit ? ". Uncheck a run to select another." : ""}
            </p>
            <button type="button" onClick={() => setSelectedIds([])} disabled={!selectedRuns.length}
              className="cursor-pointer rounded px-2 py-1 text-[10px] font-semibold text-brand hover:bg-gold/20 disabled:cursor-default disabled:opacity-40">Clear selection</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 text-[10px] leading-4">
            {!eligibleIds.size && <p className="py-8 text-center text-muted">No attribute values in this period.</p>}
            {rankings.map(({ metric, highest, lowest }) => <section key={metric.key} aria-label={`${metric.label} extremes`} className="border-b border-border py-3">
              <h3 className="mb-2 font-bold text-brand">{metric.label} ({metric.unit})</h3>
              <div className="grid grid-cols-2 gap-3">
                {([{ label: "Highest 3", entries: highest }, { label: "Lowest 3", entries: lowest }]).map(({ label, entries }) => <div key={label}>
                  <h4 className="mb-1 font-semibold text-muted">{label}</h4>
                  <ul className="space-y-1">
                    {entries.map(({ run, value }) => {
                      const checked = visibleSelectedIds.includes(run.id);
                      const formatted = metric.format === "time" ? formatTotalTime(value) : metric.format === "pace" ? formatPace(value) : formatNumber(value, 1);
                      return <li key={run.id}>
                        <label className={`flex items-center gap-1.5 rounded px-1 py-1 ${checked ? "bg-gold/20" : "hover:bg-teal/5"} ${atLimit && !checked ? "opacity-40" : "cursor-pointer"}`}>
                          <input type="checkbox" checked={checked} disabled={atLimit && !checked} aria-describedby={statusId}
                            aria-label={`Select ${run.date}, ${metric.label}: ${formatted} ${metric.unit}, ${label}`}
                            onChange={(event) => {
                              if (event.target.checked && atLimit) return;
                              setSelectedIds(event.target.checked ? [...visibleSelectedIds, run.id] : visibleSelectedIds.filter((id) => id !== run.id));
                            }} className="h-3 w-3 shrink-0 accent-brand" />
                          <time dateTime={run.date} className="shrink-0">{run.date.slice(2)}</time>
                          <span className="ml-auto text-right tabular-nums">{formatted}</span>
                        </label>
                      </li>;
                    })}
                  </ul>
                  {!entries.length && <p className="text-muted">No values</p>}
                </div>)}
              </div>
            </section>)}
          </div>
        </div>
        <div className="h-[640px] min-w-0">
          <RunRadar runs={selectedRuns} referenceRuns={cohort} emptyMessage="Select runs from the list to compare." />
        </div>
      </div>
    </div>
  );
}
