"use client";

import { useId, useMemo, useState } from "react";
import RunDetailsDialog from "@/components/RunDetailsDialog";
import ExcludeRunButton from "@/components/ExcludeRunButton";
import type { CurrentRun } from "@/types/run";
import { formatNumber, formatPace, formatSpeed, formatTotalTime } from "@/lib/runFormatters";
import { runSortColumns, sortRuns, type RunSort } from "@/lib/runSorting";

export type { CurrentRun } from "@/types/run";

type Props = {
  runs: readonly CurrentRun[];
  onSelectRun?: (run: CurrentRun) => void;
  selectedRunId?: string;
  compact?: boolean;
  checkedRunIds?: readonly string[];
  onCheckedRunsChange?: (ids: string[]) => void;
  maxSelections?: number;
};

export default function CurrentRunsList({
  runs, onSelectRun, selectedRunId, compact = false,
  checkedRunIds = [], onCheckedRunsChange, maxSelections = Infinity,
}: Props) {
  const [selectedRun, setSelectedRun] = useState<CurrentRun | null>(null);
  const [sort, setSort] = useState<RunSort>({ key: "date", direction: "descending" });
  const selectionStatusId = useId();
  const selectionLimitReached = checkedRunIds.length >= maxSelections;
  const sortedRuns = useMemo(() => sortRuns(runs, sort), [runs, sort]);

  return (
    <div className="min-w-0">
      <h2 className={`font-semibold text-foreground ${compact ? "px-4 py-3 text-sm" : "px-5 py-4 text-base"}`}>
        Runs in Selection
      </h2>
      {onCheckedRunsChange && (
        <p id={selectionStatusId} className="px-4 pb-3 text-xs text-muted" aria-live="polite">
          {checkedRunIds.length}{Number.isFinite(maxSelections) ? ` of ${maxSelections}` : ""} selected for comparison
          {selectionLimitReached && ". Uncheck a run to select another."}
        </p>
      )}
      <div className="overflow-x-auto rounded-b-lg">
        <table className={`w-full table-auto border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border ${compact
          ? "text-[10px] [&_th]:px-1.5 [&_th]:py-2 [&_td]:px-1.5 [&_td]:py-2"
          : "text-sm"}`}>
          <caption className="sr-only">Runs in the selected date range, sorted by {runSortColumns.find((column) => column.key === sort.key)?.label}, {sort.direction}. Click a column heading to change sorting. Missing values appear last.</caption>
          <thead className="border-y border-border bg-surface-muted text-foreground">
            <tr>
              {onCheckedRunsChange && (
                <th scope="col" className="w-12 px-2 py-3 text-center font-semibold">Select</th>
              )}
              {runSortColumns.map((column) => {
                const active = sort.key === column.key;
                const nextDirection = active && sort.direction === "ascending" ? "descending" : "ascending";
                return <th key={column.key} scope="col" aria-sort={active ? sort.direction : undefined}
                  className={`px-2 py-3 font-semibold ${column.key === "date" ? "text-left" : "text-center"}`}>
                  <button type="button" title={`${column.title}; sort ${nextDirection}`}
                    aria-label={`Sort by ${column.label} ${nextDirection}`}
                    onClick={() => setSort({ key: column.key, direction: nextDirection })}
                    className={`inline-flex w-full cursor-pointer items-center gap-1 rounded hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${column.key === "date" ? "justify-start" : "justify-center"}`}>
                    {column.label}
                    <span aria-hidden="true" className="shrink-0 text-muted">{active ? sort.direction === "ascending" ? "↑" : "↓" : "↕"}</span>
                  </button>
                </th>;
              })}
              <th scope="col" className="w-10"><span className="sr-only">Analysis actions</span></th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {sortedRuns.map((run) => (
              <tr key={run.id} onClick={() => onSelectRun ? onSelectRun(run) : setSelectedRun(run)}
                className={`cursor-pointer transition-colors ${selectedRunId === run.id
                  ? "bg-selection hover:bg-surface-hover"
                  : "odd:bg-surface even:bg-surface-muted odd:hover:bg-surface-hover even:hover:bg-surface-hover"}`}>
                {onCheckedRunsChange && (
                  <td className="px-2 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedRunIds.includes(run.id)}
                      disabled={selectionLimitReached && !checkedRunIds.includes(run.id)}
                      onChange={(event) => {
                        if (event.target.checked && selectionLimitReached) return;
                        onCheckedRunsChange(event.target.checked
                          ? [...checkedRunIds, run.id]
                          : checkedRunIds.filter((id) => id !== run.id));
                      }}
                      aria-describedby={selectionStatusId}
                      aria-label={`Select run on ${run.date} for comparison`}
                      className="h-4 w-4 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </td>
                )}
                <th scope="row" className="whitespace-nowrap px-2 py-3 text-left font-medium">
                  <button type="button" aria-haspopup={onSelectRun ? undefined : "dialog"}
                    aria-pressed={onSelectRun ? selectedRunId === run.id : undefined}
                    aria-label={`View run details for ${run.date}`}
                    className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    <time dateTime={run.date}>{run.date.slice(2)}</time>
                  </button>
                </th>
                <td className="px-2 py-3 text-center tabular-nums">{formatTotalTime(run.totalTimeSeconds)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatNumber(run.distanceMiles, 2)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatPace(run.pace)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatSpeed(run.pace)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatNumber(run.heartRate)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatNumber(run.temperature, 1)}</td>
                <td className="px-2 py-3 text-center tabular-nums">{formatNumber(run.elevationFeet)}</td>
                <td className="text-center"><ExcludeRunButton run={run} compact /></td>
              </tr>
            ))}
            {!sortedRuns.length && (
              <tr>
                <td colSpan={onCheckedRunsChange ? 10 : 9} className="px-2 py-12 text-center text-muted">
                  No runs in the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <RunDetailsDialog selectedRun={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}
