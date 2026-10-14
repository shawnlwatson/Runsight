"use client";

import { useEffect, useId, useRef, useState } from "react";
import IndividualRun from "@/components/charts/individualRun";
import type { CurrentRun } from "@/types/run";
import { formatNumber, formatPace, formatSpeed, formatTotalTime } from "@/lib/runFormatters";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const selectionStatusId = useId();
  const selectionLimitReached = checkedRunIds.length >= maxSelections;
  const sortedRuns = [...runs].sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!selectedRun || !dialog) return;
    if (!dialog.open) dialog.showModal();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedRun]);

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
        <table className={`w-full table-auto border-collapse [&_th]:border [&_th]:border-teal/15 [&_td]:border [&_td]:border-teal/15 ${compact
          ? "text-[10px] [&_th]:px-1.5 [&_th]:py-2 [&_td]:px-1.5 [&_td]:py-2"
          : "text-sm"}`}>
          <caption className="sr-only">Runs in the selected date range, newest first.</caption>
          <thead className="border-y border-teal/20 bg-teal/10 text-foreground">
            <tr>
              {onCheckedRunsChange && (
                <th scope="col" className="w-12 px-2 py-3 text-center font-semibold">Select</th>
              )}
              <th scope="col" aria-sort="descending" className="px-2 py-3 text-left font-semibold">Date ↓</th>
              <th scope="col" title="Hours:minutes:seconds" className="px-2 py-3 text-center font-semibold">Total Time</th>
              <th scope="col" title="Miles" className="px-2 py-3 text-center font-semibold">Distance (mi)</th>
              <th scope="col" title="Minutes per mile" className="px-2 py-3 text-center font-semibold">Pace (min/mi)</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Speed (MPH)</th>
              <th scope="col" title="Average heart rate in beats per minute" className="px-2 py-3 text-center font-semibold">Heart rate (bpm)</th>
              <th scope="col" title="Temperature in degrees Fahrenheit" className="px-2 py-3 text-center font-semibold">Temperature (°F)</th>
              <th scope="col" title="Feet" className="px-2 py-3 text-center font-semibold">Elevation (ft)</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {sortedRuns.map((run) => (
              <tr key={run.id} onClick={() => onSelectRun ? onSelectRun(run) : setSelectedRun(run)}
                className={`cursor-pointer transition-colors ${selectedRunId === run.id
                  ? "bg-gold/20 hover:bg-gold/30"
                  : "odd:bg-surface even:bg-teal/5 odd:hover:bg-surface-hover even:hover:bg-surface-hover"}`}>
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
              </tr>
            ))}
            {!sortedRuns.length && (
              <tr>
                <td colSpan={onCheckedRunsChange ? 9 : 8} className="px-2 py-12 text-center text-muted">
                  No runs in the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={() => setSelectedRun(null)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto h-[480px] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gold/40 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-navy/50 md:w-[33.333vw] md:min-w-80"
      >
        <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gold/30 bg-navy px-5 py-3">
            <h2 id={dialogTitleId} className="text-lg font-bold text-gold">Run Details</h2>
          <button type="button" aria-label="Close run details"
            onClick={() => dialogRef.current?.close()}
            className="-mr-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
              <path d="m6 6 12 12 M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {selectedRun && <IndividualRun run={selectedRun} />}
        </div>
        </div>
      </dialog>
    </div>
  );
}
