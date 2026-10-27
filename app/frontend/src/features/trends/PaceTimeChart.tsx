"use client";

import { useState } from "react";
import type { CurrentRun } from "@/types/run";
import RunDetailsDialog from "@/components/RunDetailsDialog";
import PaceTime from "@/components/charts/paceTime";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = {
  runs: CurrentRun[];
};

export default function PaceTimeChart({ runs }: Props) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  const [selectedRun, setSelectedRun] = useState<CurrentRun | null>(null);

  return (
    <div className="flex h-full flex-col">
      <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">
        Pace Consistency Over Time
      </h2>
      <div className="min-h-0 flex-1">
        <PaceTime runs={analysisRuns} fromDate={fromDate} toDate={toDate} onSelectRun={setSelectedRun} />
      </div>
      <p className="shrink-0 px-4 pb-3 text-xs leading-5 text-muted">
        Rolling median: latest 10 selected runs (fewer at the start) · Band: 25th–75th percentile · Triangles: beyond 1.5×IQR fences (at least 4 runs)
      </p>
      <RunDetailsDialog selectedRun={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}
