"use client";

import { useState } from "react";
import CurrentRunsList from "@/components/charts/CurrentRunsList";
import IndividualRun from "@/components/charts/individualRun";
import RunRadar from "@/components/charts/runRadar";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import type { CurrentRun } from "@/types/run";

type Props = { runs: readonly CurrentRun[] };
const MAX_RADAR_RUNS = 8;

export default function RunsBrowser({ runs }: Props) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [checkedRunIds, setCheckedRunIds] = useState<string[]>([]);
  const selectedRuns = analysisRuns.filter((run) =>
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate),
  ).sort((a, b) => b.date.localeCompare(a.date));
  // Pick the newest visible run when the previous selection is filtered out.
  const selectedRun = selectedRuns.find((run) => run.id === selectedRunId) ?? selectedRuns[0] ?? null;
  const visibleCheckedIds = selectedRuns.filter((run) => checkedRunIds.includes(run.id)).map((run) => run.id);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="flex h-[640px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <h2 className="shrink-0 border-b border-border bg-surface-muted px-5 py-4 text-base font-semibold text-foreground">
          Run Details
        </h2>
        <div className="min-h-0 flex-1">
          {selectedRun ? (
            <IndividualRun key={selectedRun.id} run={selectedRun} />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
              No runs in the selected period. Adjust the dates to explore a run.
            </p>
          )}
        </div>
      </div>
      <div
        aria-label="Run radar comparison"
        className="h-[640px] min-w-0 overflow-hidden rounded-xl border border-border border-t-2 border-t-accent/30 bg-surface-muted"
      >
        <RunRadar
          runs={selectedRuns.filter((run) => checkedRunIds.includes(run.id))}
          referenceRuns={selectedRuns}
        />
      </div>
      </div>
      <div className="min-h-64 min-w-0 overflow-hidden rounded-xl border border-border border-t-2 border-t-accent/30 bg-surface">
        <CurrentRunsList
          compact
          runs={selectedRuns}
          selectedRunId={selectedRun?.id}
          onSelectRun={(run) => setSelectedRunId(run.id)}
          checkedRunIds={visibleCheckedIds}
          maxSelections={MAX_RADAR_RUNS}
          onCheckedRunsChange={(ids) => setCheckedRunIds([...new Set(ids)].slice(0, MAX_RADAR_RUNS))}
        />
      </div>
    </div>
  );
}
